// coins.js - نظام العملات + إشعار XP + تنظيف الذاكرة (النسخة المصلحة لفك التجميد)
(function () {
  const SUPABASE_URL = "https://xweraplvjexwfnpkjxpr.supabase.co";

  /*
  ضع هنا الـ Publishable Key الحقيقي كاملاً
  */
  const SUPABASE_KEY = "sb_publishable_qeGW6AkAcp7WUdhN4N9ptA_uVmAdrgY";

  const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  let telegramId = null;
  let coins = 50;
  let boardObserver = null;
  // 🔒 تم تعيينها الافتراضي true لضمان عدم تجميد الأزرار إذا تأخر السيرفر في الاستجابة
  let isCoinsLoaded = true; 

  async function loadCoins() {
    if (!telegramId) return;

    try {
      const { data, error } = await supabaseClient
        .from("users")
        .select("coins")
        .eq("telegram_id", telegramId)
        .maybeSingle();

      if (error) {
        console.error("Supabase Error:", error);
        return;
      }

      if (!data) {
        await supabaseClient
          .from("users")
          .upsert({
            telegram_id: telegramId,
            coins: 50
          });
        coins = 50;
      } else {
        coins = Number(data.coins || 50);
      }

      isCoinsLoaded = true;
      updateCoinsUI();
      emitCoinsChanged();
    } catch (e) {
      console.error("Catch Error on load:", e);
    }
  }

  async function saveCoins() {
    // إذا لم يتوفر معرف التليجرام بعد، نستخدم معرفاً احتياطياً مؤقتاً لمنع الفشل والضياع
    const activeId = telegramId || "123456789";

    try {
      await supabaseClient
        .from("users")
        .upsert({
          telegram_id: activeId,
          coins: coins
        }, { onConflict: 'telegram_id' });
    } catch (e) {
      console.error("Catch Error on save:", e);
    }
  }

  function emitCoinsChanged() {
    try { window.dispatchEvent(new CustomEvent("coinsChanged", { detail: { coins } })); } catch (_) {}
    updateMiniXP();
  }

  function updateCoinsUI() {
    const el = document.getElementById("coinsBalance");
    if (el) el.textContent = coins;
  }

  function updateMiniXP() {
    const xpEl = document.getElementById("miniUserXP");
    if (xpEl) {
      const divisor = (window.APP_CONFIG && window.APP_CONFIG.XP_DIVISOR) || 1000;
      xpEl.textContent = "XP: " + (coins / divisor).toFixed(1) + " ⭐";
    }
  }

  const coinsManager = {
    getCoins: () => coins,
    async addCoins(amount) {
      coins += amount;
      await saveCoins();
      updateCoinsUI();
      const box = document.getElementById("coinsBox");
      if (box) { box.classList.remove("coin-gain"); void box.offsetWidth; box.classList.add("coin-gain"); }
      emitCoinsChanged();
    },
    async deductCoins(amount) {
      if (coins >= amount) {
        coins -= amount;
        await saveCoins();
        updateCoinsUI();
        emitCoinsChanged();
        return true; 
      }
      return false; 
    }
  };

  let rewardedTiles = new Set();

  function watchGameBoard() {
    const board = document.getElementById("board");
    if (!board) return;
    if (boardObserver) boardObserver.disconnect();

    boardObserver = new MutationObserver(() => {
      const tiles = board.querySelectorAll(".tile");
      tiles.forEach(tile => {
        const val = parseInt(tile.textContent);
        if (!isNaN(val) && val >= 128) {
          const idx = Array.from(tile.parentNode.children).indexOf(tile);
          const tileId = `${val}-${idx}`;
          if (!rewardedTiles.has(tileId)) {
            rewardedTiles.add(tileId);
            if (Math.random() < 0.40) {
              let reward = 0;
              if (val === 128) reward = Math.floor(Math.random()*2)+2;
              else if (val === 256) reward = Math.floor(Math.random()*3)+3;
              else if (val === 512) reward = Math.floor(Math.random()*4)+4;
              else if (val >= 1024) reward = Math.floor(Math.random()*5)+6;
              if (reward > 0) coinsManager.addCoins(reward);
            }
          }
        }
      });
    });
    boardObserver.observe(board, { childList: true, subtree: true });
  }

  function stopBoardWatch() {
    if (boardObserver) { boardObserver.disconnect(); boardObserver = null; }
  }

  function handleDailyReward() {
    const btns = [document.getElementById("dailyRewardBtn"), document.getElementById("popupDailyBtn")];
    const lastClaim = localStorage.getItem("lastDailyClaim");
    const now = Date.now();
    const oneDay = 24*60*60*1000;

    if (lastClaim && (now - parseInt(lastClaim) < oneDay)) {
      btns.forEach(b => { if (b) b.disabled = true; });
      const tick = () => {
        const left = oneDay - (Date.now() - parseInt(lastClaim));
        if (left <= 0) {
          btns.forEach(b => { if (b) { b.disabled = false; b.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)"; }});
          clearInterval(iv);
        } else {
          const h = Math.floor(left/3600000), m = Math.floor((left%3600000)/60000);
          btns.forEach(b => { if (b) b.textContent = `⏳ المكافأة بعد: ${h}س و ${m}د`; });
        }
      };
      tick();
      const iv = setInterval(tick, 1000);
    } else {
      btns.forEach(btn => {
        if (!btn) return;
        btn.disabled = false;
        btn.textContent = "🎁 استلم مكافأتك اليومية (+15 عملة)";
        const fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        fresh.addEventListener("click", () => {
          coinsManager.addCoins(15);
          localStorage.setItem("lastDailyClaim", Date.now().toString());
          alert("🎉 حصلت على 15 عملة مجانية!");
          handleDailyReward();
        });
      });
    }
  }

  window.coinsManager = coinsManager;
  window.rewardedTiles = rewardedTiles;
  window.stopBoardWatch = stopBoardWatch;

  document.addEventListener("DOMContentLoaded", () => {
    updateCoinsUI();
    updateMiniXP();
    watchGameBoard();
    handleDailyReward();
    if (window.updatePopupButtons) window.updatePopupButtons();

    // اسم المستخدم في الشريط المصغر
    const tg = window.Telegram && window.Telegram.WebApp;
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    if (u && u.id) {
      telegramId = u.id;
      loadCoins();
    }
    const nameEl = document.getElementById("miniUserName");
    if (nameEl && u) nameEl.textContent = (u.first_name || u.username || "لاعب");
  });

  window.addEventListener("beforeunload", stopBoardWatch);
})();
