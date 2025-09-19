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
    this.filterInput = document.getElementById('filter-input');
    this.historyBackButton = document.getElementById('history-back-button');
    this.historyForwardButton = document.getElementById('history-forward-button');
    this.clipboard = null;
    this.templateCache = {};
    this.initEventListeners();
    window.addEventListener('beforeunload', () => this.saveState());
  }
  async getTemplate(url) {
    if (this.templateCache[url]) {
      return this.templateCache[url];
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load template ${url}`);
    const template = await response.text();
    this.templateCache[url] = template;
    return template;
  }
  initEventListeners() {
    this.addTabButton.addEventListener('click', () => this.addTab());
    document.getElementById('home-button').addEventListener('click', () => this.getActiveTab()?.loadPath(''));
    document.getElementById('back-button').addEventListener('click', () => this.goBackDirectory());
    this.historyBackButton.addEventListener('click', () => this.getActiveTab()?.goBack());
    this.historyForwardButton.addEventListener('click', () => this.getActiveTab()?.goForward());
    document.getElementById('refresh-button').addEventListener('click', () => this.getActiveTab()?.refresh());
    this.pathInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const newPath = this.pathInput.value.trim();
        this.getActiveTab()?.loadPath(newPath || '');
      }
    });
    document.getElementById('cut-button').addEventListener('click', () => this.handleCut());
    document.getElementById('copy-button').addEventListener('click', () => this.handleCopy());
    document.getElementById('paste-button').addEventListener('click', () => this.handlePaste());
    document.getElementById('rename-button').addEventListener('click', () => this.handleRename());
    document.getElementById('delete-button').addEventListener('click', () => this.handleDelete());
    document.getElementById('create-button').addEventListener('click', () => this.showCreateModal());
    this.filterInput.addEventListener('input', (e) => {
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.filterFiles(e.target.value);
      }
    });
    this.filterInput.addEventListener('dblclick', (e) => {
      e.target.value = '';
      const activeTab = this.getActiveTab();
      if (activeTab) {
        activeTab.filterFiles('');
      }
    });
    document.addEventListener('keydown', (event) => {
      const activeTab = this.getActiveTab();
      if (!activeTab) return;
      if (event.key === 'F5') {
        event.preventDefault();
        activeTab.refresh();
        return;
      }
      if (event.key === 'Backspace') {
        if (document.activeElement.tagName.toLowerCase() === 'input' || document.activeElement.isContentEditable) {
          return;
        }
        event.preventDefault();
        this.goBackDirectory();
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        if (document.activeElement.tagName.toLowerCase() === 'input' || document.activeElement.isContentEditable) {
          return;
        }
        switch (event.key.toLowerCase()) {
          case 'c':
            this.handleCopy();
            break;
          case 'x':
            this.handleCut();
            break;
          case 'v':
            this.handlePaste();
            break;
        }
      }
    });
  }
  goBackDirectory() {
    const currentPath = this.pathInput.value;
    if (!currentPath) return;
    const lastSlashIndex = currentPath.lastIndexOf('\\');
    if (lastSlashIndex === -1) {
      this.getActiveTab()?.loadPath('');
      return;
    }
    if (lastSlashIndex === 2 && currentPath.length === 3) {
      this.getActiveTab()?.loadPath('');
      return;
    }
    let parentPath = currentPath.substring(0, lastSlashIndex);
    if (parentPath.length === 2 && parentPath.endsWith(':')) {
      parentPath += '\\';
    }
    this.getActiveTab()?.loadPath(parentPath);
  }
  broadcastEvent(senderTabId, eventType, payload) {
    for (const tabId in this.tabs) {
      if (tabId !== senderTabId) {
        this.tabs[tabId].onBroadcastReceived(eventType, payload);
      }
    }
  }
  handleCut() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size > 0) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key.endsWith('_mark_temp')) {
          localStorage.removeItem(key);
        }
      }
      const sourcePaths = [...activeTab.selectedItems].map((item) => item.path);
      this.clipboard = {
        sourcePaths: sourcePaths,
        operation: 'cut',
      };
      sourcePaths.forEach(path => {
        localStorage.setItem(`${path}_mark_temp`, 'cut');
      });
      this.updateActionButtons();
      activeTab.refresh();
      this.broadcastEvent(activeTab.id, 'clipboard-update', {});
    }
  }
  handleCopy() {
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.selectedItems.size > 0) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key.endsWith('_mark_temp')) {
          localStorage.removeItem(key);
        }
      }
      const sourcePaths = [...activeTab.selectedItems].map((item) => item.path);
      this.clipboard = {
        sourcePaths: sourcePaths,
        operation: 'copy',
      };
      sourcePaths.forEach(path => {
        localStorage.setItem(`${path}_mark_temp`, 'copy');
      });
      this.updateActionButtons();
      activeTab.refresh();
      this.broadcastEvent(activeTab.id, 'clipboard-update', {});
    }
  }
  async handlePaste() {
    const activeTab = this.getActiveTab();
    if (activeTab && this.clipboard) {
      const destinationPath = activeTab.history[activeTab.historyIndex];
      if (destinationPath === '') {
        alert('不能在此处粘贴文件。');
        return;
      }
      const payload = {
        action: 'paste',
        ...this.clipboard,
        destinationPath,
      };
      const result = await callApi('/api/fs-operation', 'POST', payload);
      if (result) {
        this.clipboard.sourcePaths.forEach(path => {
          localStorage.removeItem(`${path}_mark_temp`);
        });
        this.clipboard = null;
        activeTab.refresh();
        this.updateActionButtons();
        this.broadcastEvent(activeTab.id, 'clipboard-update', {});
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
        window.notificationCenter.addNotification({
          message: paths.join('\n') + '\n1分钟后彻底删除!',
          icon: 'info',
          ttl: 60000,
          actions: [
            {
              label: '撤销',
              primary: true,
              actionType: 'undoDelete',
              payload: { undoId: result.undoId },
            },
          ],
        });
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
      tab.loadPath('');
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
      if (currentPath === '') {
        tabToShow.loadDisks(false);
      } else {
        tabToShow.loadFiles(currentPath, false);
      }
    }
    tabToShow.show();
    this.filterInput.value = tabToShow.filterTerm || '';
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
      this.tabs[tabId].loadPath('');
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
    const createButton = document.getElementById('create-button');
    const isRoot = !activeTab || activeTab.history[activeTab.historyIndex] === '';
    createButton.disabled = isRoot;
    createButton.classList.toggle('opacity-50', isRoot);
    createButton.classList.toggle('cursor-not-allowed', isRoot);
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
  showCreateModal() {
    const modal = document.getElementById('create-modal');
    modal.classList.remove('hidden');
    const createInput = document.getElementById('create-input');
    createInput.value = '';
    createInput.focus();
    document.getElementById('create-file-button').onclick = () => this.handleCreate('file');
    document.getElementById('create-folder-button').onclick = () => this.handleCreate('folder');
    document.getElementById('cancel-create-button').onclick = () => this.hideCreateModal();
  }
  hideCreateModal() {
    const modal = document.getElementById('create-modal');
    modal.classList.add('hidden');
  }
  async handleCreate(type) {
    const activeTab = this.getActiveTab();
    if (!activeTab) return;
    const createInput = document.getElementById('create-input');
    const name = createInput.value.trim();
    if (!name) {
      alert('名称不能为空');
      return;
    }
    const currentPath = activeTab.history[activeTab.historyIndex];
    const payload = {
      action: 'create',
      path: currentPath,
      name: name,
      type: type,
    };
    const result = await callApi('/api/fs-operation', 'POST', payload);
    if (result) {
      this.hideCreateModal();
      activeTab.refresh();
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