// coins.js - نظام إدارة العملات والمكافآت الاحترافية (نسخة Supabase الصحيحة)
import { supabase } from '../src/api/supabaseClient.js';

(function() {
    let coins = 0;
    let nextDailyClaimTime = null;
    let isRequesting = false;

    // 🔐 1. التهيئة الصحيحة عبر Telegram Login (بديل get_user_state)
    async function initCoinsFromServer() {
        try {
            const initData = Telegram.WebApp.initData;

            if (!initData) {
                throw new Error("Missing Telegram initData");
            }

            const { data, error } = await supabase.rpc('telegram_login', {
                p_init_data: initData
            });

            if (error || !data?.success) {
                throw error || new Error("Auth failed");
            }

            window.currentUser = data.user;

            coins = data.user.coins_balance;
            updateCoinsUI();

            return data.user;

        } catch (error) {
            console.error("❌ خطأ في التحقق من الهوية / جلب الرصيد:", error);
            return null;
        }
    }

    function updateCoinsUI() {
        const coinsBalanceEl = document.getElementById("coinsBalance");
        if (coinsBalanceEl) {
            coinsBalanceEl.textContent = coins;
        }
    }

    // 💰 إدارة العملات
    const coinsManager = {
        getCoins: function() {
            return coins;
        },

        addCoins: async function(amount, reason = 'game_reward') {
            if (isRequesting) return;
            isRequesting = true;

            try {
                const { data, error } = await supabase.rpc('process_transaction', {
                    p_amount: amount,
                    p_type: reason
                });

                if (error || !data) {
                    console.warn("⚠️ فشل إضافة العملات");
                    return;
                }

                coins += amount;
                updateCoinsUI();

            } finally {
                isRequesting = false;
            }
        },

        deductCoins: async function(amount, reason = 'game_expense') {
            if (isRequesting) return false;
            if (coins < amount) return false;

            isRequesting = true;

            try {
                const { data, error } = await supabase.rpc('process_transaction', {
                    p_amount: -amount,
                    p_type: reason
                });

                if (error || !data) {
                    console.error("❌ فشل الخصم");
                    return false;
                }

                coins -= amount;
                updateCoinsUI();

                return true;

            } finally {
                isRequesting = false;
            }
        }
    };

    // 🎮 باقي النظام كما هو (بدون تغيير جوهري)
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

    // 🎁 المكافأة اليومية (بدون تغيير كبير)
    async function handleDailyReward() {
        const rewardBtns = [
            document.getElementById("dailyRewardBtn"),
            document.getElementById("popupDailyBtn")
        ];

        try {
            const { data: result, error } = await supabase.rpc('claim_daily_reward');

            if (error) throw error;

            if (result?.success) {
                await initCoinsFromServer();
                setupRewardButtons(rewardBtns);
            } else {
                if (result?.time_left) {
                    nextDailyClaimTime = Date.now() + result.time_left * 1000;
                }
                setupRewardButtons(rewardBtns);
            }

        } catch (err) {
            console.error("Daily reward error:", err);
            setupRewardButtons(rewardBtns);
        }
    }

    function setupRewardButtons(rewardBtns) {
        rewardBtns.forEach(btn => {
            if (!btn) return;

            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener("click", async () => {
                if (isRequesting) return;
                isRequesting = true;

                try {
                    const { data, error } = await supabase.rpc('claim_daily_reward');

                    if (error) throw error;

                    if (data?.success) {
                        await initCoinsFromServer();
                        alert("🎉 تم استلام المكافأة!");
                    } else {
                        alert(data?.message || "غير متاح الآن");
                    }

                } catch (err) {
                    console.error(err);
                } finally {
                    isRequesting = false;
                }
            });
        });
    }

    window.coinsManager = coinsManager;
    window.rewardedTiles = rewardedTiles;

    document.addEventListener("DOMContentLoaded", async () => {
        await initCoinsFromServer(); // 🔐 يبدأ من telegram_login فقط
        watchGameBoard();
        handleDailyReward();
    });

})();
