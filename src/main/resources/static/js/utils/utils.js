async function callApi(url, method = 'POST', payload = null) {
  try {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (payload) {
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'API operation failed');
    }
    return result;
  } catch (error) {
    console.error('API call failed:', error);
    alert(`操作失败: ${error.message}`);
    return null;
  }
}

function showUndoToast(undoId) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed top-5 right-5 z-50';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'bg-gray-800 text-white p-4 rounded-md shadow-lg flex items-center mb-2 animate-fade-in-down';
  toast.innerHTML = `
    <span>文件已移至回收站。</span>
    <button class="ml-4 text-blue-400 hover:text-blue-300 font-bold" id="undo-delete-btn-${undoId}">撤销</button>
  `;
  document.getElementById('toast-container').appendChild(toast);

  const undoButton = document.getElementById(`undo-delete-btn-${undoId}`);
  const timeoutId = setTimeout(() => {
    toast.remove();
  }, 60000);

  undoButton.addEventListener('click', async () => {
    clearTimeout(timeoutId);
    const result = await callApi('/api/undo-delete', 'POST', { undoId });
    if (result && result.success) {
      const activeTab = window.tabManager.getActiveTab();
      if (activeTab) {
        activeTab.refresh();
      }
      toast.innerHTML = '<span>已撤销删除。</span>';
      setTimeout(() => toast.remove(), 3000);
    } else {
      toast.innerHTML = `<span>撤销失败: ${result.error || '未知错误'}</span>`;
      setTimeout(() => toast.remove(), 5000);
    }
  });
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
