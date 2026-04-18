import { Config, isSupabaseUrlWithoutAnonKey } from './config';
import { supabase } from './lib/supabase';

/**
 * Prefer Supabase Edge Functions when project URL is set.
 * `apikey` is required by the Supabase gateway; omitting it causes 401 before the function runs.
 */
function useEdgeFunctions() {
  return Boolean(Config.edgeFunctionsBaseURL && Config.supabaseAnonKey);
}

export { isSupabaseUrlWithoutAnonKey };

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

/**
 * Manual refresh hits Supabase `/token` and is rate-limited (429). The JS client already uses
 * `autoRefreshToken` for normal rotation — do not call `refreshSession()` on every poll.
 */
const MIN_MS_BETWEEN_MANUAL_REFRESH = 60_000;
let lastManualRefreshAt = 0;

async function refreshSessionThrottled() {
  const now = Date.now();
  if (now - lastManualRefreshAt < MIN_MS_BETWEEN_MANUAL_REFRESH) {
    return null;
  }
  lastManualRefreshAt = now;
  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data?.session?.access_token) return null;
  return data.session.access_token;
}

/** Token from React context first, then `getSession()` (local + client refresh). No extra `/token` calls. */
async function resolveAccessToken(preferred) {
  let t = preferred || null;
  try {
    const { data } = await supabase.auth.getSession();
    t = t || data?.session?.access_token || null;
  } catch {
    /* ignore */
  }
  return t;
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
              : `Server error (404). Set EXPO_PUBLIC_API_BASE_URL in trip5-expo/.env to your API URL.`
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

export async function getDriverOrders(accessTokenHint) {
  if (isSupabaseUrlWithoutAnonKey()) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY. Add it to trip5-expo/.env (same project as EXPO_PUBLIC_SUPABASE_URL) so driver-orders can reach Edge Functions.'
    );
  }
  const url = driverOrdersUrl();

  const fetchOnce = async (token) => {
    if (!token) {
      const err = new Error('Please sign in again.');
      err._httpStatus = 401;
      throw err;
    }
    let response;
    try {
      response = await fetch(url, {
        headers: serviceHeaders(token, false),
      });
    } catch (err) {
      const msg = err?.message || '';
      if (
        msg === 'Network request failed' ||
        (err?.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Network')))
      ) {
        const base = apiHintBase();
        throw new Error(
          `Network error calling driver API.\n\nCheck internet, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, and deploy: supabase functions deploy driver-orders\n\n${base}`
        );
      }
      throw err;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        response.status === 401
          ? data.error || 'Please sign in again.'
          : data.error || data.message || `Server error (${response.status})`;
      const err = new Error(msg);
      err._httpStatus = response.status;
      throw err;
    }
    return data;
  };

  let token = await resolveAccessToken(accessTokenHint);
  try {
    return await fetchOnce(token);
  } catch (e) {
    if (e._httpStatus === 401) {
      const newTok = await refreshSessionThrottled();
      if (newTok) {
        try {
          return await fetchOnce(newTok);
        } catch (e2) {
          throw e2;
        }
      }
    }
    throw e;
  }
}

export async function postDriverOrderAction(accessTokenHint, body) {
  const url = driverOrdersUrl();

  const fetchOnce = async (token) => {
    if (!token) {
      const err = new Error('Please sign in again.');
      err._httpStatus = 401;
      throw err;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: serviceHeaders(token, true),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg = data.error || data.message || `Server error (${response.status})`;
      const err = new Error(msg);
      err._httpStatus = response.status;
      throw err;
    }
    return data;
  };

  let token = await resolveAccessToken(accessTokenHint);
  try {
    return await fetchOnce(token);
  } catch (e) {
    if (e._httpStatus === 401) {
      const newTok = await refreshSessionThrottled();
      if (newTok) {
        try {
          return await fetchOnce(newTok);
        } catch (e2) {
          throw e2;
        }
      }
    }
    throw e;
  }
}
