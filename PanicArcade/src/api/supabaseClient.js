// تهيئة عميل Supabase للاتصال بقاعدة البيانات
const SUPABASE_URL = 'https://urxcrkerzxjabqcizymt.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyeGNya2VyenhqYWJxY2l6eW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMTQyMTMsImV4cCI6MjA5NjY5MDIxM30.0pPJA7d6FkCYubEjWPGDJF-riZt1TJNT4Ibk2EnsyuE';

// تصدير العميل ليتم استخدامه في باقي ملفات المشروع
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
