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
    this.filterTerm = initialState ? initialState.filterTerm || '' : '';
    this.selectedItems = new Set();
    this.isLoading = false;
    this.lastSelectedItem = null;
    this.allItems = [];
    this.createElement();
    if (initialState) {
      this.setTitle(initialState.title);
    }
    this.eventHandlers = {
      'clipboard-update': (payload) => this.updateItemMarks(),
    };
    this.createContentElement();
  }
  onBroadcastReceived(eventType, payload) {
    const handler = this.eventHandlers[eventType];
    if (handler) {
      handler(payload);
    }
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
    if (this.isLoading || this.history[this.historyIndex] === path) {
      return;
    }
    this.clearSelection();
    if (path === '') {
      await this.loadDisks();
    } else {
      await this.loadFiles(path);
    }
  }
  async refresh() {
    if (this.isLoading) return;
    const currentPath = this.history[this.historyIndex];
    if (currentPath) {
      this.clearSelection();
      if (currentPath === '') {
        await this.loadDisks(false);
      } else {
        await this.loadFiles(currentPath, false);
      }
    }
  }
  async goBack() {
    if (this.isLoading || this.historyIndex <= 0) return;
    this.historyIndex--;
    const path = this.history[this.historyIndex];
    this.clearSelection();
    if (path === '') {
      await this.loadDisks(false);
    } else {
      await this.loadFiles(path, false);
    }
    this.tabManager.updateNavigationButtons();
  }
  async goForward() {
    if (this.isLoading || this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    const path = this.history[this.historyIndex];
    this.clearSelection();
    if (path === '') {
      await this.loadDisks(false);
    } else {
      await this.loadFiles(path, false);
    }
    this.tabManager.updateNavigationButtons();
  }
  async loadDisks(addToHistory = true) {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      this.setTitle('');
      this.tabManager.setPathInputValue('');
      this.filterTerm = '';
      this.tabManager.filterInput.value = '';
      const [disksResponse, diskViewTemplate] = await Promise.all([fetch('/api/disks'), this.tabManager.getTemplate('./tpl/viewMode/disk.html')]);
      if (!disksResponse.ok) throw new Error('Failed to load disk data');
      const disks = await disksResponse.json();
      this.allItems = disks;
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
        this.history.push('');
        this.historyIndex = this.history.length - 1;
        this.tabManager.updateNavigationButtons();
      }
    } catch (error) {
      console.error('Error fetching disk data:', error);
    } finally {
      this.isLoading = false;
    }
  }
  async loadFiles(path, addToHistory = true) {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      this.setTitle(path.split('\\').pop() || path);
      this.tabManager.setPathInputValue(path);
      const [filesResponse, listTemplate] = await Promise.all([fetch(`/api/files?path=${encodeURIComponent(path)}`), this.tabManager.getTemplate('./tpl/viewMode/list.html')]);
      if (!filesResponse.ok) {
        throw new Error('Failed to load file data');
      }
      const data = await filesResponse.json();
      this.allItems = [...data.directories, ...data.files];
      const parser = new DOMParser();
      const doc = parser.parseFromString(listTemplate, 'text/html');
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(doc.querySelector('.w-full'));
      this.renderFiles(this.allItems);
      if (this.filterTerm) {
        this.filterFiles(this.filterTerm);
      }
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
    } finally {
      this.isLoading = false;
    }
  }
  filterFiles(searchTerm) {
    this.filterTerm = searchTerm;
    if (!searchTerm) {
      this.renderFiles(this.allItems);
      return;
    }
    const filteredItems = this.allItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
    this.renderFiles(filteredItems);
  }
  renderFiles(items) {
    const fileListContainer = this.contentElement.querySelector('.divide-y');
    if (!fileListContainer) return;
    const fileTemplate = this.tabManager.templateCache['./tpl/viewMode/list.html'].match(/<for>([\s\S]*?)<\/for>/)[1].trim();
    fileListContainer.innerHTML = '';
    items.forEach((file) => {
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
      const mark = localStorage.getItem(`${file.path}_mark_temp`);
      if (mark) {
        fileElement.classList.add(mark === 'cut' ? 'marked-cut' : 'marked-copy');
      }
      fileElement.addEventListener('click', (e) => this.handleItemClick(e, file, fileElement));
      if (file.isDirectory) {
        fileElement.addEventListener('dblclick', async () => await this.loadPath(file.path));
      }
      fileListContainer.appendChild(fileElement);
    });
    this.updateItemCount();
  }
  handleItemClick(event, item, element) {
    event.stopPropagation();
    const isCtrlPressed = event.ctrlKey || event.metaKey;
    const isShiftPressed = event.shiftKey;
    if (isShiftPressed && this.lastSelectedItem) {
      const lastItem = this.lastSelectedItem;
      this.clearSelection(false);
      const lastIndex = this.allItems.findIndex((i) => i.path === lastItem.path);
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
  selectAllItems() {
    this.allItems.forEach(item => this.selectedItems.add(item));
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
  updateItemMarks() {
    this.contentElement.querySelectorAll('[data-item-id]').forEach((el) => {
      const itemId = el.dataset.itemId;
      const mark = localStorage.getItem(`${itemId}_mark_temp`);
      el.classList.remove('marked-cut', 'marked-copy');
      if (mark) {
        el.classList.add(mark === 'cut' ? 'marked-cut' : 'marked-copy');
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
      filterTerm: this.filterTerm,
    };
  }
}
