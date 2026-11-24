-- ============================================================================
-- Proje Değerlendirme ve Rubik Sistemi - MySQL Veritabanı Şeması
-- Veritabanı: kiracbi8_okul360_db (Mevcut tablolara dokunmaz, tüm tablolar pd_ ön eklidir)
-- Karakter Seti: utf8mb4_unicode_ci | Motor: InnoDB
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Kullanıcılar (Yalnızca Admin ve Ders Öğretmenleri)
CREATE TABLE IF NOT EXISTS `pd_users` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `branch` VARCHAR(120) NOT NULL DEFAULT 'Bilişim Teknolojileri',
  `title` VARCHAR(120) NOT NULL DEFAULT 'Ders Öğretmeni',
  `role` ENUM('admin', 'teacher') NOT NULL DEFAULT 'teacher',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_users_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Genel Ayarlar
CREATE TABLE IF NOT EXISTS `pd_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` TEXT NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Proje Alanları / Dersler
CREATE TABLE IF NOT EXISTS `pd_courses` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `short_code` VARCHAR(20) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `question_points` INT UNSIGNED NOT NULL DEFAULT 20,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_courses_code` (`short_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sınıflar
CREATE TABLE IF NOT EXISTS `pd_classes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `academic_year` VARCHAR(32) NOT NULL DEFAULT '2025-2026',
  `school_name` VARCHAR(180) NOT NULL DEFAULT '',
  `created_by` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pd_classes_created_by` (`created_by`),
  CONSTRAINT `fk_pd_classes_user` FOREIGN KEY (`created_by`) REFERENCES `pd_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Sınıf + Ders Bazlı Ders Öğretmenleri (Çıktı İmza Bloğu)
CREATE TABLE IF NOT EXISTS `pd_class_course_teachers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `class_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `teacher_id` INT UNSIGNED NOT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_cct` (`class_id`, `course_id`, `teacher_id`),
  CONSTRAINT `fk_pd_cct_class` FOREIGN KEY (`class_id`) REFERENCES `pd_classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_cct_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_cct_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `pd_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Proje İsimleri Havuzu
CREATE TABLE IF NOT EXISTS `pd_projects` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Öğrenciler (Her öğrencinin tüm derslerde ortak kullanacağı proje adı)
CREATE TABLE IF NOT EXISTS `pd_students` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `class_id` INT UNSIGNED NOT NULL,
  `student_no` VARCHAR(32) NOT NULL,
  `full_name` VARCHAR(140) NOT NULL,
  `project_id` INT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_students_class_no` (`class_id`, `student_no`),
  KEY `idx_pd_students_project` (`project_id`),
  CONSTRAINT `fk_pd_students_class` FOREIGN KEY (`class_id`) REFERENCES `pd_classes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_students_project` FOREIGN KEY (`project_id`) REFERENCES `pd_projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Kazanımlar (5 Temel Kazanım)
CREATE TABLE IF NOT EXISTS `pd_outcomes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(20) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `default_weight` INT UNSIGNED NOT NULL DEFAULT 20,
  `is_question_outcome` TINYINT(1) NOT NULL DEFAULT 0,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_outcomes_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Ders + Kazanım Bazlı Rubik Değerlendirme Kriterleri
CREATE TABLE IF NOT EXISTS `pd_criteria` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT UNSIGNED NOT NULL,
  `outcome_id` INT UNSIGNED NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `max_score` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `rubric_levels` LONGTEXT NOT NULL COMMENT 'JSON array: [{level,label,description,points}]',
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_pd_criteria_course_outcome` (`course_id`, `outcome_id`),
  CONSTRAINT `fk_pd_criteria_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_criteria_outcome` FOREIGN KEY (`outcome_id`) REFERENCES `pd_outcomes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Ders Bazlı Teknik Soru Havuzu (Her ders için 50+ soru)
CREATE TABLE IF NOT EXISTS `pd_questions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT UNSIGNED NOT NULL,
  `question_text` TEXT NOT NULL,
  `difficulty` ENUM('kolay', 'orta', 'zor') NOT NULL DEFAULT 'kolay',
  `expected_hint` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pd_questions_course` (`course_id`),
  CONSTRAINT `fk_pd_questions_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Öğrenci + Ders Bazlı Rastgele 3 Teknik Soru
