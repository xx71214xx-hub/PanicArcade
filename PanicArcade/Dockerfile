FROM php:8.2-apache

# تفعيل مكتبة cURL والمكتبات الهامة للبوت
RUN apt-get update && apt-get install -y libcurl4-openssl-dev pkg-config libssl-dev

# نسخ ملفات مشروعك إلى سيرفر Apache
COPY . /var/www/html/

# تفعيل مود الـ Rewrite إذا كنت تحتاجه
RUN a2enmod rewrite

EXPOSE 80
