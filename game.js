// NEON RUSH: SKYLINE ESCAPE - Dynamic Parkour Runner in Three.js

let scene, camera, renderer, clock;
let player, rain;
let obstacles = [];
let segments = [];
let score = 0;
let hasCollided = false;
let jumping = false;
let bounceValue = 0;
let gravity = 0.005;
let speed = 0.05; // starting speed
let maxSpeed = 0.2;
let currentLane = 1;
let lanes = [-2, 0, 2]; // left, middle, right
let playerBaseY = 1;
let segmentLength = 50;
let lastSegmentZ = 0;
let treeReleaseInterval = 0.5;
let lastSpawnTime = 0;
let explosionPower = 1;
let particleCount = 20;
let particles;

const obstacleTypes = [
  { name: '懸浮平台', geometry: new THREE.BoxGeometry(4, 0.2, 4), material: new THREE.MeshStandardMaterial({color: 0x00ffff, emissive: 0x00ffff}), positionY: 0 },
  { name: '斷裂鐵軌', geometry: new THREE.BoxGeometry(3, 0.5, 10), material: new THREE.MeshStandardMaterial({color: 0xff00ff, emissive: 0xff00ff}), positionY: 0.25 },
  { name: '貨櫃堆疊', geometry: new THREE.BoxGeometry(2, 3, 2), material: new THREE.MeshStandardMaterial({color: 0xffff00}), positionY: 1.5 },
  { name: '全息廣告牌', geometry: new THREE.PlaneGeometry(5, 5), material: new THREE.MeshBasicMaterial({color: 0x00ff00, transparent: true, opacity: 0.7}), positionY: 3 },
  { name: '無人機群', geometry: new THREE.SphereGeometry(1, 8, 8), material: new THREE.MeshStandardMaterial({color: 0xff0000}), positionY: 2 },
  { name: '垂直電梯井', geometry: new THREE.BoxGeometry(1, 10, 1), material: new THREE.MeshStandardMaterial({color: 0x0000ff}), positionY: 5 },
  { name: '玻璃幕牆', geometry: new THREE.PlaneGeometry(6, 4), material: new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.3}), positionY: 2 },
  { name: '磁浮列車頂', geometry: new THREE.BoxGeometry(5, 1, 20), material: new THREE.MeshStandardMaterial({color: 0xffa500}), positionY: 0.5 }
];

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x220033); // Purple neon cyberpunk night
  scene.fog = new THREE.FogExp2(0x220033, 0.05);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // Lights
  const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x000000, 0.9);
  scene.add(hemisphereLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(5, 10, 7.5);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  clock = new THREE.Clock();

  // Player (simple box for now, replace with model)
  const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
  const playerMaterial = new THREE.MeshStandardMaterial({color: 0x00ff00});
  player = new THREE.Mesh(playerGeometry, playerMaterial);
  player.position.y = playerBaseY;
  player.position.x = lanes[currentLane];
  player.castShadow = true;
  scene.add(player);

  // Initial segments
  createSegment(lastSegmentZ);
  createSegment(lastSegmentZ - segmentLength);
  lastSegmentZ -= segmentLength;

  // Explosion particles
  addExplosion();

  // Rain particles
  addRain();

  // City far landscape (simple buildings)
  addCityBackground();

  // Input
  document.addEventListener('keydown', handleKeyDown);

  animate();
}

function createSegment(z) {
  const segmentGeometry = new THREE.BoxGeometry(10, 0.2, segmentLength);
  const segmentMaterial = new THREE.MeshStandardMaterial({color: 0x333333, roughness: 0.5}); // Wet road
  const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
  segment.position.z = z;
  segment.receiveShadow = true;
  scene.add(segment);
  segments.push(segment);
}

function updateSegments() {
  player.position.z -= speed;

  // Generate new segment if needed
  if (player.position.z < lastSegmentZ + segmentLength) {
    createSegment(lastSegmentZ - segmentLength);
    lastSegmentZ -= segmentLength;
  }

  // Remove old segments
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].position.z > player.position.z + segmentLength) {
      scene.remove(segments[i]);
      segments.splice(i, 1);
    }
  }
}

function addCityBackground() {
  for (let i = 0; i < 20; i++) {
    const height = Math.random() * 20 + 10;
    const buildingGeometry = new THREE.BoxGeometry(Math.random() * 5 + 5, height, Math.random() * 5 + 5);
    const buildingMaterial = new THREE.MeshStandardMaterial({color: 0x111111, emissive: Math.random() * 0xffffff});
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.x = Math.random() * 100 - 50;
    building.position.y = height / 2;
    building.position.z = player.position.z - Math.random() * 200 - 50;
    scene.add(building);
    // Neon light
    const pointLight = new THREE.PointLight(buildingMaterial.emissive.getHex(), 2, 50);
    pointLight.position.set(building.position.x, height, building.position.z);
    scene.add(pointLight);
  }
}

