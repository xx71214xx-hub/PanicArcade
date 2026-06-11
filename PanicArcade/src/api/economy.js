import { supabase } from './supabaseClient.js';

export const EconomyAPI = {

    // 1. تهيئة المستخدم + جلب البيانات الأساسية (بديل get_user_state)
    async initUser() {
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

            // حفظ المستخدم في الذاكرة فقط
            window.currentUser = data.user;

            return data.user;

        } catch (error) {
            console.error("❌ فشل التحقق من الهوية:", error);
            return null;
        }
    },

    // 2. جلب الرصيد من الذاكرة (بعد initUser فقط)
    async fetchBalance() {
        try {
            if (window.currentUser?.coins_balance !== undefined) {
                return window.currentUser.coins_balance;
            }

            // fallback آمن: إعادة التهيئة
            const user = await this.initUser();
            return user?.coins_balance || 0;

        } catch (error) {
            console.error("❌ خطأ أثناء جلب الرصيد:", error);
            return 0;
        }
    },

    // 3. العمليات المالية (كما هي لكن أكثر أمان)
    async processTransaction(amount, type) {
        try {
            const { data, error } = await supabase.rpc('process_transaction', {
                p_amount: amount,
                p_type: type
            });

            if (error || !data) {
                console.error("❌ فشل العملية المالية:", error);
                return false;
            }

            // تحديث الذاكرة بعد العملية
            await this.fetchBalance();

            return true;

        } catch (error) {
            console.error("❌ فشل معالجة العملية المالية:", error);
            return false;
        }
    },

    // 4. المكافأة اليومية
    async claimDaily() {
        try {
            const { data, error } = await supabase.rpc('claim_daily_reward');

            if (error) throw error;

            if (data?.success) {
                await this.fetchBalance();
            }

            return data;

        } catch (error) {
            console.error("❌ خطأ أثناء المكافأة اليومية:", error);
            return {
                success: false,
                message: "فشل الاتصال بخادم المكافآت"
            };
        }
    }
};
