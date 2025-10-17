import WorkspaceScene from './scenes/WorkspaceScene.js';

WorkspaceScene.prototype.findBestSnapPosition = function findBestSnapPosition(box, considerBelowOnly = false) {
  let bestY = box.size.h / 2;
  for (const other of this.boxes) {
    if (other === box) continue;
    if (considerBelowOnly) {
      const otherTop = other.position.y + other.size.h / 2;
      const boxBottom = box.position.y - box.size.h / 2;
      if (otherTop > boxBottom + 1e-6) continue;
    }
    if (this.rectOverlapXZ(box, other)) {
      const candidate = other.position.y + other.size.h / 2 + box.size.h / 2;
      if (candidate > bestY - 1e-6) bestY = candidate;
    }
  }
  bestY = Math.min(bestY, this.spaceSize.height - box.size.h / 2);
  return bestY;
};

WorkspaceScene.prototype.computeDraggedY = function computeDraggedY(box, prevY) {
  const eps = 1e-3;
  const h2 = box.size.h / 2;
  const bottom = prevY - h2;
  const top = prevY + h2;

  let base = 0;
  let pushUp = 0;

  for (const other of this.boxes) {
    if (other === box) continue;
    if (!this.rectOverlapXZ(box, other)) continue;

    const oTop = other.position.y + other.size.h / 2;
    const oBottom = other.position.y - other.size.h / 2;

    const verticalOverlap = bottom < oTop - eps && top > oBottom + eps;
    if (verticalOverlap) {
      pushUp = Math.max(pushUp, oTop);
    }

    if (oTop <= bottom + eps) {
      base = Math.max(base, oTop);
    }
  }
  let y = Math.max(base, pushUp) + h2;
  y = Math.min(y, this.spaceSize.height - h2);
  return y;
};

WorkspaceScene.prototype.rectOverlapXZ = function rectOverlapXZ(a, b) {
  const ax1 = a.position.x - a.size.w / 2;
  const ax2 = a.position.x + a.size.w / 2;
  const az1 = a.position.z - a.size.d / 2;
  const az2 = a.position.z + a.size.d / 2;
  const bx1 = b.position.x - b.size.w / 2;
  const bx2 = b.position.x + b.size.w / 2;
  const bz1 = b.position.z - b.size.d / 2;
  const bz2 = b.position.z + b.size.d / 2;
  const xOverlap = ax1 < bx2 && ax2 > bx1;
  const zOverlap = az1 < bz2 && az2 > bz1;
  return xOverlap && zOverlap;
};

WorkspaceScene.prototype.resolveStacks = function resolveStacks(exclude = null) {
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    const ordered = this.boxes.slice().sort((a, b) => a.position.y - b.position.y);
    for (const b of ordered) {
      if (b === exclude) continue;
      const y = this.findBestSnapPosition(b, true);
      if (Math.abs(y - b.position.y) > 1e-3) {
        b.position.y = y;
        b.mesh.position.y = y;
        changed = true;
      }
      this.updateBoxLabelPosition(b);
    }
  }
};
