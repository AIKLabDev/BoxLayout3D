class App {
  constructor() {
    // 공간(mm)
    this.spaceSize = { width: 1000, height: 3000, depth: 1000 };
    this.colors = [0x2d728f, 0x94a187, 0xbf616a, 0xd08770, 0xa3be8c, 0x5e81ac];
    this.colorIdx = 0;

    // 상태
    this.boxes = [];      // {id,size:{w,h,d}, position:{x,y,z}, mesh}
    this.selectedBox = null;
    this.drag = { active:false, offset:new THREE.Vector3(), plane:null, target:null };

    // 씬 기본 구성
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xefefef);

    const aspect = (window.innerWidth - 340) / window.innerHeight;
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

    this.renderer = new THREE.WebGLRenderer({ antialias:true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth - 340, window.innerHeight);
    document.getElementById('three-root').appendChild(this.renderer.domElement);

    // 조명
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    hemi.position.set(0, 2000, 0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1500, 2000, 1500);
    this.scene.add(dir);

    // 공간/바닥/라인
    this.drawSpace();

    // 컨트롤
    this.setupControls();

    // UI
    this.topViewBtn = document.getElementById('topViewBtn');
    this.topViewBtn.addEventListener('click', () => this.toggleView());
    document.getElementById('addBoxBtn').addEventListener('click', () => this.addBox());
    window.addEventListener('resize', () => this.onResize());
    this.updateHud();
    this.updateBoxList();

    this.animate();
  }

  drawSpace() {
    const { width, height, depth } = this.spaceSize;

    // 방 모서리 와이어
    const boxGeo = new THREE.BoxGeometry(width, height, depth);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
    wire.position.set(0, height/2, 0);
    this.scene.add(wire);

    // 바닥
    const floorGeo = new THREE.PlaneGeometry(width, depth);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent:true, opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 바닥 테두리
    const p = [
      new THREE.Vector3(-width/2, 0.1, -depth/2),
      new THREE.Vector3( width/2, 0.1, -depth/2),
      new THREE.Vector3( width/2, 0.1,  depth/2),
      new THREE.Vector3(-width/2, 0.1,  depth/2),
    ];
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(p),
      new THREE.LineBasicMaterial({ color: 0xff0000 }));
    this.scene.add(loop);
  }

  setupControls() {
    const el = this.renderer.domElement;
    let rotating = false;
    const pointer = this.pointer;

    el.addEventListener('contextmenu', (e)=>e.preventDefault());
    el.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      if (e.button === 0) {
        this.tryStartDrag(e);
      } else if ((e.button === 1 || e.button === 2) && !this.cameraState.topViewActive) {
        rotating = true;
        pointer.set(e.clientX, e.clientY);
        this.cancelCameraAnimation();
      }
    });
    el.addEventListener('mousemove', (e)=>{
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
    window.addEventListener('mouseup', ()=>{
      if (rotating) rotating = false;
      if (this.drag.active) this.endDrag();
    });
    el.addEventListener('wheel', (e)=>{
      e.preventDefault();
      this.handleWheel(e.deltaY);
    }, { passive:false });
  }

  adjustCameraOrbit(dx, dy) {
    if (dx === 0 && dy === 0) return;
    if (this.cameraState.topViewActive) return;
    this.exitTopView({ snapPhi: true });
    const spherical = this.cameraState.spherical;
    spherical.theta -= dx * 0.01;
    spherical.phi -= dy * 0.01;
    this.clampSpherical();
    this.updateCameraFromState();
  }

  handleWheel(deltaY) {
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
  }

  cancelCameraAnimation() {
    this.cameraAnimation = null;
  }

  startCameraAnimation(targetSpherical, options = {}) {
    const target = targetSpherical.clone();
    const minPhi = this.cameraState.topViewActive ? 0 : this.cameraState.minPhi;
    target.phi = THREE.MathUtils.clamp(target.phi, minPhi, this.cameraState.maxPhi);
    target.radius = THREE.MathUtils.clamp(target.radius, this.cameraState.minRadius, this.cameraState.maxRadius);

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
  }

  tickCameraAnimation() {
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
  }

  toggleView() {
    if (this.cameraAnimation) this.cancelCameraAnimation();
    if (this.cameraState.topViewActive) {
      this.returnToOrbitView();
    } else {
      this.goToTopView();
    }
  }

  storeOrbitState() {
    const s = this.cameraState.spherical;
    this.previousCameraState = {
      spherical: new THREE.Spherical(s.radius, s.phi, s.theta),
      zoom: this.camera.zoom
    };
  }

  updateViewButton(isTopView) {
    if (!this.topViewBtn) return;
    this.topViewBtn.textContent = isTopView ? '3d View' : 'Top View';
  }

  goToTopView() {
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
  }

  returnToOrbitView() {
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
  }

  exitTopView({ applyUpdate = false, restoreZoom = false, snapPhi = false } = {}) {
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
  }

  clampSpherical() {
    const s = this.cameraState.spherical;
    const twoPi = Math.PI * 2;
    s.theta = ((s.theta % twoPi) + twoPi) % twoPi;
    const minPhi = this.cameraState.topViewActive ? 0 : this.cameraState.minPhi;
    s.phi = THREE.MathUtils.clamp(s.phi, minPhi, this.cameraState.maxPhi);
    s.radius = THREE.MathUtils.clamp(s.radius, this.cameraState.minRadius, this.cameraState.maxRadius);
  }

  lerpAngle(a, b, t) {
    const twoPi = Math.PI * 2;
    let diff = (b - a) % twoPi;
    if (diff < -Math.PI) diff += twoPi;
    if (diff > Math.PI) diff -= twoPi;
    return a + diff * t;
  }

  updateCameraFromState() {
    this.clampSpherical();
    this.camera.position.setFromSpherical(this.cameraState.spherical);
    this.camera.up.copy(this.cameraState.topViewActive ? this.topViewUp : this.defaultUp);
    this.camera.lookAt(this.cameraTarget);
  }

  computeTopViewZoom() {
    const aspect = (window.innerWidth - 340) / window.innerHeight;
    const requiredVertical = this.spaceSize.depth * 1.1;
    const requiredHorizontal = this.spaceSize.width * 1.1;
    const zoomV = this.frustumSize / requiredVertical;
    const zoomH = (this.frustumSize * aspect) / requiredHorizontal;
    const targetZoom = Math.min(zoomV, zoomH);
    return THREE.MathUtils.clamp(targetZoom, this.cameraZoomBounds.min, this.cameraZoomBounds.max);
  }

  easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // ----- 라벨 -----
  createBoxLabelSprite(text) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    this.drawLabelCanvas(ctx, size, text);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    const labelScale = 160;
    sprite.scale.set(labelScale, labelScale, 1);
    sprite.renderOrder = 10;
    sprite.userData.canvas = canvas;
    sprite.userData.ctx = ctx;
    sprite.userData.text = String(text);
    sprite.userData.texture = texture;
    return sprite;
  }

  drawLabelCanvas(ctx, size, text) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(33,37,41,0.8)';
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), size/2, size/2);
  }

  updateBoxLabelTexture(box) {
    if (!box.label) return;
    const desired = String(box.id);
    if (box.label.userData.text === desired) return;
    this.drawLabelCanvas(box.label.userData.ctx, box.label.userData.canvas.width, desired);
    box.label.material.map.needsUpdate = true;
    box.label.userData.text = desired;
  }

  updateBoxLabelPosition(box) {
    if (!box.label) return;
    const y = box.position.y + box.size.h/2 + 20;
    box.label.position.set(box.position.x, y, box.position.z);
  }

  updateBoxLabel(box) {
    this.updateBoxLabelTexture(box);
    this.updateBoxLabelPosition(box);
  }

  // ----- 박스 -----
  addBox() {
    const id = this.boxes.length ? Math.max(...this.boxes.map(b=>b.id))+1 : 0;

    // 200 ~ 300 범위 랜덤 크기
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const size = { w: rand(200, 300), h: rand(200, 300), d: rand(200, 300) };

    const color = this.colors[this.colorIdx++ % this.colors.length];

    const geo = new THREE.BoxGeometry(size.w, size.h, size.d);
    const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.type = 'box';
    mesh.userData.id = id;
    mesh.userData.baseColor = color;
    mesh.userData.baseEmissive = mat.emissive.getHex();
    mesh.userData.baseEmissiveIntensity = mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1;
    mesh.castShadow = true;

    const box = { id, size, position:{ x:0, y:0, z:0 }, mesh };
    this.scene.add(mesh);
    box.label = this.createBoxLabelSprite(id);
    this.scene.add(box.label);
    this.boxes.push(box);

    // 바닥에 스냅
    box.position.y = this.findBestSnapPosition(box, false);
    mesh.position.set(box.position.x, box.position.y, box.position.z);
    this.updateBoxLabel(box);

    this.selectBox(id);
    this.updateHud();
  }

  setBoxHighlight(box, active) {
    if (!box || !box.mesh) return;

    const mat = box.mesh.material;
    const baseColorHex = box.mesh.userData.baseColor ?? mat.color.getHex();
    const baseEmissiveHex = box.mesh.userData.baseEmissive ?? 0x000000;
    const baseEmissiveIntensity = box.mesh.userData.baseEmissiveIntensity ?? 1;

    if (active) {
      const highlightColor = new THREE.Color(baseColorHex).lerp(new THREE.Color(0xffffff), 0.35);
      mat.color.copy(highlightColor);
      mat.emissive.setHex(0xffc857);
      mat.emissiveIntensity = 0.6;
    } else {
      mat.color.setHex(baseColorHex);
      mat.emissive.setHex(baseEmissiveHex);
      mat.emissiveIntensity = baseEmissiveIntensity;
    }
    mat.needsUpdate = true;
  }

  selectBox(idOrNull) {
    if (this.selectedBox) this.setBoxHighlight(this.selectedBox, false);
    this.selectedBox = this.boxes.find(b=>b.id===idOrNull) || null;
    if (this.selectedBox) this.setBoxHighlight(this.selectedBox, true);
    this.updateBoxList();
  }

  deleteBox(id) {
    const idx = this.boxes.findIndex(b=>b.id===id);
    if (idx>=0) {
      const box = this.boxes[idx];
      if (this.selectedBox && this.selectedBox.id===id) {
        this.setBoxHighlight(box, false);
        this.selectedBox = null;
      }
      this.scene.remove(box.mesh);
      if (box.label) {
        this.scene.remove(box.label);
        if (box.label.material && box.label.material.map) {
          box.label.material.map.dispose();
        }
        if (box.label.material) box.label.material.dispose();
      }
      this.boxes.splice(idx,1);
      this.resolveStacks();
      this.updateBoxList();
      this.updateHud();
    }
  }

  updateBoxSize(box) {
    // 입력값 읽기
    if (!box) return;
    const w = Math.max(1, parseFloat(document.getElementById(`w-${box.id}`).value));
    const h = Math.max(1, parseFloat(document.getElementById(`h-${box.id}`).value));
    const d = Math.max(1, parseFloat(document.getElementById(`d-${box.id}`).value));
    box.size = { w, h, d };

    // 새 지오메트리
    box.mesh.geometry.dispose();
    box.mesh.geometry = new THREE.BoxGeometry(w, h, d);

    // 높이가 변했으니 스냅 재계산
    box.position.y = this.findBestSnapPosition(box, false);
    box.mesh.position.y = box.position.y;

    this.resolveStacks(box);
    this.updateBoxLabel(box);
    this.updateBoxList();
  }

  updateBoxList() {
    const list = document.getElementById('boxList');
    list.innerHTML = '';
    this.boxes.forEach(b=>{
      const selected = this.selectedBox && this.selectedBox.id === b.id;
      const div = document.createElement('div');
      div.className = 'box-info' + (selected ? ' selected' : '');
      if (selected) {
        div.innerHTML = `
          <h3>Box ${b.id}</h3>
          <label>가로 (mm)</label><input id="w-${b.id}" type="number" value="${b.size.w}" min="1">
          <label>세로 (mm)</label><input id="d-${b.id}" type="number" value="${b.size.d}" min="1">
          <label>높이 (mm)</label><input id="h-${b.id}" type="number" value="${b.size.h}" min="1">
          <div class="row">
            <button onclick="app.deleteBox(${b.id})">삭제</button>
            <button onclick="app.selectBox(null)">선택 해제</button>
          </div>
        `;
      } else {
        div.innerHTML = `
          <h3>Box ${b.id}</h3>
          <p>크기: ${b.size.w} × ${b.size.d} × ${b.size.h} mm</p>
          <p>위치: (${Math.round(b.position.x)}, ${Math.round(b.position.y)}, ${Math.round(b.position.z)})</p>
          <div class="row"><button onclick="app.selectBox(${b.id})">선택</button>
          <button onclick="app.deleteBox(${b.id})">삭제</button></div>
        `;
      }
      list.appendChild(div);
      if (selected) {
        ['w','h','d'].forEach(k=>{
          document.getElementById(`${k}-${b.id}`).addEventListener('change', ()=> this.updateBoxSize(b));
        });
      }
    });
    this.updateHud();
  }

  updateHud() {
    document.getElementById('spaceInfo').textContent =
      `공간 크기: ${this.spaceSize.width}mm × ${this.spaceSize.depth}mm × ${this.spaceSize.height}mm`;
    document.getElementById('boxCount').textContent = `박스 개수: ${this.boxes.length}`;
  }

  // ----- 드래그 -----
  raycastFromMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    return raycaster;
  }

  tryStartDrag(event) {
    const raycaster = this.raycastFromMouse(event);
    const intersects = raycaster.intersectObjects(this.boxes.map(b=>b.mesh), false);
    if (intersects.length) {
      const mesh = intersects[0].object;
      const box = this.boxes.find(b=>b.mesh===mesh);
      this.selectBox(box.id);

      // XZ 평면 상 드래그
      const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
      const hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, hit);

      const offset = hit.clone().sub(new THREE.Vector3(box.position.x, 0, box.position.z));
      this.drag = { active:true, plane, offset, target: box };
    } else {
      this.selectBox(null);
    }
  }

  dragMove(event) {
    const { plane, offset, target } = this.drag;
    const raycaster = this.raycastFromMouse(event);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, hit);

    // 경계 내로 클램프
    const w2 = this.spaceSize.width/2;
    const d2 = this.spaceSize.depth/2;
    const x = THREE.MathUtils.clamp(hit.x - offset.x, -w2 + target.size.w/2, w2 - target.size.w/2);
    const z = THREE.MathUtils.clamp(hit.z - offset.z, -d2 + target.size.d/2, d2 - target.size.d/2);

    target.position.x = x;
    target.position.z = z;
    target.position.y = this.computeDraggedY(target, target.position.y);
    target.mesh.position.set(target.position.x, target.position.y, target.position.z);
    this.updateBoxLabelPosition(target);

    // 다른 박스 낙하(중간중간도 자연스럽게)
    this.resolveStacks(target);
    this.updateBoxList();
  }

  endDrag() {
    this.drag.active = false;
  }

  // ----- 스냅/적층 -----
  findBestSnapPosition(box, considerBelowOnly = false) {
    // 기본은 바닥
    let bestY = box.size.h/2;
    // 다른 박스들의 윗면과 XZ 투영이 겹치면 그 위로
    for (const other of this.boxes) {
      if (other === box) continue;
      if (considerBelowOnly) {
        // 지지체는 현재 박스보다 아래(윗면이 현재 y 이하)만 인정
        const otherTop = other.position.y + other.size.h/2;
        const boxBottom = box.position.y - box.size.h/2;
        if (otherTop > boxBottom + 1e-6) { continue; }
      }
      if (this.rectOverlapXZ(box, other)) {
        const candidate = other.position.y + other.size.h/2 + box.size.h/2;
        if (candidate > bestY - 1e-6) bestY = candidate;
      }
    }
    // 공간 천장보다 높아지지 않도록
    bestY = Math.min(bestY, this.spaceSize.height - box.size.h/2);
    return bestY;
  }

  computeDraggedY(box, prevY) {
    // 유지하려는 높이를 기준으로, 겹치면 위로 '필요한 만큼만' 올리고
    // 그렇지 않으면 아래쪽 지지대(바닥/아래 박스)에만 안착
    const eps = 1e-3;
    const h2 = box.size.h / 2;
    const bottom = prevY - h2;
    const top = prevY + h2;

    let base = 0; // 바닥 윗면 높이(y)
    let pushUp = 0;

    for (const other of this.boxes) {
      if (other === box) continue;
      if (!this.rectOverlapXZ(box, other)) continue;

      const oTop = other.position.y + other.size.h/2;
      const oBottom = other.position.y - other.size.h/2;

      // 현재 높이에서 수직으로 겹치면, 그만큼 위로 올림
      const verticalOverlap = bottom < oTop - eps && top > oBottom + eps;
      if (verticalOverlap) {
        pushUp = Math.max(pushUp, oTop);
      }

      // 지지대는 현재 bottom보다 '아래'만 인정
      if (oTop <= bottom + eps) {
        base = Math.max(base, oTop);
      }
    }
    let y = Math.max(base, pushUp) + h2;
    // 천장 제한
    y = Math.min(y, this.spaceSize.height - h2);
    return y;
  }

  rectOverlapXZ(a, b) {
    const ax1 = a.position.x - a.size.w/2, ax2 = a.position.x + a.size.w/2;
    const az1 = a.position.z - a.size.d/2, az2 = a.position.z + a.size.d/2;
    const bx1 = b.position.x - b.size.w/2, bx2 = b.position.x + b.size.w/2;
    const bz1 = b.position.z - b.size.d/2, bz2 = b.position.z + b.size.d/2;
    const xOverlap = ax1 < bx2 && ax2 > bx1;
    const zOverlap = az1 < bz2 && az2 > bz1;
    return xOverlap && zOverlap;
  }

  resolveStacks(exclude=null) {
    // 아래에 있는 박스부터 순서대로 위로 쌓이도록 정렬 + 반복 안정화
    let changed = true, guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      const ordered = this.boxes.slice().sort((a,b)=> (a.position.y - b.position.y));
      for (const b of ordered) {
        if (b===exclude) continue;
        const y = this.findBestSnapPosition(b, true); // 아래쪽 지지체만 고려
        if (Math.abs(y - b.position.y) > 1e-3) {
          b.position.y = y;
          b.mesh.position.y = y;
          changed = true;
        }
        this.updateBoxLabelPosition(b);
      }
    }
  }

  // ----- 기타 -----
  onResize() {
    const w = window.innerWidth - 340;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = h > 0 ? (w / h) : 1;
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
    requestAnimationFrame(()=>this.animate());
    this.tickCameraAnimation();
    this.renderer.render(this.scene, this.camera);
  }
}

window.app = new App();
