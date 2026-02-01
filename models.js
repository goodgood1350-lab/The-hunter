import * as THREE from 'three';

import { CONFIG, scene } from './main.js';

// --- 初始化粒子池 (極強視覺回饋) ---
function initParticles(scene) {
    let particles = [];
    for (let i = 0; i < CONFIG.PARTICLE_COUNT * 3; i++) {  // 金幣x2 + 完美x1
        const particle = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffd700 })
        );
        particle.visible = false;
        scene.add(particle);
        particles.push(particle);
    }
    return particles;
}

// --- 粒子爆炸效果 ---
function spawnParticles(pos, color = 0xffd700, count = CONFIG.PARTICLE_COUNT, isCoin = true, particles) {
    for (let i = 0; i < count; i++) {
        const particle = particles[i % particles.length];
        particle.material.color.setHex(color);
        particle.position.copy(pos);
        particle.visible = true;
        particle.userData.vel = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 3 + 1,
            (Math.random() - 0.5) * 2
        );
        particle.userData.life = 1.0;
        particle.userData.isCoin = isCoin;
        particle.scale.set(1, 1, 1);
    }
}

// --- 更新粒子 ---
function updateParticles(delta, particles) {
    particles.forEach(p => {
        if (p.visible) {
            p.userData.life -= delta * 3;
            if (p.userData.life <= 0) {
                p.visible = false;
                return;
            }
            p.position.add(p.userData.vel.clone().multiplyScalar(delta));
            p.userData.vel.y -= 9.8 * delta;  // 重力
            p.material.opacity = p.userData.life;
            p.scale.setScalar(p.userData.life * 1.5);
            if (p.userData.isCoin) p.rotation.y += delta * 10;
        }
    });
}

// --- 角色創建 ---
function createHumanoid(color, isInspector = false) {
    const group = new THREE.Group();

    // 身體 (Capsule 更圓潤)
    const bodyGeo = new THREE.CapsuleGeometry(0.55, 1.4, 4, 12);
    const bodyMat = new THREE.MeshToonMaterial({ color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.3;
    body.castShadow = true;
    group.add(body);

    // 頭部
    const headGeo = new THREE.SphereGeometry(0.48, 20, 14);
    const headMat = new THREE.MeshToonMaterial({ color: 0xffdbac });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 2.75;
    head.castShadow = true;
    group.add(head);

    // 手臂
    const armGeo = new THREE.CapsuleGeometry(0.2, 1.0, 4, 10);
    const armMat = new THREE.MeshToonMaterial({ color: 0x34495e });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.85, 1.7, 0);
    leftArm.rotation.z = 0.15;
    const rightArm = leftArm.clone();
    rightArm.position.x = 0.85;
    rightArm.rotation.z = -0.15;
    group.add(leftArm, rightArm);

    // 腿
    const legGeo = new THREE.CapsuleGeometry(0.25, 1.1, 4, 10);
    const legMat = new THREE.MeshToonMaterial({ color: 0x2c3e50 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.35, 0.45, 0);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.35;
    group.add(leftLeg, rightLeg);

    // 配件
    if (isInspector) {
        const hatGeo = new THREE.ConeGeometry(0.6, 0.45, 10);
        const hat = new THREE.Mesh(hatGeo, new THREE.MeshToonMaterial({ color: 0x1e272e }));
        hat.position.y = 3.25;
        hat.rotation.y = Math.PI;
        group.add(hat);
    } else {
        const hatGeo = new THREE.BoxGeometry(1.1, 0.18, 1.0);
        const hat = new THREE.Mesh(hatGeo, new THREE.MeshToonMaterial({ color: 0xff6b7d }));
        hat.position.y = 3.25;
        hat.rotation.z = 0.25;
        group.add(hat);
    }

    return group;
}

function createPlayer(scene) {
    const player = createHumanoid(0x0984e3);
    player.position.set(0, 0, 0);
    scene.add(player);
    return player;
}

function createInspector(scene) {
    const inspector = createHumanoid(0x2d3436, true);
    inspector.position.set(0, 0, 12);
    scene.add(inspector);
    return inspector;
}

// --- 漂亮背景: 城市建築 ---
function createBuildings(scene) {
    const buildingTypes = [
        { w: 8, h: 15, d: 8, color: 0x95a5a6 },
        { w: 6, h: 20, d: 6, color: 0x7f8c8d },
        { w: 10, h: 12, d: 10, color: 0xb2bec3 }
    ];
    let buildings = [];
    for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 12; i++) {
            const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
            const building = new THREE.Mesh(
                new THREE.BoxGeometry(type.w, type.h, type.d),
                new THREE.MeshLambertMaterial({ color: type.color })
            );
            building.position.set(side * 22 + (Math.random() - 0.5) * 4, type.h / 2, i * -55 - 100);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            buildings.push(building);
        }
    }
    return buildings;
}

// --- 雲朵層 ---
function createClouds(scene) {
    let clouds = [];
    for (let layer = 0; layer < 3; layer++) {
        const cloudGeo = new THREE.SphereGeometry(5 + layer * 2, 12, 8);
        const cloudMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, transparent: true, opacity: 0.6 - layer * 0.1 
        });
        for (let i = 0; i < 6; i++) {
            const cloud = new THREE.Mesh(cloudGeo, cloudMat.clone());
            cloud.position.set((Math.random() - 0.5) * 100, 40 + layer * 15, i * -120 - 200);
            scene.add(cloud);
            clouds.push(cloud);
        }
    }
    return clouds;
}

// --- 環境 ---
function createEnvironment(scene) {
    // 隧道牆
    const wallMat = new THREE.MeshToonMaterial({ color: 0x7f8c8d });
    const wallGeo = new THREE.BoxGeometry(4, 30, 600);
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-20, 15, -250);
    const rightWall = leftWall.clone();
    rightWall.position.x = 20;
    scene.add(leftWall, rightWall);

    // 燈柱 (閃爍光源)
    const pillarGeo = new THREE.CylinderGeometry(0.45, 0.45, 25);
    const pillarMat = new THREE.MeshToonMaterial({ color: 0xbdc3c7 });
    for (let i = -4; i < 5; i++) {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(22 * (i % 2 ? 1 : -1), 12.5, i * -60 - 150);
        pillar.castShadow = true;
        scene.add(pillar);

        // 點光源 (動態閃爍)
        const light = new THREE.PointLight(0xffffaa, 1, 30);
        light.position.set(pillar.position.x, 20, pillar.position.z);
        scene.add(light);
    }

    // 燈光 (動態隧道燈)
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 25, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(2048, 2048);
    dirLight.shadow.camera.left = -30; dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30; dirLight.shadow.camera.bottom = -30;
    scene.add(dirLight);
}

export { initParticles, spawnParticles, updateParticles, createPlayer, createInspector, createBuildings, createClouds, createEnvironment };
