import App from './App.js';

App.prototype.drawSpace = function drawSpace() {
  const { width, height, depth } = this.spaceSize;

  // Space edge wire frame
  const boxGeo = new THREE.BoxGeometry(width, height, depth);
  const edges = new THREE.EdgesGeometry(boxGeo);
  const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 }));
  wire.position.set(0, height / 2, 0);
  this.scene.add(wire);

  // floor
  const floorGeo = new THREE.PlaneGeometry(width, depth);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xcccccc, transparent: true, opacity: 0.35 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  this.scene.add(floor);

  // floor edge
  const p = [
    new THREE.Vector3(-width / 2, 0.1, -depth / 2),
    new THREE.Vector3(width / 2, 0.1, -depth / 2),
    new THREE.Vector3(width / 2, 0.1, depth / 2),
    new THREE.Vector3(-width / 2, 0.1, depth / 2)
  ];
  const loop = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(p),
    new THREE.LineBasicMaterial({ color: 0xff0000 })
  );
  this.scene.add(loop);
};
