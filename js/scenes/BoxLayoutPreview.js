export default class BoxLayoutPreview {
  constructor({ containerId, workspace } = {}) {
    this.workspace = workspace || null;
    this.container = containerId ? document.getElementById(containerId) : null;
    this.renderer = null;
    this.camera = null;
    this.frameHandle = null;
    this.resizeHandler = null;

    if (!this.container) {
      console.warn('[BoxLayoutPreview] 컨테이너를 찾을 수 없습니다:', containerId);
      return;
    }
    if (!this.workspace) {
      console.warn('[BoxLayoutPreview] 워크스페이스 인스턴스가 필요합니다.');
      return;
    }

    this.initRenderer();
    this.lookTarget = new THREE.Vector3();
    this.initCamera();
    this.handleResize();
    this.resizeHandler = () => this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.animate();
  }

  getViewportSize() {
    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);
  }

  initCamera() {
    const { width, height } = this.getViewportSize();
    const aspect = height > 0 ? width / height : 1;
    const space = this.workspace?.spaceSize || { width: 1000, height: 3000, depth: 1000 };
    const maxSpan = Math.max(space.width, space.depth);
    const distance = Math.max(1200, maxSpan * 0.9);

    this.camera = new THREE.PerspectiveCamera(40, aspect, 10, 20000);
    const eyeY = Math.max(space.height * 0.9, 1600);
    this.camera.position.set(distance, eyeY, distance * 0.8);
    this.lookTarget.set(0, space.height * 0.45, 0);
    this.camera.lookAt(this.lookTarget);
  }

  updateCamera() {
    if (!this.camera) return;
    const space = this.workspace?.spaceSize || { width: 1000, height: 3000, depth: 1000 };
    const maxSpan = Math.max(space.width, space.depth);
    const distance = Math.max(1200, maxSpan * 0.9);
    const eyeY = Math.max(space.height * 0.9, 1600);
    this.camera.position.set(distance, eyeY, distance * 0.8);
    this.lookTarget.set(0, space.height * 0.45, 0);
    this.camera.lookAt(this.lookTarget);
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height);
    this.camera.aspect = height > 0 ? width / height : 1;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  renderScene() {
    if (!this.renderer || !this.camera || !this.workspace?.scene) return;
    this.updateCamera();

    const hidden = [];
    const { robotAnchor, robotMarker } = this.workspace;
    if (robotAnchor) {
      hidden.push({ object: robotAnchor, visible: robotAnchor.visible });
      robotAnchor.visible = false;
    }
    if (robotMarker) {
      hidden.push({ object: robotMarker, visible: robotMarker.visible });
      robotMarker.visible = false;
    }

    this.renderer.render(this.workspace.scene, this.camera);

    hidden.forEach(({ object, visible }) => {
      if (object) object.visible = visible;
    });
  }

  animate() {
    this.frameHandle = requestAnimationFrame(() => this.animate());
    this.renderScene();
  }

  dispose() {
    if (this.frameHandle) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement?.parentElement === this.container) {
        this.container.removeChild(this.renderer.domElement);
      }
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }
}
