// تهيئة عميل Supabase للاتصال بقاعدة البيانات
const SUPABASE_URL = 'https://cijzcbuhdaimtulsbhak.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpanpjYnVoZGFpbXR1bHNiaGFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMzU2NjAsImV4cCI6MjA5NjYxMTY2MH0.qBpXibaiZq-uBMeKnI4rVEnIQ6CrorLlAm25uuTbU_U';

// تصدير العميل ليتم استخدامه في باقي ملفات المشروع
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
