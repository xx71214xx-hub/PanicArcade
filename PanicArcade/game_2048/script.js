import { supabase } from '../src/api/supabaseClient.js';

const SIZE = 4;

let board = [];
let score = 0; 
let mergedTiles = new Set();
let combo = 0; 
let previousBoard = null;
let previousScore = 0;

let timeLeft = 20; 
let maxStageTime = 20; 

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const messageEl = document.getElementById("message");
const highScoreEl = document.getElementById("highScore");
const comboBoxEl = document.getElementById("comboWrapper"); // تم استخدام comboWrapper ليتوافق مع الـ HTML
const comboCountEl = document.getElementById("comboCount");
const timerElement = document.getElementById("panicTimer");
const progressBarEl = document.getElementById("timeProgressBar");
const stageLabelEl = document.getElementById("stageLabel");

let highScore = parseInt(localStorage.getItem("highScore")) || 0;
let timerInterval = null;
let lastTickTime = Date.now(); 
let hasPlayedHighScoreSound = false; 

let startX = 0;
let startY = 0;

const audioFiles = {
    merge: new Audio("sound_effects/merge.mp3"),
    swipe: new Audio("sound_effects/swipe.mp3"),
    ticking: new Audio("sound_effects/timeout_loss.mp3"),
    boardFull: new Audio("sound_effects/board_full.mp3"),
    timeoutLoss: new Audio("sound_effects/Timer_End.mp3"),
    highscore: new Audio("sound_effects/highscore.mp3"),
    win2048: new Audio("sound_effects/win_2048.mp3")
};

audioFiles.merge.volume = 0.4;
audioFiles.swipe.volume = 0.2;
audioFiles.ticking.volume = 0.5;
audioFiles.boardFull.volume = 0.5;
audioFiles.timeoutLoss.volume = 0.5;
audioFiles.highscore.volume = 0.5;
audioFiles.win2048.volume = 0.6;

function unlockAudio() {
    Object.values(audioFiles).forEach(sound => {
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
        }).catch(err => console.log("تحضير الصوت..."));
    });
    
    document.removeEventListener("touchstart", unlockAudio, true);
    document.removeEventListener("touchend", unlockAudio, true);
    document.removeEventListener("touchmove", unlockAudio, true);
    document.removeEventListener("click", unlockAudio, true);
}
document.addEventListener("touchstart", unlockAudio, true);
document.addEventListener("touchend", unlockAudio, true);
document.addEventListener("touchmove", unlockAudio, true);
document.addEventListener("click", unlockAudio, true);

const boardFullMessages = [
    "🧠 عقلك حاصر نفسه بنفسه.. ركز شوي!", "🧱 قفلت على نفسك مثل الذكي.. صفقوا له!", 
    "🫣 البورد انخنق من حركاتك العشوائية!", "📉 مهارات التخطيط عندك صفر.. ارجع للودو أفضل!",
    "🥶 حركت القطع بدون تفكير لين قفلت الباب بوجهك!", "🤯 صدمة برمجية! كيف قفلتها كذا بسرعة؟", 
    "🤫 البورد يطلب منك تفكر قبل ما تلمس الشاشة!", "🧠 الـ 2048 تحتاج عقل مو بس سرعة أصابع!", 
    "🤷‍♂️ قفلت اللعبة؟ شكلك تبي تنتقم بالمرة الجاية.. اتحداك!", "🎯 اللعبة ذكاء وتخطيط.. مو خبط لزق!",
    "💀 انتحار تكتيكي في منتصف البورد!", "🤡 قفلتها بجداره.. مبروك لقب ملك العشوائية!"
];

const timeOutMessages = [
    "🐢 السلحفاة حطمت رقمك القياسي بالسرعة!", "😴 نمت وأرسلت تفكر بالخطوة؟ الوقت ما ينتظر!",
    "⏱️ العداد مات من الملل وأنت تتأمل البورد!", "💀 الوقت مات بسبب بطئك الشديد!",
    "🥶 التفكير الزائد خلاك صنم لين صفر العداد!", "⏰ تيك توك.. الوقت مو لصالح الناس البطيئة!",
    "🤦‍♂️ جلست تحسبها يمين ويسار لين طار الوقت!", "🔋 سرعتك تحتاج شحن.. الوقت خلص يا كابتن!",
    "🚀 المرة الجاية شغل محركات الصاروخ.. بلاش برود!", "🤡 فكرت وفكرت وفكرت.. وفي النهاية خسرت بالوقت!", 
    "⚡ السرعة هي المفتاح.. ارجع وفز بالسرعة!", "🏆 العب أسرع المرة الجاية واللقب لك بالتأكيد!"
];

