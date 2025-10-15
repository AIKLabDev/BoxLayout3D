<<<<<<< HEAD
=======
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

>>>>>>> main
const AREA_SIZE = 1000; // x, z dimensions (mm)
const AREA_HEIGHT = 3000; // y dimension (mm)
const MIN_DIMENSION = 10;
const DEFAULT_DIMENSION = 300;

const container = document.getElementById('threeContainer');
const messageEl = document.getElementById('message');
const addBoxBtn = document.getElementById('addBoxBtn');
const deleteBoxBtn = document.getElementById('deleteBoxBtn');
const boxForm = document.getElementById('boxForm');
const noSelectionEl = document.getElementById('noSelection');
const boxIndexInput = document.getElementById('boxIndex');
const boxWidthInput = document.getElementById('boxWidth');
const boxDepthInput = document.getElementById('boxDepth');
const boxHeightInput = document.getElementById('boxHeight');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 10000);
camera.position.set(1500, 1800, 1500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

<<<<<<< HEAD
const controls = new THREE.OrbitControls(camera, renderer.domElement);
=======
const controls = new OrbitControls(camera, renderer.domElement);
>>>>>>> main
controls.target.set(0, 200, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI / 2.1;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(600, 1200, 600);
dirLight.castShadow = true;
scene.add(dirLight);

const floorGeometry = new THREE.PlaneGeometry(AREA_SIZE, AREA_SIZE, 10, 10);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x202020, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(AREA_SIZE, 20, 0x444444, 0x333333);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

const boundaryGeometry = new THREE.BoxGeometry(AREA_SIZE, AREA_HEIGHT, AREA_SIZE);
boundaryGeometry.translate(0, AREA_HEIGHT / 2, 0);
const boundaryEdges = new THREE.EdgesGeometry(boundaryGeometry);
<<<<<<< HEAD
const boundary = new THREE.LineSegments(boundaryEdges, new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
=======
const boundary = new THREE.LineSegments(boundaryEdges, new THREE.LineBasicMaterial({ color: 0x666666 }));
>>>>>>> main
scene.add(boundary);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const boxes = [];
let boxIdCounter = 1;
let selectedBox = null;
let dragState = null;

function setMessage(text, isError = true) {
  messageEl.textContent = text || '';
  messageEl.style.color = isError ? '#dc2626' : '#16a34a';
  if (text) {
    setTimeout(() => {
      if (messageEl.textContent === text) {
        messageEl.textContent = '';
      }
    }, 4000);
  }
}

function computeBounds(position, width, depth, height) {
  return {
    minX: position.x - width / 2,
    maxX: position.x + width / 2,
    minY: position.y - height / 2,
    maxY: position.y + height / 2,
    minZ: position.z - depth / 2,
    maxZ: position.z + depth / 2
  };
}

function isWithinBoundary(bounds) {
  const halfSize = AREA_SIZE / 2;
  return (
    bounds.minX >= -halfSize &&
    bounds.maxX <= halfSize &&
    bounds.minZ >= -halfSize &&
    bounds.maxZ <= halfSize &&
    bounds.minY >= 0 &&
    bounds.maxY <= AREA_HEIGHT
  );
}

function intersects(a, b) {
  return !(
    a.maxX <= b.minX ||
    a.minX >= b.maxX ||
    a.maxY <= b.minY ||
    a.minY >= b.maxY ||
    a.maxZ <= b.minZ ||
    a.minZ >= b.maxZ
  );
}

function isOverlapping(bounds, ignoreId = null) {
  return boxes.some((record) => {
    if (record.id === ignoreId) return false;
    return intersects(bounds, record.bounds);
  });
}

function updateBoxGeometry(record, width, depth, height) {
  record.width = width;
  record.depth = depth;
  record.height = height;
  const newGeometry = new THREE.BoxGeometry(width, height, depth);
  record.mesh.geometry.dispose();
  record.mesh.geometry = newGeometry;
  record.mesh.position.y = height / 2;
  record.bounds = computeBounds(record.mesh.position, width, depth, height);
}

function updateLastValid(record) {
  record.lastValid = {
    position: record.mesh.position.clone(),
    width: record.width,
    depth: record.depth,
    height: record.height
  };
}

function restoreLastValid(record) {
  if (!record.lastValid) return;
  const { position, width, depth, height } = record.lastValid;
  record.mesh.position.copy(position);
  updateBoxGeometry(record, width, depth, height);
}

function validatePlacement(record, candidateBounds) {
  const bounds = candidateBounds || record.bounds;
  if (!isWithinBoundary(bounds)) {
    setMessage('박스가 공간 밖으로 나갈 수 없습니다.');
    restoreLastValid(record);
    record.bounds = computeBounds(record.mesh.position, record.width, record.depth, record.height);
    return false;
  }
  if (isOverlapping(bounds, record.id)) {
    setMessage('박스가 서로 겹칠 수 없습니다.');
    restoreLastValid(record);
    record.bounds = computeBounds(record.mesh.position, record.width, record.depth, record.height);
    return false;
  }
  record.bounds = bounds;
  updateLastValid(record);
  setMessage('', false);
  return true;
}

<<<<<<< HEAD
function randomBoxColor() {
  const color = new THREE.Color();
  color.setHSL(Math.random(), 0.55, 0.55);
  return color.getHex();
}

function createMaterial(colorHex, selected = false) {
  const baseColor = new THREE.Color(colorHex);
  const displayColor = selected ? baseColor.clone().lerp(new THREE.Color(0xffffff), 0.3) : baseColor;
  return new THREE.MeshStandardMaterial({
    color: displayColor.getHex(),
    opacity: 0.92,
    transparent: true,
    metalness: 0.1,
    roughness: 0.65
=======
function createMaterial(selected = false) {
  return new THREE.MeshStandardMaterial({
    color: selected ? 0xffa500 : 0x4299e1,
    opacity: 0.9,
    transparent: true,
    metalness: 0.1,
    roughness: 0.7
>>>>>>> main
  });
}

function setSelected(record) {
  if (selectedBox && selectedBox !== record) {
    selectedBox.mesh.material.dispose();
<<<<<<< HEAD
    selectedBox.mesh.material = createMaterial(selectedBox.color, false);
=======
    selectedBox.mesh.material = createMaterial(false);
>>>>>>> main
  }
  selectedBox = record;
  if (record) {
    record.mesh.material.dispose();
<<<<<<< HEAD
    record.mesh.material = createMaterial(record.color, true);
=======
    record.mesh.material = createMaterial(true);
>>>>>>> main
    boxForm.hidden = false;
    noSelectionEl.style.display = 'none';
    boxIndexInput.value = record.id.toString();
    boxWidthInput.value = Math.round(record.width);
    boxDepthInput.value = Math.round(record.depth);
    boxHeightInput.value = Math.round(record.height);
  } else {
    boxForm.hidden = true;
    noSelectionEl.style.display = 'block';
    boxIndexInput.value = '';
  }
}

function addBox(width = DEFAULT_DIMENSION, depth = DEFAULT_DIMENSION, height = DEFAULT_DIMENSION) {
<<<<<<< HEAD
  const color = randomBoxColor();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), createMaterial(color, false));
=======
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), createMaterial(false));
>>>>>>> main
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const position = findAvailablePosition(width, depth, height);
  if (!position) {
    setMessage('새 박스를 배치할 공간이 없습니다.');
    return null;
  }
  mesh.position.copy(position);
  scene.add(mesh);

  const record = {
    id: boxIdCounter++,
    mesh,
    width,
    depth,
    height,
<<<<<<< HEAD
    color,
=======
>>>>>>> main
    bounds: computeBounds(position, width, depth, height),
    lastValid: null
  };
  updateLastValid(record);
  boxes.push(record);
  mesh.userData.recordId = record.id;
  setSelected(record);
  render();
  return record;
}

function findAvailablePosition(width, depth, height) {
  const halfSize = AREA_SIZE / 2;
  const step = Math.max(50, Math.min(width, depth));
  const minX = -halfSize + width / 2;
  const maxX = halfSize - width / 2;
  const minZ = -halfSize + depth / 2;
  const maxZ = halfSize - depth / 2;

  for (let x = minX; x <= maxX; x += step) {
    for (let z = minZ; z <= maxZ; z += step) {
      const candidate = new THREE.Vector3(x, height / 2, z);
      const bounds = computeBounds(candidate, width, depth, height);
      if (isWithinBoundary(bounds) && !isOverlapping(bounds)) {
        return candidate;
      }
    }
  }
  return null;
}

function onResize() {
  const { clientWidth, clientHeight } = container;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
  render();
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getIntersectionWithPlane(event) {
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const intersectionPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(groundPlane, intersectionPoint);
  return intersectionPoint;
}

function onPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(boxes.map((record) => record.mesh));
  if (intersections.length > 0) {
    const mesh = intersections[0].object;
    const record = boxes.find((item) => item.mesh === mesh);
    if (record) {
      setSelected(record);
      const point = getIntersectionWithPlane(event);
      dragState = {
        record,
        offset: point.clone().sub(record.mesh.position.clone().setY(0)),
        previousPosition: record.mesh.position.clone()
      };
      controls.enabled = false;
    }
  } else {
    setSelected(null);
  }
}

function onPointerMove(event) {
  if (!dragState) return;
  const point = getIntersectionWithPlane(event);
  if (!point) return;
  const { record, offset, previousPosition } = dragState;
  const targetPosition = new THREE.Vector3(point.x - offset.x, record.height / 2, point.z - offset.z);
  const bounds = computeBounds(targetPosition, record.width, record.depth, record.height);
  if (!isWithinBoundary(bounds)) {
    setMessage('박스가 공간 밖으로 나갈 수 없습니다.');
    record.mesh.position.copy(previousPosition);
    render();
    return;
  }
  if (isOverlapping(bounds, record.id)) {
    setMessage('박스가 서로 겹칠 수 없습니다.');
    record.mesh.position.copy(previousPosition);
    render();
    return;
  }
  record.mesh.position.copy(targetPosition);
  record.bounds = bounds;
  dragState.previousPosition.copy(record.mesh.position);
  setMessage('', false);
  render();
}

function onPointerUp() {
  if (dragState) {
    const { record } = dragState;
    const valid = validatePlacement(record);
    if (!valid) {
      render();
    }
  }
  dragState = null;
  controls.enabled = true;
}

function render() {
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  render();
}

function handleDimensionChange() {
  if (!selectedBox) return;
  let width = Number(boxWidthInput.value);
  let depth = Number(boxDepthInput.value);
  let height = Number(boxHeightInput.value);
  if (!Number.isFinite(width)) width = selectedBox.width;
  if (!Number.isFinite(depth)) depth = selectedBox.depth;
  if (!Number.isFinite(height)) height = selectedBox.height;
  width = Math.max(MIN_DIMENSION, width);
  depth = Math.max(MIN_DIMENSION, depth);
  height = Math.max(MIN_DIMENSION, height);
  const newPosition = selectedBox.mesh.position.clone();
  newPosition.y = height / 2;
  const candidateBounds = computeBounds(newPosition, width, depth, height);
  if (!isWithinBoundary(candidateBounds)) {
    setMessage('박스가 공간 밖으로 나갈 수 없습니다.');
    boxWidthInput.value = selectedBox.width;
    boxDepthInput.value = selectedBox.depth;
    boxHeightInput.value = selectedBox.height;
    return;
  }
  if (isOverlapping(candidateBounds, selectedBox.id)) {
    setMessage('박스가 서로 겹칠 수 없습니다.');
    boxWidthInput.value = selectedBox.width;
    boxDepthInput.value = selectedBox.depth;
    boxHeightInput.value = selectedBox.height;
    return;
  }
  updateBoxGeometry(selectedBox, width, depth, height);
  selectedBox.mesh.position.copy(newPosition);
  selectedBox.bounds = candidateBounds;
  updateLastValid(selectedBox);
  boxWidthInput.value = width;
  boxDepthInput.value = depth;
  boxHeightInput.value = height;
  setMessage('', false);
  render();
}

function deleteSelectedBox() {
  if (!selectedBox) return;
  scene.remove(selectedBox.mesh);
  selectedBox.mesh.geometry.dispose();
  selectedBox.mesh.material.dispose();
  const index = boxes.findIndex((record) => record.id === selectedBox.id);
  if (index >= 0) {
    boxes.splice(index, 1);
  }
  setSelected(null);
  render();
}

addBoxBtn.addEventListener('click', () => {
  addBox();
});

deleteBoxBtn.addEventListener('click', deleteSelectedBox);

boxWidthInput.addEventListener('change', handleDimensionChange);
boxDepthInput.addEventListener('change', handleDimensionChange);
boxHeightInput.addEventListener('change', handleDimensionChange);

renderer.domElement.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
window.addEventListener('resize', onResize);

animate();

addBox();
