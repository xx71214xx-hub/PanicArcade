// coins.js - نظام إدارة العملات والمكافآت الاحترافية العشوائية (نسخة Supabase الآمنة)
import { supabase } from '../src/api/supabaseClient.js';

(function() {
    // 1. تهيئة الرصيد من السيرفر بدلاً من الـ LocalStorage
    let coins = 0; 
    let nextDailyClaimTime = null;
    let isRequesting = false;

    async function initCoinsFromServer() {
        try {
            // استخدام RPC للحصول على حالة المستخدم الحالية بشكل آمن
            const { data, error } = await supabase.rpc('get_user_state');

            if (error) throw error;
            if (data) {
                coins = data.coins_balance;
                updateCoinsUI();
                return data;
            }
        } catch (error) {
            console.error("❌ خطأ في جلب الرصيد من السيرفر:", error);
            // إذا كان هناك مستخدم في الذاكرة من صفحة تسجيل الدخول
            if (window.currentUser) {
                coins = window.currentUser.coins_balance;
                updateCoinsUI();
            }
        }
    }

    function updateCoinsUI() {
        const coinsBalanceEl = document.getElementById("coinsBalance");
        if (coinsBalanceEl) {
            coinsBalanceEl.textContent = coins;
        }
    }

    // كائن إدارة العملات المحدث للربط مع قاعدة البيانات السحابية
    const coinsManager = {
        getCoins: function() {
            return coins;
        },
        addCoins: async function(amount, reason = 'game_reward') {
            if (isRequesting) return;
            isRequesting = true;

            try {
                // توثيق وحقن العملية في السيرفر بشكل رسمي
                const { data: success, error } = await supabase.rpc('process_transaction', {
                    p_amount: amount,
                    p_type: reason
                });

                if (error || !success) {
                    console.warn("⚠️ تم رفض إضافة العملات من السيرفر.");
                    return;
                }

                // تحديث من السيرفر مباشرة لضمان الدقة
                await initCoinsFromServer();
                
                // تأثير وميض ذهبي حماسي لصندوق العملات عند الربح
                const coinsBox = document.getElementById("coinsBox");
                if (coinsBox) {
                    coinsBox.classList.remove("coin-gain");
                    void coinsBox.offsetWidth; // Trigger reflow
                    coinsBox.classList.add("coin-gain");
                }
            } finally {
                isRequesting = false;
            }
        },
        deductCoins: async function(amount, reason = 'game_expense') {
            if (isRequesting) return false;
            if (coins < amount) return false;
            isRequesting = true;

            try {
                // انتظار تأكيد الخصم من السيرفر أولاً لحماية النظام
                const { data: success, error } = await supabase.rpc('process_transaction', {
                    p_amount: -amount,
                    p_type: reason
                });

                if (error || !success) {
                    console.error("❌ فشلت عملية الخصم من السيرفر.");
                    return false;
                }

                // تحديث من السيرفر مباشرة لضمان الدقة
                await initCoinsFromServer();
                return true;
            } finally {
                isRequesting = false;
            }
        }
    };

    // 2. نظام تتبع لوحة اللعب لمنح مكافآت عشوائية للمحترفين (دون تعديل على منطق اللعبة)
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
                                coinsManager.addCoins(reward, `tile_${val}_reward`);
                                console.log(`🔥 مكافأة مهارة! حصلت على ${reward} عملات لدمج المربع ${val}`);
                            }
                        }
                    }
                }
            });
        });

        observer.observe(board, { childList: true, subtree: true });
    }

    // 3. نظام المكافأة اليومية المطور المربوط بوقت السيرفر لحظر الغش
    async function handleDailyReward() {
        const rewardBtns = [document.getElementById("dailyRewardBtn"), document.getElementById("popupDailyBtn")];
        
        try {
            // التحقق الأولي من وقت السيرفر بدلاً من التخزين المحلي
            // إضافة timeout لمنع التجميد
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data: result, error } = await supabase.rpc('claim_daily_reward');
            clearTimeout(timeoutId);

            // إذا كانت المكافأة مستلمة بالفعل، قم بتشغيل العداد بناءً على الوقت المتبقي الفعلي
            if (!error && result && !result.success && result.time_left) {
                nextDailyClaimTime = Date.now() + (result.time_left * 1000);
                startCountdown(rewardBtns);
            } else if (!error && result && result.success) {
                // المكافأة متاحة
                setupRewardButtons(rewardBtns);
            } else {
                // حالة افتراضية في حال الخطأ أو عدم التوفر
                setupRewardButtons(rewardBtns);
            }
        } catch (err) {
            console.error("Daily reward check failed:", err);
            setupRewardButtons(rewardBtns);
        }
    }

    function setupRewardButtons(rewardBtns) {
        rewardBtns.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                
                // إزالة المستمعين القدامى
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener("click", async () => {
                    if (isRequesting) return;
                    isRequesting = true;
                    newBtn.disabled = true;
                    newBtn.textContent = "⏳ جاري استلامها...";
                    
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => {
                            controller.abort();
                            isRequesting = false;
                            newBtn.disabled = false;
                            newBtn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                        }, 5000);

                        const { data: result, error } = await supabase.rpc('claim_daily_reward');
                        clearTimeout(timeoutId);
                        
                        if (error) throw error;
                        
                        if (result.success) {
                            await initCoinsFromServer();
                            alert("🎉 مبروك! حصلت على 15 عملة مجانية بمناسبة دخولك اليومي!");
                            if (result.new_claim_time) {
                                nextDailyClaimTime = new Date(result.new_claim_time).getTime() + (24 * 60 * 60 * 1000);
                            } else {
                                nextDailyClaimTime = Date.now() + (24 * 60 * 60 * 1000);
                            }
                            startCountdown(rewardBtns);
                        } else {
                            alert(result.message || "لم يحن الوقت بعد");
                            if (result.time_left) {
                                nextDailyClaimTime = Date.now() + (result.time_left * 1000);
                                startCountdown(rewardBtns);
                            }
                        }
                    } catch (err) {
                        console.error("Claim daily failed:", err);
                        alert("فشل الاتصال بالسيرفر. يرجى المحاولة لاحقاً.");
                        newBtn.disabled = false;
                        newBtn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                    } finally {
                        isRequesting = false;
                    }
                });
            }
        });
    }

    function startCountdown(rewardBtns) {
        rewardBtns.forEach(btn => { if (btn) btn.disabled = true; });
        
        function updateCountdown() {
            const timeLeft = nextDailyClaimTime - Date.now();
            if (timeLeft <= 0) {
                handleDailyReward(); // إعادة التهيأة للاستلام عند انتهاء الوقت
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
    }

    window.coinsManager = coinsManager;
    window.rewardedTiles = rewardedTiles; 

    document.addEventListener("DOMContentLoaded", async () => {
        await initCoinsFromServer();
        watchGameBoard();
        handleDailyReward();
        if (window.updatePopupButtons) {
            window.updatePopupButtons();
        }
    });
})();