function init() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    score = 0;
    combo = 0;
    hasPlayedHighScoreSound = false;
    previousBoard = null;
    previousScore = 0;
    
    addRandom();
    addRandom();
    render();
}

function checkAndSetStage() {
    if (score <= 1000) {
        maxStageTime = 20;
        if(stageLabelEl) {
            stageLabelEl.textContent = "المرحلة العادية";
            stageLabelEl.style.color = "#66FCF1";
        }
    } else if (score > 1000 && score <= 3000) {
        maxStageTime = 15;
        if(stageLabelEl) {
            stageLabelEl.textContent = "المرحلة المتقدمة";
            stageLabelEl.style.color = "#ffd900";
        }
    } else {
        maxStageTime = 10;
        if(stageLabelEl) {
            stageLabelEl.textContent = "جنون فائق ⚡";
            stageLabelEl.style.color = "#ff0055";
        }
    }

    if (timeLeft > maxStageTime) {
        timeLeft = maxStageTime;
    }
}

async function undoMove() {
    if (!previousBoard) {
        alert("لا توجد حركة سابقة للتراجع عنها.");
        return;
    }
    if (!window.coinsManager) {
        alert("نظام العملات غير متوفر.");
        return;
    }
    if (window.coinsManager.getCoins() < 10) {
        alert("لا تملك 10 عملات للتراجع.");
        return;
    }
    
    const success = await window.coinsManager.deductCoins(10, 'undo_move');
    if (!success) {
        alert("لا تملك عملات كافية في حسابك بالسيرفر.");
        return;
    }
    board = JSON.parse(JSON.stringify(previousBoard));
    score = previousScore;
    combo = 0; 
    if(comboBoxEl) comboBoxEl.style.display = "none";
    
    render();
    previousBoard = null;
}

function render(){
    boardEl.innerHTML = "";
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            const value = board[r][c];
            const tile = document.createElement("div");
            const tilesClass = value <= 2048 ? value : "super";
            tile.className = "tile n" + tilesClass;
            if(mergedTiles.has(`${r}-${c}`)){
                tile.classList.add("merge");
            }
            tile.textContent = value || "";
            boardEl.appendChild(tile);
        }
    }
    
    scoreEl.textContent = score;
    const scoreBox = scoreEl.closest('.score-box');
    const highScoreBox = highScoreEl.closest('.score-box');

    if (highScoreEl) highScoreEl.textContent = highScore;

    if (score > highScore && highScore > 0) {
        scoreBox.classList.add("score-leader");
        highScoreBox.classList.add("score-defeated");

        if (!hasPlayedHighScoreSound) {
            hasPlayedHighScoreSound = true;
            document.body.classList.add("celebration-flash");
            setTimeout(() => {
                document.body.classList.remove("celebration-flash");
            }, 600);
            audioFiles.highscore.currentTime = 0;
            audioFiles.highscore.play().catch(e => console.log(e));
        }
    } else {
        if(scoreBox) scoreBox.classList.remove("score-leader");
        if(highScoreBox) highScoreBox.classList.remove("score-defeated");
    }
}

async function handleEndGameHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", score);

        // إرسال أعلى نتيجة إلى السيرفر
        if (window.currentUser && window.currentUser.tg_id) {
            try {
                await supabase.rpc('update_high_score', {
                    p_tg_id: window.currentUser.tg_id,
                    p_score: score
                });

                console.log("✅ تم حفظ أعلى نتيجة في السيرفر بنجاح!");
            } catch (err) {
                console.error("❌ فشل حفظ أعلى نتيجة:", err);
            }
        }
    }
}

function addRandom(){
    const empty = [];
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            if(board[r][c] === 0){
                empty.push({r,c});
            }
        }
    }
    if(empty.length === 0) return;
    const {r,c} = empty[Math.floor(Math.random()*empty.length)];
    board[r][c] = Math.random() < 0.9 ? 2 : 4;
    render();

    setTimeout(() => {
        mergedTiles.clear();
        const tiles = boardEl.querySelectorAll('.tile');
        tiles.forEach(tile => tile.classList.remove('merge'));
    }, 220); 
}

