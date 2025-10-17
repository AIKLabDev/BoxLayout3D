import WorkspaceScene from './scenes/WorkspaceScene.js';

WorkspaceScene.prototype.adjustCameraOrbit = function adjustCameraOrbit(dx, dy) {
  if (dx === 0 && dy === 0) return;
  if (this.cameraState.topViewActive) return;
  this.exitTopView({ snapPhi: true });
  const spherical = this.cameraState.spherical;
  spherical.theta -= dx * 0.01;
  spherical.phi -= dy * 0.01;
  this.clampSpherical();
  this.updateCameraFromState();
};

WorkspaceScene.prototype.handleWheel = function handleWheel(deltaY) {
  this.cancelCameraAnimation();
  const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
  this.camera.zoom = THREE.MathUtils.clamp(
    this.camera.zoom * zoomFactor,
    this.cameraZoomBounds.min,
    this.cameraZoomBounds.max
  );
  this.camera.updateProjectionMatrix();

  const radiusFactor = deltaY > 0 ? 1.05 : 0.95;
  this.cameraState.spherical.radius *= radiusFactor;
  this.clampSpherical();
  if (!this.cameraState.topViewActive) {
    this.orbitZoomSnapshot = this.camera.zoom;
  }
  this.updateCameraFromState();
};

WorkspaceScene.prototype.cancelCameraAnimation = function cancelCameraAnimation() {
  this.cameraAnimation = null;
};

WorkspaceScene.prototype.startCameraAnimation = function startCameraAnimation(targetSpherical, options = {}) {
  const target = targetSpherical.clone();
  const minPhi = this.cameraState.topViewActive ? 0 : this.cameraState.minPhi;
  target.phi = THREE.MathUtils.clamp(target.phi, minPhi, this.cameraState.maxPhi);
  target.radius = THREE.MathUtils.clamp(
    target.radius,
    this.cameraState.minRadius,
    this.cameraState.maxRadius
  );

  const duration = options.duration ?? 500;
  const easing = options.easing ?? this.easeInOutQuad;
  const zoomToRaw = options.zoom !== undefined ? options.zoom : this.camera.zoom;
  const zoomTo = THREE.MathUtils.clamp(zoomToRaw, this.cameraZoomBounds.min, this.cameraZoomBounds.max);

  this.cameraAnimation = {
    from: this.cameraState.spherical.clone(),
    to: target,
    start: performance.now(),
    duration,
    easing,
    zoomFrom: this.camera.zoom,
    zoomTo,
    onComplete: options.onComplete || null
  };
};

WorkspaceScene.prototype.tickCameraAnimation = function tickCameraAnimation() {
  if (!this.cameraAnimation) return;

  const { start, duration, from, to, easing, zoomFrom, zoomTo, onComplete } = this.cameraAnimation;
  const elapsed = (performance.now() - start) / duration;
  const clamped = Math.min(Math.max(elapsed, 0), 1);
  const t = easing ? easing(clamped) : clamped;

  this.cameraState.spherical.radius = THREE.MathUtils.lerp(from.radius, to.radius, t);
  this.cameraState.spherical.phi = THREE.MathUtils.lerp(from.phi, to.phi, t);
  this.cameraState.spherical.theta = this.lerpAngle(from.theta, to.theta, t);
  this.clampSpherical();

  const zoom = THREE.MathUtils.lerp(zoomFrom, zoomTo, t);
  this.camera.zoom = zoom;
  this.camera.updateProjectionMatrix();
  this.updateCameraFromState();

  if (clamped >= 1) {
    this.cameraState.spherical.copy(to);
    this.camera.zoom = zoomTo;
    this.camera.updateProjectionMatrix();
    this.updateCameraFromState();
    this.cameraAnimation = null;
    if (onComplete) onComplete();
  }
};

WorkspaceScene.prototype.toggleView = function toggleView() {
  if (this.cameraAnimation) this.cancelCameraAnimation();
  if (this.cameraState.topViewActive) {
    this.returnToOrbitView();
  } else {
    this.goToTopView();
  }
};

WorkspaceScene.prototype.storeOrbitState = function storeOrbitState() {
  const s = this.cameraState.spherical;
  this.previousCameraState = {
    spherical: new THREE.Spherical(s.radius, s.phi, s.theta),
    zoom: this.camera.zoom
  };
};

WorkspaceScene.prototype.updateViewButton = function updateViewButton(isTopView) {
  if (!this.topViewBtn) return;
  this.topViewBtn.textContent = isTopView ? '3d View' : 'Top View';
};

