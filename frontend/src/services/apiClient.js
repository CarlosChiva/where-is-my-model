const API_BASE = '/api';

async function _request(url, options = {}) {
  try {
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const token = localStorage.getItem('token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (options.body && typeof options.body !== 'string') {
      options = { ...options, body: JSON.stringify(options.body) };
    }

    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errBody = await response.json();
        if (errBody && errBody.message) {
          message = errBody.message;
        }
      } catch {
        // non-JSON error body — keep status-based message
      }
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
