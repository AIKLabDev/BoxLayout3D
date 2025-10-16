import App from './App.js';

App.prototype.addBox = function addBox() {
  const id = this.boxes.length ? Math.max(...this.boxes.map((b) => b.id)) + 1 : 0;

  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const size = { w: rand(200, 300), h: rand(200, 300), d: rand(200, 300) };
  const color = this.colors[this.colorIdx++ % this.colors.length];
  const initialPosition = { x: 0, y: size.h / 2, z: 0 };

  const box = this.createBoxFromData({ id, size, position: initialPosition, color });

  box.position.y = this.findBestSnapPosition(box, false);
  box.mesh.position.set(box.position.x, box.position.y, box.position.z);
  this.updateBoxLabel(box);

  this.selectBox(id);
  this.updateHud();
};

App.prototype.createBoxFromData = function createBoxFromData({ id, size, position, color }) {
  const sanitizedSize = {
    w: Math.max(1, size?.w ?? 1),
    h: Math.max(1, size?.h ?? 1),
    d: Math.max(1, size?.d ?? 1)
  };
  const defaultY = sanitizedSize.h / 2;
  const sanitizedPosition = {
    x: position?.x ?? 0,
    y: position?.y ?? defaultY,
    z: position?.z ?? 0
  };
  const geo = new THREE.BoxGeometry(sanitizedSize.w, sanitizedSize.h, sanitizedSize.d);
  const baseColor = typeof color === 'number' ? color : this.colors[this.colorIdx++ % this.colors.length];
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.05, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.type = 'box';
  mesh.userData.id = id;
  mesh.userData.baseColor = baseColor;
  mesh.userData.baseEmissive = mat.emissive.getHex();
  mesh.userData.baseEmissiveIntensity = mat.emissiveIntensity !== undefined ? mat.emissiveIntensity : 1;
  mesh.castShadow = true;

  const box = {
    id,
    size: { ...sanitizedSize },
    position: { ...sanitizedPosition },
    mesh
  };
  this.scene.add(mesh);
  mesh.position.set(box.position.x, box.position.y, box.position.z);
  box.label = this.createBoxLabelSprite(id);
  this.scene.add(box.label);
  this.updateBoxLabel(box);
  this.boxes.push(box);
  return box;
};

App.prototype.setBoxHighlight = function setBoxHighlight(box, active) {
  if (!box || !box.mesh) return;

  const mat = box.mesh.material;
  const baseColorHex = box.mesh.userData.baseColor ?? mat.color.getHex();
  const baseEmissiveHex = box.mesh.userData.baseEmissive ?? 0x000000;
  const baseEmissiveIntensity = box.mesh.userData.baseEmissiveIntensity ?? 1;

  mat.color.setHex(baseColorHex);
  mat.emissive.setHex(baseEmissiveHex);
  if (mat.emissiveIntensity !== undefined) {
    mat.emissiveIntensity = baseEmissiveIntensity;
  }
  mat.needsUpdate = true;

  this.setLabelHighlight(box, active);
};

App.prototype.selectBox = function selectBox(idOrNull) {
  if (this.selectedBox) this.setBoxHighlight(this.selectedBox, false);
  this.selectedBox = this.boxes.find((b) => b.id === idOrNull) || null;
  if (this.selectedBox) this.setBoxHighlight(this.selectedBox, true);
  this.updateBoxList();
};

App.prototype.deleteBox = function deleteBox(id) {
  const idx = this.boxes.findIndex((b) => b.id === id);
  if (idx >= 0) {
    const box = this.boxes[idx];
    if (this.selectedBox && this.selectedBox.id === id) {
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
    this.boxes.splice(idx, 1);
    this.resolveStacks();
    this.updateBoxList();
    this.updateHud();
  }
};

App.prototype.updateBoxSize = function updateBoxSize(box) {
  if (!box) return;
  const w = Math.max(1, parseFloat(document.getElementById(`w-${box.id}`).value));
  const h = Math.max(1, parseFloat(document.getElementById(`h-${box.id}`).value));
  const d = Math.max(1, parseFloat(document.getElementById(`d-${box.id}`).value));
  box.size = { w, h, d };

  box.mesh.geometry.dispose();
  box.mesh.geometry = new THREE.BoxGeometry(w, h, d);

  box.position.y = this.findBestSnapPosition(box, false);
  box.mesh.position.y = box.position.y;

  this.resolveStacks(box);
  this.updateBoxLabel(box);
  this.updateBoxList();
};

App.prototype.updateBoxList = function updateBoxList() {
  const list = document.getElementById('boxList');
  list.innerHTML = '';
  this.boxes.forEach((b) => {
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
      ['w', 'h', 'd'].forEach((k) => {
        document.getElementById(`${k}-${b.id}`).addEventListener('change', () => this.updateBoxSize(b));
      });
    }
  });
  this.updateHud();
};