function rotateCoordsClockwise(r, c, rotations) {
    let currR = r;
    let currC = c;
    for (let i = 0; i < rotations; i++) {
        let nextR = currC;
        let nextC = SIZE - 1 - currR;
        currR = nextR;
        currC = nextC;
    }
    return { r: currR, c: currC };
}

function moveLeft(){
    let changed = false;
    let localMerges = [];
    let hasMergedInThisMove = false;

    for(let r = 0; r < SIZE; r++){
        let oldRow = [...board[r]];
        let row = board[r].filter(v => v);
        let newRow = [];
        let targetCol = 0;

        for(let i = 0; i < row.length; i++){
            if(i < row.length - 1 && row[i] === row[i + 1]){
                let mergedValue = row[i] * 2;
                score += mergedValue;
                newRow.push(mergedValue);
                localMerges.push({r: r, c: targetCol});
                hasMergedInThisMove = true; 
                i++;
            }else{
                newRow.push(row[i]);
            }
            targetCol++;
        }
        while(newRow.length < SIZE){
            newRow.push(0);
        }
        board[r] = newRow;
        if(oldRow.toString() !== newRow.toString()){
            changed = true;
        }
    }
    return { changed, localMerges, hasMergedInThisMove };
}

function rotateClockwise(matrix){
    const result = Array.from({length:SIZE}, () => Array(SIZE).fill(0));
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            result[c][SIZE-1-r] = matrix[r][c];
        }
    }
    return result;
}

async function move(direction){
    if(document.getElementById("gameOverPopup").style.display === "flex" || !timerInterval) return;

    const boardSnapshot = JSON.parse(JSON.stringify(board));
    const scoreSnapshot = score;

    let rotations = { left: 0, up: 3, right: 2, down: 1 }[direction];
    for(let i=0; i<rotations; i++){ board = rotateClockwise(board); }

    const moveResult = moveLeft();
    const changed = moveResult.changed;
    const isMerged = moveResult.hasMergedInThisMove;
    let postRotations = (4 - rotations) % 4;

    for(let i=0; i < postRotations; i++){ board = rotateClockwise(board); }

    if(changed){
        previousBoard = boardSnapshot;
        previousScore = scoreSnapshot;
        checkAndSetStage();

        if(isMerged){
            if (window.navigator && window.navigator.vibrate) {
                let vibratePattern = combo >= 3 ? [40, 30, 40] : [25];
                window.navigator.vibrate(vibratePattern);
            }

            combo++;
            let addedTime = Math.min(combo, 4);
            timeLeft = Math.min(timeLeft + addedTime, maxStageTime);

            if(combo >= 2){ score += (combo * 10); }
            if (combo >= 5 && combo % 2 === 0) {
                if (Math.random() < 0.50 && window.coinsManager) { window.coinsManager.addCoins(2, 'combo_bonus'); }
            }
            audioFiles.merge.playbackRate = 1 + (combo * 0.12);
            audioFiles.merge.currentTime = 0;
            audioFiles.merge.play().catch(err => console.log(err));
        } else {
            combo = 0;
            audioFiles.swipe.currentTime = 0;
            audioFiles.swipe.play().catch(err => console.log(err));
        }

        if(combo >= 2) {
            if(comboCountEl) comboCountEl.textContent = "X" + combo + " 🔥";
            if(comboBoxEl) comboBoxEl.style.display = "block";
        } else {
            if(comboBoxEl) comboBoxEl.style.display = "none";
        }

        mergedTiles.clear();
        moveResult.localMerges.forEach(merged => {
            let finalCoords = rotateCoordsClockwise(merged.r, merged.c, postRotations);
            mergedTiles.add(`${finalCoords.r}-${finalCoords.c}`);
        });

        addRandom();
        render();

        if(checkWin()){
            audioFiles.win2048.play().catch(e => {});
            if(messageEl){ messageEl.textContent = "🎉 أسطورة! لقد صنعت مربع 2048!"; }
        } else if(checkGameOver()){
            clearInterval(timerInterval);
            timerInterval = null;
            await handleEndGameHighScore();
            audioFiles.ticking.pause();
            audioFiles.boardFull.currentTime = 0;
            audioFiles.boardFull.play().catch(e => {});

            const randomMessage = boardFullMessages[Math.floor(Math.random() * boardFullMessages.length)];
            if(messageEl){ messageEl.textContent = randomMessage; }
            document.getElementById("gameOverPopup").style.display = "flex";
            updatePopupButtons();
        }
    } else {
        combo = 0;
        if(comboBoxEl){ comboBoxEl.style.display = "none"; }
    }
}

