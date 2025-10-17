class NotificationCenter {
  constructor(panelSelector, buttonSelector, maskSelector, storageKey = 'notification-center-items') {
    this.panel = document.querySelector(panelSelector);
    this.button = document.querySelector(buttonSelector);
    this.mask = document.querySelector(maskSelector);
    this.storageKey = storageKey;
    this.notifications = [];
    this.countdownIntervals = new Map();
    this.removalTimeouts = new Map();
    if (!this.panel || !this.button || !this.mask) {
      console.error('NotificationCenter: 未找到面板、按钮或蒙版元素。');
      return;
    }
    this.notificationContainer = this.panel.querySelector('.overflow-y-auto');
    this.clearAllButton = this.panel.querySelector('.text-blue-400');
    this.countElement = this.button.querySelector('span:last-child');
    this.init();
  }
  init() {
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    if (this.clearAllButton) {
      this.clearAllButton.addEventListener('click', () => this.clearAll());
    }
    this.mask.addEventListener('click', () => this.hide());
    this._loadNotifications();
    this._renderAllNotifications();
    this.updateCount();
  }
  _saveNotifications() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.notifications));
  }
  _loadNotifications() {
    const storedNotifications = localStorage.getItem(this.storageKey);
    if (storedNotifications) {
      const parsedNotifications = JSON.parse(storedNotifications);
      const now = Date.now();
      this.notifications = parsedNotifications.filter(n => !n.expires || n.expires > now);
      if (this.notifications.length !== parsedNotifications.length) {
          this._saveNotifications();
      }
    }
  }
  _renderAllNotifications() {
      this.notificationContainer.innerHTML = '';
      this.notifications.forEach(notification => {
          this._renderNotification(notification, false);
          this._startTimers(notification);
      });
  }
  _startTimers(notification) {
    if (!notification.expires) {
      return;
    }
    const { id, expires } = notification;
    this._clearTimers(id);
    const remainingTime = expires - Date.now();
    if (remainingTime <= 0) {
      this.removeNotification(id);
      return;
    }
    const timeoutId = setTimeout(() => {
      this.removeNotification(id);
    }, remainingTime);
    this.removalTimeouts.set(id, timeoutId);
    const intervalId = setInterval(() => {
      const notificationEl = this.notificationContainer.querySelector(`[data-id="${id}"] .countdown-timer`);
      const secondsLeft = Math.round((expires - Date.now()) / 1000);
      if (secondsLeft >= 0 && notificationEl) {
        notificationEl.textContent = `${secondsLeft}秒`;
      } else if (secondsLeft < 0) {
        this.removeNotification(id);
      }
    }, 1000);
    this.countdownIntervals.set(id, intervalId);
  }
  _clearTimers(id) {
    if (this.countdownIntervals.has(id)) {
      clearInterval(this.countdownIntervals.get(id));
      this.countdownIntervals.delete(id);
    }
    if (this.removalTimeouts.has(id)) {
      clearTimeout(this.removalTimeouts.get(id));
      this.removalTimeouts.delete(id);
    }
  }
  _renderNotification(notification, prepend = false) {
    const { id, icon = 'info', iconClass = '', source = '系统', time = '刚才', message, actions, expires } = notification;
    const notificationEl = document.createElement('div');
    notificationEl.className = 'bg-[#2d2d2d] p-3 rounded-lg';
    notificationEl.style.cssText = 'width: 100%; overflow: hidden;';
    notificationEl.dataset.id = id;
    const initialCountdown = expires ? `${Math.round((expires - Date.now()) / 1000)}秒` : '';
    notificationEl.innerHTML = `
      <div class="flex justify-between items-start" style="min-width: 0;">
        <div class="flex items-center space-x-2" style="min-width: 0; flex-shrink: 1;">
          <span class="material-icons ${iconClass || ''}">${icon}</span>
          <span class="text-sm font-medium">${source}</span>
        </div>
        <div class="flex items-center" style="flex-shrink: 0;">
            <span class="countdown-timer text-xs text-gray-400 mr-2">${initialCountdown}</span>
            <span class="text-xs text-gray-400 mr-2">${time}</span>
            <button class="close-notification">&times;</button>
        </div>
      </div>
      <p class="text-sm mt-2" style="word-wrap: break-word; overflow-wrap: break-word; white-space: pre-wrap; overflow: hidden;">${message}</p>
    `;
    if (actions && actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'flex justify-end mt-3 space-x-2';
      actions.forEach((action) => {
        const button = document.createElement('button');
        button.className = `text-sm px-3 py-1 ${action.primary ? 'bg-gray-600 hover:bg-gray-500' : 'hover:bg-gray-700'} rounded`;
        button.textContent = action.label;
        button.addEventListener('click', () => {
          if (action.actionType && window.notificationActionHandlers && typeof window.notificationActionHandlers[action.actionType] === 'function') {
            window.notificationActionHandlers[action.actionType](action.payload, id);
          }
          if (action.onClick) {
            action.onClick();
          }
          if (action.removeOnClick !== false) {
            this.removeNotification(id);
          }
        });
        actionsContainer.appendChild(button);
      });
      notificationEl.appendChild(actionsContainer);
    }
    if (prepend) {
        this.notificationContainer.prepend(notificationEl);
    } else {
        this.notificationContainer.appendChild(notificationEl);
    }
    notificationEl.querySelector('.close-notification').addEventListener('click', () => {
      this.removeNotification(id);
    });
  }
  toggle() {
    this.panel.classList.toggle('active');
    this.mask.classList.toggle('active');
  }
  show() {
    this.panel.classList.add('active');
    this.mask.classList.add('active');
  }
  hide() {
    this.panel.classList.remove('active');
    this.mask.classList.remove('active');
  }
  addNotification(notification) {
    if (typeof notification === 'string') {
      notification = { message: notification };
    }
    if (notification.message && typeof notification.message === 'string') {
      notification.message = notification.message.replace(/\n/g, '<br>');
    }
    const newNotification = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      source: '系统',
      time: '刚才',
      icon: 'info',
      ...notification,
    };
    if (notification.ttl && typeof notification.ttl === 'number') {
      newNotification.expires = Date.now() + notification.ttl;
    }
    this.notifications.unshift(newNotification);
    this._saveNotifications();
    this._renderNotification(newNotification, true);
    this._startTimers(newNotification);
    this.updateCount();
    return newNotification.id;
  }
  removeNotification(id) {
    this._clearTimers(id);
    const index = this.notifications.findIndex(n => n.id === id);
    if (index > -1) {
      this.notifications.splice(index, 1);
      this._saveNotifications();
      const notificationEl = this.notificationContainer.querySelector(`[data-id="${id}"]`);
      if (notificationEl) {
        notificationEl.remove();
      }
      this.updateCount();
    }
  }
  clearAll() {
    this.notifications.forEach(n => this._clearTimers(n.id));
    this.notifications = [];
    this._saveNotifications();
    this.notificationContainer.innerHTML = '';
    this.updateCount();
  }
  updateCount() {
    const count = this.notifications.length;
    if (this.countElement) {
        this.countElement.textContent = count;
        if (count > 0) {
            this.countElement.style.display = 'inline-block';
        } else {
            this.countElement.style.display = 'none';
        }
    }
  }
}
