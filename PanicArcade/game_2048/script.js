// script.js - منطق لعبة 2048 (نسخة مُصلَّحة)
document.addEventListener("DOMContentLoaded", () => {

  const SIZE = 4;
  let board = [], score = 0, mergedTiles = new Set(), combo = 0;
  let previousBoard = null, previousScore = 0;
  let timeLeft = 20, maxStageTime = 20;

  const boardEl = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const messageEl = document.getElementById("message");
  const highScoreEl = document.getElementById("highScore");
  const comboBoxEl = document.getElementById("comboBox");
  const comboCountEl = document.getElementById("comboCount");
  const timerElement = document.getElementById("panicTimer");
  const progressBarEl = document.getElementById("timeProgressBar");
  const stageLabelEl = document.getElementById("stageLabel");

  let highScore = parseInt(localStorage.getItem("highScore")) || 0;
  let timerInterval = null;
  let lastTickTime = Date.now();
  let hasPlayedHighScoreSound = false;
  let startX = 0, startY = 0;
  let isMuted = false;

  // تعريف المسارات والأحجام الثابتة بدون أي تغيير
  const audioConfig = {
    merge:       { path: "sound_effects/merge.mp3", vol: 0.4 },
    swipe:       { path: "sound_effects/swipe.mp3", vol: 0.2 },
    ticking:     { path: "sound_effects/timeout_loss.mp3", vol: 0.5 },
    boardFull:   { path: "sound_effects/board_full.mp3", vol: 0.5 },
    timeoutLoss: { path: "sound_effects/timer_end.mp3", vol: 0.5 },
    highscore:   { path: "sound_effects/highscore.mp3", vol: 0.5 },
    win2048:     { path: "sound_effects/win_2048.mp3", vol: 0.6 }
  };

  // كائن للاحتفاظ بصوت التكتكة المستمر فقط لمنع تكراره
  let activeTickingAudio = null;

  // الدالة السحرية البديلة والمحسنة لبيئة التليجرام (توليد لحظي ديناميكي لضمان التشغيل)
  function playSoundSafe(soundKey, rate = 1.0) {
    if (isMuted) return;
    try {
      const config = audioConfig[soundKey];
      if (!config) return;

      // معالجة خاصة لصوت التكتكة المستمر لحمايته من التداخل
      if (soundKey === 'ticking') {
        if (!activeTickingAudio) {
          activeTickingAudio = new Audio(config.path);
          activeTickingAudio.volume = config.vol;
          activeTickingAudio.loop = true;
          activeTickingAudio.playbackRate = rate;
          activeTickingAudio.play().catch(() => {});
        } else {
          activeTickingAudio.playbackRate = rate;
        }
        return;
      }

      // بقية المؤثرات الفورية (مثل الدمج والسحب) تُنشأ وتُطلق ديناميكياً لكسر حظر المتصفح
      const audioInstance = new Audio(config.path);
      audioInstance.volume = config.vol;
      audioInstance.playbackRate = rate;
      
      const p = audioInstance.play();
      if (p && p.catch) {
        p.catch(() => {});
      }
    } catch (_) {}
  }

  // إيقاف الصوت المستمر عند الحاجة
  function stopTickingSound() {
    if (activeTickingAudio) {
      try {
        activeTickingAudio.pause();
        activeTickingAudio = null;
      } catch (_) {}
    }
  }

  // تفعيل أولي آمن لوحدات الصوت عند لمس الشاشة لأول مرة فكاً للقيود الأساسية
  function unlockAudio() {
    try {
      const dummy = new Audio(audioConfig.swipe.path);
      dummy.volume = 0.0;
      dummy.play().then(() => { dummy.pause(); }).catch(() => {});
    } catch (_) {}
    document.removeEventListener("touchstart", unlockAudio, true);
    document.removeEventListener("click", unlockAudio, true);
  }
  document.addEventListener("touchstart", unlockAudio, true);
  document.addEventListener("click", unlockAudio, true);

  // ===== منع السحب / الانعكاس =====
  document.addEventListener('touchmove', (e) => {
    if (!e.target.closest('.game-board')) e.preventDefault();
  }, { passive: false });
  document.body.style.overscrollBehavior = 'none';

  const boardFullMessages = [
    "🧠 عقلك حاصر نفسه بنفسه.. ركز شوي!","🧱 قفلت على نفسك!","🫣 البورد انخنق من حركاتك!",
    "📉 مهارات التخطيط صفر!","🥶 حركت بدون تفكير!","🤯 صدمة برمجية!","🧠 الـ2048 تحتاج عقل!",
    "🎯 اللعبة ذكاء وتخطيط!","💀 انتحار تكتيكي!","🤡 ملك العشوائية!"
  ];
  const timeOutMessages = [
    "🐢 السلحفاة أسرع منك!","⏱️ العداد مات من الملل!","💀 الوقت مات بسبب بطئك!",
    "⏰ الوقت ما ينتظر!","🚀 شغل المحركات!","⚡ السرعة هي المفتاح!"
  ];

  function init() {
    board = Array.from({length:SIZE}, () => Array(SIZE).fill(0));
    score = 0; combo = 0; hasPlayedHighScoreSound = false;
    previousBoard = null; previousScore = 0;
    addRandom(); addRandom(); render();
  }

  function checkAndSetStage() {
    if (score <= 1000) { maxStageTime = 20; if(stageLabelEl){stageLabelEl.textContent="المرحلة العادية";stageLabelEl.style.color="#66FCF1";}}
    else if (score <= 3000) { maxStageTime = 15; if(stageLabelEl){stageLabelEl.textContent="المرحلة المتقدمة";stageLabelEl.style.color="#ffd900";}}
    else { maxStageTime = 10; if(stageLabelEl){stageLabelEl.textContent="جنون فائق ⚡";stageLabelEl.style.color="#ff0055";}}
    if (timeLeft > maxStageTime) timeLeft = maxStageTime;
  }

  function undoMove() {
    if (!previousBoard) { alert("لا توجد حركة سابقة."); return; }
    if (!window.coinsManager || window.coinsManager.getCoins() < 10) { alert("تحتاج 10 عملات للتراجع."); return; }
    if (!window.coinsManager.deductCoins(10)) return;
    board = JSON.parse(JSON.stringify(previousBoard));
    score = previousScore; combo = 0;
    if (comboBoxEl) comboBoxEl.style.display = "none";
    render(); previousBoard = null;
  }

  function render() {
    boardEl.innerHTML = "";
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      const v = board[r][c];
      const t = document.createElement("div");
      t.className = "tile n" + v;
      if (mergedTiles.has(`${r}-${c}`)) t.classList.add("merge");
      t.textContent = v || "";
      boardEl.appendChild(t);
    }
    scoreEl.textContent = score;
    const sBox = scoreEl.closest('.score-box');
    const hBox = highScoreEl.closest('.score-box');
    if (highScoreEl) highScoreEl.textContent = highScore;

    if (score > highScore && highScore > 0) {
      sBox && sBox.classList.add("score-leader");
      hBox && hBox.classList.add("score-defeated");
      if (!hasPlayedHighScoreSound) {
        hasPlayedHighScoreSound = true;
        document.body.classList.add("celebration-flash");
        setTimeout(()=>document.body.classList.remove("celebration-flash"),600);
        playSoundSafe('highscore');
      }
    } else {
      sBox && sBox.classList.remove("score-leader");
      hBox && hBox.classList.remove("score-defeated");
    }
  }

  function handleEndGameHighScore() {
    if (score > highScore) { highScore = score; localStorage.setItem("highScore", score); }
  }

  function addRandom() {
    const empty = [];
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) if (board[r][c]===0) empty.push({r,c});
    if (!empty.length) return;
    const {r,c} = empty[Math.floor(Math.random()*empty.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    render();
    setTimeout(()=>{ mergedTiles.clear(); boardEl.querySelectorAll('.tile').forEach(t=>t.classList.remove('merge')); }, 220);
  }

  function rotateCoordsClockwise(r,c,rot) {
    let R=r,C=c;
    for(let i=0;i<rot;i++){ const nR=C, nC=SIZE-1-R; R=nR; C=nC; }
    return {r:R,c:C};
  }

  function moveLeft() {
    let changed=false, localMerges=[], hasMergedInThisMove=false;
    for (let r=0;r<SIZE;r++) {
      const oldRow = [...board[r]];
      const row = board[r].filter(v=>v);
      const newRow = []; let targetCol = 0;
      for (let i=0;i<row.length;i++) {
        if (i < row.length-1 && row[i] === row[i+1]) {
          const m = row[i]*2; score += m; newRow.push(m);
          localMerges.push({r, c: targetCol}); hasMergedInThisMove = true; i++;
        } else { newRow.push(row[i]); }
        targetCol++;
      }
      while (newRow.length < SIZE) newRow.push(0);
      board[r] = newRow;
      if (oldRow.toString() !== newRow.toString()) changed = true;
    }
    return { changed, localMerges, hasMergedInThisMove };
  }

  function rotateClockwise(m) {
    const out = Array.from({length:SIZE},()=>Array(SIZE).fill(0));
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) out[c][SIZE-1-r] = m[r][c];
    return out;
  }

  function move(direction) {
    if (document.getElementById("gameOverPopup").style.display === "flex" || !timerInterval) return;
    const snap = JSON.parse(JSON.stringify(board));
    const snapScore = score;
    const rotations = { left:0, up:3, right:2, down:1 }[direction];
    for (let i=0;i<rotations;i++) board = rotateClockwise(board);
    const moveResult = moveLeft();
    const postRotations = (4 - rotations) % 4;
    for (let i=0;i<postRotations;i++) board = rotateClockwise(board);

    if (moveResult.changed) {
      previousBoard = snap; previousScore = snapScore;
      checkAndSetStage();

      if (moveResult.hasMergedInThisMove) {
        if (window.navigator.vibrate) {
          window.navigator.vibrate(combo >= 3 ? [40,30,40] : [25]);
        }
        combo++;
        const addedTime = Math.min(combo, 4);
        timeLeft = Math.min(timeLeft + addedTime, maxStageTime);
        if (combo >= 2) score += (combo * 10);
        if (combo >= 5 && combo % 2 === 0 && Math.random() < 0.5 && window.coinsManager) {
          window.coinsManager.addCoins(2);
        }
        const mRate = 1 + combo * 0.12;
        playSoundSafe('merge', mRate);
      } else {
        combo = 0;
        playSoundSafe('swipe');
      }

      if (combo >= 2) { if(comboCountEl) comboCountEl.textContent="X"+combo+" 🔥"; if(comboBoxEl) comboBoxEl.style.display="block"; }
      else { if(comboBoxEl) comboBoxEl.style.display="none"; }

      mergedTiles.clear();
      moveResult.localMerges.forEach(mg => {
        const f = rotateCoordsClockwise(mg.r, mg.c, postRotations);
        mergedTiles.add(`${f.r}-${f.c}`);
      });

      addRandom(); render();

      if (checkWin()) {
        playSoundSafe('win2048');
        if (messageEl) messageEl.textContent = "🎉 أسطورة! صنعت 2048!";
      } else if (checkGameOver()) {
        clearInterval(timerInterval); timerInterval = null;
        handleEndGameHighScore();
        stopTickingSound();
        playSoundSafe('boardFull');
        if (window.stopBoardWatch) window.stopBoardWatch();
        if (messageEl) messageEl.textContent = boardFullMessages[Math.floor(Math.random()*boardFullMessages.length)];
        document.getElementById("gameOverPopup").style.display = "flex";
      }
    } else { combo = 0; if (comboBoxEl) comboBoxEl.style.display = "none"; }
  }

  function checkWin(){ for (const r of board) if (r.includes(2048)) return true; return false; }
  function checkGameOver(){
    for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
      if (board[r][c]===0) return false;
      if (c<SIZE-1 && board[r][c]===board[r][c+1]) return false;
      if (r<SIZE-1 && board[r][c]===board[r+1][c]) return false;
    }
    return true;
  }

  function restartGame() {
    if (timerInterval) clearInterval(timerInterval);
    document.getElementById("gameOverPopup").style.display = "none";
    document.body.classList.remove("shake");
    if (timerElement) { timerElement.style.background="#66FCF1"; timerElement.classList.remove("timerDanger"); }
    if (progressBarEl) { progressBarEl.style.background="#66FCF1"; progressBarEl.style.boxShadow="0 0 8px #66FCF1"; }
    const overlay = document.getElementById("dangerOverlay"); if (overlay) overlay.classList.remove("panicFlash");
    stopTickingSound();
    init();
    if (window.rewardedTiles) window.rewardedTiles.clear();
    checkAndSetStage();
    timeLeft = maxStageTime;
    if (messageEl) messageEl.textContent = "";
    lastTickTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
  }

  function handlePayAndStart() {
    if (window.coinsManager && window.coinsManager.deductCoins) {
      if (window.coinsManager.deductCoins(5)) { restartGame(); }
      else { alert("لا تملك عملات كافية!"); }
    } else { restartGame(); }
  }

  window.restartGame = restartGame;
  window.handlePayAndStart = handlePayAndStart;

  function updatePopupButtons() {
    const payBtn = document.getElementById("popupButton");
    const freeBtn = document.getElementById("startFreeButton");
    const subtext = document.getElementById("popupSubtext");
    const dailyBtn = document.getElementById("popupDailyBtn");

    if (window.coinsManager && window.coinsManager.getCoins() >= 5) {
      if (payBtn) payBtn.style.display = "inline-block";
      if (freeBtn) freeBtn.style.display = "none";
      if (subtext) subtext.textContent = "مطلوب دفع 5 عملات لدخول الجولة";
    } else {
      if (payBtn) payBtn.style.display = "none";
      if (freeBtn) freeBtn.style.display = "inline-block";
      if (subtext) subtext.textContent = "يمكنك بدء اللعب مجاناً الآن أو استلام مكافأتك اليومية";
    }

    const lastClaim = localStorage.getItem("lastDailyClaim");
    const oneDay = 24*60*60*1000;
    if (dailyBtn) {
      const canClaim = !lastClaim || (Date.now() - parseInt(lastClaim) >= oneDay);
      dailyBtn.style.display = canClaim ? "inline-block" : "none";
    }
  }
  window.updatePopupButtons = updatePopupButtons;

  // أزرار
  const payBtn = document.getElementById("popupButton");
  if (payBtn) payBtn.addEventListener("click", handlePayAndStart);
  const undoBtn = document.getElementById("undoBtn");
  if (undoBtn) undoBtn.addEventListener("click", undoMove);
  const restartBtn = document.getElementById("restartBtn");
  if (restartBtn) restartBtn.addEventListener("click", () => {
    if (confirm("هل أنت متأكد من إعادة تشغيل الجولة؟")) restartGame();
  });

  const soundToggleBtn = document.getElementById("soundToggleBtn");
  if (soundToggleBtn) soundToggleBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    if (isMuted) {
      stopTickingSound();
    }
    soundToggleBtn.querySelector('.btn-icon').textContent = isMuted ? "🔇" : "🔊";
  });

  const startFreeBtn = document.getElementById("startFreeButton");
  if (startFreeBtn) startFreeBtn.addEventListener("click", restartGame);

  // إدخال
  document.addEventListener("keydown", e => {
    switch(e.key){
      case "ArrowLeft": move("left"); break;
      case "ArrowRight": move("right"); break;
      case "ArrowUp": move("up"); break;
      case "ArrowDown": move("down"); break;
    }
  });

  document.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener("touchend", e => {
    if (!startX || !startY) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) { if (dx > 40) move("right"); else if (dx < -40) move("left"); }
    else { if (dy > 40) move("down"); else if (dy < -40) move("up"); }
    startX = 0; startY = 0;
  }, { passive: true });

  function updateTimer() {
    if (!timerElement) return;
    const now = Date.now();
    const elapsed = Math.floor((now - lastTickTime) / 1000);
    if (elapsed >= 1) { timeLeft -= elapsed; lastTickTime += elapsed * 1000; }
    const display = timeLeft < 0 ? 0 : timeLeft;
    timerElement.innerHTML = "⏳ " + display;
    if (progressBarEl) progressBarEl.style.width = Math.min((display/maxStageTime)*100, 100) + "%";

    const overlay = document.getElementById("dangerOverlay");
    const danger = maxStageTime === 10 ? 3 : 5;

    if (timeLeft <= danger && timeLeft > 0) {
      timerElement.style.background = "#FF0055";
      if (progressBarEl) { progressBarEl.style.background="#FF0055"; progressBarEl.style.boxShadow="0 0 10px #FF0055"; }
      document.body.classList.add("shake");
      timerElement.classList.add("timerDanger");
      if (overlay) overlay.classList.add("panicFlash");
      const tRate = maxStageTime === 10 ? 1.5 : 1.0;
      playSoundSafe('ticking', tRate);
    }

    if (timeLeft > danger) {
      if (maxStageTime === 10) {
        timerElement.style.background = "#ff5500";
        if (progressBarEl) { progressBarEl.style.background="#ff5500"; progressBarEl.style.boxShadow="0 0 8px #ff5500"; }
      } else {
        timerElement.style.background = "#66FCF1";
        if (progressBarEl) { progressBarEl.style.background="#66FCF1"; progressBarEl.style.boxShadow="0 0 8px #66FCF1"; }
      }
      document.body.classList.remove("shake");
      timerElement.classList.remove("timerDanger");
      if (overlay) overlay.classList.remove("panicFlash");
      stopTickingSound();
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval); timerInterval = null;
      handleEndGameHighScore();
      stopTickingSound();
      playSoundSafe('timeoutLoss');
      if (window.stopBoardWatch) window.stopBoardWatch();
      if (messageEl) messageEl.textContent = timeOutMessages[Math.floor(Math.random()*timeOutMessages.length)];
      document.getElementById("gameOverPopup").style.display = "flex";
    }
  }

  // البداية
  init();
  document.getElementById("gameOverPopup").style.display = "flex";
  updatePopupButtons();
});
