class TerminalInstance {
  constructor(tabId, initialPath, type = 'cmd') {
    this.id = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.tabId = tabId;
    this.currentPath = initialPath || 'C:\\';
    this.type = type;
    this.ws = null;
    this.commandBuffer = '';
    this.currentLine = null;
    this.heartbeatInterval = null;
    this.headerElement = document.createElement('div');
    this.headerElement.className = 'flex items-center bg-[#1e1e1e] px-3 py-2 border-r border-gray-700 cursor-pointer';
    this.headerElement.dataset.terminalId = this.id;
    const terminalName = type === 'powershell' || type === 'ps' ? 'PowerShell' : '命令提示符';
    this.headerElement.innerHTML = `
      <span class="material-icons text-base mr-2">terminal</span>
      <span class="text-sm">${terminalName}</span>
      <button class="ml-2 p-0.5 hover:bg-gray-600 rounded close-terminal-button">
        <span class="material-icons text-xs">close</span>
      </button>
    `;
    this.bodyElement = document.createElement('div');
    this.bodyElement.className = 'p-4 font-mono text-sm bg-black text-white';
    this.bodyElement.style.display = 'none';
    this.bodyElement.style.position = 'absolute';
    this.bodyElement.style.top = '0';
    this.bodyElement.style.left = '0';
    this.bodyElement.style.right = '0';
    this.bodyElement.style.bottom = '0';
    this.bodyElement.style.overflowY = 'auto';
    this.bodyElement.style.overflowX = 'hidden';
    this.bodyElement.dataset.terminalId = this.id;
    this.bodyElement.style.whiteSpace = 'pre-wrap';
    this.bodyElement.style.wordBreak = 'break-all';
    this.initWebSocket();
    this.setupKeyboardListener();
  }
  initWebSocket() {
    const token = localStorage.getItem('accessToken');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/terminal?token=${encodeURIComponent(token)}&type=${encodeURIComponent(this.type)}&path=${encodeURIComponent(this.currentPath)}`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => {
      console.log('终端 WebSocket 连接已建立');
      this.createInputLine();
      this.startHeartbeat();
    };
    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'output') {
          this.appendOutput(msg.data);
        } else if (msg.type === 'pong') {
          console.log('收到心跳响应');
        }
      } catch (e) {
        console.error('解析WebSocket消息失败:', e);
      }
    };
    this.ws.onerror = (error) => {
      console.error('终端 WebSocket 错误:', error);
      this.appendOutput('\r\n[错误: WebSocket 连接失败]\r\n');
    };
    this.ws.onclose = () => {
      console.log('终端 WebSocket 连接已关闭');
      this.stopHeartbeat();
    };
  }
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 10000);
  }
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  appendOutput(text) {
    if (this.currentLine && this.bodyElement.contains(this.currentLine)) {
      this.currentLine.remove();
      this.currentLine = null;
    }
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (index > 0) {
        this.bodyElement.appendChild(document.createElement('br'));
      }
      if (line) {
        const lineElement = document.createElement('span');
        lineElement.textContent = line.replace(/\r/g, '');
        lineElement.style.display = 'inline';
        this.bodyElement.appendChild(lineElement);
      }
    });
    const shouldScroll = this.shouldAutoScroll();
    if (shouldScroll) {
      this.bodyElement.scrollTop = this.bodyElement.scrollHeight;
    }
    setTimeout(() => this.createInputLine(shouldScroll), 10);
  }
  shouldAutoScroll() {
    const threshold = 50;
    return (this.bodyElement.scrollHeight - this.bodyElement.scrollTop - this.bodyElement.clientHeight) < threshold;
  }
  createInputLine(shouldScroll = true) {
    if (this.currentLine && this.bodyElement.contains(this.currentLine)) {
      return;
    }
    this.currentLine = document.createElement('div');
    this.currentLine.contentEditable = 'true';
    this.currentLine.style.outline = 'none';
    this.currentLine.style.caretColor = 'white';
    this.currentLine.style.minHeight = '1em';
    this.currentLine.style.display = 'inline-block';
    this.currentLine.style.width = '100%';
    this.currentLine.className = 'terminal-input-line';
    this.bodyElement.appendChild(this.currentLine);
    setTimeout(() => {
      if (shouldScroll) {
        this.bodyElement.scrollTop = this.bodyElement.scrollHeight;
      }
      if (document.activeElement === this.bodyElement || !document.activeElement || document.activeElement === document.body) {
        this.currentLine.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(this.currentLine);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }, 0);
  }
  setupKeyboardListener() {
    this.bodyElement.addEventListener('click', (e) => {
      if (this.currentLine && e.target.className !== 'terminal-input-line') {
        const selection = window.getSelection();
        if (!selection || selection.toString().length === 0) {
          this.currentLine.focus();
        }
      }
    });
    this.bodyElement.addEventListener('keydown', (e) => {
      if (e.target.classList.contains('terminal-input-line')) {
        if (e.key === 'Enter' && !e.isComposing) {
          e.preventDefault();
          e.stopPropagation();
          const command = e.target.textContent.trim();
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', data: command + '\r\n' }));
          }
          e.target.contentEditable = 'false';
          e.target.style.color = '#888';
          this.bodyElement.appendChild(document.createElement('br'));
          this.currentLine = null;
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
        } else if (e.ctrlKey && e.key === 'c') {
          e.preventDefault();
          e.stopPropagation();
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'command', data: '\x03' }));
          }
          e.target.contentEditable = 'false';
          this.bodyElement.appendChild(document.createElement('br'));
          this.currentLine = null;
        }
      }
    }, { capture: true });
    this.bodyElement.addEventListener('paste', (e) => {
      if (e.target.classList.contains('terminal-input-line')) {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        selection.deleteFromDocument();
        selection.getRangeAt(0).insertNode(document.createTextNode(text));
        selection.collapseToEnd();
      }
    });
  }
  show() {
    this.bodyElement.style.display = 'block';
    this.headerElement.classList.add('bg-[#2d2d2d]');
    setTimeout(() => {
      if (this.currentLine) {
        this.currentLine.focus();
      } else {
        this.createInputLine();
      }
    }, 100);
  }
  hide() {
    this.bodyElement.style.display = 'none';
    this.headerElement.classList.remove('bg-[#2d2d2d]');
  }
  focus() {
    if (this.currentLine) {
      this.currentLine.focus();
    }
  }
  close() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}