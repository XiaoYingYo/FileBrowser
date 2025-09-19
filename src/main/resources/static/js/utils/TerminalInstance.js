class TerminalInstance {
  /**
   * @param {string} tabId - The ID of the parent file browser tab.
   * @param {string} initialPath - The initial working directory for the terminal.
   */
  constructor(tabId, initialPath) {
    this.id = `terminal-${Date.now()}`;
    this.tabId = tabId;
    this.currentPath = initialPath || 'C:\\'; // Default path if none provided

    // Create header element (the tab itself)
    this.headerElement = document.createElement('div');
    this.headerElement.className = 'flex items-center bg-[#1e1e1e] px-3 py-2 border-r border-gray-700 cursor-pointer';
    this.headerElement.dataset.terminalId = this.id;
    this.headerElement.innerHTML = `
      <span class="material-icons text-base mr-2">terminal</span>
      <span class="text-sm">命令提示符</span>
      <button class="ml-2 p-0.5 hover:bg-gray-600 rounded close-terminal-button">
        <span class="material-icons text-xs">close</span>
      </button>
    `;

    // Create body element (the terminal content)
    this.bodyElement = document.createElement('div');
    this.bodyElement.className = 'p-4 font-mono text-sm h-full overflow-y-auto bg-black';
    this.bodyElement.style.display = 'none'; // Initially hidden
    this.bodyElement.dataset.terminalId = this.id;
    this.bodyElement.innerHTML = `
      <p class="text-white" contenteditable="false">Microsoft Windows [版本 10.0.19042.1288]</p>
      <p class="text-white" contenteditable="false">(c) Microsoft Corporation. All rights reserved.</p>
      <br />
      <div class="flex items-start">
        <span class="text-white whitespace-pre" contenteditable="false">${this.currentPath}> </span>
        <div class="flex-grow" contenteditable="true"></div>
      </div>
    `;
  }

  /**
   * Shows the terminal's body and marks its header as active.
   */
  show() {
    this.bodyElement.style.display = 'block';
    this.headerElement.classList.add('bg-[#2d2d2d]'); // Use the same active color as file tabs
  }

  /**
   * Hides the terminal's body and marks its header as inactive.
   */
  hide() {
    this.bodyElement.style.display = 'none';
    this.headerElement.classList.remove('bg-[#2d2d2d]');
  }

  /**
   * Focuses on the terminal's input area.
   */
  focus() {
    const input = this.bodyElement.querySelector('[contenteditable="true"]');
    if (input) {
      input.focus();
    }
  }
}