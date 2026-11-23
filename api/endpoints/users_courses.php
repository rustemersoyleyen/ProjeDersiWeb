<?php
/**
 * Kullanıcılar (Ders Öğretmenleri), Dersler (Proje Alanları) ve Ayarlar Endpoint'leri
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

function pd_handle_users(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $rows = $pdo->query(
            'SELECT id, username, full_name, branch, title, role, is_active, created_at
             FROM pd_users ORDER BY role ASC, full_name ASC'
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['is_active'] = (int)$r['is_active'];
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

        if ($username === '' || $fullName === '' || strlen($password) < 4) {
            pd_json_response(['error' => 'Kullanıcı adı, ad soyad ve en az 4 karakterli şifre zorunludur.'], 400);
        }

        $chk = $pdo->prepare('SELECT id FROM pd_users WHERE username = ?');
        $chk->execute([$username]);
        if ($chk->fetch()) {
            pd_json_response(['error' => 'Bu kullanıcı adı zaten kayıtlı.'], 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_users (username, password_hash, full_name, branch, title, role, is_active)
             VALUES (?, ?, ?, ?, ?, ?, 1)'
        );
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $branch, $title, $role]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
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

        if ($id === $admin['id'] && ($role !== 'admin' || $isActive === 0)) {
            pd_json_response(['error' => 'Kendi admin yetkinizi veya hesabınızı pasif yapamazsınız.'], 400);
        }

        if ($fullName === '') {
            pd_json_response(['error' => 'Ad Soyad boş olamaz.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE pd_users SET full_name = ?, branch = ?, title = ?, role = ?, is_active = ? WHERE id = ?'
        );
        $stmt->execute([$fullName, $branch, $title, $role, $isActive, $id]);

        $newPassword = (string)($b['password'] ?? '');
        if ($newPassword !== '') {
            if (strlen($newPassword) < 4) {
                pd_json_response(['error' => 'Yeni şifre en az 4 karakter olmalıdır.'], 400);
            }
            $pwStmt = $pdo->prepare('UPDATE pd_users SET password_hash = ? WHERE id = ?');
            $pwStmt->execute([password_hash($newPassword, PASSWORD_DEFAULT), $id]);
        }

        pd_json_response(['ok' => true]);
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

function pd_handle_courses(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $rows = $pdo->query(
            'SELECT c.id, c.name, c.short_code, c.description, c.question_points, c.sort_order,
                    (SELECT COUNT(*) FROM pd_questions q WHERE q.course_id = c.id) AS question_count,
                    (SELECT COALESCE(SUM(cr.max_score), 0) FROM pd_criteria cr WHERE cr.course_id = c.id) AS rubric_points
             FROM pd_courses c
             ORDER BY c.sort_order ASC, c.id ASC'
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['question_points'] = (int)$r['question_points'];
            $r['sort_order'] = (int)$r['sort_order'];
            $r['question_count'] = (int)$r['question_count'];
            $r['rubric_points'] = (float)$r['rubric_points'];
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        pd_require_admin();
        $b = pd_get_json_body();
        $name = trim((string)($b['name'] ?? ''));
        $shortCode = strtoupper(trim((string)($b['short_code'] ?? '')));
        $description = trim((string)($b['description'] ?? ''));
        $questionPoints = max(0, min(100, (int)($b['question_points'] ?? 20)));
        $sortOrder = (int)($b['sort_order'] ?? 10);

        if ($name === '' || $shortCode === '') {
            pd_json_response(['error' => 'Ders adı ve kısa kodu zorunludur.'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_courses (name, short_code, description, question_points, sort_order)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$name, $shortCode, $description, $questionPoints, $sortOrder]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $shortCode = strtoupper(trim((string)($b['short_code'] ?? '')));
        $description = trim((string)($b['description'] ?? ''));
        $questionPoints = max(0, min(100, (int)($b['question_points'] ?? 20)));
        $sortOrder = (int)($b['sort_order'] ?? 1);

        if ($id <= 0 || $name === '' || $shortCode === '') {
            pd_json_response(['error' => 'Geçersiz ders bilgisi.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE pd_courses SET name = ?, short_code = ?, description = ?, question_points = ?, sort_order = ? WHERE id = ?'
        );
        $stmt->execute([$name, $shortCode, $description, $questionPoints, $sortOrder, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_admin();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz ders ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_courses WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}
