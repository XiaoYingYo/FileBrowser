class NotificationCenter {
  constructor(panelSelector, buttonSelector, maskSelector) {
    this.panel = document.querySelector(panelSelector);
    this.button = document.querySelector(buttonSelector);
    this.mask = document.querySelector(maskSelector);
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
    this.updateCount();
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
      notification = { message: notification, source: '系统', time: '刚才', icon: 'info' };
    }

    const { icon = 'info', iconClass = '', source = '系统', time = '刚才', message, actions } = notification;

    const notificationEl = document.createElement('div');
    notificationEl.className = 'bg-[#2d2d2d] p-3 rounded-lg';

    notificationEl.innerHTML = `
      <div class="flex justify-between items-start">
        <div class="flex items-center space-x-2">
          <span class="material-icons ${iconClass || ''}">${icon}</span>
          <span class="text-sm font-medium">${source}</span>
        </div>
        <div class="flex items-center">
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
          if (action.onClick) {
            action.onClick();
          }
          if (action.removeOnClick !== false) {
            notificationEl.remove();
            this.updateCount();
          }
        });
        actionsContainer.appendChild(button);
      });
      notificationEl.appendChild(actionsContainer);
    }

    this.notificationContainer.prepend(notificationEl);
    notificationEl.querySelector('.close-notification').addEventListener('click', () => {
      notificationEl.remove();
      this.updateCount();
    });
    this.updateCount();
  }
  clearAll() {
    this.notificationContainer.innerHTML = '';
    this.updateCount();
  }
  updateCount() {
    const count = this.notificationContainer.children.length;
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
