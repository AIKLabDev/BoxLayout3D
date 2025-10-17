const templateUrl = new URL('./messageBox.html', import.meta.url);
let templatePromise;

function loadTemplate() {
  if (!templatePromise) {
    templatePromise = fetch(templateUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load message box template: ${response.status}`);
        }
        return response.text();
      })
      .catch((error) => {
        console.error(error);
        return `
          <div class="message-box-layer" data-message-box-layer aria-hidden="true">
            <div class="message-box-backdrop" data-message-box-backdrop></div>
            <div class="message-box" role="alertdialog" aria-modal="true">
              <header class="message-box__header" data-message-box-handle>
                <h2 class="message-box__title" data-message-box-title>Message</h2>
                <button class="message-box__close" type="button" aria-label="Close message" data-message-box-close>&times;</button>
              </header>
              <div class="message-box__body" data-message-box-body></div>
              <footer class="message-box__footer">
                <button class="message-box__action" type="button" data-message-box-primary>확인</button>
              </footer>
            </div>
          </div>
        `;
      });
  }
  return templatePromise;
}

function createId(prefix = 'msgbox') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
}

export default class MessageBox {
  constructor(options = {}) {
    const defaults = {
      parent: document.body,
      defaultTitle: '알림',
      primaryLabel: '확인',
      mode: 'floating',
      rememberPosition: false,
      closeOnBackdrop: undefined,
      draggable: undefined
    };
    this.options = { ...defaults, ...options };
    this.parent = this.options.parent || document.body;
    this.defaultTitle = this.options.defaultTitle || defaults.defaultTitle;
    this.defaultPrimaryLabel = this.options.primaryLabel || defaults.primaryLabel;
    this.mode = this.options.mode === 'modal' ? 'modal' : 'floating';
    this.draggable =
      typeof this.options.draggable === 'boolean' ? this.options.draggable : this.mode === 'floating';
    this.closeOnBackdrop =
      typeof this.options.closeOnBackdrop === 'boolean'
        ? this.options.closeOnBackdrop
        : this.mode === 'modal';
    this.rememberPosition = this.mode === 'floating' && !!this.options.rememberPosition;

    this.root = null;
    this.dialog = null;
    this.titleEl = null;
    this.bodyEl = null;
    this.primaryBtn = null;
    this.closeBtn = null;
    this.header = null;
    this.backdrop = null;
    this.position = null;
    this.dragState = {
      active: false,
      pointerId: null,
      offsetX: 0,
      offsetY: 0
    };
    this._dragListenersActive = false;
    this._isVisible = false;
    this._autoCloseTimer = null;
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handlePointerCancel = this._handlePointerUp.bind(this);
    this._handleResize = this._handleResize.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleCloseClick = this.hide.bind(this);
    this._handlePrimaryClick = this.hide.bind(this);
    this._handleBackdropClick = this._handleBackdropClick.bind(this);

    this.ready = this._initialize();
  }

  static async create(options = {}) {
    const instance = new MessageBox(options);
    await instance.ready;
    return instance;
  }

  async _initialize() {
    const markup = await loadTemplate();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup.trim();
    const layer = wrapper.firstElementChild;
    if (!layer) {
      throw new Error('MessageBox: template did not contain a root element.');
    }

    this.root = layer;
    this.dialog = this.root.querySelector('.message-box');
    this.titleEl = this.root.querySelector('[data-message-box-title]');
    this.bodyEl = this.root.querySelector('[data-message-box-body]');
    this.primaryBtn = this.root.querySelector('[data-message-box-primary]');
    this.closeBtn = this.root.querySelector('[data-message-box-close]');
    this.header = this.root.querySelector('[data-message-box-handle]') || this.dialog;
    this.backdrop = this.root.querySelector('[data-message-box-backdrop]');

    const titleId = createId('message-box-title');
    const bodyId = createId('message-box-body');
    if (this.titleEl) {
      this.titleEl.id = titleId;
      this.titleEl.textContent = this.defaultTitle;
    }
    if (this.bodyEl) {
      this.bodyEl.id = bodyId;
    }
    if (this.dialog) {
      this.dialog.setAttribute('aria-labelledby', titleId);
      this.dialog.setAttribute('aria-describedby', bodyId);
      this.dialog.setAttribute('role', this.mode === 'modal' ? 'alertdialog' : 'dialog');
      this.dialog.setAttribute('aria-modal', this.mode === 'modal' ? 'true' : 'false');
    }

    this.root.classList.add(this.mode === 'modal' ? 'is-modal' : 'is-floating');
    if (this.draggable) {
      this.root.classList.add('is-draggable');
    }

    this._bindEvents();

    this.root.classList.remove('is-visible');
    this.root.setAttribute('aria-hidden', 'true');
    this._isVisible = false;

    this.parent.appendChild(this.root);
  }

  _bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', this._handleCloseClick);
    }
    if (this.primaryBtn) {
      this.primaryBtn.textContent = this.defaultPrimaryLabel;
      this.primaryBtn.addEventListener('click', this._handlePrimaryClick);
    }
    if (this.header && this.draggable) {
      this.header.addEventListener('pointerdown', this._handlePointerDown);
    }
    if (this.backdrop && this.closeOnBackdrop) {
      this.backdrop.addEventListener('click', this._handleBackdropClick);
    }
    window.addEventListener('resize', this._handleResize);
  }

  _handlePointerDown(event) {
    if (!this.draggable || !this.root || !this._isVisible) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = this.root.getBoundingClientRect();
    this.dragState.active = true;
    this.dragState.pointerId = event.pointerId;
    this.dragState.offsetX = event.clientX - rect.left;
    this.dragState.offsetY = event.clientY - rect.top;
    this.root.classList.add('is-dragging');
    this.root.style.transition = 'none';

    if (!this._dragListenersActive) {
      window.addEventListener('pointermove', this._handlePointerMove, { passive: false });
      window.addEventListener('pointerup', this._handlePointerUp);
      window.addEventListener('pointercancel', this._handlePointerCancel);
      this._dragListenersActive = true;
    }

    event.preventDefault();
  }

  _handlePointerMove(event) {
    if (!this.draggable || !this.dragState.active || event.pointerId !== this.dragState.pointerId) return;
    event.preventDefault();
    const left = event.clientX - this.dragState.offsetX;
    const top = event.clientY - this.dragState.offsetY;
    this._applyPosition(left, top);
  }

  _handlePointerUp(event) {
    if (!this.draggable || !this.dragState.active || event.pointerId !== this.dragState.pointerId) return;
    this.dragState.active = false;
    this.dragState.pointerId = null;
    this.root.classList.remove('is-dragging');
    this.root.style.transition = '';
    this._removeDragListeners();
  }

  _removeDragListeners() {
    if (!this._dragListenersActive) return;
    window.removeEventListener('pointermove', this._handlePointerMove);
    window.removeEventListener('pointerup', this._handlePointerUp);
    window.removeEventListener('pointercancel', this._handlePointerCancel);
    this._dragListenersActive = false;
  }

  _handleResize() {
    if (!this.root || this.mode !== 'floating') return;
    if (!this.position) {
      this._center();
      return;
    }
    this._applyPosition(this.position.left, this.position.top);
  }

  _applyPosition(left, top) {
    if (!this.root || this.mode !== 'floating') return;
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || height;
    const padding = 12;
    const maxLeft = Math.max(padding, viewportWidth - width - padding);
    const maxTop = Math.max(padding, viewportHeight - height - padding);
    const clampedLeft = clamp(left, padding, maxLeft);
    const clampedTop = clamp(top, padding, maxTop);

    this.root.style.left = `${clampedLeft}px`;
    this.root.style.top = `${clampedTop}px`;
    this.root.style.transform = 'none';
    this.position = { left: clampedLeft, top: clampedTop };
  }

  _center() {
    if (!this.root || this.mode !== 'floating') return;
    const width = this.root.offsetWidth;
    const height = this.root.offsetHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || width;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || height;
    const left = Math.max(16, (viewportWidth - width) / 2);
    const top = Math.max(16, (viewportHeight - height) / 2);
    this._applyPosition(left, top);
  }

  _prepareForShow() {
    if (!this.root) return;
    if (this.mode !== 'floating') {
      this.root.style.top = '';
      this.root.style.left = '';
      this.root.style.transform = '';
      return;
    }
    if (this._isVisible && this.position) {
      this._applyPosition(this.position.left, this.position.top);
      return;
    }
    if (this.rememberPosition && this.position) {
      this._applyPosition(this.position.left, this.position.top);
    } else {
      this._center();
    }
  }

  _handleBackdropClick(event) {
    if (this.mode !== 'modal') return;
    if (!event || event.target === this.backdrop) {
      this.hide();
    }
  }

  _handleKeyDown(event) {
    if (!this._isVisible) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
    }
  }

  async show(message, options = {}) {
    await this.ready;
    const { title, primaryLabel, autoClose } = options;

    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
    }

    if (this.titleEl) {
      this.titleEl.textContent = typeof title === 'string' && title.length ? title : this.defaultTitle;
    }
    if (this.bodyEl) {
      this.bodyEl.textContent = typeof message === 'undefined' ? '' : String(message);
    }
    if (this.primaryBtn) {
      this.primaryBtn.textContent =
        typeof primaryLabel === 'string' && primaryLabel.length ? primaryLabel : this.defaultPrimaryLabel;
    }

    this.dragState.active = false;
    this.root.classList.remove('is-dragging');
    this._removeDragListeners();
    this._prepareForShow();

    if (!this._isVisible) {
      document.addEventListener('keydown', this._handleKeyDown);
    }
    this.root.classList.add('is-visible');
    this.root.setAttribute('aria-hidden', 'false');
    this._isVisible = true;

    if (typeof autoClose === 'number' && autoClose > 0) {
      this._autoCloseTimer = window.setTimeout(() => this.hide(), autoClose);
    }
  }

  async hide() {
    await this.ready;
    if (!this._isVisible) {
      if (this.root) {
        this.root.classList.remove('is-visible');
        this.root.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    this._isVisible = false;
    if (this.root) {
      this.root.classList.remove('is-visible');
      this.root.setAttribute('aria-hidden', 'true');
      this.root.classList.remove('is-dragging');
      this.root.style.transition = '';
      if (this.mode !== 'floating' || !this.rememberPosition) {
        this.position = null;
        this.root.style.top = '';
        this.root.style.left = '';
        this.root.style.transform = '';
      }
    }
    document.removeEventListener('keydown', this._handleKeyDown);
    this.dragState.active = false;
    this.dragState.pointerId = null;
    this._removeDragListeners();
    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer = null;
    }
  }

  async destroy() {
    await this.ready;
    if (this.closeBtn) {
      this.closeBtn.removeEventListener('click', this._handleCloseClick);
    }
    if (this.primaryBtn) {
      this.primaryBtn.removeEventListener('click', this._handlePrimaryClick);
    }
    if (this.header && this.draggable) {
      this.header.removeEventListener('pointerdown', this._handlePointerDown);
    }
    if (this.backdrop && this.closeOnBackdrop) {
      this.backdrop.removeEventListener('click', this._handleBackdropClick);
    }
    window.removeEventListener('resize', this._handleResize);
    this._removeDragListeners();
    document.removeEventListener('keydown', this._handleKeyDown);
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.root = null;
    this.dialog = null;
    this.header = null;
    this.backdrop = null;
    this.dragState.active = false;
  }
}
