import { supabase } from './supabaseClient.js';

export async function authenticateTelegramUser() {
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData;

    if (!initData) {
        console.error("❌ لم يتم العثور على بيانات تليجرام. تأكد من فتح اللعبة داخل تليجرام.");
        return null;
    }

    try {
        // إرسال سطر البيانات الكامل المشفر ليقوم السيرفر بفحصه ومطابقته بالتوكن المخزن بجدول الإعدادات
        const { data, error: rpcError } = await supabase.rpc('telegram_login', {
            initData: initData
        });

        if (rpcError) throw rpcError;

        if (!data || !data.success) {
            throw new Error(data?.error || "فشل تسجيل الدخول والتحقق من السيرفر");
        }

        console.log("✅ تم التحقق الآمن بنجاح ومزامنة بيانات اللاعب:", data);
        
        // حفظ بيانات اللاعب ورصيده الحالي في الذاكرة المؤقتة للعبة لتحديث واجهات العملات
        window.currentUser = data;
        return data;

    } catch (error) {
        console.error("❌ خطأ في المصادقة الآمنة:", error);
        // منع الدخول فوراً عند فشل التحقق
        alert("فشل التحقق من الهوية. يرجى إعادة فتح التطبيق من تليجرام.");
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.close();
        }
        return null;
    }
}
