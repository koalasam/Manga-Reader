const API = {
  async request(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (res.status === 401) {
      window.dispatchEvent(new Event('auth:required'));
      throw new Error('Unauthorized');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  me: () => API.request('/api/auth/me'),
  login: (username, password, rememberMe) =>
    API.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    }),
  register: (username, password, rememberMe) =>
    API.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    }),
  logout: () => API.request('/api/auth/logout', { method: 'POST' }),

  search: (q, source) => API.request(`/api/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(source)}`),
  getChapters: (source, seriesId) => API.request(`/api/series/${source}/${seriesId}/chapters`),
  getPages: (source, seriesId, chapterId) => API.request(`/api/read/${source}/${seriesId}/${chapterId}/pages`),

  getLibrary: () => API.request('/api/library'),
  saveSeries: (series) => API.request('/api/library', { method: 'POST', body: JSON.stringify(series) }),
  removeSeries: (source, seriesId) => API.request(`/api/library/${source}/${seriesId}`, { method: 'DELETE' }),
};