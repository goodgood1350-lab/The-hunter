import * as THREE from 'three';

import { createPlayer, createInspector, createBuildings, createClouds, createEnvironment, initParticles, updateParticles, spawnParticles } from './models.js';
import { spawnTrackSection, generateObstacles, updateTracks } from './trackManager.js';
import { updatePlayer, handleCollision, moveLane, jump, slide, updateObjects } from './physics.js';
import { flashScreen, playSound, createScorePop, startGame, gameOver, restartGame, setupUIEvents, updateMultiplier } from './ui.js';

// --- 遊戲配置 (優化容錯與流暢) ---
const CONFIG = {
    LANE_WIDTH: 3.5,
    LANES: [-3.5, 0, 3.5],
    BASE_SPEED: 0.5,
    GRAVITY: 0.018,
    JUMP_FORCE: 0.38,
    SLIDE_DURATION: 1.2,
    SPEED_INC: 0.00004,
    POWERUP_DURATION: 10,
    POWERUP_CHANCE: 0.15,
    BONUS_PERFECT: 50,
    COIN_BONUS: 300,
    DISTANCE_MULT: 180,
    COLLISION_Z_WIDTH: 3.5,  // 擴大碰撞Z範圍，解決高速漏檢
    PLAYER_HALF_WIDTH: 0.8,   // 玩家半寬
    PARTICLE_COUNT: 20        // 粒子數
};

// --- 全局變數 ---
let scene, camera, renderer, clock, audioCtx;
let player, inspector, playerBodyMat;
let obstacles = [], tracks = [], coins = [], powerups = [], buildings = [], clouds = [];
let particles = [];  // 粒子池
let score = 0, highScore = parseInt(localStorage.getItem('subwayRunHighScore') || '0'), isGameOver = false, isGameStarted = false, paused = false;
let gameSpeed = CONFIG.BASE_SPEED;
document.getElementById('high-score-value').innerText = highScore.toLocaleString();

// 玩家狀態 (支援空中換線)
let playerState = { lane: 1, y: 0, vy: 0, isJumping: false, isSliding: false, slideTimer: 0, currentX: 0, stumble: 0 };

// 進階狀態
let distanceTraveled = 0, streak = 0, multiplier = 1;
let powerupActive = { mult: false, timer: 0, invincible: false, timerInv: 0, magnet: false, timerMag: 0 };
let newBest = false;

// --- 初始化遊戲 ---
function init() {
    // 場景 (漂亮背景漸變)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.006);

    // 相機
    camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
    camera.position.set(0, 8, 16);
    camera.lookAt(0, 2, -10);

    // 渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 粒子池
    particles = initParticles(scene);

    // 創建角色
    player = createPlayer(scene);
    inspector = createInspector(scene);
    playerBodyMat = player.children[0].material;

    // 環境 + 漂亮背景
    createEnvironment(scene);
    buildings = createBuildings(scene);
    clouds = createClouds(scene);

    // 生成初始賽道
    tracks = [];
    for (let i = 0; i < 10; i++) {  // 更多段確保無縫
        tracks = tracks.concat(spawnTrackSection(scene, i * -48));
    }

    // 事件
    setupControls();
    setupUIEvents();
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', () => paused = document.hidden);

    clock = new THREE.Clock();
    animate();
}

function animate() {
    requestAnimationFrame(animate);
    if (!isGameStarted || isGameOver || paused) return;

    const delta = Math.min(clock.getDelta(), 0.033);  // 60fps cap

    // 速度 & 計分 (距離 * 倍率)
    gameSpeed = CONFIG.BASE_SPEED + (score * CONFIG.SPEED_INC);
    const distanceBonus = gameSpeed * CONFIG.DISTANCE_MULT * multiplier * delta;
    score += Math.floor(distanceBonus);
    distanceTraveled += gameSpeed * delta;
    document.getElementById('score').textContent = score.toLocaleString();

    updateMultiplier();
    updatePlayer(delta, playerState, player, CONFIG);
    updateInspector(delta, inspector, playerState, player);
    updateParticles(delta, particles);
    updateObjects(obstacles, true);
    updateObjects(coins, false);
    updateObjects(powerups, false, true);
    updateTracks(tracks, gameSpeed, generateObstacles);
    updateBackgrounds(delta, buildings, clouds, gameSpeed);
    updateCamera(delta, camera, playerState);
    updateLights(scene);

    // 無敵閃爍
    if (powerupActive.invincible && powerupActive.timerInv > 0) {
        const flash = Math.sin(Date.now() * 0.04) > 0;
        player.visible = flash;
        playerBodyMat.emissive.setHex(flash ? 0x4444ff : 0x000000);
    } else {
        player.visible = true;
        playerBodyMat.emissive.setHex(0x000000);
    }

    // 電源計時
    ['timer', 'timerInv', 'timerMag'].forEach(t => {
        if (powerupActive[t] > 0) powerupActive[t] -= delta;
    });

    renderer.render(scene, camera);
}

