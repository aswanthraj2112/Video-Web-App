const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request (path, { method = 'GET', token, body, headers = {} } = {}) {
  const options = { method, headers: { ...headers } };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.error?.message || 'Request failed';
    throw new Error(message);
  }

  return payload;
}

const api = {
  register: (username, password) =>
    request('/api/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  getMe: (token) => request('/api/auth/me', { token }),
  uploadVideo: (token, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/videos/upload', { method: 'POST', token, body: formData });
  },
  listVideos: (token, page = 1, limit = 10) =>
    request(`/api/videos?page=${page}&limit=${limit}`, { token }),
  getVideo: (token, id) => request(`/api/videos/${id}`, { token }),
  requestTranscode: (token, id, preset = '720p') =>
    request(`/api/videos/${id}/transcode`, { method: 'POST', token, body: { preset } }),
  deleteVideo: (token, id) => request(`/api/videos/${id}`, { method: 'DELETE', token }),
  getStreamUrl: (id, token, variant = 'original', download = false) => {
    const params = new URLSearchParams();
    params.set('variant', variant);
    if (download) {
      params.set('download', '1');
    }
    if (token) {
      params.set('token', token);
    }
    return `${API_URL}/api/videos/${id}/stream?${params.toString()}`;
  },
  getThumbnailUrl: (id, token) => {
    const params = new URLSearchParams();
    if (token) {
      params.set('token', token);
    }
    return `${API_URL}/api/videos/${id}/thumbnail?${params.toString()}`;
  }
};

export default api;
