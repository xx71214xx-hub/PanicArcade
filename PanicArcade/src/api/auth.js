import { supabase } from './supabaseClient.js';

export async function authenticateTelegramUser() {
    const tg = window.Telegram?.WebApp;
    const initDataUnsafe = tg?.initDataUnsafe;

    if (!initDataUnsafe || !initDataUnsafe.user) {
        console.error("❌ لم يتم العثور على بيانات تليجرام. تأكد من فتح اللعبة داخل تليجرام.");
        return null;
    }

    try {
        // استخراج معرف المستخدم واسمه من واجهة تليجرام مباشرة لرفعها للسيرفر
        const telegramId = String(initDataUnsafe.user.id);
        const username = initDataUnsafe.user.username || `user_${telegramId}`;

        // استدعاء الدالة المخزنة في السيرفر (RPC) مباشرة من الهاتف وبأعلى أمان لحظر الغش
        const { data, error: rpcError } = await supabase.rpc('telegram_login', {
            p_telegram_id: telegramId,
            p_username: username
        });

        if (rpcError) throw rpcError;

        if (!data || !data.success) {
            throw new Error(data?.error || "فشل تسجيل الدخول من السيرفر");
        }

        console.log("✅ تم تسجيل الدخول بنجاح ومزامنة البيانات:", data.user);
        
        // حفظ بيانات المستخدم ورصيده الحالي في الذاكرة المؤقتة للعبة لتحديث الواجهات
        window.currentUser = data.user;
        return data.user;

    } catch (error) {
        console.error("❌ خطأ في المصادقة:", error);
        return null;
    }
}