function addRain() {
  const rainCount = 10000;
  const rainGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    positions[i * 3] = Math.random() * 200 - 100;
    positions[i * 3 + 1] = Math.random() * 200;
    positions[i * 3 + 2] = Math.random() * 200 - 100;
  }
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMaterial = new THREE.PointsMaterial({color: 0x888888, size: 0.1, transparent: true});
  rain = new THREE.Points(rainGeometry, rainMaterial);
  scene.add(rain);
}

function animateRain() {
  const positions = rain.geometry.attributes.position.array;
  for (let i = 1; i < positions.length; i += 3) {
    positions[i] -= 0.2 + speed * 5; // Slant with speed
    if (positions[i] < 0) positions[i] = 200;
  }
  rain.geometry.attributes.position.needsUpdate = true;
  rain.position.z = player.position.z; // Follow player
}

function addExplosion() {
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const pMaterial = new THREE.PointsMaterial({color: 0xff0000, size: 0.2, transparent: true});
  particles = new THREE.Points(particleGeometry, pMaterial);
  scene.add(particles);
  particles.visible = false;
}

function explode() {
  particles.position.copy(player.position);
  const positions = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = Math.random() * 2 - 1;
    positions[i * 3 + 1] = Math.random() * 2 - 1;
    positions[i * 3 + 2] = Math.random() * 2 - 1;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  explosionPower = 1.07;
  particles.visible = true;
}

function doExplosionLogic() {
  if (!particles.visible) return;
  const positions = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] *= explosionPower;
  }
  if (explosionPower > 1.005) {
    explosionPower -= 0.001;
  } else {
    particles.visible = false;
  }
  particles.geometry.attributes.position.needsUpdate = true;
}

function generateObstacles(delta) {
  lastSpawnTime += delta;
  if (lastSpawnTime > treeReleaseInterval) {
    lastSpawnTime = 0;
    const typeIndex = Math.floor(Math.random() * obstacleTypes.length);
    const obsType = obstacleTypes[typeIndex];
    const obstacle = new THREE.Mesh(obsType.geometry, obsType.material);
    obstacle.position.x = lanes[Math.floor(Math.random() * 3)];
    obstacle.position.y = obsType.positionY;
    obstacle.position.z = player.position.z - 50 - Math.random() * 50;
    obstacle.castShadow = true;
    scene.add(obstacle);
    obstacles.push(obstacle);
  }
}

function updateObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].position.z += speed;
    if (obstacles[i].position.z > player.position.z + 5) {
      scene.remove(obstacles[i]);
      obstacles.splice(i, 1);
    } else {
      const box = new THREE.Box3().setFromObject(obstacles[i]);
      const playerBox = new THREE.Box3().setFromObject(player);
      if (box.intersectsBox(playerBox)) {
        explode();
        hasCollided = true;
      }
    }
  }
}

function handleKeyDown(event) {
  if (jumping) return;
  if (event.keyCode === 37 && currentLane > 0) { // left
    currentLane--;
  } else if (event.keyCode === 39 && currentLane < 2) { // right
    currentLane++;
  } else if (event.keyCode === 38) { // up - jump
    jumping = true;
    bounceValue = 0.06;
  }
  player.position.x = lanes[currentLane];
}

function updatePlayer(delta) {
  if (jumping) {
    bounceValue -= gravity;
    player.position.y += bounceValue;
    if (player.position.y <= playerBaseY) {
      jumping = false;
      player.position.y = playerBaseY;
    }
  }
}

function updateUI() {
  document.getElementById('speed').innerHTML = Math.round(speed * 1000) + ' KM/H';
  document.getElementById('score').innerHTML = score;
  // Update energy, skills, prompts as needed (e.g., random prompts)
  if (Math.random() < 0.01) {
    document.getElementById('prompt').innerHTML = Math.random() > 0.5 ? '滑行！' : '左跳！';
    setTimeout(() => { document.getElementById('prompt').innerHTML = ''; }, 1000);
  }
}

function updateColors() {
  let fogColor;
  if (speed < 0.02) fogColor = 0x00ff00; // green
  else if (speed < 0.04) fogColor = 0x0000ff; // blue
  else if (speed < 0.06) fogColor = 0xff00ff; // purple
  else fogColor = 0xff0000; // red
  scene.fog.color.setHex(fogColor);
  scene.background.setHex(fogColor);
  if (speed > 0.06) {
    // Adrenaline mode - screen shake
    camera.position.x += Math.random() * 0.05 - 0.025;
    camera.position.y += Math.random() * 0.05 - 0.025;
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!hasCollided) {
    speed = Math.min(speed + 0.00001, maxSpeed);
    score += Math.round(speed * 10);
    updateSegments();
    generateObstacles(delta);
    updateObstacles();
    updatePlayer(delta);
    animateRain();
    updateColors();
    updateUI();
  } else {
    doExplosionLogic();
  }

  camera.position.set(player.position.x, player.position.y + 2, player.position.z + 5); // Shoulder view
  camera.lookAt(player.position);

  renderer.render(scene, camera);
}

init();
