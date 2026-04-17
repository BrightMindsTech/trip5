import { Config } from './config';

/** Prefer Supabase Edge Functions when project URL + anon key are configured. */
function useEdgeFunctions() {
  return Boolean(Config.edgeFunctionsBaseURL && Config.supabaseAnonKey);
}

function serviceHeaders(accessToken, withJsonBody) {
  const h = {
    ...(withJsonBody ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  if (useEdgeFunctions()) {
    h.apikey = Config.supabaseAnonKey;
  }
  return h;
}

function ordersUrl() {
  return useEdgeFunctions() ? `${Config.edgeFunctionsBaseURL}/orders` : `${Config.apiBaseURL}/api/orders`;
}

function driverOrdersUrl() {
  return useEdgeFunctions()
    ? `${Config.edgeFunctionsBaseURL}/driver-orders`
    : `${Config.apiBaseURL}/api/driver-orders`;
}

function apiHintBase() {
  return useEdgeFunctions() ? Config.edgeFunctionsBaseURL : Config.apiBaseURL;
}

export async function submitOrder(order, accessToken) {
  const url = ordersUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: serviceHeaders(accessToken, true),
      body: JSON.stringify(order),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const parts = [data.error, data.message, data.detail].filter(Boolean);
      const fromBody = parts.length ? parts.join(' — ') : '';
      const gatewayHint =
        response.status >= 502 && response.status <= 504
          ? ' Gateway error: open Supabase → Edge Functions → orders → Logs, or redeploy: supabase functions deploy orders.'
          : '';
      const msg =
        response.status === 401
          ? data.error || 'Please sign in again.'
          : response.status === 404
            ? useEdgeFunctions()
              ? `Not found (404). Deploy Edge Functions: orders — ${Config.edgeFunctionsBaseURL}/orders`
              : `Server error (404). Set EXPO_PUBLIC_API_BASE_URL in .env to your API URL.`
            : fromBody || `Server error (${response.status})`;
      throw new Error(`${msg}${gatewayHint}`.trim());
    }
    return data;
  } catch (err) {
    const msg = err?.message || '';
    if (msg !== 'Failed to submit order') {
      if (
        msg === 'Network request failed' ||
        (err.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Network')))
      ) {
        const base = apiHintBase();
        const hint = useEdgeFunctions()
          ? 'Check EXPO_PUBLIC_SUPABASE_URL, deploy supabase functions, and device network.'
          : !base || base.includes('your-vercel-url') || base.includes('your-project')
            ? 'Set EXPO_PUBLIC_API_BASE_URL in trip5-expo/.env to your backend URL.'
            : 'Check device internet and that the backend is reachable.';
        throw new Error('Network request failed.\n\n' + hint + '\n\nCurrent: ' + base);
      }
      throw err;
    }
    throw err;
  }
}

export async function getDriverOrders(accessToken) {
  const url = driverOrdersUrl();
  const response = await fetch(url, {
    headers: serviceHeaders(accessToken, false),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      response.status === 401
        ? data.error || 'Please sign in again.'
        : data.error || data.message || `Server error (${response.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function postDriverOrderAction(accessToken, body) {
  const url = driverOrdersUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: serviceHeaders(accessToken, true),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = data.error || data.message || `Server error (${response.status})`;
    throw new Error(msg);
  }
  return data;
}
