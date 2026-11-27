<?php
/**
 * Kullanıcılar (Ders Öğretmenleri + Sınıf/Ders Atamaları), Ana Dersler (Subjects),
 * Uygulamalar/Projeler (Courses) ve Ayarlar Endpoint'leri
 */

function pd_handle_settings(string $method): void {
    $pdo = pd_db();
    if ($method === 'GET') {
        pd_require_auth();
        $rows = $pdo->query('SELECT setting_key, setting_value FROM pd_settings')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $out[$r['setting_key']] = $r['setting_value'];
        }
        pd_json_response($out);
    }

    if ($method === 'POST' || $method === 'PUT') {
        pd_require_admin();
        $body = pd_get_json_body();
        $allowed = ['school_name', 'academic_year', 'evaluation_title'];
        $stmt = $pdo->prepare(
            'INSERT INTO pd_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        foreach ($allowed as $key) {
            if (isset($body[$key])) {
                $stmt->execute([$key, trim((string)$body[$key])]);
            }
        }
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_sync_teacher_assignments(PDO $pdo, int $teacherId, array $assignments): void {
    $del = $pdo->prepare('DELETE FROM pd_class_course_teachers WHERE teacher_id = ?');
    $del->execute([$teacherId]);

    $ins = $pdo->prepare(
        'INSERT IGNORE INTO pd_class_course_teachers (class_id, course_id, teacher_id, sort_order)
         VALUES (?, ?, ?, ?)'
    );
    $order = 1;
    foreach ($assignments as $pair) {
        $cid = (int)($pair['class_id'] ?? 0);
        $courseId = (int)($pair['course_id'] ?? 0);
        if ($cid > 0 && $courseId > 0) {
            $ins->execute([$cid, $courseId, $teacherId, $order++]);
        }
    }
}

function pd_handle_users(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $rows = $pdo->query(
            'SELECT id, username, full_name, branch, title, role, is_active, created_at
             FROM pd_users ORDER BY role ASC, full_name ASC'
        )->fetchAll();

        $assignRows = $pdo->query(
            'SELECT teacher_id, class_id, course_id FROM pd_class_course_teachers ORDER BY class_id ASC, course_id ASC'
        )->fetchAll();
        $assignMap = [];
        foreach ($assignRows as $ar) {
            $assignMap[(int)$ar['teacher_id']][] = [
                'class_id' => (int)$ar['class_id'],
                'course_id' => (int)$ar['course_id'],
            ];
        }

        foreach ($rows as &$r) {
            $uid = (int)$r['id'];
            $r['id'] = $uid;
            $r['is_active'] = (int)$r['is_active'];
            $r['assignments'] = $assignMap[$uid] ?? [];
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        pd_require_admin();
        $b = pd_get_json_body();
        $username = trim((string)($b['username'] ?? ''));
        $password = (string)($b['password'] ?? '');
        $fullName = trim((string)($b['full_name'] ?? ''));
        $branch = trim((string)($b['branch'] ?? 'Bilişim Teknolojileri'));
        $title = trim((string)($b['title'] ?? 'Ders Öğretmeni'));
        $role = ($b['role'] ?? 'teacher') === 'admin' ? 'admin' : 'teacher';
        $assignments = is_array($b['assignments'] ?? null) ? $b['assignments'] : null;

        if ($username === '' || $fullName === '' || strlen($password) < 4) {
            pd_json_response(['error' => 'Kullanıcı adı, ad soyad ve en az 4 karakterli şifre zorunludur.'], 400);
        }

        $chk = $pdo->prepare('SELECT id FROM pd_users WHERE username = ?');
        $chk->execute([$username]);
        if ($chk->fetch()) {
            pd_json_response(['error' => 'Bu kullanıcı adı zaten kayıtlı.'], 409);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO pd_users (username, password_hash, full_name, branch, title, role, is_active)
                 VALUES (?, ?, ?, ?, ?, ?, 1)'
            );
            $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $branch, $title, $role]);
            $newId = (int)$pdo->lastInsertId();

            if ($assignments !== null) {
                pd_sync_teacher_assignments($pdo, $newId, $assignments);
            }
            $pdo->commit();
            pd_json_response(['ok' => true, 'id' => $newId], 201);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Öğretmen hesabı oluşturulamadı.'], 500);
        }
    }

    if ($method === 'PUT') {
        $admin = pd_require_admin();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz kullanıcı ID.'], 400);
        }

        $fullName = trim((string)($b['full_name'] ?? ''));
        $branch = trim((string)($b['branch'] ?? 'Bilişim Teknolojileri'));
        $title = trim((string)($b['title'] ?? 'Ders Öğretmeni'));
        $role = ($b['role'] ?? 'teacher') === 'admin' ? 'admin' : 'teacher';
        $isActive = isset($b['is_active']) ? ((int)$b['is_active'] ? 1 : 0) : 1;
        $assignments = array_key_exists('assignments', $b) && is_array($b['assignments']) ? $b['assignments'] : null;

        if ($id === $admin['id'] && ($role !== 'admin' || $isActive === 0)) {
            pd_json_response(['error' => 'Kendi admin yetkinizi veya hesabınızı pasif yapamazsınız.'], 400);
        }

        if ($fullName === '') {
            pd_json_response(['error' => 'Ad Soyad boş olamaz.'], 400);
        }

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'UPDATE pd_users SET full_name = ?, branch = ?, title = ?, role = ?, is_active = ? WHERE id = ?'
            );
            $stmt->execute([$fullName, $branch, $title, $role, $isActive, $id]);

            $newPassword = (string)($b['password'] ?? '');
            if ($newPassword !== '') {
                if (strlen($newPassword) < 4) {
                    $pdo->rollBack();
                    pd_json_response(['error' => 'Yeni şifre en az 4 karakter olmalıdır.'], 400);
                }
                $pwStmt = $pdo->prepare('UPDATE pd_users SET password_hash = ? WHERE id = ?');
                $pwStmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $id]);
            }

            if ($assignments !== null) {
                pd_sync_teacher_assignments($pdo, $id, $assignments);
            }
            $pdo->commit();
            pd_json_response(['ok' => true]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Kullanıcı güncellenemedi.'], 500);
        }
    }

    if ($method === 'DELETE') {
        $admin = pd_require_admin();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz kullanıcı ID.'], 400);
        }
        if ($id === $admin['id']) {
            pd_json_response(['error' => 'Kendi hesabınızı silemezsiniz.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_users WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_subjects(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        $user = pd_require_auth();
        $rows = $pdo->query(
            'SELECT s.id, s.name, s.code, s.model_type, s.description, s.sort_order, s.is_active,
                    (SELECT COUNT(*) FROM pd_courses c WHERE c.subject_id = s.id) AS course_count
             FROM pd_subjects s
             ORDER BY s.sort_order ASC, s.id ASC'
        )->fetchAll();

        $allowedCourseIds = pd_allowed_course_ids($user);
        $allowedSubjectIds = null;
        if ($allowedCourseIds !== null) {
            if (empty($allowedCourseIds)) {
                $allowedSubjectIds = [];
            } else {
                $in = implode(',', array_fill(0, count($allowedCourseIds), '?'));
                $sStmt = $pdo->prepare("SELECT DISTINCT subject_id FROM pd_courses WHERE id IN ($in)");
                $sStmt->execute($allowedCourseIds);
                $allowedSubjectIds = array_map(fn($r) => (int)$r['subject_id'], $sStmt->fetchAll());
            }
        }

        $out = [];
        foreach ($rows as $r) {
            $sid = (int)$r['id'];
            if ($allowedSubjectIds !== null && !in_array($sid, $allowedSubjectIds, true)) {
                continue;
            }
            $r['id'] = $sid;
            $r['sort_order'] = (int)$r['sort_order'];
            $r['is_active'] = (int)$r['is_active'];
            $r['course_count'] = (int)$r['course_count'];
            $out[] = $r;
        }
        pd_json_response($out);
    }

    if ($method === 'POST') {
        pd_require_admin();
        $b = pd_get_json_body();
        $name = trim((string)($b['name'] ?? ''));
        $code = trim((string)($b['code'] ?? ''));
        $modelType = ($b['model_type'] ?? 'practice_assignment') === 'project_rubric' ? 'project_rubric' : 'practice_assignment';
        $description = trim((string)($b['description'] ?? ''));
        $sortOrder = (int)($b['sort_order'] ?? 10);

        if ($name === '' || $code === '') {
            pd_json_response(['error' => 'Ders adı ve kısa kodu zorunludur.'], 400);
        }

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO pd_subjects (name, code, model_type, description, sort_order, is_active)
                 VALUES (?, ?, ?, ?, ?, 1)'
            );
            $stmt->execute([$name, $code, $modelType, $description !== '' ? $description : null, $sortOrder]);
            pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
        } catch (PDOException $e) {
            pd_json_response(['error' => 'Bu ders kodu zaten kullanılıyor.'], 409);
        }
    }

    if ($method === 'PUT') {
        pd_require_admin();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $code = trim((string)($b['code'] ?? ''));
        $modelType = ($b['model_type'] ?? 'practice_assignment') === 'project_rubric' ? 'project_rubric' : 'practice_assignment';
        $description = trim((string)($b['description'] ?? ''));
        $sortOrder = (int)($b['sort_order'] ?? 1);

        if ($id <= 0 || $name === '' || $code === '') {
            pd_json_response(['error' => 'Geçersiz ders bilgisi.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE pd_subjects SET name = ?, code = ?, model_type = ?, description = ?, sort_order = ? WHERE id = ?'
        );
        $stmt->execute([$name, $code, $modelType, $description !== '' ? $description : null, $sortOrder, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_admin();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 1) {
            pd_json_response(['error' => 'Varsayılan Seçmeli Yazılım Dersi silinemez.'], 400);
        }
        $chk = $pdo->prepare('SELECT COUNT(*) FROM pd_courses WHERE subject_id = ?');
        $chk->execute([$id]);
        if ((int)$chk->fetchColumn() > 0) {
            pd_json_response(['error' => 'Bu derse bağlı uygulamalar/ödevler var. Önce onları silin veya başka derse taşıyın.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_subjects WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_courses(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        $user = pd_require_auth();
        $subjectId = (int)($_GET['subject_id'] ?? 0);
        $allowedIds = pd_allowed_course_ids($user);

        if ($allowedIds !== null && empty($allowedIds)) {
            pd_json_response([]);
        }

        $where = [];
        $params = [];
        if ($subjectId > 0) {
            $where[] = 'c.subject_id = ?';
            $params[] = $subjectId;
        }
        if ($allowedIds !== null) {
            $in = implode(',', array_fill(0, count($allowedIds), '?'));
            $where[] = "c.id IN ($in)";
            $params = array_merge($params, $allowedIds);
        }

        $sql = 'SELECT c.id, c.subject_id, s.name AS subject_name, s.model_type,
                       c.name, c.short_code, c.description, c.question_points,
                       c.evaluation_mode, c.final_completion_points, c.final_report_points, c.sort_order,
                       (SELECT COUNT(*) FROM pd_questions q WHERE q.course_id = c.id) AS question_count,
                       (SELECT COALESCE(SUM(cr.max_score), 0) FROM pd_criteria cr WHERE cr.course_id = c.id) AS rubric_points,
                       (SELECT COUNT(*) FROM pd_weekly_tasks wt WHERE wt.course_id = c.id) AS weekly_task_count,
                       (SELECT COALESCE(SUM(wt.max_score), 0) FROM pd_weekly_tasks wt WHERE wt.course_id = c.id) AS weekly_points_sum
                FROM pd_courses c
                LEFT JOIN pd_subjects s ON s.id = c.subject_id';
        if (!empty($where)) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY c.subject_id ASC, c.sort_order ASC, c.id ASC';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['subject_id'] = (int)$r['subject_id'];
            $r['question_points'] = (int)$r['question_points'];
            $r['final_completion_points'] = (int)$r['final_completion_points'];
            $r['final_report_points'] = (int)$r['final_report_points'];
            $r['sort_order'] = (int)$r['sort_order'];
            $r['question_count'] = (int)$r['question_count'];
            $r['rubric_points'] = (float)$r['rubric_points'];
            $r['weekly_task_count'] = (int)$r['weekly_task_count'];
            $r['weekly_points_sum'] = (float)$r['weekly_points_sum'];
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $subjectId = max(1, (int)($b['subject_id'] ?? 1));
        $name = trim((string)($b['name'] ?? ''));
        $shortCode = trim((string)($b['short_code'] ?? ''));
        $description = trim((string)($b['description'] ?? ''));
        $allowedModes = ['rubric_full', 'weekly_plus_final', 'practice_simple'];
        $evalMode = in_array($b['evaluation_mode'] ?? '', $allowedModes, true) ? $b['evaluation_mode'] : 'rubric_full';
        $questionPoints = max(0, min(100, (int)($b['question_points'] ?? ($evalMode === 'practice_simple' ? 0 : 20))));
        $finalCompletion = max(0, min(100, (int)($b['final_completion_points'] ?? 20)));
        $finalReport = max(0, min(100, (int)($b['final_report_points'] ?? 10)));
        $sortOrder = (int)($b['sort_order'] ?? 10);

        if ($name === '' || $shortCode === '') {
            pd_json_response(['error' => 'Uygulama/ödev adı ve kısa kodu zorunludur.'], 400);
        }

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO pd_courses (subject_id, name, short_code, description, question_points, evaluation_mode, final_completion_points, final_report_points, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([$subjectId, $name, $shortCode, $description !== '' ? $description : null, $questionPoints, $evalMode, $finalCompletion, $finalReport, $sortOrder]);
            $newCourseId = (int)$pdo->lastInsertId();

            // Öğretmen yeni uygulama eklediyse kendi sınıflarına otomatik erişim ver
            if ($user['role'] === 'teacher') {
                $myClasses = pd_allowed_class_ids($user) ?? [];
                $insAssign = $pdo->prepare(
                    'INSERT IGNORE INTO pd_class_course_teachers (class_id, course_id, teacher_id, sort_order) VALUES (?, ?, ?, 1)'
                );
                foreach ($myClasses as $cid) {
                    $insAssign->execute([$cid, $newCourseId, $user['id']]);
                }
            }

            // Uygulama ödevi ise varsayılan 100 puanlık temel kriter ekle (boş kalmasın)
            if ($evalMode === 'practice_simple') {
                $defaultLevels = json_encode([
                    ['level' => 1, 'label' => 'Geliştirilmeli', 'description' => 'Eksik veya çalışmıyor', 'points' => 25],
                    ['level' => 2, 'label' => 'Orta', 'description' => 'Temel beklenti kısmen karşılandı', 'points' => 50],
                    ['level' => 3, 'label' => 'İyi', 'description' => 'Büyük ölçüde eksiksiz', 'points' => 75],
                    ['level' => 4, 'label' => 'Çok İyi', 'description' => 'Eksiksiz ve özgün uygulama', 'points' => 100],
                ], JSON_UNESCAPED_UNICODE);
                $crIns = $pdo->prepare(
                    'INSERT INTO pd_criteria (course_id, outcome_id, name, max_score, rubric_levels, sort_order)
                     VALUES (?, 3, ?, 100.00, ?, 1)'
                );
                $crIns->execute([$newCourseId, 'Uygulama ödevi / görev performansı ve çalışırlık', $defaultLevels]);
            }

            pd_json_response(['ok' => true, 'id' => $newCourseId], 201);
        } catch (PDOException $e) {
            pd_json_response(['error' => 'Bu kısa kod başka bir uygulamada kullanılıyor.'], 409);
        }
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $shortCode = trim((string)($b['short_code'] ?? ''));
        $description = trim((string)($b['description'] ?? ''));
        $questionPoints = max(0, min(100, (int)($b['question_points'] ?? 20)));
        $sortOrder = (int)($b['sort_order'] ?? 1);
        $allowedModes = ['rubric_full', 'weekly_plus_final', 'practice_simple'];

        if ($id <= 0 || $name === '' || $shortCode === '') {
            pd_json_response(['error' => 'Geçersiz uygulama bilgisi.'], 400);
        }

        // Mevcut değerleri koruyarak güncelle
        $curStmt = $pdo->prepare('SELECT subject_id, evaluation_mode, final_completion_points, final_report_points FROM pd_courses WHERE id = ?');
        $curStmt->execute([$id]);
        $cur = $curStmt->fetch();
        if (!$cur) {
            pd_json_response(['error' => 'Uygulama bulunamadı.'], 404);
        }

        $subjectId = isset($b['subject_id']) ? max(1, (int)$b['subject_id']) : (int)$cur['subject_id'];
        $evalMode = isset($b['evaluation_mode']) && in_array($b['evaluation_mode'], $allowedModes, true)
            ? $b['evaluation_mode']
            : $cur['evaluation_mode'];
        $finalCompletion = isset($b['final_completion_points'])
            ? max(0, min(100, (int)$b['final_completion_points']))
            : (int)$cur['final_completion_points'];
        $finalReport = isset($b['final_report_points'])
            ? max(0, min(100, (int)$b['final_report_points']))
            : (int)$cur['final_report_points'];

        $stmt = $pdo->prepare(
            'UPDATE pd_courses
             SET subject_id = ?, name = ?, short_code = ?, description = ?, question_points = ?,
                 evaluation_mode = ?, final_completion_points = ?, final_report_points = ?, sort_order = ?
             WHERE id = ?'
        );
        $stmt->execute([
            $subjectId,
            $name,
            $shortCode,
            $description !== '' ? $description : null,
            $questionPoints,
            $evalMode,
            $finalCompletion,
            $finalReport,
            $sortOrder,
            $id,
        ]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_admin();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz uygulama ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_courses WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}
