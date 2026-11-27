-- ============================================================================
-- Proje Değerlendirme Sistemi — Faz 2 (v2) Veritabanı Geçiş Betiği
-- UYARI: Mevcut hiçbir nota, öğrenciye, sınıfa veya soruya DOKUNMAZ!
-- Yalnızca yeni tablolar ve varsayılan değerli yeni sütunlar ekler (MariaDB 10+).
-- phpMyAdmin -> kiracbi8_okul360_db -> Import sekmesinden güvenle çalıştırabilirsiniz.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ana Dersler (Seçmeli Yazılım Dersi vs Uygulama Dersleri)
CREATE TABLE IF NOT EXISTS `pd_subjects` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(140) NOT NULL,
  `code` VARCHAR(24) NOT NULL,
  `model_type` ENUM('project_rubric', 'practice_assignment') NOT NULL DEFAULT 'project_rubric',
  `description` VARCHAR(255) DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_subjects_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `pd_subjects` (`id`, `name`, `code`, `model_type`, `description`, `sort_order`, `is_active`) VALUES
(1, 'Seçmeli Yazılım Dersi', 'SYP', 'project_rubric', '4 dönemlik proje değerlendirme (Rubik / Haftalık Süreç + Final & 3 Teknik/Yorum Sorusu)', 1, 1);

-- 2. pd_courses tablosuna Ana Ders, Değerlendirme Modu ve Proje Sonu Final puan sütunları ekle
ALTER TABLE `pd_courses`
  ADD COLUMN IF NOT EXISTS `subject_id` INT UNSIGNED NOT NULL DEFAULT 1 AFTER `id`,
  ADD COLUMN IF NOT EXISTS `evaluation_mode` ENUM('rubric_full', 'weekly_plus_final', 'practice_simple') NOT NULL DEFAULT 'rubric_full' AFTER `question_points`,
  ADD COLUMN IF NOT EXISTS `final_completion_points` INT UNSIGNED NOT NULL DEFAULT 20 AFTER `evaluation_mode`,
  ADD COLUMN IF NOT EXISTS `final_report_points` INT UNSIGNED NOT NULL DEFAULT 10 AFTER `final_completion_points`;

ALTER TABLE `pd_courses`
  ADD INDEX IF NOT EXISTS `idx_pd_courses_subject` (`subject_id`);

-- 3. Proje Bazlı Opsiyonel Ayrı Ödev / Proje Adı + Proje Başlangıç Hayali Notu
CREATE TABLE IF NOT EXISTS `pd_student_course_projects` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `course_id` INT UNSIGNED NOT NULL,
  `project_id` INT UNSIGNED DEFAULT NULL,
  `custom_title` VARCHAR(200) DEFAULT NULL,
  `initial_vision_note` TEXT DEFAULT NULL COMMENT 'Proje basinda ogrencinin hayal ettigi/hedefledigi kisa not',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_scp_student_course` (`student_id`, `course_id`),
  KEY `idx_pd_scp_course` (`course_id`),
  CONSTRAINT `fk_pd_scp_student` FOREIGN KEY (`student_id`) REFERENCES `pd_students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_scp_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_scp_project` FOREIGN KEY (`project_id`) REFERENCES `pd_projects` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Haftalık Çalışma Görevleri (Her proje/uygulama için opsiyonel haftalık plan)
CREATE TABLE IF NOT EXISTS `pd_weekly_tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` INT UNSIGNED NOT NULL,
  `week_no` INT UNSIGNED NOT NULL DEFAULT 1,
  `title` VARCHAR(180) NOT NULL,
  `description` VARCHAR(255) DEFAULT NULL,
  `max_score` DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  `due_date` VARCHAR(32) DEFAULT NULL,
  `sort_order` INT UNSIGNED NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pd_wt_course` (`course_id`, `week_no`),
  CONSTRAINT `fk_pd_wt_course` FOREIGN KEY (`course_id`) REFERENCES `pd_courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Öğrenci Haftalık Kontrol Puanları
CREATE TABLE IF NOT EXISTS `pd_student_weekly_scores` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` INT UNSIGNED NOT NULL,
  `weekly_task_id` INT UNSIGNED NOT NULL,
  `status` ENUM('done', 'partial', 'missing') NOT NULL DEFAULT 'missing',
  `score` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `note` VARCHAR(255) DEFAULT NULL,
  `checked_by` INT UNSIGNED DEFAULT NULL,
  `checked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pd_sws_student_task` (`student_id`, `weekly_task_id`),
  KEY `idx_pd_sws_task` (`weekly_task_id`),
  CONSTRAINT `fk_pd_sws_student` FOREIGN KEY (`student_id`) REFERENCES `pd_students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_sws_task` FOREIGN KEY (`weekly_task_id`) REFERENCES `pd_weekly_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pd_sws_user` FOREIGN KEY (`checked_by`) REFERENCES `pd_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. pd_questions tablosuna 3 kategorili soru tipi ekle (mevcut sorular korunur)
ALTER TABLE `pd_questions`
  ADD COLUMN IF NOT EXISTS `question_type` ENUM('technical_easy', 'technical_hard', 'vision_comment') NOT NULL DEFAULT 'technical_easy' AFTER `difficulty`;

-- 7. pd_evaluations tablosuna haftalık ve proje sonu final alt toplam sütunları ekle (mevcut notlar korunur)
ALTER TABLE `pd_evaluations`
  ADD COLUMN IF NOT EXISTS `weekly_total` DECIMAL(6,2) NOT NULL DEFAULT 0.00 AFTER `rubric_total`,
  ADD COLUMN IF NOT EXISTS `final_completion_score` DECIMAL(5,2) DEFAULT NULL AFTER `weekly_total`,
  ADD COLUMN IF NOT EXISTS `final_report_score` DECIMAL(5,2) DEFAULT NULL AFTER `final_completion_score`;

SET FOREIGN_KEY_CHECKS = 1;
