class Tab {
  constructor(tabManager, initialState = null) {
    this.tabManager = tabManager;
    if (initialState) {
      this.id = initialState.id;
      this.history = initialState.history;
      this.historyIndex = initialState.historyIndex;
    } else {
      this.id = `tab-${Date.now()}`;
      this.history = [];
      this.historyIndex = -1;
    }
    this.selectedItems = new Set();
    this.lastSelectedItem = null;
    this.allItems = [];
    this.createElement();
    if (initialState) {
      this.setTitle(initialState.title);
    }
    this.createContentElement();
  }
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'flex items-center px-3 py-2 border-r border-gray-700';
    this.element.dataset.tabId = this.id;
    this.element.innerHTML = `<span class="material-icons text-yellow-500 text-base mr-2" style="cursor: default; user-select: none;">folder</span>
      <span class="text-sm" style="cursor: default; user-select: none;">新标签页</span>
      <button class="ml-2 p-0.5 hover:bg-gray-600 rounded close-tab-button">
        <span class="material-icons text-xs">close</span>
      </button>`;
    this.element.addEventListener('click', () => this.tabManager.switchTab(this.id));
    this.element.addEventListener('dblclick', () => this.tabManager.closeTab(this.id));
    this.element.querySelector('.close-tab-button').addEventListener('click', (e) => {
      e.stopPropagation();
      this.tabManager.closeTab(this.id);
    });
  }
  createContentElement() {
    this.contentElement = document.createElement('div');
    this.contentElement.id = this.id;
    this.contentElement.className = 'p-4 h-full';
    this.contentElement.style.display = 'none';
    this.contentElement.addEventListener('click', (e) => {
      if (e.target === this.contentElement) {
        this.clearSelection();
      }
    });
  }
  setTitle(title) {
    this.element.querySelector('.text-sm').textContent = title;
  }
  show() {
    this.element.classList.add('bg-[#2d2d2d]');
    this.contentElement.style.display = 'block';
  }
  hide() {
    this.element.classList.remove('bg-[#2d2d2d]');
    this.contentElement.style.display = 'none';
  }
  async loadPath(path) {
    if (this.history[this.historyIndex] === path) {
      return;
    }
    this.clearSelection();
    if (path === '此电脑') {
      await this.loadDisks();
    } else {
      await this.loadFiles(path);
    }
  }
  async refresh() {
    const currentPath = this.history[this.historyIndex];
    if (currentPath) {
      this.clearSelection();
      if (currentPath === '此电脑') {
        await this.loadDisks(false);
      } else {
        await this.loadFiles(currentPath, false);
      }
    }
  }
  async goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const path = this.history[this.historyIndex];
      this.clearSelection();
      if (path === '此电脑') {
        await this.loadDisks(false);
      } else {
        await this.loadFiles(path, false);
      }
      this.tabManager.updateNavigationButtons();
    }
  }
  async goForward() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const path = this.history[this.historyIndex];
      this.clearSelection();
      if (path === '此电脑') {
        await this.loadDisks(false);
      } else {
        await this.loadFiles(path, false);
      }
      this.tabManager.updateNavigationButtons();
    }
  }
  async loadDisks(addToHistory = true) {
    try {
      this.setTitle('此电脑');
      this.tabManager.setPathInputValue('此电脑');
      const [disksResponse, diskTemplateResponse] = await Promise.all([fetch('/api/disks'), fetch('./tpl/viewMode/disk.html')]);
      if (!disksResponse.ok || !diskTemplateResponse.ok) throw new Error('Failed to load disk data or template');
      const disks = await disksResponse.json();
      this.allItems = disks;
      const diskViewTemplate = await diskTemplateResponse.text();
      const diskItemTemplateMatch = diskViewTemplate.match(/<for>([\s\S]*?)<\/for>/);
      if (!diskItemTemplateMatch) throw new Error('Disk item template not found');
      const diskItemTemplate = diskItemTemplateMatch[1].trim();
      let allDisksHtml = disks
        .map((disk) => {
          const usedSpace = disk.totalSpace - disk.freeSpace;
          const usedPercentage = (usedSpace / disk.totalSpace) * 100;
          return diskItemTemplate.replace('{{diskType}}', disk.type).replace('{{diskPath}}', disk.path.slice(0, 2)).replace('{{usedPercentage}}', usedPercentage.toFixed(2)).replace('{{freeSpace}}', formatBytes(disk.freeSpace)).replace('{{totalSpace}}', formatBytes(disk.totalSpace));
        })
        .join('');
      this.contentElement.innerHTML = diskViewTemplate.replace(/<for>[\s\S]*?<\/for>/, allDisksHtml);
      this.contentElement.querySelectorAll('.cursor-pointer').forEach((element, index) => {
        const disk = disks[index];
        element.dataset.itemId = disk.path;
        element.addEventListener('click', (e) => this.handleItemClick(e, disk, element));
        element.addEventListener('dblclick', async () => await this.loadPath(disk.path));
      });
      this.updateItemCount();
      if (addToHistory) {
        if (this.historyIndex < this.history.length - 1) {
          this.history.splice(this.historyIndex + 1);
        }
        this.history.push('此电脑');
        this.historyIndex = this.history.length - 1;
        this.tabManager.updateNavigationButtons();
      }
    } catch (error) {
      console.error('Error fetching disk data:', error);
    }
  }
  async loadFiles(path, addToHistory = true) {
    try {
      this.setTitle(path.split('\\').pop() || path);
      this.tabManager.setPathInputValue(path);
      const [filesResponse, listTemplateResponse] = await Promise.all([fetch(`/api/files?path=${encodeURIComponent(path)}`), fetch('./tpl/viewMode/list.html')]);
      if (!filesResponse.ok || !listTemplateResponse.ok) {
        throw new Error('Failed to load file data or template');
      }
      const data = await filesResponse.json();
      this.allItems = [];
      const listTemplate = await listTemplateResponse.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(listTemplate, 'text/html');
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(doc.querySelector('.w-full'));
      const fileListContainer = this.contentElement.querySelector('.divide-y');
      const fileTemplate = fileListContainer.querySelector('for').innerHTML.trim();
      fileListContainer.innerHTML = '';
      [data.directories, data.files].forEach((arr) => {
        arr.forEach((file) => {
          this.allItems.push(file);
          let fileElementHtml = fileTemplate
            .replace('{{icon}}', file.isSymbolicLink ? 'link' : file.isDirectory ? 'folder' : 'description')
            .replace('{{iconColor}}', file.isSymbolicLink ? 'text-cyan-400' : file.isDirectory ? 'text-yellow-500' : 'text-gray-400')
            .replace('{{extraClasses}}', file.isHidden ? 'opacity-50' : '')
            .replace('{{fileName}}', file.name)
            .replace('{{lastModified}}', new Date(file.lastModified).toLocaleString())
            .replace('{{fileSize}}', file.isDirectory ? '' : formatBytes(file.size));
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = fileElementHtml;
          const fileElement = tempDiv.firstElementChild;
          fileElement.dataset.itemId = file.path;
          fileElement.addEventListener('click', (e) => this.handleItemClick(e, file, fileElement));
          if (file.isDirectory) {
            fileElement.addEventListener('dblclick', async () => await this.loadPath(file.path));
          }
          fileListContainer.appendChild(fileElement);
        });
      });
      this.updateItemCount();
      if (addToHistory) {
        if (this.historyIndex < this.history.length - 1) {
          this.history.splice(this.historyIndex + 1);
        }
        this.history.push(path);
        this.historyIndex = this.history.length - 1;
        this.tabManager.updateNavigationButtons();
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    }
  }
  handleItemClick(event, item, element) {
    event.stopPropagation();
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    const isShiftPressed = event.shiftKey;
    if (isShiftPressed && this.lastSelectedItem) {
      this.clearSelection(false);
      const lastIndex = this.allItems.findIndex((i) => i.path === this.lastSelectedItem.path);
      const currentIndex = this.allItems.findIndex((i) => i.path === item.path);
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      for (let i = start; i <= end; i++) {
        this.selectedItems.add(this.allItems[i]);
      }
    } else if (isCtrlPressed) {
      if (this.selectedItems.has(item)) {
        this.selectedItems.delete(item);
      } else {
        this.selectedItems.add(item);
      }
      this.lastSelectedItem = item;
    } else {
      this.clearSelection(false);
      this.selectedItems.add(item);
      this.lastSelectedItem = item;
    }
    this.updateSelectionUI();
    this.updateItemCount();
    this.tabManager.updateActionButtons();
  }
  updateSelectionUI() {
    this.contentElement.querySelectorAll('[data-item-id]').forEach((el) => {
      const itemId = el.dataset.itemId;
      const item = this.allItems.find((i) => i.path === itemId);
      if (item && this.selectedItems.has(item)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }
  clearSelection(updateUI = true) {
    this.selectedItems.clear();
    this.lastSelectedItem = null;
    if (updateUI) {
      this.updateSelectionUI();
      this.updateItemCount();
      this.tabManager.updateActionButtons();
    }
  }
  updateItemCount() {
    const totalCount = this.allItems.length;
    const selectedCount = this.selectedItems.size;
    let text = `${totalCount} 个项目`;
    if (selectedCount > 0) {
      text += ` | ${selectedCount} 个项目已选择`;
    }
    document.getElementById('item-count').textContent = text;
  }
  toJSON() {
    return {
      id: this.id,
      history: this.history,
      historyIndex: this.historyIndex,
      title: this.element.querySelector('.text-sm').textContent,
    };
  }
}
class TabManager {
  constructor() {
    this.tabs = {};
    this.activeTabId = null;
    this.tabCount = 0;
    this.visitHistory = [];
    this.tabContainer = document.getElementById('tab-bar');
    this.contentContainer = document.getElementById('content-container');
    this.addTabButton = document.getElementById('add-tab-button');
    this.pathInput = document.getElementById('path-input');
    this.historyBackButton = document.getElementById('history-back-button');
    this.historyForwardButton = document.getElementById('history-forward-button');
    this.clipboard = null;
    this.initEventListeners();
    window.addEventListener('beforeunload', () => this.saveState());
  }
  initEventListeners() {
    this.addTabButton.addEventListener('click', () => this.addTab());
    document.getElementById('home-button').addEventListener('click', () => this.getActiveTab()?.loadPath('此电脑'));
    document.getElementById('back-button').addEventListener('click', () => {
      const currentPath = this.pathInput.value;
      const lastSlashIndex = currentPath.lastIndexOf('\\');
      if (lastSlashIndex < 3 && currentPath.includes(':\\')) {
        this.getActiveTab()?.loadPath('此电脑');
      } else {
        const parentPath = currentPath.substring(0, lastSlashIndex);
        if (parentPath) {
          this.getActiveTab()?.loadPath(parentPath);
        } else {
          this.getActiveTab()?.loadPath('此电脑');
        }
      }
    });
    this.historyBackButton.addEventListener('click', () => this.getActiveTab()?.goBack());
    this.historyForwardButton.addEventListener('click', () => this.getActiveTab()?.goForward());
    document.getElementById('refresh-button').addEventListener('click', () => this.getActiveTab()?.refresh());
    this.pathInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const newPath = this.pathInput.value.trim();
        this.getActiveTab()?.loadPath(newPath || '此电脑');
      }
    });
    document.getElementById('cut-button').addEventListener('click', () => this.handleCut());
    document.getElementById('copy-button').addEventListener('click', () => this.handleCopy());
    document.getElementById('paste-button').addEventListener('click', () => this.handlePaste());
    document.getElementById('rename-button').addEventListener('click', () => this.handleRename());
    document.getElementById('delete-button').addEventListener('click', () => this.handleDelete());
  }
  handleCut() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size > 0) {
      this.clipboard = {
        sourcePaths: [...activeTab.selectedItems].map((item) => item.path),
        operation: 'cut',
      };
      this.updateActionButtons();
      // Optional: Add visual feedback for cut items
    }
  }
  handleCopy() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size > 0) {
      this.clipboard = {
        sourcePaths: [...activeTab.selectedItems].map((item) => item.path),
        operation: 'copy',
      };
      this.updateActionButtons();
    }
  }
  async handlePaste() {
    const activeTab = this.getActiveTab();
    if (activeTab && this.clipboard) {
      const destinationPath = activeTab.history[activeTab.historyIndex];
      if (destinationPath === '此电脑') {
        alert('不能在"此电脑"中粘贴文件。');
        return;
      }
      const payload = {
        action: 'paste',
        ...this.clipboard,
        destinationPath,
      };
      const result = await callApi('/api/fs-operation', 'POST', payload);
      if (result) {
        this.clipboard = null;
        activeTab.refresh();
        this.updateActionButtons();
        window.notificationCenter.addNotification(`${this.clipboard.sourcePaths.length}个文件已成功${this.clipboard.operation === 'cut' ? '移动' : '复制'}到 ${destinationPath}`, 'success');
      }
    }
  }
  async handleRename() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size === 1) {
      const itemToRename = [...activeTab.selectedItems][0];
      const newName = prompt('输入新的文件名:', itemToRename.name);
      if (newName && newName !== itemToRename.name) {
        const payload = {
          action: 'rename',
          oldPath: itemToRename.path,
          newName: newName,
        };
        const result = await callApi('/api/fs-operation', 'POST', payload);
        if (result) {
          activeTab.refresh();
        }
      }
    }
  }
  async handleDelete() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size > 0) {
      const paths = [...activeTab.selectedItems].map((item) => item.path);
      const payload = {
        action: 'delete',
        paths: paths,
      };
      const result = await callApi('/api/fs-operation', 'POST', payload);
      if (result && result.undoId) {
        activeTab.refresh();
        window.notificationCenter.addNotification(`${paths.length} 个项目已移至回收站`, 'info');
      }
    }
  }
  addTab(initialState = null) {
    const tab = new Tab(this, initialState);
    this.tabs[tab.id] = tab;
    this.tabCount++;
    this.tabContainer.insertBefore(tab.element, this.addTabButton);
    this.contentContainer.appendChild(tab.contentElement);
    if (!initialState) {
      this.switchTab(tab.id);
      tab.loadPath('此电脑');
    }
    return tab;
  }
  switchTab(tabId) {
    if (this.activeTabId && this.tabs[this.activeTabId]) {
      this.tabs[this.activeTabId].hide();
    }
    this.activeTabId = tabId;
    const index = this.visitHistory.indexOf(tabId);
    if (index > -1) {
      this.visitHistory.splice(index, 1);
    }
    this.visitHistory.push(tabId);
    const tabToShow = this.tabs[tabId];
    if (tabToShow.contentElement.childElementCount === 0 && tabToShow.history.length > 0) {
      const currentPath = tabToShow.history[tabToShow.historyIndex];
      if (currentPath === '此电脑') {
        tabToShow.loadDisks(false);
      } else {
        tabToShow.loadFiles(currentPath, false);
      }
    }
    tabToShow.show();
    this.updateNavigationButtons();
    const activeTab = this.getActiveTab();
    if (activeTab) {
      if (activeTab.history.length > 0) {
        this.setPathInputValue(activeTab.history[activeTab.historyIndex]);
      }
      activeTab.updateItemCount();
      this.updateActionButtons();
    }
  }
  closeTab(tabId) {
    if (this.tabCount === 1) {
      this.tabs[tabId].loadPath('此电脑');
      return;
    }
    const tab = this.tabs[tabId];
    tab.element.remove();
    tab.contentElement.remove();
    delete this.tabs[tabId];
    this.tabCount--;
    const historyIndex = this.visitHistory.indexOf(tabId);
    if (historyIndex > -1) {
      this.visitHistory.splice(historyIndex, 1);
    }
    if (this.activeTabId === tabId) {
      if (this.visitHistory.length > 0) {
        const newActiveTabId = this.visitHistory[this.visitHistory.length - 1];
        this.switchTab(newActiveTabId);
      } else {
        this.activeTabId = null;
        this.pathInput.value = '';
        document.getElementById('item-count').textContent = '';
      }
    }
    this.updateActionButtons();
  }
  updateActionButtons() {
    const activeTab = this.getActiveTab();
    const selectedCount = activeTab ? activeTab.selectedItems.size : 0;
    document.getElementById('cut-button').disabled = selectedCount === 0;
    document.getElementById('copy-button').disabled = selectedCount === 0;
    document.getElementById('delete-button').disabled = selectedCount === 0;
    document.getElementById('rename-button').disabled = selectedCount !== 1;
    const pasteButton = document.getElementById('paste-button');
    if (this.clipboard && this.clipboard.sourcePaths && this.clipboard.sourcePaths.length > 0) {
      pasteButton.disabled = false;
      pasteButton.classList.remove('disabled:opacity-50');
    } else {
      pasteButton.disabled = true;
      pasteButton.classList.add('disabled:opacity-50');
    }
  }
  updateNavigationButtons() {
    const tab = this.getActiveTab();
    if (tab) {
      this.historyBackButton.disabled = tab.historyIndex <= 0;
      this.historyForwardButton.disabled = tab.historyIndex >= tab.history.length - 1;
    } else {
      this.historyBackButton.disabled = true;
      this.historyForwardButton.disabled = true;
    }
  }
  getActiveTab() {
    return this.activeTabId ? this.tabs[this.activeTabId] : null;
  }
  setPathInputValue(value) {
    this.pathInput.value = value;
  }
  saveState() {
    const state = {
      tabs: Object.values(this.tabs).map((tab) => tab.toJSON()),
      activeTabId: this.activeTabId,
      visitHistory: this.visitHistory,
    };
    localStorage.setItem('tabManagerState', JSON.stringify(state));
  }
  loadState() {
    const savedState = localStorage.getItem('tabManagerState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.tabs && state.tabs.length > 0) {
          state.tabs.forEach((tabState) => {
            const tab = this.addTab(tabState);
            this.contentContainer.appendChild(tab.contentElement);
          });
          this.visitHistory = state.visitHistory || [];
          const lastActiveTabId = state.activeTabId || this.visitHistory[this.visitHistory.length - 1] || state.tabs[0].id;
          if (this.tabs[lastActiveTabId]) {
            this.switchTab(lastActiveTabId);
          } else if (state.tabs.length > 0) {
            this.switchTab(state.tabs[0].id);
          }
          return true;
        }
      } catch (e) {
        console.error('Error loading state from localStorage:', e);
        localStorage.removeItem('tabManagerState');
      }
    }
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const tabManager = new TabManager();
  window.tabManager = tabManager;
  // 初始化通知中心
  const notificationCenter = new NotificationCenter('#notification-center', '#notification-center-button', '#notification-center-mask');
  window.notificationCenter = notificationCenter;

  // 清除HTML中的静态示例，并通过JS动态添加，以作演示
  if (window.notificationCenter) {
    window.notificationCenter.clearAll();

    window.notificationCenter.addNotification({
      icon: 'settings',
      iconClass: 'text-blue-400',
      source: '系统',
      time: '刚才',
      message: 'Windows 更新已可用。请重启以安装。',
      actions: [
        { label: '立即重启', primary: true },
        { label: '稍后提醒我', primary: false },
      ],
    });

    window.notificationCenter.addNotification({
      icon: 'security',
      iconClass: 'text-green-400',
      source: '安全中心',
      time: '1 小时前',
      message: '已完成扫描。未发现威胁。',
      actions: [],
    });
  }

  if (!tabManager.loadState()) {
    tabManager.addTab();
  }
  tabManager.updateActionButtons();
  const tooltip = document.getElementById('tooltip');
  const buttonsWithTooltip = document.querySelectorAll('[data-tooltip]');
  buttonsWithTooltip.forEach((button) => {
    button.addEventListener('mouseenter', () => {
      tooltip.textContent = button.dataset.tooltip;
      tooltip.classList.remove('hidden');
    });
    button.addEventListener('mousemove', (e) => {
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;
    });
    button.addEventListener('mouseleave', () => {
      tooltip.classList.add('hidden');
    });
  });
});
