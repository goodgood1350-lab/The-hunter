let audioCtx;

// --- 畫面閃光 ---
function flashScreen(duration = 0.15) {
    const overlay = document.getElementById('flash-overlay');
    overlay.style.opacity = '1';
    setTimeout(() => overlay.style.opacity = '0', duration * 1000);
}

// --- 初始化音效 ---
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playSound(freq, duration, type = 'sine') {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
}

function createScorePop(amount, worldPos) {
    const pop = document.createElement('div');
    pop.className = 'score-pop';
    pop.textContent = `+${amount}`;
    pop.style.left = '50%';
    pop.style.top = '40%';
    document.body.appendChild(pop);
    setTimeout(() => document.body.removeChild(pop), 800);
}

function updateMultiplier(multiplier) {
    multiplier = powerupActive.mult ? 2 : Math.floor(1 + streak * 0.3);
    multiplier = Math.min(multiplier, 10);
    const multEl = document.getElementById('mult-val');
    const multUi = document.getElementById('mult-ui');
    multEl.textContent = multiplier;
    multUi.style.display = multiplier > 1 ? 'block' : 'none';
}

// --- UI ---
function setupUIEvents() {
    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
}

function startGame() {
    isGameStarted = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui-container').style.opacity = '1';
    document.getElementById('controls-hint').style.opacity = '0.6';
    playSound(1050, 0.6);
}

function gameOver() {
    isGameOver = true;
    newBest = score > highScore;
    if (newBest) {
        highScore = score;
        localStorage.setItem('subwayRunHighScore', highScore);
        document.getElementById('high-score-value').textContent = highScore.toLocaleString();
    }
    document.getElementById('final-score').textContent = score.toLocaleString();
    document.getElementById('go-title').textContent = 'BUSTED!';
    const newBestEl = document.getElementById('new-best');
    if (newBest) {
        newBestEl.textContent = 'NEW BEST!';
        newBestEl.style.display = 'block';
    }
    document.getElementById('game-over').style.display = 'block';

    player.rotation.x = -Math.PI / 2;
    player.position.y = 0.6;
    inspector.position.z = 1.5;
}

function restartGame() {
    // 清空
    [obstacles, coins, powerups].forEach(list => list.forEach(o => scene.remove(o)));
    obstacles = []; coins = []; powerups = [];
    particles.forEach(p => p.visible = false);

    // 重置
    Object.assign(playerState, { lane: 1, y: 0, vy: 0, isJumping: false, isSliding: false, slideTimer: 0, currentX: 0, stumble: 0 });
    player.position.set(0,0,0);
    player.rotation.set(0,0,0);
    player.scale.set(1,1,1);
    inspector.position.set(0,0,14);
    playerBodyMat.emissive.setHex(0x000000);
    player.visible = true;

    score = 0; distanceTraveled = 0; streak = 0; multiplier = 1;
    Object.assign(powerupActive, { mult: false, timer: 0, invincible: false, timerInv: 0, magnet: false, timerMag: 0 });
    gameSpeed = CONFIG.BASE_SPEED;
    isGameOver = false;

    document.getElementById('score').textContent = '0';
    document.getElementById('mult-ui').style.display = 'none';

    // 賽道重生
    tracks.forEach(t => scene.remove(t));
    tracks = [];
    for (let i = 0; i < 10; i++) tracks = tracks.concat(spawnTrackSection(i * -48));

    document.getElementById('game-over').style.display = 'none';
    document.getElementById('new-best').style.display = 'none';
}

export { flashScreen, initAudio, playSound, createScorePop, updateMultiplier, startGame, gameOver, restartGame, setupUIEvents };