CREATE TABLE IF NOT EXISTS `pd_student_questions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `question_id` INT UNSIGNED NOT NULL,
  `sort_order` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `max_score` DECIMAL(5,2) NOT NULL DEFAULT 7.00,
  `score` DECIMAL(5,2) DEFAULT NULL,
  `note` VARCHAR(255) DEFAULT NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_sq_student_course_q` (`student_id`, `course_id`, `question_id`),
  KEY `idx_pd_sq_student_course` (`student_id`, `course_id`),
  CONSTRAINT `fk_pd_sq_student` FOREIGN KEY (`student_id`) REFERENCES `pd_students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_sq_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_sq_question` FOREIGN KEY (`question_id`) REFERENCES `pd_questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Öğrenci + Ders Bazlı Değerlendirmeler (Aynı öğrenci her dersten ayrı not alır)
CREATE TABLE IF NOT EXISTS `pd_evaluations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `evaluator_id` INT UNSIGNED DEFAULT NULL,
  `rubric_total` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `question_total` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `total_score` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `evaluated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_eval_student_course` (`student_id`, `course_id`),
  KEY `idx_pd_eval_course` (`course_id`),
  CONSTRAINT `fk_pd_eval_student` FOREIGN KEY (`student_id`) REFERENCES `pd_students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_eval_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_eval_user` FOREIGN KEY (`evaluator_id`) REFERENCES `pd_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Kriter Bazlı Rubik Puanları
CREATE TABLE IF NOT EXISTS `pd_evaluation_scores` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `evaluation_id` INT UNSIGNED NOT NULL,
  `criterion_id` INT UNSIGNED NOT NULL,
  `selected_level` TINYINT UNSIGNED DEFAULT NULL,
  `score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_es_eval_crit` (`evaluation_id`, `criterion_id`),
  CONSTRAINT `fk_pd_es_eval` FOREIGN KEY (`evaluation_id`) REFERENCES `pd_evaluations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_es_crit` FOREIGN KEY (`criterion_id`) REFERENCES `pd_criteria` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VARSAYILAN BAŞLANGIÇ VERİLERİ
-- ============================================================================

-- Varsayılan Admin Kullanıcısı (İlk giriş şifresi: admin123 — İlk girişte otomatik bcrypt ile şifrelenir)
INSERT IGNORE INTO `pd_users` (`id`, `username`, `password_hash`, `full_name`, `branch`, `title`, `role`, `is_active`, `must_change_password`) VALUES
(1, 'admin', 'INIT_ADMIN123', 'Sistem Yöneticisi', 'Bilişim Teknolojileri', 'Alan Şefi / Yönetici', 'admin', 1, 1);

-- Genel Ayarlar
INSERT IGNORE INTO `pd_settings` (`setting_key`, `setting_value`) VALUES
('school_name', 'Mesleki ve Teknik Anadolu Lisesi - Bilişim Teknolojileri Alanı'),
('academic_year', '2025-2026'),
('evaluation_title', 'PROJE DEĞERLENDİRME VE RUBİK FORMU');

-- 4 Proje Alanı / Ders (1. ve 2. Dönem Uygulamaları)
INSERT IGNORE INTO `pd_courses` (`id`, `name`, `short_code`, `description`, `question_points`, `sort_order`) VALUES
(1, '1.Dönem 1.Uygulama (Nesne Tabanlı Programlama)', '1.Dönem 1.Uyg.', 'Sınıf, nesne, kapsülleme, kalıtım ve masaüstü/konsol uygulama projeleri', 20, 1),
(2, '1.Dönem 2.Uygulama (FrontEnd Web Tasarımı)', '1.Dönem 2.Uyg.', 'HTML, CSS, JavaScript ve responsive arayüz tasarım projeleri', 20, 2),
(3, '2.Dönem 1.Uygulama (Web Tabanlı Proje)', '2.Dönem 1.Uyg.', 'Backend, veritabanı, CRUD işlemleri ve dinamik web projeleri', 20, 3),
(4, '2.Dönem 2.Uygulama (Mobil Uygulama)', '2.Dönem 2.Uyg.', 'Mobil ekran akışı, veri yönetimi ve etkileşimli mobil uygulama projeleri', 20, 4);

-- 5 Temel Kazanım
INSERT IGNORE INTO `pd_outcomes` (`id`, `code`, `name`, `description`, `default_weight`, `is_question_outcome`, `sort_order`) VALUES
(1, 'K1', 'Planlama', 'Proje kapsamı, analiz, iş-zaman planlaması ve akış hazırlığı', 15, 0, 1),
(2, 'K2', 'Tasarım', 'Arayüz, mimari, veri/sınıf yapısı ve kullanıcı deneyimi tasarımı', 20, 0, 2),
(3, 'K3', 'Kodlama', 'Çalışan işlevsellik, temiz kod, derse özgü teknik yapı ve hata kontrolü', 35, 0, 3),
(4, 'K4', 'Rapor', 'Proje dokümantasyonu, ekran görüntüleri, açıklamalar ve yazım düzeni', 10, 0, 4),
(5, 'K5', 'Teknik Soru/Cevap', 'İlgili proje alanından rastgele gelen 3 teknik sorunun yanıtlanması', 20, 1, 5);

-- Varsayılan Rubik Kriterleri (Her ders için 80p Rubik + 20p 3 Teknik Soru = 100 Puan)
-- 1) Nesne Tabanlı Programlama (course_id = 1)
INSERT IGNORE INTO `pd_criteria` (`id`, `course_id`, `outcome_id`, `name`, `max_score`, `rubric_levels`, `sort_order`) VALUES
(1, 1, 1, 'Problem tanımı, gereksinim analizi ve proje kapsamı', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Kapsam belirsiz veya eksik","points":2},{"level":2,"label":"Orta","description":"Temel amaç yazılmış, detay az","points":4},{"level":3,"label":"İyi","description":"Gereksinimler açıkça belirlenmiş","points":6},{"level":4,"label":"Çok İyi","description":"Kapsam, analiz ve senaryolar eksiksiz","points":8}]', 1),
(2, 1, 1, 'İş-zaman planlaması ve program akış kurgusu', 7.00, '[{"level":1,"label":"Geliştirilmeli","description":"Planlama yapılmamış","points":2},{"level":2,"label":"Orta","description":"Kısmi planlama mevcut","points":3.5},{"level":3,"label":"İyi","description":"Aşamalar düzenli planlanmış","points":5.5},{"level":4,"label":"Çok İyi","description":"Zamanlama ve akış diyagramı eksiksiz","points":7}]', 2),
(3, 1, 2, 'Sınıf (Class) yapısı ve nesne ilişkileri tasarımı', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Sınıf ayrımı yapılmamış","points":2.5},{"level":2,"label":"Orta","description":"Temel sınıf var, yapı zayıf","points":5},{"level":3,"label":"İyi","description":"Sınıf ve özellikler uygun tasarlanmış","points":7.5},{"level":4,"label":"Çok İyi","description":"Modüler ve temiz nesne mimarisi","points":10}]', 3),
(4, 1, 2, 'Kullanıcı arayüzü (Form/Ekran) düzeni ve kullanılabilirlik', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Dağınık ve kullanımı zor","points":2.5},{"level":2,"label":"Orta","description":"Temel bileşenler yerleşik","points":5},{"level":3,"label":"İyi","description":"Düzenli ve anlaşılır ekranlar","points":7.5},{"level":4,"label":"Çok İyi","description":"Estetik, tutarlı ve kullanıcı dostu","points":10}]', 4),
(5, 1, 3, 'Projenin çalışırlığı ve temel işlevlerin eksiksizliği', 15.00, '[{"level":1,"label":"Geliştirilmeli","description":"Çalışmıyor veya kritik hatalı","points":4},{"level":2,"label":"Orta","description":"Kısmen çalışıyor, eksikler var","points":7.5},{"level":3,"label":"İyi","description":"Temel işlevler sorunsuz çalışıyor","points":11.5},{"level":4,"label":"Çok İyi","description":"Tüm işlevler akıcı ve eksiksiz","points":15}]', 5),
(6, 1, 3, 'NTP ilkeleri (Kapsülleme, Kalıtım, Metot, Koleksiyon) kullanımı', 12.00, '[{"level":1,"label":"Geliştirilmeli","description":"NTP kavramları kullanılmamış","points":3},{"level":2,"label":"Orta","description":"Yalnızca basit sınıf/metot var","points":6},{"level":3,"label":"İyi","description":"Kapsülleme ve metotlar doğru kullanılmış","points":9},{"level":4,"label":"Çok İyi","description":"NTP ilkeleri etkin ve doğru uygulanmış","points":12}]', 6),
(7, 1, 3, 'Temiz kod, isimlendirme ve hata yakalama (try-catch / doğrulama)', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Hata kontrolü ve düzen yok","points":2},{"level":2,"label":"Orta","description":"Kısmi doğrulama var","points":4},{"level":3,"label":"İyi","description":"Okunabilir kod ve temel hata kontrolü","points":6},{"level":4,"label":"Çok İyi","description":"Temiz kod, yorumlar ve eksiksiz hata yönetimi","points":8}]', 7),
(8, 1, 4, 'Proje raporu, ekran görüntüleri ve teknik dokümantasyon', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Rapor eksik veya özensiz","points":2.5},{"level":2,"label":"Orta","description":"Temel başlıklar var, açıklama az","points":5},{"level":3,"label":"İyi","description":"Düzenli rapor ve ekran görüntüleri","points":7.5},{"level":4,"label":"Çok İyi","description":"Kapsamlı, düzenli ve anlaşılır dokümantasyon","points":10}]', 8),

-- 2) FrontEnd Web Tasarımı (course_id = 2)
(9, 2, 1, 'Hedef kitle, site haritası ve içerik planlaması', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Site yapısı planlanmamış","points":2},{"level":2,"label":"Orta","description":"Basit sayfa listesi var","points":4},{"level":3,"label":"İyi","description":"Sayfa hiyerarşisi net kurulmuş","points":6},{"level":4,"label":"Çok İyi","description":"Site haritası ve içerik planı eksiksiz","points":8}]', 1),
(10, 2, 1, 'Wireframe/taslak hazırlığı ve zaman yönetimi', 7.00, '[{"level":1,"label":"Geliştirilmeli","description":"Taslak hazırlanmamış","points":2},{"level":2,"label":"Orta","description":"Kaba taslak mevcut","points":3.5},{"level":3,"label":"İyi","description":"Ekran taslakları düzenli","points":5.5},{"level":4,"label":"Çok İyi","description":"Detaylı wireframe ve zaman planına tam uyum","points":7}]', 2),
(11, 2, 2, 'Görsel estetik, renk uyumu, tipografi ve hizalama', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Görsel bütünlük yok","points":2.5},{"level":2,"label":"Orta","description":"Temel stil uygulanmış","points":5},{"level":3,"label":"İyi","description":"Uyumlu renk ve okunabilir tipografi","points":7.5},{"level":4,"label":"Çok İyi","description":"Profesyonel, modern ve dengeli arayüz","points":10}]', 3),
(12, 2, 2, 'Responsive (mobil/tablet/masaüstü) uyumluluk ve UX', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Küçük ekranlarda taşma/bozulma var","points":2.5},{"level":2,"label":"Orta","description":"Kısmen uyumlu","points":5},{"level":3,"label":"İyi","description":"Farklı ekranlarda düzenli çalışıyor","points":7.5},{"level":4,"label":"Çok İyi","description":"Tüm cihazlarda kusursuz responsive deneyim","points":10}]', 4),
(13, 2, 3, 'Semantik HTML5 yapısı ve düzenli CSS (Flexbox/Grid)', 15.00, '[{"level":1,"label":"Geliştirilmeli","description":"Hatalı etiketleme ve dağınık CSS","points":4},{"level":2,"label":"Orta","description":"Temel HTML/CSS kullanılmış","points":7.5},{"level":3,"label":"İyi","description":"Semantik yapı ve modern CSS yerleşimi","points":11.5},{"level":4,"label":"Çok İyi","description":"Temiz, yeniden kullanılabilir HTML/CSS mimarisi","points":15}]', 5),
(14, 2, 3, 'JavaScript etkileşimleri, DOM yönetimi ve form doğrulama', 12.00, '[{"level":1,"label":"Geliştirilmeli","description":"Etkileşim yok veya hatalı","points":3},{"level":2,"label":"Orta","description":"Basit tıklama/olaylar çalışıyor","points":6},{"level":3,"label":"İyi","description":"Dinamik etkileşimler ve doğrulama çalışıyor","points":9},{"level":4,"label":"Çok İyi","description":"Zengin, hatasız ve akıcı kullanıcı etkileşimi","points":12}]', 6),
(15, 2, 3, 'Dosya organizasyonu, kod temizliği ve tarayıcı konsol hatasızlığı', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Klasörleme bozuk, konsol hataları var","points":2},{"level":2,"label":"Orta","description":"Temel klasörleme mevcut","points":4},{"level":3,"label":"İyi","description":"Düzenli klasörleme ve temiz kod","points":6},{"level":4,"label":"Çok İyi","description":"Sıfır konsol hatası, örnek dosya düzeni","points":8}]', 7),
(16, 2, 4, 'Tasarım raporu, ekran görüntüleri ve kullanılan teknolojiler', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Rapor eksik","points":2.5},{"level":2,"label":"Orta","description":"Kısa özet verilmiş","points":5},{"level":3,"label":"İyi","description":"Ekranlar ve tasarım kararları açıklanmış","points":7.5},{"level":4,"label":"Çok İyi","description":"Eksiksiz, görselli ve düzenli proje raporu","points":10}]', 8),

-- 3) Web Tabanlı Proje (course_id = 3)
(17, 3, 1, 'Sistem gereksinimleri, kullanıcı rolleri ve proje kapsamı', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Kapsam ve roller net değil","points":2},{"level":2,"label":"Orta","description":"Temel senaryo belirlenmiş","points":4},{"level":3,"label":"İyi","description":"Roller ve sistem akışı açıkça planlanmış","points":6},{"level":4,"label":"Çok İyi","description":"Kapsam, roller ve tüm iş kuralları eksiksiz","points":8}]', 1),
(18, 3, 1, 'Veritabanı ve modül iş-zaman planlaması', 7.00, '[{"level":1,"label":"Geliştirilmeli","description":"Plan yapılmamış","points":2},{"level":2,"label":"Orta","description":"Kısmi modül planı var","points":3.5},{"level":3,"label":"İyi","description":"Modüller düzenli sıralanmış","points":5.5},{"level":4,"label":"Çok İyi","description":"Veri modeli ve takvim eksiksiz planlanmış","points":7}]', 2),
(19, 3, 2, 'Veritabanı tablo ilişkileri (ER) ve veri bütünlüğü tasarımı', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Tablo tasarımı hatalı veya eksik","points":2.5},{"level":2,"label":"Orta","description":"Temel tablolar var, ilişki zayıf","points":5},{"level":3,"label":"İyi","description":"Normalleştirilmiş ve ilişkili tablolar","points":7.5},{"level":4,"label":"Çok İyi","description":"Örnek veri modeli ve anahtar ilişkileri","points":10}]', 3),
(20, 3, 2, 'Web arayüz akışı, yönetici/kullanıcı panelleri ve kullanılabilirlik', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Sayfalar arası geçiş karmaşık","points":2.5},{"level":2,"label":"Orta","description":"Temel paneller mevcut","points":5},{"level":3,"label":"İyi","description":"Anlaşılır menü ve tutarlı ekranlar","points":7.5},{"level":4,"label":"Çok İyi","description":"Akıcı, profesyonel ve kolay kullanımlı panel","points":10}]', 4),
(21, 3, 3, 'Backend-Veritabanı bağlantısı ve CRUD (Ekle/Listele/Güncelle/Sil) işlevleri', 15.00, '[{"level":1,"label":"Geliştirilmeli","description":"CRUD işlemleri çalışmıyor","points":4},{"level":2,"label":"Orta","description":"Sadece ekleme/listeleme çalışıyor","points":7.5},{"level":3,"label":"İyi","description":"Tüm CRUD işlemleri sorunsuz çalışıyor","points":11.5},{"level":4,"label":"Çok İyi","description":"Hızlı, eksiksiz ve doğrulamalı CRUD mimarisi","points":15}]', 5),
(22, 3, 3, 'Oturum yönetimi, yetkilendirme ve temel web güvenliği', 12.00, '[{"level":1,"label":"Geliştirilmeli","description":"Güvenlik ve oturum kontrolü yok","points":3},{"level":2,"label":"Orta","description":"Basit giriş formu var","points":6},{"level":3,"label":"İyi","description":"Oturum, şifreleme ve sorgu güvenliği mevcut","points":9},{"level":4,"label":"Çok İyi","description":"Güvenli oturum, rol kontrolü ve SQL/XSS koruması","points":12}]', 6),
(23, 3, 3, 'Kod organizasyonu, hata yönetimi ve form doğrulama', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Hatalar kontrolsüz, kod dağınık","points":2},{"level":2,"label":"Orta","description":"Temel kontrol yapıları var","points":4},{"level":3,"label":"İyi","description":"Düzenli kod ve kullanıcıya anlamlı mesajlar","points":6},{"level":4,"label":"Çok İyi","description":"Modüler yapı, temiz kod ve tam hata yönetimi","points":8}]', 7),
(24, 3, 4, 'Sistem raporu, veritabanı diyagramı ve kurulum/kullanım kılavuzu', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Rapor yetersiz","points":2.5},{"level":2,"label":"Orta","description":"Temel açıklamalar mevcut","points":5},{"level":3,"label":"İyi","description":"Tablolar, akış ve ekran görüntüleri düzenli","points":7.5},{"level":4,"label":"Çok İyi","description":"Kapsamlı teknik rapor ve kurulum dokümanı","points":10}]', 8),

-- 4) Mobil Uygulama (course_id = 4)
(25, 4, 1, 'Mobil uygulama fikri, kullanıcı senaryosu ve kapsam analizi', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Uygulama amacı belirsiz","points":2},{"level":2,"label":"Orta","description":"Temel özellikler sıralanmış","points":4},{"level":3,"label":"İyi","description":"Kullanıcı senaryoları net hazırlanmış","points":6},{"level":4,"label":"Çok İyi","description":"Kapsamlı mobil ihtiyaç ve özellik analizi","points":8}]', 1),
(26, 4, 1, 'Ekran akış şeması ve geliştirme takvimi', 7.00, '[{"level":1,"label":"Geliştirilmeli","description":"Ekran akışı planlanmamış","points":2},{"level":2,"label":"Orta","description":"Basit ekran listesi mevcut","points":3.5},{"level":3,"label":"İyi","description":"Ekran geçişleri önceden kurgulanmış","points":5.5},{"level":4,"label":"Çok İyi","description":"Eksiksiz ekran haritası ve aşama planı","points":7}]', 2),
(27, 4, 2, 'Mobil arayüz (UI) tasarımı, ikon/buton boyutları ve okunabilirlik', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Mobil ergonomiye uygun değil","points":2.5},{"level":2,"label":"Orta","description":"Temel bileşenler yerleştirilmiş","points":5},{"level":3,"label":"İyi","description":"Temiz ve dokunmaya uygun tasarım","points":7.5},{"level":4,"label":"Çok İyi","description":"Modern, tutarlı ve yüksek ergonomili mobil UI","points":10}]', 3),
(28, 4, 2, 'Farklı ekran boyutlarına uyum ve navigasyon (menü/geri dönüş) deneyimi', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Ekran taşmaları ve kopuk geçişler var","points":2.5},{"level":2,"label":"Orta","description":"Temel geçişler mevcut","points":5},{"level":3,"label":"İyi","description":"Akıcı navigasyon ve uyumlu yerleşim","points":7.5},{"level":4,"label":"Çok İyi","description":"Kusursuz navigasyon ve tüm ekran boyutlarına tam uyum","points":10}]', 4),
(29, 4, 3, 'Uygulamanın çalışırlığı ve temel mobil özelliklerin eksiksizliği', 15.00, '[{"level":1,"label":"Geliştirilmeli","description":"Uygulama çöküyor veya çalışmıyor","points":4},{"level":2,"label":"Orta","description":"Temel ekranlar açılıyor, işlevler eksik","points":7.5},{"level":3,"label":"İyi","description":"Ana işlevler kararlı biçimde çalışıyor","points":11.5},{"level":4,"label":"Çok İyi","description":"Tüm modüller akıcı, hızlı ve hatasız","points":15}]', 5),
(30, 4, 3, 'Durum yönetimi (State), veri saklama (Yerel/API) ve ekran iletişimi', 12.00, '[{"level":1,"label":"Geliştirilmeli","description":"Veri kaydı/aktarımı yapılmamış","points":3},{"level":2,"label":"Orta","description":"Sadece statik veya geçici veri var","points":6},{"level":3,"label":"İyi","description":"Veri saklama ve ekranlar arası veri aktarımı çalışıyor","points":9},{"level":4,"label":"Çok İyi","description":"Sağlam state yönetimi ve kalıcı veri/API entegrasyonu","points":12}]', 6),
(31, 4, 3, 'Kod düzeni, performans ve hata/boş durum kontrolleri', 8.00, '[{"level":1,"label":"Geliştirilmeli","description":"Hata kontrolü yok, kod karmaşık","points":2},{"level":2,"label":"Orta","description":"Temel doğrulamalar mevcut","points":4},{"level":3,"label":"İyi","description":"Düzenli kod ve uygun uyarı mesajları","points":6},{"level":4,"label":"Çok İyi","description":"Temiz mimari, yüksek performans ve eksiksiz hata kontrolü","points":8}]', 7),
(32, 4, 4, 'Mobil proje raporu, ekran akış görselleri ve test notları', 10.00, '[{"level":1,"label":"Geliştirilmeli","description":"Rapor eksik","points":2.5},{"level":2,"label":"Orta","description":"Temel ekran görüntüleri eklenmiş","points":5},{"level":3,"label":"İyi","description":"Ekranlar, veri yapısı ve kullanım anlatılmış","points":7.5},{"level":4,"label":"Çok İyi","description":"Detaylı, görselli ve profesyonel proje raporu","points":10}]', 8);
