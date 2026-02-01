import * as THREE from 'three';

import { CONFIG, scene, obstacles, coins, powerups } from './main.js';

// --- 賽道生成 ---
function spawnTrackSection(scene, zPos) {
    let tracks = [];
    // 地面 (更寬)
    const groundGeo = new THREE.PlaneGeometry(42, 48);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x34495e });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0.01, zPos);
    ground.receiveShadow = true;
    scene.add(ground);
    tracks.push(ground);

    // 車道線 (發光)
    for (let i = 0; i < 3; i++) {
        const lineGeo = new THREE.PlaneGeometry(0.35, 48);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, emissive: 0x004400 });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(CONFIG.LANES[i], 0.02, zPos);
        scene.add(line);
        tracks.push(line);
    }

    if (zPos < -80) generateObstacles(zPos + (Math.random() * 15 - 7.5));  // 隨機偏移
    return tracks;
}

// --- 重新設計障礙生成 (多樣、群組、無重疊) ---
function generateObstacles(zBase) {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);  // 隨機順序
    let obsPlaced = 0;
    const maxObs = 2 + Math.floor(Math.random() * 2);  // 2-3

    for (let i = 0; i < lanes.length && obsPlaced < maxObs; i++) {
        const laneIdx = lanes[i];
        const x = CONFIG.LANES[laneIdx];
        const r = Math.random();

        // 25% 火車 (致命寬體)
        if (r < 0.25) {
            spawnTrain(x, zBase);
            obsPlaced++;
        } 
        // 30% 低障 (跳)
        else if (r < 0.55) {
            spawnBarrier(x, zBase);
            obsPlaced++;
        } 
        // 25% 高障 (滑)
        else if (r < 0.8) {
            spawnHighBarrier(x, zBase);
            obsPlaced++;
        } 
        // 20% 電源
        else if (Math.random() < CONFIG.POWERUP_CHANCE) {
            spawnPowerup(x, zBase);
        }
    }

    // 金幣 (剩餘車道 + 機率)
    for (let i = 0; i < 3; i++) {
        if (Math.random() > 0.35 || obsPlaced < 1) {  // 確保有金幣
            const pattern = Math.random() > 0.5 ? 'line' : 'arc';
            spawnCoins(CONFIG.LANES[i], zBase + (Math.random() - 0.5) * 5, pattern);
        }
    }
}

// 障礙生成函數 (更細緻模型)
function spawnTrain(x, z) {
    const train = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(5, 5.5, 18);
    const bodyMat = new THREE.MeshToonMaterial({ color: 0xe74c3c });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2.75;
    body.castShadow = true;
    const windowsGeo = new THREE.BoxGeometry(4.5, 2.2, 12);
    const windows = new THREE.Mesh(windowsGeo, new THREE.MeshBasicMaterial({ color: 0x3498db }));
    windows.position.y = 3.3;
    train.add(body, windows);
    train.position.set(x, 0, z);
    train.userData = { type: 'train', fatal: true, halfWidth: 2.5, heightLow: 2, heightHigh: 5.5 };
    scene.add(train);
    obstacles.push(train);
}

function spawnBarrier(x, z) {  // 低障 (多杆設計)
    const barrier = new THREE.Group();
    const topGeo = new THREE.BoxGeometry(3.2, 1.1, 0.7);
    const top = new THREE.Mesh(topGeo, new THREE.MeshToonMaterial({ color: 0xf39c12 }));
    top.position.y = 1.0;
    top.castShadow = true;
    for (let px of [-1.4, 0, 1.4]) {
        const poleGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.4);
        const pole = new THREE.Mesh(poleGeo, new THREE.MeshBasicMaterial({ color: 0x2c3e50 }));
        pole.position.set(px, 0.7, 0);
        barrier.add(pole);
    }
    barrier.add(top);
    barrier.position.set(x, 0.6, z);
    barrier.userData = { type: 'barrier', height: 'low', halfWidth: 1.6, clearHeight: 1.6 };
    scene.add(barrier);
    obstacles.push(barrier);
}

function spawnHighBarrier(x, z) {  // 高障 (厚實)
    const barrier = new THREE.Group();
    const mainGeo = new THREE.BoxGeometry(3.8, 3.2, 0.8);
    const main = new THREE.Mesh(mainGeo, new THREE.MeshToonMaterial({ color: 0xe67e22 }));
    main.position.y = 2.0;
    main.castShadow = true;
    const topGeo = new THREE.BoxGeometry(3.0, 0.6, 1.2);
    const top = new THREE.Mesh(topGeo, new THREE.MeshToonMaterial({ color: 0xd35400 }));
    top.position.y = 3.4;
    barrier.add(main, top);
    barrier.position.set(x, 0, z);
    barrier.userData = { type: 'high_barrier', height: 'high', halfWidth: 1.9, clearHeight: 0.8 };
    scene.add(barrier);
    obstacles.push(barrier);
}

function spawnPowerup(x, z) {
    const types = [
        { color: 0xffff00, emissive: 0x444400, subtype: 'mult' },
        { color: 0x00ffff, emissive: 0x004444, subtype: 'magnet' },
        { color: 0xff4444, emissive: 0x440000, subtype: 'invincible' }
    ];
    const type = types[Math.floor(Math.random() * types.length)];
    const powerupGeo = new THREE.DodecahedronGeometry(0.65, 1);
    const powerupMat = new THREE.MeshToonMaterial({ 
        color: type.color, emissive: type.emissive, emissiveIntensity: 0.4 
    });
    const powerup = new THREE.Mesh(powerupGeo, powerupMat);
    powerup.position.set(x, 2.2, z);
    powerup.userData = { type: 'powerup', subtype: type.subtype };
    scene.add(powerup);
    powerups.push(powerup);
}

function spawnCoins(x, zBase, pattern) {
    const num = 4 + Math.floor(Math.random() * 3);  // 更多金幣
    for (let i = 0; i < num; i++) {
        const coinGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.14, 14);
        const coinMat = new THREE.MeshToonMaterial({ 
            color: 0xffd700, emissive: 0xaaaa00, emissiveIntensity: 0.3 
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.rotation.z = Math.PI / 2;
        const offsetZ = i * 2.2;
        if (pattern === 'arc') {
            const angle = (i / num) * Math.PI;
            coin.position.set(x + Math.sin(angle) * 1.2, 1.9 + Math.abs(Math.cos(angle)) * 1.0, zBase + offsetZ);
        } else {
            coin.position.set(x, 1.9, zBase + offsetZ);
        }
        coin.userData = { spinSpeed: 0.09 + Math.random() * 0.05 };
        scene.add(coin);
        coins.push(coin);
    }
}

function updateTracks(tracks, gameSpeed, generateObstacles) {
    for (let i = tracks.length - 1; i >= 0; i--) {
        const track = tracks[i];
        track.position.z += gameSpeed;
        if (track.position.z > 30) {
            track.position.z -= 480;  // 10*48
            if (track.geometry.parameters.width > 30) generateObstacles(track.position.z);
        }
    }
}

export { spawnTrackSection, generateObstacles, updateTracks };
