import WorkspaceGrid from './grid.js';

export default class App {
  constructor() {
    // Work space (mm)
    this.spaceSize = { width: 1000, height: 3000, depth: 1000 };
    this.colors = [0x2d728f, 0x94a187, 0xbf616a, 0xd08770, 0xa3be8c, 0x5e81ac];
    this.colorIdx = 0;

    this.boxes = []; // {id,size:{w,h,d}, position:{x,y,z}, mesh}
    this.selectedBox = null;
    this.drag = { active:false, offset:new THREE.Vector3(), plane:null, target:null };
    this.robotAxes = null;
    this.messageTimer = null;

    // Scene default construct
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf2f5fb);

    const { width: sceneWidth, height: sceneHeight } = this.getSceneDimensions();
    const aspect = sceneWidth / sceneHeight;

    this.frustumSize = 2000;
    const frustumHeight = this.frustumSize;
    const frustumWidth = frustumHeight * aspect;
    this.camera = new THREE.OrthographicCamera(
      -frustumWidth / 2,
      frustumWidth / 2,
      frustumHeight / 2,
      -frustumHeight / 2,
      0.1,
      10000
    );
    this.defaultUp = new THREE.Vector3(0, 1, 0);
    this.topViewUp = new THREE.Vector3(0, 0, -1);
    this.cameraTarget = new THREE.Vector3(0, 0, 0);

    this.camera.position.set(1200, 1000, 1200);
    this.camera.up.copy(this.defaultUp);
    this.camera.lookAt(this.cameraTarget);
    this.cameraZoomBounds = { min: 0.35, max: 4 };
    this.cameraState = {
      spherical: new THREE.Spherical().setFromVector3(this.camera.position.clone()),
      minPhi: 0.01,
      maxPhi: Math.PI - 0.12,
      minRadius: 600,
      maxRadius: 5000,
      topViewActive: false
    };
    this.previousCameraState = null;
    this.initialOrbitSpherical = new THREE.Spherical(
      this.cameraState.spherical.radius,
      this.cameraState.spherical.phi,
      this.cameraState.spherical.theta
    );
    this.cameraAnimation = null;
    this.pointer = new THREE.Vector2();
    this.orbitZoomSnapshot = this.camera.zoom;
    this.updateCameraFromState();

    this.gridOverlay = new WorkspaceGrid({
      scene: this.scene,
      getSpaceSize: () => this.spaceSize,
      getCameraState: () => this.cameraState
    });

    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(sceneWidth, sceneHeight);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    document.getElementById('three-root').appendChild(this.renderer.domElement);

    // Light
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    hemi.position.set(0, 2000, 0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1500, 2000, 1500);
    this.scene.add(dir);

    // draw space, floor, line
    this.drawSpace();
    this.loadRobotIntoScene();

    this.setupControls();

    // UI
    this.topViewBtn = document.getElementById('topViewBtn');
    this.topViewBtn.addEventListener('click', () => this.toggleView());
    const addBoxBtn = document.getElementById('addBoxBtn');
    if (addBoxBtn) addBoxBtn.addEventListener('click', () => this.addBox());
    this.saveBtn = document.getElementById('saveLayoutBtn');
    if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveLayout());
    this.loadBtn = document.getElementById('loadLayoutBtn');
    if (this.loadBtn) this.loadBtn.addEventListener('click', () => this.promptLoadLayout());
    this.loadInput = document.getElementById('loadInput');
    if (this.loadInput) this.loadInput.addEventListener('change', (e) => this.handleLoadFile(e));
    window.addEventListener('resize', () => this.onResize());
    this.updateHud();
    this.updateBoxList();

    this.animate();
  }

  getSceneDimensions() {
    const wrap = document.getElementById('scene-wrap');
    if (!wrap) {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    const rect = wrap.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    return { width, height };
  }

  onResize() {
    const { width, height } = this.getSceneDimensions();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    const aspect = height > 0 ? (width / height) : 1;
    const frustumHeight = this.frustumSize;
    this.camera.left = -frustumHeight * aspect / 2;
    this.camera.right = frustumHeight * aspect / 2;
    this.camera.top = frustumHeight / 2;
    this.camera.bottom = -frustumHeight / 2;

    this.camera.updateProjectionMatrix();
    if (this.cameraState.topViewActive) {
      this.camera.zoom = this.computeTopViewZoom();
      this.camera.updateProjectionMatrix();
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.tickCameraAnimation();
    this.renderer.render(this.scene, this.camera);
  }
}
