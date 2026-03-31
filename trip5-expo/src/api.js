import { Config } from './config';

export async function submitOrder(order, accessToken) {
  const url = `${Config.apiBaseURL}/api/orders`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(order),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        response.status === 401
          ? data.error || 'Please sign in again.'
          : response.status === 404
            ? `Server error (404). Set EXPO_PUBLIC_API_BASE_URL in .env to your API URL.`
            : data.error || data.message || `Server error (${response.status})`;
      throw new Error(msg);
    }
    return data;
  } catch (err) {
    const msg = err?.message || '';
    if (msg !== 'Failed to submit order') {
      if (
        msg === 'Network request failed' ||
        (err.name === 'TypeError' && (msg.includes('fetch') || msg.includes('Network')))
      ) {
        const base = Config.apiBaseURL;
        const isPlaceholder =
          !base || base.includes('your-vercel-url') || base.includes('your-project');
        const hint = isPlaceholder
          ? 'Set EXPO_PUBLIC_API_BASE_URL in trip5-expo/.env to your Render backend URL.'
          : 'Check device internet and that the backend is reachable.';
        throw new Error('Network request failed.\n\n' + hint + '\n\nCurrent: ' + base);
      }
      throw err;
    }
    throw err;
  }
}