App.prototype.updateHud = function updateHud() {
  const labelSpace = '공간 크기';
  const labelCount = '박스 개수';
  document.getElementById('spaceInfo').textContent =
    `${labelSpace}: ${this.spaceSize.width}mm x ${this.spaceSize.depth}mm x ${this.spaceSize.height}mm`;
  document.getElementById('boxCount').textContent = '${labelCount}: ${this.boxes.length}';
};

App.prototype.exportLayoutData = function exportLayoutData() {
  return {
    version: 1,
    spaceSize: { ...this.spaceSize },
    boxes: this.boxes.map((box) => ({
      id: box.id,
      size: { ...box.size },
      position: { ...box.position },
      color: box.mesh.userData.baseColor ?? box.mesh.material.color.getHex()
    }))
  };
};

App.prototype.saveLayout = function saveLayout() {
  try {
    const data = this.exportLayoutData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `box-layout-${timestamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    this.showMessage('레이아웃을 저장했습니다.', 'info');
  } catch (err) {
    console.error(err);
    this.showMessage('레이아웃 저장에 실패했습니다.', 'error');
  }
};

App.prototype.promptLoadLayout = function promptLoadLayout() {
  if (!this.loadInput) return;
  this.loadInput.value = '';
  this.loadInput.click();
};

App.prototype.handleLoadFile = function handleLoadFile(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      this.applyLayoutData(data);
      this.showMessage('레이아웃을 불러왔습니다.', 'info');
    } catch (err) {
      console.error(err);
      this.showMessage('레이아웃 파일이 올바르지 않습니다.', 'error');
    } finally {
      input.value = '';
    }
  };
  reader.onerror = () => {
    this.showMessage('레이아웃 파일을 읽을 수 없습니다.', 'error');
    input.value = '';
  };
  reader.readAsText(file);
};

App.prototype.applyLayoutData = function applyLayoutData(data) {
  if (!data || !Array.isArray(data.boxes)) {
    throw new Error('Invalid layout data');
  }

  this.clearBoxes();
  const boxEntries = data.boxes;
  boxEntries.forEach((entry, index) => {
    const rawId = Number(entry?.id);
    const id = Number.isFinite(rawId) ? rawId : index;
    const size = {
      w: Number(entry?.size?.w) || 200,
      h: Number(entry?.size?.h) || 200,
      d: Number(entry?.size?.d) || 200
    };
    const position = {
      x: Number(entry?.position?.x) || 0,
      y: Number(entry?.position?.y) || size.h / 2,
      z: Number(entry?.position?.z) || 0
    };
    const color = typeof entry?.color === 'number' ? entry.color : undefined;
    const box = this.createBoxFromData({ id, size, position, color });
    box.mesh.position.set(box.position.x, box.position.y, box.position.z);
    this.updateBoxLabel(box);
  });
  this.colorIdx = boxEntries.length;
  this.resolveStacks();
  this.selectBox(null);
  this.updateBoxList();
  this.updateHud();
};

App.prototype.clearBoxes = function clearBoxes() {
  for (const box of this.boxes) {
    if (box.mesh) {
      this.scene.remove(box.mesh);
      if (box.mesh.geometry) {
        box.mesh.geometry.dispose();
      }
      const material = box.mesh.material;
      if (Array.isArray(material)) {
        material.forEach((mat) => mat && mat.dispose && mat.dispose());
      } else if (material && material.dispose) {
        material.dispose();
      }
    }
    if (box.label) {
      this.scene.remove(box.label);
      if (box.label.material) {
        if (box.label.material.map && box.label.material.map.dispose) {
          box.label.material.map.dispose();
        }
        if (box.label.material.dispose) {
          box.label.material.dispose();
        }
      }
    }
  }
  this.boxes = [];
  this.selectedBox = null;
};

App.prototype.showMessage = function showMessage(message, type = 'info', duration = 4000) {
  const el = document.getElementById('error-message');
  if (!el) return;
  el.textContent = message;
  el.style.color = type === 'error' ? '#b91c1c' : '#065f46';
  if (this.messageTimer) clearTimeout(this.messageTimer);
  this.messageTimer = setTimeout(() => {
    if (el.textContent === message) {
      el.textContent = '';
    }
  }, duration);
};
