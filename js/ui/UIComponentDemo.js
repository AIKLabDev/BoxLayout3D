const templateUrl = new URL('./uiComponents.html', import.meta.url);
let templatePromise;

function loadTemplate() {
  if (!templatePromise) {
    templatePromise = fetch(templateUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load UI component template: ${response.status}`);
        }
        return response.text();
      })
      .catch((error) => {
        console.error(error);
        return `
          <div class="ui-component-panel" data-ui-component-panel aria-hidden="true">
            <header class="ui-component-panel__header">
              <h2 class="ui-component-panel__title">UI Component Lab</h2>
              <button class="ui-component-panel__close" type="button" aria-label="Close UI component panel" data-ui-panel-close>&times;</button>
            </header>
            <div class="ui-component-panel__body">
              <p>Failed to load UI component panel.</p>
            </div>
          </div>
        `;
      });
  }
  return templatePromise;
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default class UIComponentDemo {
  constructor(options = {}) {
    const defaults = {
      parent: document.body,
      autoHideOnEscape: true
    };
    this.options = { ...defaults, ...options };
    this.parent = this.options.parent || document.body;
    this.autoHideOnEscape = this.options.autoHideOnEscape !== false;

    this.root = null;
    this.closeBtn = null;
    this.editBox = null;
    this.toggleInput = null;
    this.toggleLabel = null;
    this.dpad = null;
    this.dpadButtons = [];
    this.dpadStatus = null;
    this.textDisplay = null;
    this.statusButton = null;
    this.dropdown = null;
    this.dropdownValue = null;

    this._isVisible = false;
    this._handleCloseClick = this.hide.bind(this);
    this._handleDocumentKeyDown = this._handleDocumentKeyDown.bind(this);
    this._handleEditBoxInput = this._handleEditBoxInput.bind(this);
    this._handleToggleChange = this._handleToggleChange.bind(this);
    this._handleStatusButtonClick = this._handleStatusButtonClick.bind(this);
    this._handleDropdownChange = this._handleDropdownChange.bind(this);
    this._handleDpadPointerDown = this._handleDpadPointerDown.bind(this);
    this._handleDpadPointerUp = this._handleDpadPointerUp.bind(this);
    this._handleDpadPointerCancel = this._handleDpadPointerCancel.bind(this);

    this.ready = this._initialize();
  }

  async _initialize() {
    const markup = await loadTemplate();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup.trim();
    const panel = wrapper.firstElementChild;
    if (!panel) {
      throw new Error('UIComponentDemo: template did not contain a root element.');
    }

    this.root = panel;
    this.closeBtn = this.root.querySelector('[data-ui-panel-close]');
    this.editBox = this.root.querySelector('[data-ui-editbox]');
    this.toggleInput = this.root.querySelector('[data-ui-toggle]');
    this.toggleLabel = this.root.querySelector('[data-ui-toggle-label]');
    this.dpad = this.root.querySelector('[data-ui-dpad]');
    this.dpadButtons = this.dpad ? Array.from(this.dpad.querySelectorAll('[data-direction]')) : [];
    this.dpadStatus = this.root.querySelector('[data-ui-dpad-status]');
    this.textDisplay = this.root.querySelector('[data-ui-text]');
    this.statusButton = this.root.querySelector('[data-ui-status-button]');
    this.dropdown = this.root.querySelector('[data-ui-dropdown]');
    this.dropdownValue = this.root.querySelector('[data-ui-dropdown-value]');

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
    if (this.editBox) {
      this.editBox.addEventListener('input', this._handleEditBoxInput);
    }
    if (this.toggleInput) {
      this.toggleInput.addEventListener('change', this._handleToggleChange);
    }
    if (this.statusButton) {
      this.statusButton.addEventListener('click', this._handleStatusButtonClick);
    }
    if (this.dropdown) {
      this.dropdown.addEventListener('change', this._handleDropdownChange);
    }
    if (this.dpadButtons.length > 0) {
      this.dpadButtons.forEach((button) => {
        button.addEventListener('pointerdown', this._handleDpadPointerDown);
        button.addEventListener('pointerup', this._handleDpadPointerUp);
        button.addEventListener('pointerleave', this._handleDpadPointerCancel);
        button.addEventListener('pointercancel', this._handleDpadPointerCancel);
        button.addEventListener('blur', () => button.classList.remove('is-active'));
      });
    }
  }

  _handleDocumentKeyDown(event) {
    if (!this._isVisible || !this.autoHideOnEscape) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
    }
  }

  _handleEditBoxInput(event) {
    if (!this.textDisplay) return;
    const value = String(event.target.value || '').trim();
    this.textDisplay.textContent = value.length > 0 ? value : '입력한 내용이 여기에 표시됩니다.';
  }

  _handleToggleChange(event) {
    if (!this.toggleLabel) return;
    this.toggleLabel.textContent = event.target.checked ? 'On' : 'Off';
  }

  _handleStatusButtonClick() {
    if (!this.statusButton) return;
    const isOn = !this.statusButton.classList.contains('is-off');
    if (isOn) {
      this.statusButton.classList.add('is-off');
      this.statusButton.textContent = 'OFF';
      this.statusButton.setAttribute('aria-pressed', 'false');
    } else {
      this.statusButton.classList.remove('is-off');
      this.statusButton.textContent = 'ON';
      this.statusButton.setAttribute('aria-pressed', 'true');
    }
  }

  _handleDropdownChange(event) {
    if (!this.dropdownValue) return;
    const value = event.target.value;
    if (value) {
      this.dropdownValue.textContent = `선택된 항목: ${value}`;
    } else {
      this.dropdownValue.textContent = '선택된 항목이 없습니다.';
    }
  }

  _handleDpadPointerDown(event) {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const button = event.currentTarget;
    const direction = button.dataset.direction || '';
    button.classList.add('is-active');
    this._updateDpadStatus('Pressed', direction);
    button.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  _handleDpadPointerUp(event) {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const button = event.currentTarget;
    const direction = button.dataset.direction || '';
    button.classList.remove('is-active');
    this._updateDpadStatus('Released', direction);
  }

  _handleDpadPointerCancel(event) {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const button = event.currentTarget;
    button.classList.remove('is-active');
    this._updateDpadStatus('Cancelled', button.dataset.direction || '');
  }

  _updateDpadStatus(state, direction) {
    if (!this.dpadStatus) return;
    const label = direction ? capitalize(direction) : 'None';
    this.dpadStatus.textContent = `${state}: ${label}`;
  }

  async show() {
    await this.ready;
    if (!this.root) return;
    this.root.classList.add('is-visible');
    this.root.setAttribute('aria-hidden', 'false');
    this._isVisible = true;
    if (this.autoHideOnEscape) {
      document.addEventListener('keydown', this._handleDocumentKeyDown);
    }
    if (this.editBox) {
      this.editBox.focus({ preventScroll: true });
    }
  }

  async hide() {
    await this.ready;
    if (!this.root) return;
    this._isVisible = false;
    this.root.classList.remove('is-visible');
    this.root.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this._handleDocumentKeyDown);
  }

  async toggle() {
    if (this._isVisible) {
      await this.hide();
    } else {
      await this.show();
    }
  }

  async destroy() {
    await this.ready;
    if (this.closeBtn) {
      this.closeBtn.removeEventListener('click', this._handleCloseClick);
    }
    if (this.editBox) {
      this.editBox.removeEventListener('input', this._handleEditBoxInput);
    }
    if (this.toggleInput) {
      this.toggleInput.removeEventListener('change', this._handleToggleChange);
    }
    if (this.statusButton) {
      this.statusButton.removeEventListener('click', this._handleStatusButtonClick);
    }
    if (this.dropdown) {
      this.dropdown.removeEventListener('change', this._handleDropdownChange);
    }
    if (this.dpadButtons.length > 0) {
      this.dpadButtons.forEach((button) => {
        button.removeEventListener('pointerdown', this._handleDpadPointerDown);
        button.removeEventListener('pointerup', this._handleDpadPointerUp);
        button.removeEventListener('pointerleave', this._handleDpadPointerCancel);
        button.removeEventListener('pointercancel', this._handleDpadPointerCancel);
      });
    }
    document.removeEventListener('keydown', this._handleDocumentKeyDown);
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
    this.root = null;
  }
}
