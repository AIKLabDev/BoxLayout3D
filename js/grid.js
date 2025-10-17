import CoordinateAxes, { DEFAULT_AXES_NAME, disposeObject3D } from './axes.js';

const DEFAULT_GRID_NAME = 'workspaceGrid';

export default class WorkspaceGrid {
  constructor({ scene, getSpaceSize, getCameraState, targetSpacing = 200 } = {}) {
    this.scene = scene;
    this.getSpaceSize = getSpaceSize;
    this.getCameraState = getCameraState;
    this.targetSpacing = targetSpacing;
    this.gridName = DEFAULT_GRID_NAME;
    this.axesName = DEFAULT_AXES_NAME;

    this.grid = null;
    this.axes = null;
    this.currentGridSize = null;
    this.currentAxisLength = null;
  }

  sync() {
    const spaceSize = this.getSpaceSize ? this.getSpaceSize() : null;
    if (!spaceSize || !this.scene) return;
    const cameraState = this.getCameraState ? this.getCameraState() : null;

    const targetGridSize = this.computeGridSize(spaceSize, cameraState);
    this.ensureGrid(targetGridSize);
    this.ensureAxes(targetGridSize);
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

  ensureAxes(targetGridSize) {
    const axisLength = this.computeAxisLength(targetGridSize);
    if (!this.scene) return;

    if (!this.axes) {
      this.axes = new CoordinateAxes({
        name: this.axesName,
        axisLength
      });
      this.axes.attachTo(this.scene);
      this.currentAxisLength = axisLength;
      return;
    }

    if (this.currentAxisLength !== axisLength) {
      this.axes.setLength(axisLength);
      this.currentAxisLength = axisLength;
    }

    this.axes.attachTo(this.scene);
  }

  computeAxisLength(gridSize) {
    return Math.max(1500, gridSize * 0.3);
  }

  dispose() {
    if (this.grid) {
      this.scene?.remove(this.grid);
      disposeObject3D(this.grid);
      this.grid = null;
    }

    if (this.axes) {
      this.axes.dispose();
      this.axes = null;
    }

    this.currentGridSize = null;
    this.currentAxisLength = null;
  }
}