function updateInspector(delta, inspector, playerState, player) {
    const targetZ = playerState.stumble > 0 ? 2.5 : 14;
    inspector.position.z += (targetZ - inspector.position.z) * (playerState.stumble > 0 ? 10 : 4) * delta;
    inspector.position.x += (player.position.x - inspector.position.x) * 10 * delta;
    inspector.position.y = THREE.MathUtils.lerp(inspector.position.y, player.position.y + 0.5, 12 * delta);

    // 追逐動畫
    const time = Date.now() * 0.02;
    inspector.children[4].rotation.z = Math.sin(time) * 0.4;
    inspector.children[5].rotation.z = -Math.sin(time) * 0.4;
}

function updateBackgrounds(delta, buildings, clouds, gameSpeed) {
    // 建築 (慢速)
    buildings.forEach(b => {
        b.position.z += gameSpeed * 0.4;
        if (b.position.z > 30) b.position.z -= 660;  // 12*55
    });
    // 雲朵 (超慢)
    clouds.forEach(c => {
        c.position.z += gameSpeed * 0.15;
        if (c.position.z > 50) c.position.z -= 720;  // 6*120
    });
}

function updateCamera(delta, camera, playerState) {
    camera.position.x += (playerState.currentX * 0.6 - camera.position.x) * 12 * delta;
    camera.position.y += (playerState.y + 7.5 - camera.position.y) * 10 * delta;
    camera.lookAt(playerState.currentX * 0.4, playerState.y + 1.8, -15);
    // 絆倒搖晃
    if (playerState.stumble > 0) {
        camera.position.x += (Math.random() - 0.5) * 0.6;
        camera.position.y += (Math.random() - 0.5) * 0.3;
    }
}

function updateLights(scene) {
    scene.children.forEach(child => {
        if (child.type === 'PointLight') {
            child.intensity = 1 + Math.sin(Date.now() * 0.008 + child.position.z * 0.1) * 0.4;
        }
    });
}

// --- 核心操作: 容錯微調 ---
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if (!isGameStarted || isGameOver || paused) return;
        switch (e.code) {
            case 'ArrowLeft': moveLane(-1, playerState); break;
            case 'ArrowRight': moveLane(1, playerState); break;
            case 'ArrowUp':
            case 'Space': jump(playerState, CONFIG, playSound); break;
            case 'ArrowDown': slide(playerState, CONFIG, playSound); break;  // 向下永遠滑/取消
        }
    });

    let touchStartX, touchStartY;
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }, { passive: false });
    document.addEventListener('touchend', (e) => {
        if (!isGameStarted || isGameOver || paused) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
            if (Math.abs(dx) > 35) moveLane(dx > 0 ? 1 : -1, playerState);
        } else {
            if (dy < -45) jump(playerState, CONFIG, playSound);
            if (dy > 35) slide(playerState, CONFIG, playSound);  // 下滑觸發取消/滑行
        }
    }, { passive: false });
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function activatePowerup(subtype, powerupActive, CONFIG) {
    powerupActive.timer = CONFIG.POWERUP_DURATION;
    switch (subtype) {
        case 'mult': powerupActive.mult = true; break;
        case 'magnet': powerupActive.magnet = true; powerupActive.timerMag = CONFIG.POWERUP_DURATION; break;
        case 'invincible': 
            powerupActive.invincible = true; 
            powerupActive.timerInv = CONFIG.POWERUP_DURATION; 
            break;
    }
}

export { CONFIG, scene, player, playerState, obstacles, coins, powerups, score, highScore, isGameOver, isGameStarted, paused, gameSpeed, powerupActive, streak, multiplier, distanceTraveled, newBest, particles, playerBodyMat, inspector, tracks, buildings, clouds, activatePowerup };

init();
