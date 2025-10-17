let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

async function refreshAccessToken() {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (response.ok && data.success) {
      localStorage.setItem('accessToken', data.accessToken);
      return data.accessToken;
    } else {
      throw new Error('刷新令牌失败');
    }
  } catch (error) {
    console.error('刷新令牌错误:', error);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
    throw error;
  }
}

async function fetchWithAuth(url, method = 'GET') {
  const token = localStorage.getItem('accessToken');
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`
    },
    credentials: 'include',
  };
  const response = await fetch(url, options);
  if (response.status === 401) {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          options.headers['Authorization'] = `Bearer ${token}`;
          return fetch(url, options).then((res) => res.json());
        })
        .catch((err) => {
          throw err;
        });
    }
    isRefreshing = true;
    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      options.headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, options);
      if (!retryResponse.ok) {
        throw new Error(`HTTP error! status: ${retryResponse.status}`);
      }
      return await retryResponse.json();
    } catch (refreshError) {
      processQueue(refreshError, null);
      throw refreshError;
    } finally {
      isRefreshing = false;
    }
  }
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}
async function callApi(url, method = 'POST', payload = null) {
  const token = localStorage.getItem('accessToken');
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
    if (payload) {
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(url, options);
    if (response.status === 401) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            options.headers['Authorization'] = `Bearer ${token}`;
            return fetch(url, options).then((res) => res.json());
          })
          .catch((err) => {
            throw err;
          });
      }
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(null, newToken);
        options.headers['Authorization'] = `Bearer ${newToken}`;
        const retryResponse = await fetch(url, options);
        if (!retryResponse.ok) {
          throw new Error(`HTTP error! status: ${retryResponse.status}`);
        }
        const result = await retryResponse.json();
        if (result.success === false) {
          throw new Error(result.error || 'API operation failed');
        }
        return result;
      } catch (refreshError) {
        processQueue(refreshError, null);
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (result.success === false) {
      throw new Error(result.error || 'API operation failed');
    }
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    alert(`操作失败: ${error.message}`);
    return null;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function checkAuth() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('注销错误:', error);
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('username');
    window.location.href = '/login.html';
  }
}
