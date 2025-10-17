const DEFAULT_GRID_NAME = 'workspaceGrid';
const DEFAULT_AXES_NAME = 'coordinateAxes';

function disposeObject3D(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.isMesh || child.isLine || child.isSprite) {
      if (child.geometry) {
        child.geometry.dispose();
      }
      const { material } = child;
      if (material) {
        if (Array.isArray(material)) {
          material.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        } else {
          if (material.map) material.map.dispose();
          material.dispose();
        }
      }
    }
  });
}

export default class WorkspaceGrid {
  constructor({ scene, getSpaceSize, getCameraState, targetSpacing = 200 } = {}) {
    this.scene = scene;
    this.getSpaceSize = getSpaceSize;
    this.getCameraState = getCameraState;
    this.targetSpacing = targetSpacing;
    this.grid = null;
    this.axesGroup = null;
    this.currentGridSize = null;
    this.currentAxisLength = null;
    this.gridName = DEFAULT_GRID_NAME;
    this.axesName = DEFAULT_AXES_NAME;
  }

  sync() {
    const spaceSize = this.getSpaceSize ? this.getSpaceSize() : null;
    if (!spaceSize || !this.scene) return;
    const cameraState = this.getCameraState ? this.getCameraState() : null;

    const targetGridSize = this.computeGridSize(spaceSize, cameraState);
    this.ensureGrid(targetGridSize);
    this.ensureAxes(targetGridSize, spaceSize, cameraState);
  }

  computeGridSize(spaceSize, cameraState) {
    const baseSize = Math.max(spaceSize.width, spaceSize.depth);
    const maxOrbitDistance = cameraState?.maxRadius ?? baseSize * 3;
    return Math.max(8000, baseSize * 6, maxOrbitDistance * 2.2);
  }

  ensureGrid(targetGridSize) {
    if (this.grid && this.currentGridSize === targetGridSize) return;

    if (this.grid) {
      this.scene.remove(this.grid);
      disposeObject3D(this.grid);
      this.grid = null;
    }

    const divisions = Math.max(1, Math.round(targetGridSize / this.targetSpacing));
    const grid = new THREE.GridHelper(targetGridSize, divisions, 0xc7d3e5, 0xe7ecf5);
    grid.position.y = 0.01;
    grid.name = this.gridName;

    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((mat) => {
      mat.transparent = true;
      mat.opacity = 0.35;
      mat.depthWrite = false;
    });

    this.scene.add(grid);
    this.grid = grid;
    this.currentGridSize = targetGridSize;
  }

  ensureAxes(targetGridSize, spaceSize, cameraState) {
    const axisLength = this.computeAxisLength(targetGridSize);
    if (this.axesGroup && this.currentAxisLength === axisLength) return;

    if (this.axesGroup) {
      this.scene.remove(this.axesGroup);
      disposeObject3D(this.axesGroup);
      this.axesGroup = null;
    }

    const axesGroup = this.buildAxes(axisLength, spaceSize, cameraState);
    this.scene.add(axesGroup);
    this.axesGroup = axesGroup;
    this.currentAxisLength = axisLength;
  }

  computeAxisLength(gridSize) {
    return Math.max(1500, gridSize * 0.3);
  }

  buildAxes(axisLength) {
    const axesGroup = new THREE.Group();
    axesGroup.name = this.axesName;
    const origin = new THREE.Vector3(0, 0.02, 0);

    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xff4d4d, label: 'X' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3b6bdb, label: 'Y' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x3cb371, label: 'Z' }
    ];

    axes.forEach(({ dir, color, label }) => {
      const arrowHeadLength = Math.max(120, axisLength * 0.15);
      const arrowHeadWidth = Math.max(50, axisLength * 0.07);
      const arrow = new THREE.ArrowHelper(
        dir.clone().normalize(),
        origin,
        axisLength,
        color,
        arrowHeadLength,
        arrowHeadWidth
      );
      axesGroup.add(arrow);

      const labelPos = origin.clone().add(
        dir.clone().normalize().multiplyScalar(axisLength + arrowHeadLength * 0.6)
      );
      if (dir.y === 0) {
        labelPos.y += Math.max(60, axisLength * 0.05);
      }
      const labelScale = Math.max(60, axisLength * 0.1);
      axesGroup.add(this.createAxisLabel(label, color, labelScale, labelPos));
    });

    return axesGroup;
  }

  createAxisLabel(text, color, size, position) {
    const canvasSize = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`;
    ctx.fillText(text, canvasSize / 2, canvasSize / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.setScalar(size);
    return sprite;
  }
}
