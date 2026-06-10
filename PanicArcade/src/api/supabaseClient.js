// تهيئة عميل Supabase للاتصال بقاعدة البيانات
const SUPABASE_URL = 'https://hznfppmomejmimjklipb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6bmZwcG1vbWVqbWltamtsaXBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMDc3OTksImV4cCI6MjA5NjY4Mzc5OX0.tX1v-JPXHcezks2y-kqnsCQFd1wdV2r4x0kC80euAxw';

// تصدير العميل ليتم استخدامه في باقي ملفات المشروع
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
