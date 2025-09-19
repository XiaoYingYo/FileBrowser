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
    
    // 清除已存在的定时器，防止重复
    this._clearTimers(id);

    const remainingTime = expires - Date.now();
    if (remainingTime <= 0) {
      this.removeNotification(id);
      return;
    }
    
    // 设置到期后自动移除的定时器
    const timeoutId = setTimeout(() => {
      this.removeNotification(id);
    }, remainingTime);
    this.removalTimeouts.set(id, timeoutId);
    
    // 设置每秒更新倒计时的定时器
    const intervalId = setInterval(() => {
      const notificationEl = this.notificationContainer.querySelector(`[data-id="${id}"] .countdown-timer`);
      const secondsLeft = Math.round((expires - Date.now()) / 1000);
      if (secondsLeft >= 0 && notificationEl) {
        notificationEl.textContent = `${secondsLeft}秒`;
      } else if (secondsLeft < 0) {
        // 作为保险措施，如果 interval 仍在运行但已过期，则清除
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
    notificationEl.dataset.id = id;

    const initialCountdown = expires ? `${Math.round((expires - Date.now()) / 1000)}秒` : '';

    notificationEl.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex items-center space-x-2">
          <span class="material-icons ${iconClass || ''}">${icon}</span>
          <span class="text-sm font-medium">${source}</span>
        </div>
        <div class="flex items-center">
            <span class="countdown-timer text-xs text-gray-400 mr-2">${initialCountdown}</span>
            <span class="text-xs text-gray-400 mr-2">${time}</span>
            <button class="close-notification">&times;</button>
        </div>
      </div>
      <p class="text-sm mt-2 break-all">${message}</p>
    `;

    if (actions && actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'flex justify-end mt-3 space-x-2';
      actions.forEach((action) => {
        const button = document.createElement('button');
        button.className = `text-sm px-3 py-1 ${action.primary ? 'bg-gray-600 hover:bg-gray-500' : 'hover:bg-gray-700'} rounded`;
        button.textContent = action.label;
        button.addEventListener('click', () => {
          // 新的Action处理机制
          if (action.actionType && window.notificationActionHandlers && typeof window.notificationActionHandlers[action.actionType] === 'function') {
            window.notificationActionHandlers[action.actionType](action.payload);
          }
          // 旧的onClick（为不中断旧代码，保留兼容）
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
    this._startTimers(newNotification); // 为新通知启动定时器
    this.updateCount();
    return newNotification.id;
  }
  
  removeNotification(id) {
    this._clearTimers(id); // 在移除前清除定时器
    
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
    // 清除所有定时器
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
