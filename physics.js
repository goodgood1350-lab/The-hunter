import * as THREE from 'three';

import { CONFIG, scene, player, playerState, obstacles, coins, powerups, score, multiplier, particles, gameOver, streak, powerupActive } from './main.js';
import { spawnParticles } from './models.js';
import { flashScreen, playSound, createScorePop } from './ui.js';

function updatePlayer(delta, playerState, player, CONFIG) {
    // 跳躍/重力 (空中換線已支援)
    if (playerState.isJumping) {
        playerState.vy -= CONFIG.GRAVITY;
        playerState.y += playerState.vy * delta * 60;  // 幀獨立
        if (playerState.y <= 0) {
            playerState.y = 0;
            playerState.vy = 0;
            playerState.isJumping = false;
            player.scale.set(1.2, 0.82, 1.2);
            setTimeout(() => player.scale.set(1,1,1), 120);
            playSound(380, 0.1, 'square');
        }
    }

    // 滑行 (跳躍取消)
    if (playerState.isSliding) {
        playerState.slideTimer -= delta;
        if (playerState.slideTimer <= 0) {
            playerState.isSliding = false;
            player.scale.y = 1;
            player.children[2].rotation.z = 0.15;  // 手臂恢復
            player.children[3].rotation.z = -0.15;
        } else {
            player.scale.y = 0.52;
            player.children[2].rotation.z = 0.9;   // 前伸
            player.children[3].rotation.z = -0.9;
        }
    }

    // X Lerp (空中也動)
    const targetX = CONFIG.LANES[playerState.lane];
    playerState.currentX += (targetX - playerState.currentX) * 15 * delta;
    player.position.set(playerState.currentX, playerState.y, 0);

    // 跑步動畫 (滑行/跳時停)
    if (!playerState.isJumping && !playerState.isSliding) {
        const time = Date.now() * 0.025;
        player.children[2].rotation.z = Math.sin(time * 1.8) * 0.45;  // 左臂
        player.children[3].rotation.z = -Math.sin(time * 1.8) * 0.45; // 右臂
        player.children[4].rotation.z = -Math.sin(time * 2.2) * 0.65; // 左腿
        player.children[5].rotation.z = Math.sin(time * 2.2) * 0.65;  // 右腿
        player.position.y += Math.sin(time * 3.5) * 0.1;
    }

    // 傾斜 (流暢)
    player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, (playerState.currentX - targetX) * -0.2, 12 * delta);
}

function updateObjects(list, isObstacle, isPowerup = false) {
    for (let i = list.length - 1; i >= 0; i--) {
        const obj = list[i];
        obj.position.z += gameSpeed;

        // 旋轉
        if (!isObstacle) {
            obj.rotation.x += obj.userData?.spinSpeed || 0.07;
            obj.rotation.y += 0.04;
        } else {
            // 障礙輕微搖動
            obj.rotation.y += delta * 0.5;
        }

        // 優化碰撞: 擴大Z範圍 + AABB-like (x/y/寬度考慮)
        if (obj.position.z > -CONFIG.COLLISION_Z_WIDTH && obj.position.z < CONFIG.COLLISION_Z_WIDTH) {
            const xDist = Math.abs(obj.position.x - player.position.x);
            const objHalfW = obj.userData?.halfWidth || 1.2;
            const objClearH = obj.userData?.clearHeight || 1.0;

            if (xDist < CONFIG.PLAYER_HALF_WIDTH + objHalfW) {
                if (isObstacle) {
                    // 精準避開判定 (y + 狀態)
                    let avoided = false;
                    if (obj.userData.height === 'low' && playerState.y > objClearH) {
                        avoided = true;  // 跳過低
                    } else if (obj.userData.height === 'high' && playerState.isSliding && (playerState.y + 1.2) < objClearH) {
                        avoided = true;  // 滑過高
                    } else if (obj.userData.fatal) {
                        avoided = false;  // 火車必撞
                    }

                    if (avoided) {
                        streak++;
                        score += CONFIG.BONUS_PERFECT * multiplier;
                        flashScreen(0.1);
                        spawnParticles(player.position.clone().add(new THREE.Vector3(0,1.5,0)), 0x00ff88, 12, false);  // 綠粒子完美
                        playSound(1100 - streak * 40, 0.15);
                        // Pop-up UI
                        createScorePop(CONFIG.BONUS_PERFECT * multiplier, player.position);
                    } else if (!powerupActive.invincible) {
                        handleCollision(obj);
                        return;
                    }
                } else if (isPowerup) {
                    activatePowerup(obj.userData.subtype);
                    spawnParticles(obj.position, 0xffffff, 25);
                    flashScreen(0.2);
                    playSound(950, 0.3);
                    scene.remove(obj);
                    list.splice(i, 1);
                    createScorePop(1000, obj.position);
                    continue;
                } else {
                    // 金幣 (磁鐵 + 收集)
                    const dist = player.position.distanceTo(obj.position);
                    if (dist < 2.2 || (powerupActive.magnet && dist < 12)) {
                        if (powerupActive.magnet && dist > 2.2) {
                            // 拉近
                            const dir = player.position.clone().sub(obj.position).normalize();
                            obj.position.add(dir.multiplyScalar(8 * delta));
                        } else {
                            spawnParticles(obj.position, 0xffd700, CONFIG.PARTICLE_COUNT);
                            flashScreen(0.08);
                            scene.remove(obj);
                            list.splice(i, 1);
                            score += CONFIG.COIN_BONUS * multiplier;
                            playSound(850 + Math.random() * 350, 0.14);
                            createScorePop(CONFIG.COIN_BONUS * multiplier, obj.position);
                        }
                    }
                }
            }
        }

        if (obj.position.z > 25) {
            scene.remove(obj);
            list.splice(i, 1);
        }
    }
}

function handleCollision(obj) {
    playSound(200, 0.45, 'sawtooth');
    scene.remove(obj);
    const idx = obstacles.indexOf(obj);
    if (idx > -1) obstacles.splice(idx, 1);

    if (obj.userData?.fatal || playerState.stumble > 0) {
        gameOver();
    } else {
        playerState.stumble = 3.5;
        streak = 0;
        // 撞擊反饋
        player.rotation.x = -0.4;
        player.position.x += (Math.random() - 0.5) * 0.5;
        setTimeout(() => {
            player.rotation.x = 0;
            player.position.x = playerState.currentX;
        }, 250);
        flashScreen(0.25);  // 紅閃 (負回饋)
    }
}

function moveLane(dir, playerState) {
    // 空中換線: 只禁滑行
    if (!playerState.isSliding) {
        const newLane = playerState.lane + dir;
        if (newLane >= 0 && newLane <= 2) playerState.lane = newLane;
    }
}

function jump(playerState, CONFIG, playSound) {
    if (!playerState.isJumping && !playerState.isSliding) {
        playerState.isJumping = true;
        playerState.vy = CONFIG.JUMP_FORCE;
        playSound(680, 0.16);
    }
}

function slide(playerState, CONFIG, playSound) {
    // 跳躍取消: 強制落地 + 滑行
    if (playerState.isJumping) {
        playerState.y = 0;
        playerState.vy = 0;
        playerState.isJumping = false;
    }
    if (!playerState.isSliding) {
        playerState.isSliding = true;
        playerState.slideTimer = CONFIG.SLIDE_DURATION;
        playSound(480, 0.13);
    }
}

export { updatePlayer, handleCollision, updateObjects, moveLane, jump, slide };
