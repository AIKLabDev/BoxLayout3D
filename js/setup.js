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

let socket = null;
let connectLabel = '연결';

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

function hasLogEntries() {
  if (!elements.logList) return false;
  return elements.logList.querySelector('li:not(#wsEmptyLog)') !== null;
}

function removeEmptyLog() {
  if (elements.emptyLog && elements.emptyLog.parentElement) {
    elements.emptyLog.remove();
  }
}

function ensureEmptyLog() {
  if (elements.emptyLog && elements.logList && !elements.emptyLog.parentElement && !hasLogEntries()) {
    elements.logList.appendChild(elements.emptyLog);
  }
}

function appendLog(type, content) {
  if (!elements.logList) return;
  const config = LOG_TYPES[type] || LOG_TYPES.info;
  removeEmptyLog();

  const item = document.createElement('li');

  const meta = document.createElement('div');
  meta.className = 'ws-log-meta';

  const badge = document.createElement('span');
  badge.className = `ws-badge ${config.badge}`;
  badge.textContent = config.label;
  meta.appendChild(badge);

  const time = document.createElement('span');
  time.textContent = new Date().toLocaleTimeString();
  meta.appendChild(time);

  item.appendChild(meta);

  const message = document.createElement('div');
  message.className = 'ws-log-message';
  message.textContent = typeof content === 'string' ? content : JSON.stringify(content);
  item.appendChild(message);

  elements.logList.appendChild(item);

  if (elements.autoScroll?.checked) {
    elements.logList.scrollTop = elements.logList.scrollHeight;
  }
}

function safelyCloseSocket(code = 1000, reason = 'Client closed connection') {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    socket.close(code, reason);
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

  try {
    const ws = new WebSocket(url);
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
      ensureEmptyLog();
    });
  } catch (err) {
    appendLog('error', `연결 생성 중 오류: ${err.message}`);
    updateStatus('error', '연결을 생성할 수 없습니다.');
  }
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

function clearLog() {
  if (!elements.logList) return;
  elements.logList.querySelectorAll('li').forEach((item) => {
    if (item !== elements.emptyLog) item.remove();
  });
  ensureEmptyLog();
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

  connectLabel = elements.connectBtn?.textContent || '연결';
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

  elements.clearLogBtn?.addEventListener('click', clearLog);

  window.addEventListener('beforeunload', () => {
    safelyCloseSocket();
  });
}

async function initSetupPanel() {
  const container = await loadSetupTemplate();
  if (!container) return;
  cacheElements();
  bindSetupEvents();
}

bindViewToggle();
initSetupPanel();
