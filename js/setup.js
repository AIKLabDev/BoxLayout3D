const ACTIVE_CLASS = 'is-active';
const viewButtons = Array.from(document.querySelectorAll('[data-view-target]'));
const viewPanels = Array.from(document.querySelectorAll('.view-panel[data-view]'));

const STATUS_CONFIG = {
  offline: { dotClass: 'status-offline', text: '연결되지 않음' },
  connecting: { dotClass: 'status-connecting', text: '연결 중…' },
  online: { dotClass: 'status-online', text: '연결됨' },
  error: { dotClass: 'status-error', text: '오류 발생' }
};

const LOG_TYPES = {
  info: { label: 'INFO', badge: 'ws-badge-info' },
  send: { label: 'SEND', badge: 'ws-badge-send' },
  recv: { label: 'RECV', badge: 'ws-badge-recv' },
  error: { label: 'ERROR', badge: 'ws-badge-error' }
};

const elements = {
  form: null,
  urlInput: null,
  connectBtn: null,
  disconnectBtn: null,
  statusDot: null,
  statusText: null,
  messageInput: null,
  sendBtn: null,
  clearLogBtn: null,
  logList: null,
  emptyLog: null,
  autoScroll: null
};

const serverElements = {
  form: null,
  idInput: null,
  startBtn: null,
  stopBtn: null,
  statusDot: null,
  statusText: null,
  clientsList: null,
  clientsEmpty: null,
  messageInput: null,
  sendBtn: null,
  clearLogBtn: null,
  logList: null,
  emptyLog: null,
  autoScroll: null
};

const serverState = {
  instance: null,
  connections: []
};

let socket = null;
let connectLabel = '연결';
let serverStartLabel = '서버 시작';
let unloadBound = false;

const LOCAL_SERVER_HOST = 'local';

const LocalWebSocketHub = (() => {
  const registry = new Map();
  const normalize = (value) => (value || '').trim().toLowerCase();

  return {
    register(id, server) {
      const key = normalize(id);
      if (!key) {
        throw new Error('서버 ID를 입력하세요.');
      }
      if (registry.has(key)) {
        throw new Error(`이미 사용 중인 서버 ID입니다: ${id}`);
      }
      registry.set(key, server);
      return () => {
        if (registry.get(key) === server) {
          registry.delete(key);
        }
      };
    },
    connect(id) {
      const server = registry.get(normalize(id));
      if (!server) return null;
      try {
        return server.createConnection();
      } catch (err) {
        console.error('Failed to create local WebSocket connection', err);
        return null;
      }
    }
  };
})();

function sanitizeServerId(value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  const replaced = trimmed.replace(/[^a-zA-Z0-9\-_]/g, '-');
  const collapsed = replaced.replace(/-+/g, '-');
  const cleaned = collapsed.replace(/^[-_]+/, '').replace(/[-_]+$/, '');
  return cleaned.toLowerCase();
}

class LocalSocket extends EventTarget {
  constructor(url) {
    super();
    this.url = url;
    this.readyState = LocalSocket.CONNECTING;
    this.binaryType = 'blob';
    this.bufferedAmount = 0;
    this.extensions = '';
    this.protocol = '';
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._peer = null;
  }

  _link(peer) {
    this._peer = peer;
  }

