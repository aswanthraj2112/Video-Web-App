const RAW_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function trimTrailingSlashes (value) {
  if (!value) return '';

  let result = `${value}`.trim();
  while (result.endsWith('/')) {
    result = result.slice(0, -1);
  }
  return result;
}

function normalizeBaseUrl (url) {
  if (!url) return '';

  const trimmed = trimTrailingSlashes(url);

  try {
    const parsed = new URL(trimmed);
    let pathname = trimTrailingSlashes(parsed.pathname);

    if (pathname === '/api' || pathname === 'api') {
      pathname = '';
    }

    return `${parsed.origin}${pathname}`;
  } catch {
    return trimmed;
  }
}

const API_BASE_URL = normalizeBaseUrl(RAW_API_URL);

function buildRequestUrl (path = '') {
  const sanitizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(sanitizedPath, `${API_BASE_URL}/`).toString();
}

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

  const response = await fetch(buildRequestUrl(path), options);
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
  getPresignedUrl: (token, id, { variant = 'original', download = true } = {}) => {
    const params = new URLSearchParams();
    if (variant) params.set('variant', variant);
    if (download != null) params.set('download', download ? '1' : '0');
    return request(`/api/videos/${id}/presigned?${params.toString()}`, { token });
  }
};

export default api;
