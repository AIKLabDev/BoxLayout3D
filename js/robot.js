import App from './App.js';
import CoordinateAxes from './axes.js';

const ROBOT_COLOR = 0x87ceeb;
const ROBOT_PARTS = [
  { name: 'base', file: 'robotModel/base.stl' },
  { name: 'link1', file: 'robotModel/link1.stl' },
  { name: 'link2', file: 'robotModel/link2.stl' },
  { name: 'link3', file: 'robotModel/link3.stl' },
  { name: 'link4', file: 'robotModel/link4.stl' },
  { name: 'link5', file: 'robotModel/link5.stl' },
  { name: 'link6', file: 'robotModel/link6.stl' }
];

const ROBOT_ZONE_MARGIN = 160;
const ROBOT_LABEL_SIZE = 220;
const ROBOT_DEFAULT_FORWARD_CLEARANCE = 320;

App.prototype.getRobotHomePosition = function getRobotHomePosition() {
  const halfDepth = this.spaceSize.depth / 2;
  const clearance = this.robotForwardClearance ?? ROBOT_DEFAULT_FORWARD_CLEARANCE;
  return {
    x: 0,
    z: -halfDepth - clearance
  };
};

App.prototype.disposeRobotMarker = function disposeRobotMarker() {
  if (!this.robotMarker) return;
  this.scene.remove(this.robotMarker);
  if (this.robotMarker.material) {
    if (this.robotMarker.material.map) {
      this.robotMarker.material.map.dispose();
    }
    this.robotMarker.material.dispose();
  }
  if (this.robotMarker.geometry) {
    this.robotMarker.geometry.dispose();
  }
  this.robotMarker = null;
};

App.prototype.createRobotZoneMarker = function createRobotZoneMarker() {
  const position = this.getRobotHomePosition();
  this.disposeRobotMarker();

  const size = ROBOT_LABEL_SIZE;
  const canvasSize = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvasSize, canvasSize);
  ctx.fillStyle = 'rgba(255, 255, 255, 0)';
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  ctx.fillStyle = 'rgba(220, 38, 38, 0.12)';
  const padding = 32;
  ctx.fillRect(padding, padding, canvasSize - padding * 2, canvasSize - padding * 2);

  ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(padding, padding, canvasSize - padding * 2, canvasSize - padding * 2);

  const texture = new THREE.CanvasTexture(canvas);
  if (this.renderer?.capabilities?.getMaxAnisotropy) {
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
  }
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });
  const geometry = new THREE.PlaneGeometry(size, size);
  const marker = new THREE.Mesh(geometry, material);
  marker.rotation.x = -Math.PI / 2;
  marker.position.set(position.x, 0.2, position.z);
  marker.renderOrder = 2;

  this.scene.add(marker);
  this.robotMarker = marker;
};

App.prototype.computeRobotAxisLength = function computeRobotAxisLength(bounds) {
  if (!bounds || bounds.isEmpty()) {
    return 180;
  }
  const size = bounds.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const length = Math.max(80, maxDim * 0.45);
  return Math.min(length, 400);
};

App.prototype.updateRobotAxes = function updateRobotAxes(bounds) {
  if (!this.robotGroup) return;
  const axisLength = this.computeRobotAxisLength(bounds);
  const axisOrigin = new THREE.Vector3(0, 0.02, 0);
  if (!this.robotAxes) {
    this.robotAxes = new CoordinateAxes({
      name: 'robotAxes',
      axisLength,
      origin: axisOrigin,
      arrowHead: {
        lengthRatio: 0.18,
        widthRatio: 0.12,
        minLength: 24,
        minWidth: 12
      },
      label: {
        offsetRatio: 0.35,
        minOffset: 18,
        scaleRatio: 0.16,
        minScale: 26,
        horizontalLiftRatio: 0.035,
        horizontalMinLift: 14
      }
    });
  } else {
    this.robotAxes.setLength(axisLength);
    this.robotAxes.setOrigin(axisOrigin);
  }
  this.robotAxes.attachTo(this.robotGroup);
};

App.prototype.loadRobotIntoScene = function loadRobotIntoScene() {
  if (typeof THREE === 'undefined' || typeof THREE.STLLoader !== 'function') {
    console.warn('STLLoader가 로드되지 않아 로봇 모델을 불러올 수 없습니다.');
    return;
  }

  if (this.robotAnchor) {
    this.robotAnchor.traverse((child) => {
      if (!child.isMesh) return;
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat.map) mat.map.dispose();
          if (mat.dispose) mat.dispose();
        });
      }
      if (child.geometry && child.geometry.dispose) {
        child.geometry.dispose();
      }
    });
    this.scene.remove(this.robotAnchor);
  }

  const anchor = new THREE.Group();
  anchor.name = 'robot-anchor';
  this.scene.add(anchor);
  this.robotAnchor = anchor;

  this.disposeRobotMarker();

  const robotGroup = new THREE.Group();
  robotGroup.name = 'robot-model';
  anchor.add(robotGroup);
  this.robotGroup = robotGroup;

  const loader = new THREE.STLLoader();
  const loadPart = (part) =>
    new Promise((resolve, reject) => {
      loader.load(
        part.file,
        (geometry) => {
          geometry.computeVertexNormals();

          const material = new THREE.MeshStandardMaterial({
            color: ROBOT_COLOR,
            metalness: 0.25,
            roughness: 0.55
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = part.name;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          robotGroup.add(mesh);
          resolve(mesh);
        },
        undefined,
        (err) => {
          const error = err instanceof Error ? err : new Error(String(err));
          error.message = `[RobotModel] ${part.name} 로딩 실패: ${error.message}`;
          reject(error);
        }
      );
    });

  Promise.all(ROBOT_PARTS.map(loadPart))
    .then(() => {
      robotGroup.rotation.set(0, 0, Math.PI);
      robotGroup.updateWorldMatrix(true, true);

      const baseMesh = robotGroup.children.find((child) => child.name === 'base');
      if (baseMesh) {
        const baseBounds = new THREE.Box3().setFromObject(baseMesh);
        const baseCenter = baseBounds.getCenter(new THREE.Vector3());
        robotGroup.position.set(-baseCenter.x, -baseBounds.min.y, -baseCenter.z);
      }

      robotGroup.updateWorldMatrix(true, true);

      const bounds = new THREE.Box3().setFromObject(robotGroup);
      if (!baseMesh && !bounds.isEmpty()) {
        const centerFallback = bounds.getCenter(new THREE.Vector3());
        const minFallback = bounds.min.clone();
        robotGroup.position.set(-centerFallback.x, -minFallback.y, -centerFallback.z);
        robotGroup.updateWorldMatrix(true, true);
        bounds.copy(new THREE.Box3().setFromObject(robotGroup));
      }

      this.updateRobotAxes(bounds);

      const clearance = !bounds.isEmpty()
        ? ROBOT_ZONE_MARGIN + Math.max(0, bounds.max.z)
        : ROBOT_DEFAULT_FORWARD_CLEARANCE;
      this.robotForwardClearance = clearance;

      const home = this.getRobotHomePosition();
      anchor.position.set(home.x, 0, home.z);
      this.createRobotZoneMarker();
    })
    .catch((err) => {
      console.error(err);
      this.showMessage('로봇 모델을 불러오지 못했습니다.', 'error');
    });
};
