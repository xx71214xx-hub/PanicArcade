// src/api/auth.js

import { supabase } from './supabaseClient.js';

export async function authenticateTelegramUser() {
    const tg = window.Telegram?.WebApp;
    
    // 1. محاولة جلب البيانات بالطريقة العادية، وإن لم توجد يسحبها من الرابط المحول من الـ Hub
    let initData = tg?.initData;
    
    if (!initData) {
        const urlParams = new URLSearchParams(window.location.search);
        const paramData = urlParams.get('tgWebAppStartParam');
        if (paramData) {
            initData = decodeURIComponent(paramData);
        }
    }

    if (!initData) {
        console.error("❌ لم يتم العثور على بيانات تليجرام. تأكد من فتح اللعبة داخل تليجرام.");
        return null;
    }

    try {
        // إرسال سطر البيانات الكامل المشفر ليقوم السيرفر بفحصه ومطابقته بالتوكن المخزن بجدول الإعدادات
        const { data, error: rpcError } = await supabase.rpc('telegram_login', {
            p_init_data: initData
        });

        if (rpcError) throw rpcError;

        if (!data || !data.success) {
            throw new Error(data?.error || "فشل تسجيل الدخول والتحقق من السيرفر");
        }

        console.log("✅ تم التحقق الآمن بنجاح ومزامنة بيانات اللاعب:", data.user);
        
        // حفظ بيانات اللاعب ورصيده الحالي في الذاكرة المؤقتة للعبة لتحديث واجهات العملات
        window.currentUser = data.user;
        return data.user;

    } catch (error) {
        console.error("❌ خطأ في المصادقة الآمنة:", error);
        return null;
    }
}