function checkWin(){
    for(let row of board){ if(row.includes(2048)) return true; }
    return false;
}

function checkGameOver(){
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            if(board[r][c] === 0) return false;
            if(c < SIZE-1 && board[r][c] === board[r][c+1]) return false;
            if(r < SIZE-1 && board[r][c] === board[r+1][c]) return false;
        }
    }
    return true;
}

function restartGame(){
    if (timerInterval) { clearInterval(timerInterval); }
    document.getElementById("gameOverPopup").style.display = "none";
    document.body.classList.remove("shake");
    
    if(timerElement) {
        timerElement.style.background = "#66FCF1";
        timerElement.classList.remove("timerDanger");
    }
    if(progressBarEl) {
        progressBarEl.style.background = "#66FCF1";
        progressBarEl.style.boxShadow = "0 0 8px #66FCF1";
    }
    const overlay = document.getElementById("dangerOverlay");
    if(overlay) overlay.classList.remove("panicFlash");

    audioFiles.timeoutLoss.pause();
    audioFiles.boardFull.pause();
    audioFiles.ticking.pause();

    init();
    if (window.rewardedTiles) { window.rewardedTiles.clear(); }
    checkAndSetStage();
    timeLeft = maxStageTime; 
    if(messageEl) messageEl.textContent = "";
    
    lastTickTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

// تم تعديل الدالة لتشمل رسالة دقيقة في حال فشل سحب العملات أو حدوث خطأ اتصال بالسيرفر
async function handlePayAndStart() {
    const payBtn = document.getElementById("popupButton");
    if (window.coinsManager && typeof window.coinsManager.deductCoins === "function") {
        if (payBtn) {
            payBtn.disabled = true;
            payBtn.textContent = "⏳ جاري الفحص...";
        }
        let success = await window.coinsManager.deductCoins(5, 'entry_fee');
        if (success) { 
            restartGame(); 
        } else { 
            // التعديل المطلوب لبيان سبب الفشل المزدوج (الرصيد أو مشكلة الاتصال بالسيرفر)
            alert("عذراً، لا تملك عملات كافية للعب أو حدث خطأ في الاتصال بالسيرفر!"); 
            if (payBtn) {
                payBtn.disabled = false;
                payBtn.textContent = "🎟️ دفع 5 عملات وبدء اللعب";
            }
        }
    } else { 
        restartGame(); 
    }
}

window.restartGame = restartGame;
window.handlePayAndStart = handlePayAndStart;

document.addEventListener("DOMContentLoaded", () => {
    const payBtn = document.getElementById("popupButton");
    if(payBtn) { payBtn.addEventListener("click", handlePayAndStart); }

    const undoBtn = document.getElementById("undoBtn");
    if (undoBtn) { undoBtn.addEventListener("click", undoMove); }

    const restartBtn = document.getElementById("restartBtn");
    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            if(confirm("هل أنت متأكد من رغبتك في إعادة تشغيل الجولة الحالية؟")) { restartGame(); }
        });
    }

    let isMuted = false;
    const soundToggleBtn = document.getElementById("soundToggleBtn");
    if (soundToggleBtn) {
        soundToggleBtn.addEventListener("click", () => {
            isMuted = !isMuted;
            Object.values(audioFiles).forEach(sound => { sound.muted = isMuted; });
            soundToggleBtn.querySelector('.btn-icon').textContent = isMuted ? "🔇" : "🔊";
        });
    }
    
    updatePopupButtons();
});

document.addEventListener("keydown", e => {
    switch(e.key){
        case "ArrowLeft": move("left"); break;
        case "ArrowRight": move("right"); break;
        case "ArrowUp": move("up"); break;
        case "ArrowDown": move("down"); break;
    }
});

document.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener("touchend", e => {
    if (!startX || !startY) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 40) move("right"); else if (dx < -40) move("left");
    } else {
        if (dy > 40) move("down"); else if (dy < -40) move("up");
    }
    startX = 0; startY = 0;
}, { passive: true });

