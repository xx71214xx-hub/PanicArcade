// coins.js - نظام إدارة العملات والمكافآت الاحترافية العشوائية
(function() {
    // 1. تهيئة الرصيد من الـ LocalStorage
    let coins = parseInt(localStorage.getItem("gameCoins")) || 50;

    function updateCoinsUI() {
        const coinsBalanceEl = document.getElementById("coinsBalance");
        if (coinsBalanceEl) {
            coinsBalanceEl.textContent = coins;
        }
    }

    // كائن إدارة العملات
    const coinsManager = {
        getCoins: function() {
            return coins;
        },
        addCoins: function(amount) {
            coins += amount;
            localStorage.setItem("gameCoins", coins);
            updateCoinsUI();
            
            // تأثير وميض ذهبي حماسي لصندوق العملات عند الربح
            const coinsBox = document.getElementById("coinsBox");
            if (coinsBox) {
                coinsBox.classList.remove("coin-gain");
                void coinsBox.offsetWidth; // Trigger reflow
                coinsBox.classList.add("coin-gain");
            }
        },
        deductCoins: function(amount) {
            if (coins >= amount) {
                coins -= amount;
                localStorage.setItem("gameCoins", coins);
                updateCoinsUI();
                return true;
            }
            return false;
        }
    };

    // 2. نظام تتبع لوحة اللعب لمنح مكافآت عشوائية للمحترفين
    let rewardedTiles = new Set(); 

    function watchGameBoard() {
        const board = document.getElementById("board");
        if (!board) return;

        const observer = new MutationObserver(() => {
            const tiles = board.querySelectorAll(".tile");
            tiles.forEach(tile => {
                const val = parseInt(tile.textContent);
                if (!isNaN(val) && val >= 128) {
                    const tileIndex = Array.from(tile.parentNode.children).indexOf(tile);
                    const tileId = `${val}-${tileIndex}`;
                    
                    if (!rewardedTiles.has(tileId)) {
                        rewardedTiles.add(tileId);
                        
                        if (Math.random() < 0.40) {
                            let reward = 0;
                            if (val === 128) reward = Math.floor(Math.random() * 2) + 2; 
                            else if (val === 256) reward = Math.floor(Math.random() * 3) + 3; 
                            else if (val === 512) reward = Math.floor(Math.random() * 4) + 4; 
                            else if (val >= 1024) reward = Math.floor(Math.random() * 5) + 6; 

                            if (reward > 0) {
                                coinsManager.addCoins(reward);
                                console.log(`🔥 مكافأة مهارة! حصلت على ${reward} عملات لدمج المربع ${val}`);
                            }
                        }
                    }
                }
            });
        });

        observer.observe(board, { childList: true, subtree: true });
    }

    // 3. نظام المكافأة اليومية المطور (يشحن كلا الزرين في الـ HTML)
    function handleDailyReward() {
        const rewardBtns = [document.getElementById("dailyRewardBtn"), document.getElementById("popupDailyBtn")];
        const lastClaim = localStorage.getItem("lastDailyClaim");
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (lastClaim && (now - parseInt(lastClaim) < oneDay)) {
            rewardBtns.forEach(btn => { if (btn) btn.disabled = true; });
            
            function updateCountdown() {
                const timeLeft = oneDay - (Date.now() - parseInt(lastClaim));
                if (timeLeft <= 0) {
                    rewardBtns.forEach(btn => {
                        if (btn) {
                            btn.disabled = false;
                            btn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                        }
                    });
                    clearInterval(countdownInterval);
                } else {
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    rewardBtns.forEach(btn => {
                        if (btn) btn.textContent = `⏳ المكافأة بعد: ${hours}س و ${minutes}د`;
                    });
                }
            }
            updateCountdown();
            const countdownInterval = setInterval(updateCountdown, 1000);
        } else {
            rewardBtns.forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                    
                    // تنظيف الأحداث القديمة لتجنب تكرار الـ Click Event listener
                    const newBtn = btn.cloneNode(true);
                    btn.parentNode.replaceChild(newBtn, btn);
                    
                    newBtn.addEventListener("click", () => {
                        coinsManager.addCoins(15);
                        localStorage.setItem("lastDailyClaim", Date.now().toString());
                        alert("🎉 مبروك! حصلت على 15 عملة مجانية بمناسبة دخولك اليومي!");
                        handleDailyReward();
                    });
                }
            });
        }
    }

    window.coinsManager = coinsManager;
    window.rewardedTiles = rewardedTiles; 

    document.addEventListener("DOMContentLoaded", () => {
        updateCoinsUI();
        watchGameBoard();
        handleDailyReward();
        if (window.updatePopupButtons) {
            window.updatePopupButtons();
        }
    });
})();
