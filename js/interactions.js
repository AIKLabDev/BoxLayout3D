import WorkspaceScene from './scenes/WorkspaceScene.js';

WorkspaceScene.prototype.setupControls = function setupControls() {
  const el = this.renderer.domElement;
  let rotating = false;
  const pointer = this.pointer;

  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (e.button === 0) {
      this.tryStartDrag(e);
    } else if ((e.button === 1 || e.button === 2) && !this.cameraState.topViewActive) {
      rotating = true;
      pointer.set(e.clientX, e.clientY);
      this.cancelCameraAnimation();
    }
  });
  el.addEventListener('mousemove', (e) => {
    e.preventDefault();
    if (rotating) {
      if (this.cameraState.topViewActive) {
        rotating = false;
      } else {
        const dx = e.clientX - pointer.x;
        const dy = e.clientY - pointer.y;
        pointer.set(e.clientX, e.clientY);
        this.adjustCameraOrbit(dx, dy);
      }
    }
    if (this.drag.active) this.dragMove(e);
  });
  window.addEventListener('mouseup', () => {
    if (rotating) rotating = false;
    if (this.drag.active) this.endDrag();
  });
  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      this.handleWheel(e.deltaY);
    },
    { passive: false }
  );
};

WorkspaceScene.prototype.raycastFromMouse = function raycastFromMouse(event) {
  const rect = this.renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const mouse = new THREE.Vector2(x, y);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, this.camera);
  return raycaster;
};

WorkspaceScene.prototype.tryStartDrag = function tryStartDrag(event) {
  const raycaster = this.raycastFromMouse(event);
  const intersects = raycaster.intersectObjects(this.boxes.map((b) => b.mesh), false);
  if (intersects.length) {
    const mesh = intersects[0].object;
    const box = this.boxes.find((b) => b.mesh === mesh);
    this.selectBox(box.id);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, hit);

    const offset = hit.clone().sub(new THREE.Vector3(box.position.x, 0, box.position.z));
    this.drag = { active: true, plane, offset, target: box };
  } else {
    this.selectBox(null);
  }
};

WorkspaceScene.prototype.dragMove = function dragMove(event) {
  const { plane, offset, target } = this.drag;
  const raycaster = this.raycastFromMouse(event);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);

  const w2 = this.spaceSize.width / 2;
  const d2 = this.spaceSize.depth / 2;
  const x = THREE.MathUtils.clamp(hit.x - offset.x, -w2 + target.size.w / 2, w2 - target.size.w / 2);
  const z = THREE.MathUtils.clamp(hit.z - offset.z, -d2 + target.size.d / 2, d2 - target.size.d / 2);

  target.position.x = x;
  target.position.z = z;
  target.position.y = this.computeDraggedY(target, target.position.y);
  target.mesh.position.set(target.position.x, target.position.y, target.position.z);
  this.updateBoxLabelPosition(target);

  this.resolveStacks(target);
  this.updateBoxList();
};

WorkspaceScene.prototype.endDrag = function endDrag() {
  this.drag.active = false;
};