async function updateTimer(){
    if(!timerElement) return;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - lastTickTime) / 1000);

    if (elapsedSeconds >= 1) {
        timeLeft -= elapsedSeconds;
        lastTickTime += elapsedSeconds * 1000; 
    }

    let displayTime = timeLeft < 0 ? 0 : timeLeft;
    timerElement.innerHTML = "⏳ " + displayTime;

    if (progressBarEl) {
        let percentage = Math.min((displayTime / maxStageTime) * 100, 100);
        progressBarEl.style.width = percentage + "%";
    }

    const overlay = document.getElementById("dangerOverlay");
    let dangerThreshold = maxStageTime === 10 ? 3 : 5; 

    if(timeLeft <= dangerThreshold && timeLeft > 0){
        timerElement.style.background = "#FF0055";
        if(progressBarEl) {
            progressBarEl.style.background = "#FF0055";
            progressBarEl.style.boxShadow = "0 0 10px #FF0055";
        }
        document.body.classList.add("shake");
        timerElement.classList.add("timerDanger");
        if(overlay) overlay.classList.add("panicFlash");

        audioFiles.ticking.playbackRate = maxStageTime === 10 ? 1.5 : 1.0;
        audioFiles.ticking.play().catch(err => console.log(err));
    }

    if(timeLeft > dangerThreshold || (maxStageTime === 10 && timeLeft > 3)){
        if(maxStageTime === 10) {
            timerElement.style.background = "#ff5500";
            if(progressBarEl) {
                progressBarEl.style.background = "#ff5500";
                progressBarEl.style.boxShadow = "0 0 8px #ff5500";
            }
        } else {
            timerElement.style.background = "#66FCF1";
            if(progressBarEl) {
                progressBarEl.style.background = "#66FCF1";
                progressBarEl.style.boxShadow = "0 0 8px #66FCF1";
            }
        }
        document.body.classList.remove("shake");
        timerElement.classList.remove("timerDanger");
        if(overlay) overlay.classList.remove("panicFlash");

        if (timeLeft > dangerThreshold) { audioFiles.ticking.pause(); }
    }

    if(timeLeft <= 0){
        clearInterval(timerInterval);
        timerInterval = null;
        await handleEndGameHighScore();
        audioFiles.ticking.pause();
        audioFiles.timeoutLoss.currentTime = 0;
        audioFiles.timeoutLoss.play().catch(e => {});

        const randomMessage = timeOutMessages[Math.floor(Math.random() * timeOutMessages.length)];
        if(messageEl) messageEl.textContent = randomMessage;
        document.getElementById("gameOverPopup").style.display = "flex";
        updatePopupButtons();
        return;
    }
}

init();
document.getElementById("gameOverPopup").style.display = "flex";

const startFreeBtn = document.getElementById("startFreeButton");
if (startFreeBtn) { startFreeBtn.addEventListener("click", restartGame); }

function updatePopupButtons() {
    const payBtn = document.getElementById("popupButton");
    const startFreeBtn = document.getElementById("startFreeButton");
    const popupSubtext = document.getElementById("popupSubtext");
    const popupDailyBtn = document.getElementById("popupDailyBtn");

    if (window.coinsManager) {
        const currentCoins = window.coinsManager.getCoins();
        if (currentCoins >= 5) {
            if (payBtn) payBtn.style.display = "inline-block";
            if (startFreeBtn) startFreeBtn.style.display = "none";
            if (popupSubtext) popupSubtext.textContent = "مطلوب دفع 5 عملات لدخول الجولة";
        } else {
            if (payBtn) payBtn.style.display = "none";
            if (startFreeBtn) startFreeBtn.style.display = "inline-block";
            if (popupSubtext) popupSubtext.textContent = "يمكنك بدء اللعب مجاناً الآن أو استلام مكافأتك اليومية";
        }
    }

    if (popupDailyBtn && popupDailyBtn.style.display !== "none") {
        // نتركه يظهر بشكل طبيعي إلا في حال قام ملف coins.js بإخفائه أو معالجته
    }
}
window.updatePopupButtons = updatePopupButtons;

if (window.coinsManager) {
    const originalAddCoins = window.coinsManager.addCoins;
    window.coinsManager.addCoins = function(amount, reason) {
        originalAddCoins.call(this, amount, reason);
        updatePopupButtons();
    };
    const originalDeductCoins = window.coinsManager.deductCoins;
    window.coinsManager.deductCoins = async function(amount, reason) {
        const result = await originalDeductCoins.call(this, amount, reason);
        updatePopupButtons();
        return result;
    };
}
