// coins.js - نسخة التشخيص الذكي والتجاوز المؤقت
import { supabase } from '../src/api/supabaseClient.js';
import { authenticateTelegramUser } from '../src/api/auth.js';

(function() {
    let coins = 50; // سنبدأ بـ 50 عملة بشكل افتراضي لتفادي التعليق
    let nextDailyClaimTime = null;
    let currentUser = null;

    async function initCoinsFromServer() {
        if (!currentUser || !currentUser.tg_id) return; 
        try {
            const { data, error } = await supabase
                .from('users')
                .select('coins_balance')
                .eq('tg_id', currentUser.tg_id)
                .single();

            if (error) throw error;
            if (data) {
                coins = data.coins_balance;
                updateCoinsUI();
            }
        } catch (error) {
            console.error("❌ خطأ في جلب الرصيد (تم التجاوز والاعتماد على المحلي):", error);
        }
    }

    function updateCoinsUI() {
        const coinsBalanceEl = document.getElementById("coinsBalance");
        if (coinsBalanceEl) {
            coinsBalanceEl.textContent = coins;
        }
    }

    const coinsManager = {
        getCoins: function() {
            return coins;
        },
        addCoins: async function(amount, reason = 'game_reward') {
            coins += amount;
            updateCoinsUI();
            
            const coinsBox = document.getElementById("coinsBox");
            if (coinsBox) {
                coinsBox.classList.remove("coin-gain");
                void coinsBox.offsetWidth; 
                coinsBox.classList.add("coin-gain");
            }

            if (!currentUser) return;

            // محاولة الإرسال مع طباعة التشخيص في حال الفشل
            const { data: success, error } = await supabase.rpc('process_transaction', {
                p_tg_id: currentUser.tg_id, 
                p_amount: amount,
                p_type: reason
            });

            if (error) {
                console.group("🛑 تشخيص خطأ السيرفر (اضغط هنا لرؤية التفاصيل)");
                console.error("رسالة الخطأ الفريدة:", error.message);
                console.log("تلميح السيرفر:", error.hint);
                console.log("تفاصيل الأكواد:", error.details);
                console.groupEnd();
                // لن نتراجع عن العملات محلياً الآن لنسمح لك باللعب وتجربة الواجهة
            }
        },
        deductCoins: async function(amount, reason = 'game_expense') {
            if (coins < amount) return false;

            // خصم فوري تكتيكي (Optimistic) حتى لا تقف الشاشة على "جاري الفحص"
            coins -= amount;
            updateCoinsUI();

            if (!currentUser) return true; // السماح باللعب أوفلاين كبديل

            const { data: success, error } = await supabase.rpc('process_transaction', {
                p_tg_id: currentUser.tg_id,
                p_amount: -amount,
                p_type: reason
            });

            if (error) {
                console.group("🛑 تشخيص خطأ الخصم (تلميح لأسماء البارامترات)");
                console.error("الرسالة:", error.message);
                console.log("هل المشكلة في اسم البارامتر؟ راجع هذا:", error.hint || "لا يوجد تلميح");
                console.groupEnd();
                
                // حتى لو فشل السيرفر، سنعيد true لتستمتع باللعب ولا يعلق الزر!
                return true; 
            }

            return true;
        }
    };

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
                            }
                        }
                    }
                }
            });
        });

        observer.observe(board, { childList: true, subtree: true });
    }

    async function handleDailyReward() {
        if (!currentUser) return;
        const rewardBtns = [document.getElementById("dailyRewardBtn"), document.getElementById("popupDailyBtn")];
        
        try {
            const { data: result, error } = await supabase.rpc('claim_daily_reward', {
                p_tg_id: currentUser.tg_id
            });

            if (!error && result && !result.success && result.time_left) {
                nextDailyClaimTime = Date.now() + (result.time_left * 1000);
                startCountdown(rewardBtns);
            } else {
                setupRewardButtons(rewardBtns);
            }
        } catch(e) {
            setupRewardButtons(rewardBtns);
        }
    }

    function setupRewardButtons(rewardBtns) {
        rewardBtns.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
                
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener("click", async () => {
                    newBtn.disabled = true;
                    newBtn.textContent = "⏳ جاري استلامها...";
                    
                    if (!currentUser) {
                        coins += 15;
                        updateCoinsUI();
                        alert("🎉 تم الحساب محلياً!");
                        return;
                    }
                    
                    const { data: result, error } = await supabase.rpc('claim_daily_reward', {
                        p_tg_id: currentUser.tg_id
                    });
                    
                    if (error || !result) {
                        // تجاوز المشكلة وإعطاء المكافأة للمستخدم بأي حال
                        coins += 15;
                        updateCoinsUI();
                        alert("🎉 مبروك! حصلت على 15 عملة (تم التجاوز الآمن لفشل السيرفر)");
                        return;
                    }
                    
                    if (result.success) {
                        coins += 15;
                        updateCoinsUI();
                        alert("🎉 مبروك! حصلت على 15 عملة مجانية بمناسبة دخولك اليومي!");
                        nextDailyClaimTime = new Date(result.new_claim_time).getTime() + (24 * 60 * 60 * 1000);
                        handleDailyReward(); 
                    } else {
                        alert(result.message || "لم يحن الوقت بعد");
                        if (result.time_left) {
                            nextDailyClaimTime = Date.now() + (result.time_left * 1000);
                            startCountdown(rewardBtns);
                        }
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
                handleDailyReward(); 
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
        updateCoinsUI(); // إظهار الـ 50 الافتراضية فوراً لمنع تعليق اللاعب
        
        currentUser = await authenticateTelegramUser().catch(() => null);
        
        await initCoinsFromServer();
        watchGameBoard();
        handleDailyReward();

        if (window.updatePopupButtons) {
            window.updatePopupButtons();
        }
    });
})();
