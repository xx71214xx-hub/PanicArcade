import { supabase } from './supabaseClient.js';

export const EconomyAPI = {
    // 1. جلب رصيد العملات الحالي للاعب المسجل من السيرفر باستخدام الـ tgId
    async fetchBalance(tgId) {
        try {
            if (!tgId) throw new Error("معرف التليجرام غير متوفر");
            
            const { data, error } = await supabase
                .from('users')
                .select('coins_balance')
                .eq('tg_id', tgId) // التعديل المطلوب لربط جلب الرصيد باللاعب الحالي
                .single();

            if (error) throw error;
            return data ? data.coins_balance : 0;
        } catch (error) {
            console.error("❌ خطأ أثناء جلب الرصيد من السيرفر:", error);
            // محاولة جلب الرصيد من الذاكرة المؤقتة للمستخدم كخيار بديل مؤقت
            return window.currentUser ? window.currentUser.coins_balance : 0;
        }
    },

    // 2. تنفيذ عملية الخصم أو الإضافة الآمنة عبر دالة الـ RPC بالسيرفر باستخدام الـ tgId
    async processTransaction(tgId, amount, type) {
        try {
            if (!tgId) throw new Error("معرف التليجرام غير متوفر");

            const { data, error } = await supabase.rpc('process_transaction', {
                p_tg_id: tgId, // التعديل المطلوب لتمرير الهوية الموحدة للاعب إلى دالة السيرفر
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

    // 3. طلب استلام المكافأة اليومية والتحقق من وقت السيرفر بدقة باستخدام الـ tgId
    async claimDaily(tgId) {
        try {
            if (!tgId) throw new Error("معرف التليجرام غير متوفر");

            const { data, error } = await supabase.rpc('claim_daily_reward', {
                p_tg_id: tgId // التعديل المطلوب لربط العداد اليومي بحساب اللاعب على السيرفر لضمان حظر الغش
            });
            if (error) throw error;
            return data; // ترجع كائن يحتوي على النتيجة والرسالة والوقت المتبقي
        } catch (error) {
            console.error("❌ خطأ أثناء طلب المكافأة اليومية:", error);
            return { success: false, message: "فشل الاتصال بخادم المكافآت التلقائي" };
        }
    }
};