WorkspaceScene.prototype.goToTopView = function goToTopView() {
  this.cancelCameraAnimation();
  if (!this.cameraState.topViewActive) {
    this.storeOrbitState();
  }
  const target = this.cameraState.spherical.clone();
  target.theta = 0;
  target.phi = 0;
  target.radius = Math.max(target.radius, 2200);

  this.orbitZoomSnapshot = this.camera.zoom;
  this.cameraState.topViewActive = true;
  this.camera.up.copy(this.topViewUp);
  this.updateViewButton(true);

  const zoom = this.computeTopViewZoom();
  this.startCameraAnimation(target, {
    duration: 520,
    easing: this.easeInOutQuad,
    zoom,
    onComplete: () => {
      this.cameraState.spherical.phi = 0;
      this.updateCameraFromState();
    }
  });
};

WorkspaceScene.prototype.returnToOrbitView = function returnToOrbitView() {
  if (!this.cameraState.topViewActive) return;

  const storedSpherical = this.previousCameraState?.spherical ?? this.initialOrbitSpherical;
  const target = new THREE.Spherical(
    storedSpherical.radius,
    storedSpherical.phi,
    storedSpherical.theta
  );
  const storedZoom = this.previousCameraState?.zoom ?? this.orbitZoomSnapshot;
  const targetZoom = THREE.MathUtils.clamp(
    storedZoom,
    this.cameraZoomBounds.min,
    this.cameraZoomBounds.max
  );

  this.exitTopView({ applyUpdate: true, restoreZoom: false });
  this.updateViewButton(false);
  this.startCameraAnimation(target, {
    duration: 520,
    easing: this.easeInOutQuad,
    zoom: targetZoom,
    onComplete: () => {
      this.orbitZoomSnapshot = targetZoom;
      this.previousCameraState = null;
      this.updateCameraFromState();
    }
  });
};

WorkspaceScene.prototype.exitTopView = function exitTopView({ applyUpdate = false, restoreZoom = false, snapPhi = false } = {}) {
  if (!this.cameraState.topViewActive) return false;
  this.cameraState.topViewActive = false;
  this.camera.up.copy(this.defaultUp);
  if (restoreZoom) {
    const restored = THREE.MathUtils.clamp(
      this.orbitZoomSnapshot,
      this.cameraZoomBounds.min,
      this.cameraZoomBounds.max
    );
    this.camera.zoom = restored;
  } else {
    this.orbitZoomSnapshot = this.camera.zoom;
  }
  this.camera.updateProjectionMatrix();
  if (snapPhi) {
    this.cameraState.spherical.phi = Math.max(this.cameraState.spherical.phi, this.cameraState.minPhi);
  }
  if (applyUpdate) this.updateCameraFromState();
  return true;
};

WorkspaceScene.prototype.clampSpherical = function clampSpherical() {
  const s = this.cameraState.spherical;
  const twoPi = Math.PI * 2;
  s.theta = ((s.theta % twoPi) + twoPi) % twoPi;
  const minPhi = this.cameraState.topViewActive ? 0 : this.cameraState.minPhi;
  s.phi = THREE.MathUtils.clamp(s.phi, minPhi, this.cameraState.maxPhi);
  s.radius = THREE.MathUtils.clamp(s.radius, this.cameraState.minRadius, this.cameraState.maxRadius);
};

WorkspaceScene.prototype.lerpAngle = function lerpAngle(a, b, t) {
  const twoPi = Math.PI * 2;
  let diff = (b - a) % twoPi;
  if (diff < -Math.PI) diff += twoPi;
  if (diff > Math.PI) diff -= twoPi;
  return a + diff * t;
};

WorkspaceScene.prototype.updateCameraFromState = function updateCameraFromState() {
  this.clampSpherical();
  this.camera.position.setFromSpherical(this.cameraState.spherical);
  this.camera.up.copy(this.cameraState.topViewActive ? this.topViewUp : this.defaultUp);
  this.camera.lookAt(this.cameraTarget);
};

WorkspaceScene.prototype.computeTopViewZoom = function computeTopViewZoom() {
  const aspect = (window.innerWidth - 340) / window.innerHeight;
  const requiredVertical = this.spaceSize.depth * 1.1;
  const requiredHorizontal = this.spaceSize.width * 1.1;
  const zoomV = this.frustumSize / requiredVertical;
  const zoomH = (this.frustumSize * aspect) / requiredHorizontal;
  const targetZoom = Math.min(zoomV, zoomH);
  return THREE.MathUtils.clamp(targetZoom, this.cameraZoomBounds.min, this.cameraZoomBounds.max);
};

WorkspaceScene.prototype.easeInOutQuad = function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};
