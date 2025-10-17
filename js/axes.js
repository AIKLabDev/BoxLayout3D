export const DEFAULT_AXES_NAME = 'coordinateAxes';

function toVector3(source, fallback) {
  if (source instanceof THREE.Vector3) return source.clone();
  if (
    source &&
    typeof source.x === 'number' &&
    typeof source.y === 'number' &&
    typeof source.z === 'number'
  ) {
    return new THREE.Vector3(source.x, source.y, source.z);
  }
  return fallback.clone();
}

export function disposeObject3D(object) {
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

export default class CoordinateAxes {
  constructor({
    name = DEFAULT_AXES_NAME,
    axisLength = 1000,
    origin = new THREE.Vector3(0, 0.02, 0)
  } = {}) {
    this.name = name;
    this.axisLength = axisLength;
    this.origin = toVector3(origin, new THREE.Vector3(0, 0.02, 0));
    this.group = null;
    this.parent = null;
    this.rebuildAxes();
  }

  attachTo(parent) {
    if (this.parent === parent) return;
    if (this.group && this.parent) {
      this.parent.remove(this.group);
    }
    this.parent = parent || null;
    if (this.parent && this.group) {
      this.parent.add(this.group);
    }
  }

  setLength(length) {
    if (length === this.axisLength) return;
    this.axisLength = length;
    this.rebuildAxes();
  }

  setOrigin(origin) {
    if (!origin) return;
    const nextOrigin = toVector3(origin, this.origin);
    if (this.origin.equals(nextOrigin)) return;
    this.origin.copy(nextOrigin);
    this.rebuildAxes();
  }

  getObject3D() {
    return this.group;
  }

  dispose() {
    if (this.group && this.parent) {
      this.parent.remove(this.group);
    }
    disposeObject3D(this.group);
    this.group = null;
    this.parent = null;
  }

  rebuildAxes() {
    if (this.group) {
      if (this.group.parent) {
        this.group.parent.remove(this.group);
      }
      disposeObject3D(this.group);
      this.group = null;
    }
    this.group = this.buildAxes(this.axisLength);
    this.group.name = this.name;
    if (this.parent) {
      this.parent.add(this.group);
    }
  }

  buildAxes(axisLength) {
    const axesGroup = new THREE.Group();
    const origin = this.origin.clone();

    const axes = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xff4d4d, label: 'X' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x3b6bdb, label: 'Y' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x3cb371, label: 'Z' }
    ];

    axes.forEach(({ dir, color, label }) => {
      const normalizedDir = dir.clone().normalize();
      const arrowHeadLength = Math.max(120, axisLength * 0.15);
      const arrowHeadWidth = Math.max(50, axisLength * 0.07);
      const arrow = new THREE.ArrowHelper(
        normalizedDir,
        origin,
        axisLength,
        color,
        arrowHeadLength,
        arrowHeadWidth
      );
      axesGroup.add(arrow);

      const labelPos = origin
        .clone()
        .add(normalizedDir.multiplyScalar(axisLength + arrowHeadLength * 0.6));
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
