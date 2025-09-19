document.addEventListener('DOMContentLoaded', () => {
  function clearTempLocalStorage() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key.endsWith('_temp')) {
        localStorage.removeItem(key);
      }
    }
  }
  clearTempLocalStorage();
  const tabManager = new TabManager();
  window.tabManager = tabManager;
  window.notificationActionHandlers = {
    undoDelete: async (payload, notificationId) => {
      const activeTab = window.tabManager.getActiveTab();
      if (!activeTab || !payload || !payload.undoId) return;
      const undoResult = await callApi('/api/undo-delete', 'POST', {
        action: 'undo',
        undoId: payload.undoId,
      });
      if (undoResult) {
        activeTab.refresh();
        if (notificationId) {
          window.notificationCenter.removeNotification(notificationId);
        }
      }
    },
  };
  const notificationCenter = new NotificationCenter('#notification-center', '#notification-center-button', '#notification-center-mask');
  window.notificationCenter = notificationCenter;
  if (!tabManager.loadState()) {
    tabManager.addTab();
  }
  tabManager.updateActionButtons();
  const tooltip = document.getElementById('tooltip');
  const elementsWithTooltip = document.querySelectorAll('[data-tooltip]');
  elementsWithTooltip.forEach((element) => {
    element.addEventListener('mouseenter', () => {
      tooltip.textContent = element.dataset.tooltip;
      tooltip.classList.remove('hidden');
    });
    element.addEventListener('mousemove', (e) => {
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    });
    element.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  });
});

const terminalContainer = document.getElementById('terminal-container');
const terminalResizer = document.getElementById('terminal-resizer');
const terminalMinimizeButton = document.getElementById('terminal-minimize-button');
const minimizeIcon = terminalMinimizeButton.querySelector('.material-icons');
const updateTerminalIcon = () => {
  if (terminalContainer.classList.contains('collapsed')) {
    minimizeIcon.textContent = 'web_asset';
  } else {
    minimizeIcon.textContent = 'remove';
  }
};
const toggleTerminal = () => {
  terminalContainer.classList.toggle('collapsed');
  localStorage.setItem('terminalCollapsed', terminalContainer.classList.contains('collapsed'));
  updateTerminalIcon();
};
terminalMinimizeButton.addEventListener('click', toggleTerminal);
terminalResizer.addEventListener('click', (e) => {
  if (e.target === terminalResizer) {
    toggleTerminal();
  }
});
updateTerminalIcon();
