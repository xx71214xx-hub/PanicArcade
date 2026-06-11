import { supabase } from './supabaseClient.js';

export const EconomyAPI = {
    // 1. جلب رصيد العملات الحالي للاعب المسجل من السيرفر
    async fetchBalance() {
        try {
            const { data, error } = await supabase.rpc('get_user_state');

            if (error) throw error;
            return data ? data.coins_balance : 0;
        } catch (error) {
            console.error("❌ خطأ أثناء جلب الرصيد من السيرفر:", error);
            // محاولة جلب الرصيد من الذاكرة المؤقتة للمستخدم كخيار بديل مؤقت
            return window.currentUser ? window.currentUser.coins_balance : 0;
        }
    },

    // 2. تنفيذ عملية الخصم أو الإضافة الآمنة عبر دالة الـ RPC بالسيرفر
    async processTransaction(amount, type) {
        try {
            const { data, error } = await supabase.rpc('process_transaction', {
                p_amount: amount,
                p_type: type
            });

            if (error) throw error;
            return data; // ستعيد true إذا نجحت العملية والسيرفر وافق، أو false إذا الرصيد غير كافٍ
        } catch (error) {
            console.error("❌ فشل معالجة العملية المالية على السيرفر:", error);
            return false;
        }
    },

    // 3. طلب استلام المكافأة اليومية والتحقق من وقت السيرفر بدقة
    async claimDaily() {
        try {
            const { data, error } = await supabase.rpc('claim_daily_reward');
            if (error) throw error;
            return data; // ترجع كائن يحتوي على النتيجة والرسالة والوقت المتبقي
        } catch (error) {
            console.error("❌ خطأ أثناء طلب المكافأة اليومية:", error);
            return { success: false, message: "فشل الاتصال بخادم المكافآت التلقائي" };
        }
    }
};
