class Tab {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.id = `tab-${Date.now()}`;
    this.history = [];
    this.historyIndex = -1;

    this.createElement();
    this.createContentElement();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'flex items-center bg-[#2d2d2d] px-3 py-2 border-r border-gray-700';
    this.element.dataset.tabId = this.id;
    this.element.innerHTML = `
      <span class="material-icons text-yellow-500 text-base mr-2">folder</span>
      <span class="text-sm">新标签页</span>
      <button class="ml-2 p-0.5 hover:bg-gray-600 rounded close-tab-button">
        <span class="material-icons text-xs">close</span>
      </button>
    `;

    this.element.addEventListener('click', () => this.tabManager.switchTab(this.id));
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
    if (path === '此电脑') {
      await this.loadDisks();
    } else {
      await this.loadFiles(path);
    }
  }

  async goBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const path = this.history[this.historyIndex];
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
        element.addEventListener('dblclick', async () => await this.loadPath(disks[index].path));
      });
      document.getElementById('item-count').textContent = `${disks.length} 个项目 |`;
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
      const allItems = [...data.directories, ...data.files];
      const listTemplate = await listTemplateResponse.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(listTemplate, 'text/html');
      this.contentElement.innerHTML = '';
      this.contentElement.appendChild(doc.querySelector('.w-full'));

      const fileListContainer = this.contentElement.querySelector('.divide-y');
      const fileTemplate = fileListContainer.querySelector('for').innerHTML.trim();
      fileListContainer.innerHTML = '';

      allItems.forEach((file) => {
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

        if (file.isDirectory) {
          fileElement.addEventListener('dblclick', async () => await this.loadPath(file.path));
        }
        fileListContainer.appendChild(fileElement);
      });
      document.getElementById('item-count').textContent = `${allItems.length} 个项目 |`;
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
}

class TabManager {
  constructor() {
    this.tabs = {};
    this.activeTabId = null;
    this.visitHistory = [];
    this.tabContainer = document.getElementById('tab-bar');
    this.contentContainer = document.getElementById('content-container');
    this.addTabButton = document.getElementById('add-tab-button');
    this.pathInput = document.getElementById('path-input');

    this.historyBackButton = document.getElementById('history-back-button');
    this.historyForwardButton = document.getElementById('history-forward-button');

    this.initEventListeners();
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

    document.getElementById('refresh-button').addEventListener('click', () => {
      const currentPath = this.pathInput.value;
      if (currentPath && currentPath !== '此电脑') {
        this.getActiveTab()?.loadPath(currentPath);
      }
    });

    this.pathInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const newPath = this.pathInput.value.trim();
        this.getActiveTab()?.loadPath(newPath || '此电脑');
      }
    });
  }

  addTab() {
    const tab = new Tab(this);
    this.tabs[tab.id] = tab;
    this.tabContainer.insertBefore(tab.element, this.addTabButton);
    this.contentContainer.appendChild(tab.contentElement);
    this.switchTab(tab.id);
    tab.loadPath('此电脑');
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

    this.tabs[tabId].show();
    this.updateNavigationButtons();
    const activeTab = this.getActiveTab();
    if (activeTab && activeTab.history.length > 0) {
      this.setPathInputValue(activeTab.history[activeTab.historyIndex]);
    }
  }

  closeTab(tabId) {
    const tab = this.tabs[tabId];
    tab.element.remove();
    tab.contentElement.remove();
    delete this.tabs[tabId];

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
}

document.addEventListener('DOMContentLoaded', () => {
  const tabManager = new TabManager();
  tabManager.addTab();
});

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