  _open() {
    queueMicrotask(() => {
      if (this.readyState !== LocalSocket.CONNECTING) return;
      this.readyState = LocalSocket.OPEN;
      const event = new Event('open');
      this.dispatchEvent(event);
      if (typeof this.onopen === 'function') {
        try {
          this.onopen(event);
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  send(data) {
    if (this.readyState !== LocalSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    const peer = this._peer;
    if (!peer || peer.readyState !== LocalSocket.OPEN) {
      throw new Error('상대측 소켓이 닫혔습니다.');
    }
    queueMicrotask(() => {
      peer._deliverMessage(data);
    });
  }

  _deliverMessage(data) {
    if (this.readyState !== LocalSocket.OPEN) return;
    const event = new MessageEvent('message', { data });
    this.dispatchEvent(event);
    if (typeof this.onmessage === 'function') {
      try {
        this.onmessage(event);
      } catch (err) {
        console.error(err);
      }
    }
  }

  close(code = 1000, reason = '') {
    if (this.readyState === LocalSocket.CLOSING || this.readyState === LocalSocket.CLOSED) return;
    this._initiateClose(code, reason, true);
  }

  _initiateClose(code, reason, notifyPeer) {
    if (this.readyState === LocalSocket.CLOSED) return;

    if (this.readyState !== LocalSocket.CLOSING) {
      this.readyState = LocalSocket.CLOSING;
      queueMicrotask(() => {
        if (this.readyState === LocalSocket.CLOSED) return;
        this.readyState = LocalSocket.CLOSED;
        const event = new CloseEvent('close', {
          code,
          reason,
          wasClean: code === 1000
        });
        this.dispatchEvent(event);
        if (typeof this.onclose === 'function') {
          try {
            this.onclose(event);
          } catch (err) {
            console.error(err);
          }
        }
      });
    }

    const peer = this._peer;
    this._peer = null;
    if (notifyPeer && peer) {
      peer._initiateClose(code, reason, false);
    }
  }

  _emitError(message) {
    const event = new Event('error');
    event.message = message;
    this.dispatchEvent(event);
    if (typeof this.onerror === 'function') {
      try {
        this.onerror(event);
      } catch (err) {
        console.error(err);
      }
    }
  }
}

LocalSocket.CONNECTING = 0;
LocalSocket.OPEN = 1;
LocalSocket.CLOSING = 2;
LocalSocket.CLOSED = 3;

function createLocalSocketPair(url) {
  const client = new LocalSocket(url);
  const server = new LocalSocket(url);
  client._link(server);
  server._link(client);
  client._open();
  server._open();
  return { client, server };
}

class LocalWebSocketServer {
  constructor(id, hooks = {}) {
    this.id = id;
    this.hooks = hooks;
    this.unregister = null;
    this.connections = new Map();
    this.nextConnectionId = 1;
  }

  start() {
    if (this.unregister) {
      throw new Error('서버가 이미 실행 중입니다.');
    }
    this.unregister = LocalWebSocketHub.register(this.id, this);
    this.hooks.onStatus?.('online', `실행 중: ws://local/${this.id}`);
    this.hooks.onLog?.('info', `서버가 시작되었습니다. (ID: ${this.id})`);
    this._notifyConnections();
  }

  stop() {
    if (!this.unregister) return;
    for (const { socket } of this.connections.values()) {
      socket.close(1012, 'Server stopped');
    }
    this.connections.clear();
    const unregister = this.unregister;
    this.unregister = null;
    unregister();
    this.hooks.onLog?.('info', '서버가 중지되었습니다.');
    this.hooks.onStatus?.('offline', '서버 중지됨');
    this._notifyConnections();
  }

  isRunning() {
    return typeof this.unregister === 'function';
  }

  createConnection() {
    if (!this.isRunning()) {
      throw new Error('서버가 실행 중이 아닙니다.');
    }
    const pair = createLocalSocketPair(`ws://local/${this.id}`);
    this._attachServerSocket(pair.server);
    return pair.client;
  }

  broadcast(message) {
    if (!this.connections.size) {
      this.hooks.onLog?.('info', '전송할 클라이언트가 없습니다.');
      return;
    }
    for (const { socket, id } of this.connections.values()) {
      try {
        socket.send(message);
      } catch (err) {
        this.hooks.onLog?.('error', `클라이언트 #${id} 전송 실패: ${err.message}`);
      }
    }
    this.hooks.onLog?.('send', message, {
      meta: `broadcast (${this.connections.size})`
    });
  }

  _attachServerSocket(socket) {
    const record = {
      id: this.nextConnectionId++,
      connectedAt: new Date(),
      socket
    };
    this.connections.set(socket, record);
    this.hooks.onLog?.('info', `클라이언트 #${record.id} 연결됨`);
    this._notifyConnections();

    socket.addEventListener('message', (event) => {
      this.hooks.onLog?.('recv', event.data, { meta: `#${record.id}` });
    });

    socket.addEventListener('close', (event) => {
      if (!this.connections.has(socket)) return;
      this.connections.delete(socket);
      const reason = event.reason || `코드 ${event.code}`;
      this.hooks.onLog?.('info', `클라이언트 #${record.id} 연결 종료 (${reason})`);
      this._notifyConnections();
    });
  }

  _notifyConnections() {
    const summary = Array.from(this.connections.values()).map(({ id, connectedAt }) => ({
      id,
      connectedAt
    }));
    this.hooks.onConnections?.(summary);
  }
}

function hasLogEntries(ctx = elements) {
  if (!ctx.logList) return false;
  return ctx.logList.querySelector('li[data-log-entry="true"]') !== null;
}

function removeEmptyLog(ctx = elements) {
  if (ctx.emptyLog && ctx.emptyLog.parentElement) {
    ctx.emptyLog.remove();
  }
}

function ensureEmptyLog(ctx = elements) {
  if (!ctx.emptyLog || !ctx.logList) return;
  if (ctx.emptyLog.parentElement) return;
  if (hasLogEntries(ctx)) return;
  ctx.logList.appendChild(ctx.emptyLog);
}

function appendLogEntry(ctx, type, content, options = {}) {
  if (!ctx.logList) return;
  const config = LOG_TYPES[type] || LOG_TYPES.info;
  removeEmptyLog(ctx);

  const item = document.createElement('li');
  item.dataset.logEntry = 'true';

  const meta = document.createElement('div');
  meta.className = 'ws-log-meta';

  const badge = document.createElement('span');
  badge.className = `ws-badge ${config.badge}`;
  badge.textContent = config.label;
  meta.appendChild(badge);

  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString();
  meta.appendChild(time);

  if (options.meta) {
    const detail = document.createElement('span');
    detail.className = 'ws-log-detail';
    detail.textContent = options.meta;
    meta.appendChild(detail);
  }

  item.appendChild(meta);

  const message = document.createElement('div');
  message.className = 'ws-log-message';
  let text = content;
  if (typeof text !== 'string') {
    try {
      text = JSON.stringify(text, null, 2);
    } catch (err) {
      text = String(text);
    }
  }
  message.textContent = text;
  item.appendChild(message);

  ctx.logList.appendChild(item);

  if (ctx.autoScroll?.checked) {
    ctx.logList.scrollTop = ctx.logList.scrollHeight;
  }
}

function appendLog(type, content, options) {
  appendLogEntry(elements, type, content, options);
}

function appendServerLog(type, content, options) {
  appendLogEntry(serverElements, type, content, options);
}

function clearLog(ctx = elements) {
  if (!ctx.logList) return;
  ctx.logList.querySelectorAll('li[data-log-entry="true"]').forEach((item) => item.remove());
  ensureEmptyLog(ctx);
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return '-';
  return date.toLocaleTimeString();
}

function switchView(target) {
  if (!target) return;
  viewButtons.forEach((btn) => {
    btn.classList.toggle(ACTIVE_CLASS, btn.dataset.viewTarget === target);
  });
  viewPanels.forEach((panel) => {
    panel.classList.toggle('view-hidden', panel.dataset.view !== target);
  });
  if (target === 'setup' && elements.urlInput) {
    setTimeout(() => elements.urlInput.focus(), 0);
  }
  if (target === 'workspace' && window.app?.onResize) {
    requestAnimationFrame(() => window.app.onResize());
  }
}

function updateStatus(state, message) {
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.offline;
  if (elements.statusDot) {
    elements.statusDot.className = `status-dot ${config.dotClass}`;
  }
  if (elements.statusText) {
    elements.statusText.textContent = message || config.text;
  }

  if (!elements.connectBtn || !elements.disconnectBtn || !elements.sendBtn || !elements.messageInput) {
    return;
  }

  switch (state) {
    case 'connecting':
      elements.connectBtn.disabled = true;
      elements.connectBtn.textContent = '연결 중…';
      elements.disconnectBtn.disabled = true;
      break;
    case 'online':
      elements.connectBtn.disabled = true;
      elements.connectBtn.textContent = connectLabel;
      elements.disconnectBtn.disabled = false;
      break;
    default:
      elements.connectBtn.disabled = false;
      elements.connectBtn.textContent = connectLabel;
      elements.disconnectBtn.disabled = true;
      break;
  }

  const enablePayload = state === 'online';
  elements.sendBtn.disabled = !enablePayload;
  elements.messageInput.disabled = !enablePayload;
}

function updateServerStatus(state, message) {
  const config = STATUS_CONFIG[state] || STATUS_CONFIG.offline;
  if (serverElements.statusDot) {
    serverElements.statusDot.className = `status-dot ${config.dotClass}`;
  }
  if (serverElements.statusText) {
    serverElements.statusText.textContent = message || config.text;
  }
}

function updateServerControls() {
  const running = Boolean(serverState.instance?.isRunning());
  const hasClients = running && serverState.connections.length > 0;

  if (serverElements.idInput) {
    serverElements.idInput.disabled = running;
  }
  if (serverElements.startBtn) {
    serverElements.startBtn.disabled = running;
    serverElements.startBtn.textContent = running ? '실행 중' : serverStartLabel;
  }
  if (serverElements.stopBtn) {
    serverElements.stopBtn.disabled = !running;
  }
  if (serverElements.sendBtn) {
    serverElements.sendBtn.disabled = !hasClients;
  }
  if (serverElements.messageInput) {
    serverElements.messageInput.disabled = !hasClients;
  }
}

function renderServerClients(connections = []) {
  const list = serverElements.clientsList;
  if (!list) return;

  list.querySelectorAll('.ws-client-item').forEach((item) => item.remove());

  if (!connections.length) {
    if (serverElements.clientsEmpty && !serverElements.clientsEmpty.parentElement) {
      list.appendChild(serverElements.clientsEmpty);
    }
    return;
  }

  if (serverElements.clientsEmpty?.parentElement) {
    serverElements.clientsEmpty.remove();
  }

  connections.forEach((conn) => {
    const item = document.createElement('li');
    item.className = 'ws-client-item';

    const title = document.createElement('strong');
    title.textContent = `클라이언트 #${conn.id}`;
    item.appendChild(title);

    const subtitle = document.createElement('span');
    subtitle.textContent = `연결 시각: ${formatTime(conn.connectedAt)}`;
    item.appendChild(subtitle);

    list.appendChild(item);
  });
}

function handleServerConnectionsChanged(connections = []) {
  serverState.connections = connections;
  renderServerClients(connections);

  if (serverState.instance?.isRunning()) {
    const descriptor = connections.length
      ? `실행 중 • 클라이언트 ${connections.length}명`
      : '실행 중 (대기 중)';
    updateServerStatus('online', descriptor);
  } else {
    updateServerStatus('offline', '서버 중지됨');
  }

  updateServerControls();
}

function startLocalServer() {
  if (!serverElements.idInput) return;

  const sanitized = sanitizeServerId(serverElements.idInput.value || 'local-sim');
  if (!sanitized) {
    appendServerLog('error', '서버 ID를 입력하세요.');
    serverElements.idInput.focus();
    return;
  }

  serverElements.idInput.value = sanitized;

  if (serverState.instance?.isRunning()) {
    appendServerLog('info', '이미 서버가 실행 중입니다. 먼저 중지하세요.');
    return;
  }

  const hooks = {
    onLog: (type, message, options) => appendServerLog(type, message, options),
    onStatus: updateServerStatus,
    onConnections: handleServerConnectionsChanged
  };

  const server = new LocalWebSocketServer(sanitized, hooks);
  serverState.instance = server;
  serverState.connections = [];

  try {
    server.start();
    updateServerControls();
    serverElements.messageInput?.setAttribute('placeholder', '예: {"status":"ready"}');
  } catch (error) {
    serverState.instance = null;
    appendServerLog('error', error.message);
    updateServerStatus('error', error.message);
  }
}

function stopLocalServer() {
  if (!serverState.instance) {
    updateServerStatus('offline', '서버 중지됨');
    return;
  }

  serverState.instance.stop();
  serverState.instance = null;
  serverState.connections = [];
  renderServerClients([]);
  ensureEmptyLog(serverElements);
  updateServerControls();
}

function sendServerMessage() {
  if (!serverState.instance || !serverState.instance.isRunning()) {
    appendServerLog('error', '서버가 실행 중이 아닙니다.');
    return;
  }
  const payload = serverElements.messageInput?.value ?? '';
  if (!payload.trim()) {
    appendServerLog('error', '전송할 메시지를 입력하세요.');
    serverElements.messageInput?.focus();
    return;
  }
  serverState.instance.broadcast(payload);
}

function extractLocalServerId(parsed) {
  const rawPath = (parsed.pathname || '').replace(/^\/+/, '');
  const sanitized = sanitizeServerId(rawPath || 'default');
  return sanitized || 'default';
}

function connectLocalServer(parsed, url) {
  const serverId = extractLocalServerId(parsed);
  const localSocket = LocalWebSocketHub.connect(serverId);
  if (!localSocket) {
    appendLog('error', `로컬 서버(${serverId})가 실행 중이 아닙니다.`);
    updateStatus('error', '로컬 서버에 연결하지 못했습니다.');
    return null;
  }
  localSocket.url = url;
  appendLog('info', `로컬 서버(${serverId})에 연결 시도`);
  return localSocket;
}

function safelyCloseSocket(code = 1000, reason = 'Client closed connection') {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    try {
      socket.close(code, reason);
    } catch (err) {
      console.warn('Failed to close socket', err);
    }
  }
}

function connectWebSocket(url) {
  if (!url) {
    appendLog('error', '서버 주소를 입력하세요.');
    elements.urlInput?.focus();
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    appendLog('error', `유효하지 않은 주소입니다: ${url}`);
    updateStatus('error', '주소 형식을 확인하세요.');
    return;
  }

  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    appendLog('error', `지원하지 않는 프로토콜입니다: ${parsed.protocol}`);
    updateStatus('error', 'ws:// 또는 wss:// 만 지원합니다.');
    return;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    appendLog('info', '기존 연결을 종료하고 새 연결을 시도합니다.');
    safelyCloseSocket(1000, 'Reconnecting');
  }

  updateStatus('connecting');
  appendLog('info', `연결 시도: ${url}`);

  let ws;
  if (parsed.hostname === LOCAL_SERVER_HOST) {
    ws = connectLocalServer(parsed, url);
    if (!ws) {
      ensureEmptyLog(elements);
      return;
    }
  } else {
    try {
      ws = new WebSocket(url);
    } catch (err) {
      appendLog('error', `연결 생성 중 오류: ${err.message}`);
      updateStatus('error', '연결을 생성할 수 없습니다.');
      return;
    }
  }

  socket = ws;

  ws.addEventListener('open', () => {
    if (socket !== ws) return;
    updateStatus('online', `연결됨: ${url}`);
    appendLog('info', '서버와 연결되었습니다.');
  });

  ws.addEventListener('message', (event) => {
    if (socket !== ws) return;
    appendLog('recv', event.data);
  });

  ws.addEventListener('error', () => {
    if (socket !== ws) return;
    updateStatus('error', '연결 오류가 발생했습니다.');
    appendLog('error', 'WebSocket 오류가 발생했습니다.');
  });

  ws.addEventListener('close', (event) => {
    if (socket !== ws) return;
    const reason = event.reason || `코드 ${event.code}`;
    const type = event.wasClean ? 'info' : 'error';
    appendLog(type, `연결 종료: ${reason}`);
    socket = null;
    const status = event.wasClean ? 'offline' : 'error';
    updateStatus(status, event.wasClean ? '연결이 종료되었습니다.' : '비정상적으로 종료되었습니다.');
    ensureEmptyLog(elements);
  });
}

function sendMessage() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    appendLog('error', '연결된 WebSocket이 없습니다.');
    return;
  }
  const payload = elements.messageInput?.value ?? '';
  if (!payload.trim()) {
    appendLog('error', '전송할 메시지를 입력하세요.');
    elements.messageInput?.focus();
    return;
  }
  try {
    socket.send(payload);
    appendLog('send', payload);
  } catch (err) {
    appendLog('error', `메시지 전송 실패: ${err.message}`);
  }
}

function clearClientLog() {
  clearLog(elements);
}

function bindViewToggle() {
  if (!viewButtons.length) return;
  const activeBtn = viewButtons.find((btn) => btn.classList.contains(ACTIVE_CLASS));
  switchView(activeBtn?.dataset.viewTarget || 'workspace');
  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.viewTarget));
  });
}

