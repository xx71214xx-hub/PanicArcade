// coins.js - نظام إدارة العملات والمكافآت الاحترافية العشوائية (نسخة Supabase الآمنة)
import { supabase } from '../src/api/supabaseClient.js';
import { authenticateTelegramUser } from '../src/api/auth.js'; 

(function() {
    // تهيئة الرصيد من السيرفر
    let coins = 0; 
    let nextDailyClaimTime = null;
    let currentUser = null; // متغير لحفظ بيانات اللاعب الحالي

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
                
                // 🔥 تحديث واجهة الأزرار فوراً بعد نجاح جلب الرصيد الحقيقي من السيرفر
                if (window.updatePopupButtons) {
                    window.updatePopupButtons();
                }
            }
        } catch (error) {
            console.error("❌ خطأ في جلب الرصيد من السيرفر:", error);
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
            if (!currentUser) return;

            coins += amount;
            updateCoinsUI();
            
            const coinsBox = document.getElementById("coinsBox");
            if (coinsBox) {
                coinsBox.classList.remove("coin-gain");
                void coinsBox.offsetWidth; 
                coinsBox.classList.add("coin-gain");
            }

            const { data: success, error } = await supabase.rpc('process_transaction', {
                p_tg_id: currentUser.tg_id, 
                p_amount: amount,
                p_type: reason
            });

            if (error || success === false) {
                coins -= amount; 
                updateCoinsUI();
                console.warn("⚠️ تم رفض إضافة العملات من السيرفر.");
            }
            
            if (window.updatePopupButtons) {
                window.updatePopupButtons();
            }
        },
        deductCoins: async function(amount, reason = 'game_expense') {
            if (!currentUser) {
                console.error("❌ المستخدم غير مسجل.");
                return false;
            }
            if (coins < amount) return false;

            // خصم محلي مؤقت سريع لتحسين تجربة المستخدم
            coins -= amount;
            updateCoinsUI();

            try {
                const { data: success, error } = await supabase.rpc('process_transaction', {
                    p_tg_id: currentUser.tg_id, 
                    p_amount: -amount,
                    p_type: reason
                });

                if (error || success === false) {
                    // إلغاء الخصم في حال فشل السيرفر
                    coins += amount;
                    updateCoinsUI();
                    console.error("❌ فشلت عملية الخصم من السيرفر.");
                    return false;
                }

                if (window.updatePopupButtons) {
                    window.updatePopupButtons();
                }
                return true;
            } catch (err) {
                // إلغاء الخصم في حال حدوث خطأ شبكة
                coins += amount;
                updateCoinsUI();
                console.error("❌ خطأ في الاتصال أثناء الخصم:", err);
                return false;
            }
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
        
        const { data: result, error } = await supabase.rpc('claim_daily_reward', {
            p_tg_id: currentUser.tg_id 
        });

        if (!error && result && !result.success && result.time_left) {
            nextDailyClaimTime = Date.now() + (result.time_left * 1000);
            startCountdown(rewardBtns);
        } else {
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
                    if (!currentUser) return;
                    newBtn.disabled = true;
                    newBtn.textContent = "⏳ جاري استلامها من السيرفر...";
                    
                    const { data: result, error } = await supabase.rpc('claim_daily_reward', {
                        p_tg_id: currentUser.tg_id 
                    });
                    
                    if (error) {
                        alert("حدث خطأ أثناء الاتصال بالسيرفر.");
                        newBtn.disabled = false;
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
        // 1. تسجيل الدخول أولاً قبل جلب الرصيد
        currentUser = await authenticateTelegramUser();
        
        if (currentUser) {
            // 2. جلب الرصيد الحقيقي (الدالة ستقوم بتحديث الواجهة فور الانتهاء)
            await initCoinsFromServer();
            watchGameBoard();
            handleDailyReward();
        } else {
            console.error("⚠️ تعذر الاتصال بتليجرام، اللعبة تعمل بدون حفظ الرصيد.");
            if (window.updatePopupButtons) {
                window.updatePopupButtons();
            }
        }
    });
})();
