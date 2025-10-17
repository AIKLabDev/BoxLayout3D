export default class AuxiliaryScene {
  constructor({ containerId, workspace } = {}) {
    this.workspace = workspace || null;
    this.container = containerId ? document.getElementById(containerId) : null;
    this.canvasParent = this.container;
    this.renderer = null;
    this.camera = null;
    this.frameHandle = null;
    this.orbitTarget = new THREE.Vector3(0, 0, 0);
    const space = this.workspace?.spaceSize;
    this.orbitRadius = space ? Math.max(space.width, space.depth) * 0.9 : 2200;
    this.orbitHeight = space ? Math.max(space.height * 0.45, 800) : 1200;

    if (!this.container) {
      console.warn('[AuxiliaryScene] 지정된 컨테이너를 찾을 수 없습니다:', containerId);
      return;
    }

    this.initRenderer();
    this.initCamera();
    this.resizeHandler = () => this.handleResize();
    this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.animate();
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
    this.camera = new THREE.PerspectiveCamera(55, aspect, 10, 12000);
    this.orbitAngle = Math.PI * 0.35;
    this.updateCameraTransform();
  }

  getViewportSize() {
    if (!this.container) {
      return { width: 1, height: 1 };
    }
    const rect = this.container.getBoundingClientRect();
    return {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height)
    };
  }

  handleResize() {
    if (!this.renderer || !this.camera) return;
    const { width, height } = this.getViewportSize();
    this.renderer.setSize(width, height);
    this.camera.aspect = height > 0 ? width / height : 1;
    this.camera.updateProjectionMatrix();
  }

  updateCameraTransform(deltaAngle = 0) {
    this.orbitAngle += deltaAngle;
    const x = Math.cos(this.orbitAngle) * this.orbitRadius;
    const z = Math.sin(this.orbitAngle) * this.orbitRadius;
    this.camera.position.set(x, this.orbitHeight, z);
    const lookAtTarget = this.workspace?.cameraTarget ?? this.orbitTarget;
    this.camera.lookAt(lookAtTarget);
  }

  animate() {
    this.frameHandle = requestAnimationFrame(() => this.animate());
    if (!this.renderer || !this.camera) return;

    const now = performance.now();
    const deltaMs = this.lastFrameTime ? now - this.lastFrameTime : 16;
    this.lastFrameTime = now;
    const deltaAngle = Math.min(deltaMs, 100) * 0.0002;
    this.updateCameraTransform(deltaAngle);
    const scene = this.workspace?.scene;
    if (scene) {
      this.renderer.render(scene, this.camera);
    }
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
