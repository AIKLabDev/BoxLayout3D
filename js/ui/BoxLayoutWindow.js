export default class BoxLayoutWindow {
  constructor({ container, workspace } = {}) {
    this.container = container || null;
    this.workspace = workspace || null;

    if (!this.container) {
      console.warn('[BoxLayoutWindow] 컨테이너 요소를 찾을 수 없습니다.');
      return;
    }
    if (!this.workspace) {
      console.warn('[BoxLayoutWindow] 워크스페이스 인스턴스를 찾을 수 없습니다.');
      return;
    }

    this.initialize();
  }

  initialize() {
    const controlsRoot = this.container.querySelector('#controls');
    if (!controlsRoot) {
      console.warn('[BoxLayoutWindow] controls 루트를 찾을 수 없습니다.');
      return;
    }

    const addBoxBtn = controlsRoot.querySelector('#addBoxBtn');
    const saveLayoutBtn = controlsRoot.querySelector('#saveLayoutBtn');
    const loadLayoutBtn = controlsRoot.querySelector('#loadLayoutBtn');
    const loadInput = controlsRoot.querySelector('#loadInput');
    const boxList = controlsRoot.querySelector('#boxList');

    this.workspace.attachControls({
      addBoxBtn,
      saveLayoutBtn,
      loadLayoutBtn,
      loadInput,
      boxList
    });

    // Ensure UI reflects current state when window initializes.
    this.workspace.updateBoxList();
  }
}
