-- ============================================================================
-- Mevcut pd_courses Tablosundaki 4 Dersin Adlarını Dönem/Uygulama Formatına Güncelleme
-- phpMyAdmin -> SQL veya Import sekmesinden çalıştırabilirsiniz.
-- (Alternatif: Web arayüzünde Ayarlar & Şifre sayfasından tek tıkla güncelleyebilirsiniz.)
-- ============================================================================

SET NAMES utf8mb4;

UPDATE `pd_courses` SET `name` = '1.Dönem 1.Uygulama (Nesne Tabanlı Programlama)', `short_code` = '1.Dönem 1.Uyg.' WHERE `id` = 1;
UPDATE `pd_courses` SET `name` = '1.Dönem 2.Uygulama (FrontEnd Web Tasarımı)', `short_code` = '1.Dönem 2.Uyg.' WHERE `id` = 2;
UPDATE `pd_courses` SET `name` = '2.Dönem 1.Uygulama (Web Tabanlı Proje)', `short_code` = '2.Dönem 1.Uyg.' WHERE `id` = 3;
UPDATE `pd_courses` SET `name` = '2.Dönem 2.Uygulama (Mobil Uygulama)', `short_code` = '2.Dönem 2.Uyg.' WHERE `id` = 4;