async function loadSetupTemplate() {
  const container = document.getElementById('setup-panel');
  if (!container) return null;

  const templatePath = container.dataset?.template;
  if (!templatePath) return container;

  try {
    const response = await fetch(templatePath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const markup = await response.text();
    container.innerHTML = markup;
  } catch (err) {
    console.warn('Setup template을 불러오지 못했습니다.', err);
    container.innerHTML =
      '<div class="setup-placeholder">설정 템플릿을 불러올 수 없습니다. 템플릿 경로를 확인하세요.</div>';
  }

  return container;
}

function cacheElements() {
  elements.form = document.getElementById('wsConnectForm');
  elements.urlInput = document.getElementById('wsUrl');
  elements.connectBtn = document.getElementById('wsConnectBtn');
  elements.disconnectBtn = document.getElementById('wsDisconnectBtn');
  elements.statusDot = document.getElementById('wsStatusDot');
  elements.statusText = document.getElementById('wsStatusText');
  elements.messageInput = document.getElementById('wsMessageInput');
  elements.sendBtn = document.getElementById('wsSendBtn');
  elements.clearLogBtn = document.getElementById('wsClearLogBtn');
  elements.logList = document.getElementById('wsLog');
  elements.emptyLog = document.getElementById('wsEmptyLog');
  elements.autoScroll = document.getElementById('wsAutoScroll');

  serverElements.form = document.getElementById('wsServerForm');
  serverElements.idInput = document.getElementById('wsServerId');
  serverElements.startBtn = document.getElementById('wsServerStartBtn');
  serverElements.stopBtn = document.getElementById('wsServerStopBtn');
  serverElements.statusDot = document.getElementById('wsServerStatusDot');
  serverElements.statusText = document.getElementById('wsServerStatusText');
  serverElements.clientsList = document.getElementById('wsServerClients');
  serverElements.clientsEmpty = document.getElementById('wsServerClientsEmpty');
  serverElements.messageInput = document.getElementById('wsServerMessageInput');
  serverElements.sendBtn = document.getElementById('wsServerSendBtn');
  serverElements.clearLogBtn = document.getElementById('wsServerClearLogBtn');
  serverElements.logList = document.getElementById('wsServerLog');
  serverElements.emptyLog = document.getElementById('wsServerEmptyLog');
  serverElements.autoScroll = document.getElementById('wsServerAutoScroll');

  connectLabel = elements.connectBtn?.textContent || '연결';
  serverStartLabel = serverElements.startBtn?.textContent || '서버 시작';
}

function bindSetupEvents() {
  if (!elements.form) return;

  updateStatus('offline');

  elements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = elements.urlInput ? elements.urlInput.value.trim() : '';
    connectWebSocket(url);
  });

  elements.disconnectBtn?.addEventListener('click', () => {
    if (!socket) {
      updateStatus('offline');
      return;
    }
    appendLog('info', '사용자 요청으로 연결을 종료합니다.');
    safelyCloseSocket(1000, 'Client disconnected');
  });

  elements.sendBtn?.addEventListener('click', sendMessage);

  elements.messageInput?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      sendMessage();
    }
  });

  elements.clearLogBtn?.addEventListener('click', clearClientLog);

  if (!unloadBound) {
    window.addEventListener('beforeunload', () => {
      safelyCloseSocket();
      if (serverState.instance?.isRunning()) {
        serverState.instance.stop();
      }
    });
    unloadBound = true;
  }
}

function bindServerEvents() {
  if (!serverElements.form) return;

  updateServerStatus('offline', '서버 중지됨');
  updateServerControls();
  renderServerClients([]);
  ensureEmptyLog(serverElements);

  serverElements.form.addEventListener('submit', (event) => {
    event.preventDefault();
    startLocalServer();
  });

  serverElements.stopBtn?.addEventListener('click', () => {
    stopLocalServer();
  });

  serverElements.sendBtn?.addEventListener('click', sendServerMessage);

  serverElements.messageInput?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      sendServerMessage();
    }
  });

  serverElements.clearLogBtn?.addEventListener('click', () => clearLog(serverElements));
}

async function initSetupPanel() {
  const container = await loadSetupTemplate();
  if (!container) return;
  cacheElements();
  bindSetupEvents();
  bindServerEvents();
  ensureEmptyLog(elements);
  ensureEmptyLog(serverElements);
  updateServerControls();
}

bindViewToggle();
initSetupPanel();
