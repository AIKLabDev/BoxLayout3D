class BoxLayout3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.boxes = [];
        this.selectedBox = null;
        this.isDragging = false;
        // FIX #1: 공간 크기 교정 (가로X=1000, 세로Z=1000, 높이Y=3000)
        this.spaceSize = { width: 1000, height: 3000, depth: 1000 };
        this.colors = [];
        this.usedColors = new Set();
        
        this.init();
        this.setupEventListeners();
        this.animate();
    }
    
    init() {
        // Three.js 씬 설정
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // 카메라 설정
        this.camera = new THREE.PerspectiveCamera(75, (window.innerWidth - 300) / window.innerHeight, 0.1, 10000);
        this.camera.position.set(2000, 2000, 2000);
        this.camera.lookAt(0, this.spaceSize.height/2, 0);
        
        // 렌더러 설정
        const canvas = document.getElementById('canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1000, 1000, 1000);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // 공간 라인 그리기
        this.drawSpace();
        
        // 컨트롤 설정 (마우스로 카메라 조작)
        this.setupControls();
        
        // 색상 팔레트 초기화
        this.initializeColors();
    }
    
    drawSpace() {
        const { width, height, depth } = this.spaceSize;
        
        // 공간의 와이어프레임 그리기 (6면체)
        const points = [
            // 바닥면 4개 점
            new THREE.Vector3(-width/2, 0, -depth/2),
            new THREE.Vector3(width/2, 0, -depth/2),
            new THREE.Vector3(width/2, 0, depth/2),
            new THREE.Vector3(-width/2, 0, depth/2),
            new THREE.Vector3(-width/2, 0, -depth/2), // 닫기
            
            // 천장면 4개 점
            new THREE.Vector3(-width/2, height, -depth/2),
            new THREE.Vector3(width/2, height, -depth/2),
            new THREE.Vector3(width/2, height, depth/2),
            new THREE.Vector3(-width/2, height, depth/2),
            new THREE.Vector3(-width/2, height, -depth/2), // 닫기
            
            // 세로 연결선들
            new THREE.Vector3(-width/2, 0, -depth/2),
            new THREE.Vector3(-width/2, height, -depth/2),
            new THREE.Vector3(width/2, 0, -depth/2),
            new THREE.Vector3(width/2, height, -depth/2),
            new THREE.Vector3(width/2, 0, depth/2),
            new THREE.Vector3(width/2, height, depth/2),
            new THREE.Vector3(-width/2, 0, depth/2),
            new THREE.Vector3(-width/2, height, depth/2)
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        const wireframe = new THREE.LineSegments(geometry, material);
        this.scene.add(wireframe);
        
        // 바닥면 표시 (정확히 1000x1000) - depth 사용
        const floorGeometry = new THREE.PlaneGeometry(width, depth);
        const floorMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xcccccc, 
            transparent: true, 
            opacity: 0.3 
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);
        
        // 바닥면 경계선 그리기
        const floorBorderPoints = [
            new THREE.Vector3(-width/2, 0.1, -depth/2),
            new THREE.Vector3(width/2, 0.1, -depth/2),
            new THREE.Vector3(width/2, 0.1, depth/2),
            new THREE.Vector3(-width/2, 0.1, depth/2),
            new THREE.Vector3(-width/2, 0.1, -depth/2)
        ];
        
        const floorBorderGeometry = new THREE.BufferGeometry().setFromPoints(floorBorderPoints);
        const floorBorderMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 });
        const floorBorder = new THREE.LineSegments(floorBorderGeometry, floorBorderMaterial);
        this.scene.add(floorBorder);
    }
    
    setupControls() {
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        
        this.renderer.domElement.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
            
            // 박스 선택 체크
            const raycaster = new THREE.Raycaster();
            const mouse = new THREE.Vector2();
            mouse.x = (event.clientX / (window.innerWidth - 300)) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, this.camera);
            const intersects = raycaster.intersectObjects(this.boxes.map(box => box.mesh));
            
            if (intersects.length > 0) {
                this.selectedBox = intersects[0].object.userData.box;
                this.isDragging = true;
                
                // 드래그 시작 시 바닥 또는 상자 상면에 스냅
                const snapY = this.findBestSnapPosition(this.selectedBox);
                this.selectedBox.position.y = snapY;
                this.selectedBox.mesh.position.y = snapY;
                
                this.updateBoxInfo();
            }
        });
        
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            if (isMouseDown && this.isDragging && this.selectedBox) {
                // 박스 드래그 로직 - 바닥면(y=0)과의 교차점 계산
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                mouse.x = (event.clientX / (window.innerWidth - 300)) * 2 - 1;
                mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
                
                raycaster.setFromCamera(mouse, this.camera);
                
                // 바닥면 (y=0)과의 교차점 계산
                const ray = raycaster.ray;
                const t = -ray.origin.y / ray.direction.y;
                const intersection = new THREE.Vector3();
                intersection.copy(ray.origin).addScaledVector(ray.direction, t);
                
                if (t > 0) { // 앞쪽에 교차점이 있는 경우만
                    this.moveBox(this.selectedBox, intersection);
                }
            } else if (isMouseDown && !this.isDragging) {
                // 카메라 회전
                const deltaX = event.clientX - mouseX;
                const deltaY = event.clientY - mouseY;
                
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position);
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                this.camera.position.setFromSpherical(spherical);
                this.camera.lookAt(0, 0, 0);
                
                mouseX = event.clientX;
                mouseY = event.clientY;
            }
        });
        
        this.renderer.domElement.addEventListener('mouseup', () => {
            isMouseDown = false;
            this.isDragging = false;
        });
        
        // 마우스 휠로 줌
        this.renderer.domElement.addEventListener('wheel', (event) => {
            const zoomSpeed = 50;
            const direction = event.deltaY > 0 ? 1 : -1;
            this.camera.position.multiplyScalar(1 + direction * zoomSpeed / this.camera.position.length());
            this.camera.lookAt(0, 0, 0);
        });
    }
    
    setupEventListeners() {
        document.getElementById('addBoxBtn').addEventListener('click', () => {
            this.addBox();
        });
        
        window.addEventListener('resize', () => {
            this.camera.aspect = (window.innerWidth - 300) / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth - 300, window.innerHeight);
        });
    }
    
    initializeColors() {
        this.colors = [
            0xff6b6b, 0x4ecdc4, 0x45b7d1, 0x96ceb4, 0xfeca57,
            0xff9ff3, 0x54a0ff, 0x5f27cd, 0x00d2d3, 0xff9f43,
            0xee5a24, 0x0984e3, 0xa29bfe, 0xfd79a8, 0xfdcb6e
        ];
    }
    
    getRandomColor() {
        const availableColors = this.colors.filter(color => !this.usedColors.has(color));
        if (availableColors.length === 0) {
            // 모든 색상이 사용된 경우 랜덤 색상 생성
            return Math.random() * 0xffffff;
        }
        const color = availableColors[Math.floor(Math.random() * availableColors.length)];
        this.usedColors.add(color);
        return color;
    }
    
    addBox() {
        const defaultSize = { width: 100, height: 100, depth: 100 };
        const box = {
            id: this.boxes.length,
            size: { ...defaultSize },
            position: { x: 0, y: defaultSize.height/2, z: 0 },
            color: this.getRandomColor(),
            mesh: null
        };
        
        this.createBoxMesh(box);
        this.boxes.push(box);
        
        // 바닥면에 강제 스냅
        box.position.y = box.size.height / 2;
        box.mesh.position.set(box.position.x, box.position.y, box.position.z);
        
        this.updateBoxCount();
        this.updateBoxList();
    }
    
    createBoxMesh(box) {
        const geometry = new THREE.BoxGeometry(box.size.width, box.size.height, box.size.depth);
        const material = new THREE.MeshLambertMaterial({ color: box.color });
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.set(box.position.x, box.position.y, box.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.box = box;
        
        box.mesh = mesh;
        this.scene.add(mesh);
    }
    
    moveBox(box, newPosition) {
        // X, Z 좌표만 업데이트
        box.position.x = newPosition.x;
        box.position.z = newPosition.z;
        
        // 항상 바닥면에 먼저 스냅
        box.position.y = box.size.height / 2;
        
        // 다층 적재 체크 (다른 박스 위에 스냅)
        const snapY = this.findBestSnapPosition(box);
        box.position.y = snapY;
        
        // 공간 경계 체크
        if (this.isBoxOutOfBounds(box)) {
            this.showError('박스가 공간을 벗어났습니다!');
            return;
        }
        
        // 다른 박스와의 충돌 체크
        if (this.checkBoxCollision(box)) {
            this.showError('박스가 다른 박스와 겹칩니다!');
            return;
        }
        
        box.mesh.position.set(box.position.x, box.position.y, box.position.z);
    }
    
    isBoxOutOfBounds(box) {
        const halfWidth = box.size.width / 2;
        const halfDepth = box.size.depth / 2;
        const spaceHalfWidth = this.spaceSize.width / 2;
        const spaceHalfDepth = this.spaceSize.depth / 2;
        
        return (box.position.x - halfWidth < -spaceHalfWidth ||
                box.position.x + halfWidth > spaceHalfWidth ||
                box.position.z - halfDepth < -spaceHalfDepth ||
                box.position.z + halfDepth > spaceHalfDepth ||
                box.position.y + box.size.height / 2 > this.spaceSize.height);
    }
    
    checkBoxCollision(box) {
        for (let otherBox of this.boxes) {
            if (otherBox === box) continue;
            
            const dx = Math.abs(box.position.x - otherBox.position.x);
            const dz = Math.abs(box.position.z - otherBox.position.z);
            const dy = Math.abs(box.position.y - otherBox.position.y);
            
            const minDistanceX = (box.size.width + otherBox.size.width) / 2;
            const minDistanceZ = (box.size.depth + otherBox.size.depth) / 2;
            const minDistanceY = (box.size.height + otherBox.size.height) / 2;
            
            if (dx < minDistanceX && dz < minDistanceZ && dy < minDistanceY) {
                return true;
            }
        }
        return false;
    }
    
    findBestSnapPosition(box) {
        // 기본값: 바닥면 (중심Y = 높이/2)
        let bestSnapY = box.size.height / 2;
        
        // 다른 박스들과의 관계를 확인
        for (let otherBox of this.boxes) {
            if (otherBox === box) continue;
            
            // 박스 중심점 간의 거리 계산
            const dx = Math.abs(box.position.x - otherBox.position.x);
            const dz = Math.abs(box.position.z - otherBox.position.z);
            
            // FIX #2: XZ 투영이 '겹칠 때만' 위에 올릴 수 있음
            const minDistanceX = (box.size.width + otherBox.size.width) / 2;
            const minDistanceZ = (box.size.depth + otherBox.size.depth) / 2;
            const overlapsXZ = (dx < minDistanceX) && (dz < minDistanceZ);
            if (!overlapsXZ) continue;
            
            // other 상판 위 후보 높이
            const snapY = otherBox.position.y + otherBox.size.height / 2 + box.size.height / 2;
            // 더 높은 위치 가능하면 갱신 (천장 이하)
            if (snapY > bestSnapY && snapY + box.size.height / 2 <= this.spaceSize.height) {
                bestSnapY = snapY;
            }
        }
        
        return bestSnapY;
    }
    
    snapToBox(box) {
        box.position.y = this.findBestSnapPosition(box);
    }
    
    updateBoxInfo() {
        if (!this.selectedBox) return;
        
        const boxList = document.getElementById('boxList');
        boxList.innerHTML = '';
        
        const boxInfo = document.createElement('div');
        boxInfo.className = 'box-info';
        boxInfo.innerHTML = `
            <h3>Box ${this.selectedBox.id}</h3>
            <label>가로 (mm):</label>
            <input type="number" id="width-${this.selectedBox.id}" value="${this.selectedBox.size.width}" min="1">
            <label>세로 (mm):</label>
            <input type="number" id="height-${this.selectedBox.id}" value="${this.selectedBox.size.height}" min="1">
            <label>높이 (mm):</label>
            <input type="number" id="depth-${this.selectedBox.id}" value="${this.selectedBox.size.depth}" min="1">
            <button onclick="app.deleteBox(${this.selectedBox.id})">삭제</button>
        `;
        
        boxList.appendChild(boxInfo);
        
        // 입력 이벤트 리스너 추가
        const inputs = boxInfo.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.updateBoxSize(this.selectedBox);
            });
        });
    }
    
    updateBoxSize(box) {
        const width = parseFloat(document.getElementById(`width-${box.id}`).value);
        const height = parseFloat(document.getElementById(`height-${box.id}`).value);
        const depth = parseFloat(document.getElementById(`depth-${box.id}`).value);
        
        if (width > 0 && height > 0 && depth > 0) {
            box.size.width = width;
            box.size.height = height;
            box.size.depth = depth;
            
            // 메시 업데이트
            this.scene.remove(box.mesh);
            this.createBoxMesh(box);
            
            // 바닥/적층 스냅
            const snapY = this.findBestSnapPosition(box);
            box.position.y = snapY;
            box.mesh.position.set(box.position.x, box.position.y, box.position.z);
        }
    }
    
    deleteBox(boxId) {
        const boxIndex = this.boxes.findIndex(box => box.id === boxId);
        if (boxIndex !== -1) {
            const box = this.boxes[boxIndex];
            this.scene.remove(box.mesh);
            this.usedColors.delete(box.color);
            // 안전 수정: 정확히 1개만 삭제
            this.boxes.splice(boxIndex, 1);
            this.updateBoxCount();
            this.updateBoxList();
            this.selectedBox = null;
        }
    }
    
    updateBoxCount() {
        document.getElementById('boxCount').textContent = this.boxes.length;
    }
    
    updateBoxList() {
        const boxList = document.getElementById('boxList');
        boxList.innerHTML = '';
        
        this.boxes.forEach(box => {
            const boxInfo = document.createElement('div');
            boxInfo.className = 'box-info';
            boxInfo.innerHTML = `
                <h3>Box ${box.id}</h3>
                <p>크기: ${box.size.width} × ${box.size.height} × ${box.size.depth} mm</p>
                <p>위치: (${Math.round(box.position.x)}, ${Math.round(box.position.y)}, ${Math.round(box.position.z)})</p>
                <button onclick="app.selectBox(${box.id})">선택</button>
                <button onclick="app.deleteBox(${box.id})">삭제</button>
            `;
            boxList.appendChild(boxInfo);
        });
    }
    
    selectBox(boxId) {
        this.selectedBox = this.boxes.find(box => box.id === boxId);
        this.updateBoxInfo();
    }
    
    showError(message) {
        const errorDiv = document.getElementById('error-message');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }
}

// 애플리케이션 시작
const app = new BoxLayout3D();
