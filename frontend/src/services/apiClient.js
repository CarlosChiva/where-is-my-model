const API_BASE = '/api/v1';

/* ------------------------------------------------------------------ */
/*  Circuit breaker: only one in-flight refresh at a time              */
/* ------------------------------------------------------------------ */
let isRefreshing = false;
const retryQueue = [];

function processQueue(error, errorBody) {
  retryQueue.forEach((callback) => (error ? callback.reject(error, errorBody) : callback.resolve()));
  retryQueue.length = 0;
}

/* ------------------------------------------------------------------ */
/*  Raw refresh — bypasses _request to avoid interceptor recursion     */
/* ------------------------------------------------------------------ */
async function doRefreshToken() {
  const resp = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).message ?? msg; } catch { /* ok */ }
    return { data: null, error: msg };
  }

  if (resp.status === 204 || resp.headers.get('Content-Length') === '0') {
    return { data: null, error: null };
  }

  const parsed = await resp.json();
  return { data: parsed.data ?? parsed, error: null };
}

/* ------------------------------------------------------------------ */
/*  Core request method with automatic 401-retry                       */
/* ------------------------------------------------------------------ */
async function _request(url, options = {}, isRetry = false) {
  try {
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.body && typeof options.body !== 'string') {
      options = { ...options, body: JSON.stringify(options.body) };
    }

    const response = await fetch(url, { ...options, headers, credentials: 'include' });

    /* --- 401 intercept with auto-refresh retry ------------------- */
    if (response.status === 401 && !isRetry) {
      const isExpired = response.headers.get('X-Session-Expired') === 'true';

      if (isExpired) {
        let expiredBody = null;
        try {
          expiredBody = await response.json();
        } catch { /* non-JSON — ok */ }

        if (!isRefreshing) {
          isRefreshing = true;
          const refreshResult = await doRefreshToken();
          isRefreshing = false;

          if (refreshResult.error) {
            processQueue(refreshResult.error, null);
            window.dispatchEvent(new CustomEvent('auth:session-ended'));
            return { data: null, error: refreshResult.error };
          }

          processQueue(null);
          return _request(url, options, true);
        } else {
          return new Promise((resolve, reject) => {
            retryQueue.push({ resolve, reject });
          })
            .then(() => _request(url, options, true))
            .catch(() => {
              window.dispatchEvent(new CustomEvent('auth:session-ended'));
              return { data: null, error: 'Session expired.' };
            });
        }
      }

      let message = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.message) message = errBody.message;
      } catch { /* non-JSON */ }
      return { data: null, error: message };
    }

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.message) {
          message = errBody.message;
        }
      } catch { /* non-JSON */ }
      return { data: null, error: message };
    }

    if (response.status === 204 || response.headers.get('Content-Length') === '0') {
      return { data: null, error: null };
    }

    const ct = response.headers.get('Content-Type') || '';
    if (ct.includes('application/json') && response.body !== null) {
      const parsed = await response.json();
      return { data: parsed.data ?? parsed, error: null };
    }

    return { data: null, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/* ------------------------------------------------------------------ */
/*  Public API helpers                                                 */
/* ------------------------------------------------------------------ */

export function get(endpoint) {
  return _request(`${API_BASE}${endpoint}`, { method: 'GET' });
}

export function post(endpoint, body) {
  return _request(`${API_BASE}${endpoint}`, { method: 'POST', body });
}

export function put(endpoint, body) {
  return _request(`${API_BASE}${endpoint}`, { method: 'PUT', body });
}

export function del(endpoint) {
  return _request(`${API_BASE}${endpoint}`, { method: 'DELETE' });
}
