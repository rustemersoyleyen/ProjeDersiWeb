<?php
/**
 * Sınıflar, Sınıf-Ders Öğretmen Atamaları, Projeler ve Öğrenciler Endpoint'leri
 */

function pd_handle_classes(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $classes = $pdo->query(
            'SELECT c.id, c.name, c.academic_year, c.school_name, c.created_at,
                    (SELECT COUNT(*) FROM pd_students s WHERE s.class_id = c.id) AS student_count
             FROM pd_classes c
             ORDER BY c.academic_year DESC, c.name ASC'
        )->fetchAll();

        $ctRows = $pdo->query(
            'SELECT cct.class_id, cct.course_id, cct.teacher_id, cct.sort_order,
                    u.full_name, u.branch, u.title
             FROM pd_class_course_teachers cct
             JOIN pd_users u ON u.id = cct.teacher_id
             ORDER BY cct.sort_order ASC, u.full_name ASC'
        )->fetchAll();

        $ctMap = [];
        foreach ($ctRows as $r) {
            $cid = (int)$r['class_id'];
            $courseId = (int)$r['course_id'];
            $ctMap[$cid][$courseId][] = [
                'teacher_id' => (int)$r['teacher_id'],
                'full_name' => $r['full_name'],
                'branch' => $r['branch'],
                'title' => $r['title'],
            ];
        }

        foreach ($classes as &$c) {
            $id = (int)$c['id'];
            $c['id'] = $id;
            $c['student_count'] = (int)$c['student_count'];
            $c['course_teachers'] = $ctMap[$id] ?? new stdClass();
        }
        pd_json_response($classes);
    }

    if ($method === 'POST') {
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $name = trim((string)($b['name'] ?? ''));
        $academicYear = trim((string)($b['academic_year'] ?? '2025-2026'));
        $schoolName = trim((string)($b['school_name'] ?? ''));

        if ($name === '') {
            pd_json_response(['error' => 'Sınıf adı zorunludur (ör. 11-A).'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_classes (name, academic_year, school_name, created_by) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$name, $academicYear, $schoolName, $user['id']]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $academicYear = trim((string)($b['academic_year'] ?? '2025-2026'));
        $schoolName = trim((string)($b['school_name'] ?? ''));

        if ($id <= 0 || $name === '') {
            pd_json_response(['error' => 'Geçersiz sınıf bilgisi.'], 400);
        }

        $stmt = $pdo->prepare('UPDATE pd_classes SET name = ?, academic_year = ?, school_name = ? WHERE id = ?');
        $stmt->execute([$name, $academicYear, $schoolName, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz sınıf ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_classes WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_class_teachers(string $method): void {
    $pdo = pd_db();
    if ($method !== 'POST') {
        pd_json_response(['error' => 'Yalnızca POST desteklenir.'], 405);
    }
    pd_require_auth();
    $b = pd_get_json_body();
    $classId = (int)($b['class_id'] ?? 0);
    $courseId = (int)($b['course_id'] ?? 0);
    $teacherIds = is_array($b['teacher_ids'] ?? null) ? $b['teacher_ids'] : [];

    if ($classId <= 0 || $courseId <= 0) {
        pd_json_response(['error' => 'Sınıf ve ders seçilmelidir.'], 400);
    }

    $pdo->beginTransaction();
    try {
        $del = $pdo->prepare('DELETE FROM pd_class_course_teachers WHERE class_id = ? AND course_id = ?');
        $del->execute([$classId, $courseId]);

        $ins = $pdo->prepare(
            'INSERT INTO pd_class_course_teachers (class_id, course_id, teacher_id, sort_order) VALUES (?, ?, ?, ?)'
        );
        $order = 1;
        foreach ($teacherIds as $tid) {
            $t = (int)$tid;
            if ($t > 0) {
                $ins->execute([$classId, $courseId, $t, $order++]);
            }
        }
        $pdo->commit();
        pd_json_response(['ok' => true]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        pd_json_response(['error' => 'Ders öğretmeni ataması kaydedilemedi.'], 500);
    }
}

function pd_handle_projects(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $rows = $pdo->query(
            'SELECT p.id, p.title, p.description, p.created_at,
                    (SELECT COUNT(*) FROM pd_students s WHERE s.project_id = p.id) AS student_count
             FROM pd_projects p
             ORDER BY p.title ASC'
        )->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['student_count'] = (int)$r['student_count'];
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        pd_require_auth();
        $b = pd_get_json_body();

        // Toplu proje ekleme desteği
        if (isset($b['items']) && is_array($b['items'])) {
            $ins = $pdo->prepare('INSERT INTO pd_projects (title, description) VALUES (?, ?)');
            $count = 0;
            foreach ($b['items'] as $item) {
                $title = is_array($item) ? trim((string)($item['title'] ?? '')) : trim((string)$item);
                $desc = is_array($item) ? trim((string)($item['description'] ?? '')) : '';
                if ($title !== '') {
                    $ins->execute([$title, $desc !== '' ? $desc : null]);
                    $count++;
                }
            }
            pd_json_response(['ok' => true, 'inserted' => $count], 201);
        }

        $title = trim((string)($b['title'] ?? ''));
        $description = trim((string)($b['description'] ?? ''));
        if ($title === '') {
            pd_json_response(['error' => 'Proje adı zorunludur.'], 400);
        }
        $stmt = $pdo->prepare('INSERT INTO pd_projects (title, description) VALUES (?, ?)');
        $stmt->execute([$title, $description !== '' ? $description : null]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $title = trim((string)($b['title'] ?? ''));
        $description = trim((string)($b['description'] ?? ''));
        if ($id <= 0 || $title === '') {
            pd_json_response(['error' => 'Geçersiz proje bilgisi.'], 400);
        }
        $stmt = $pdo->prepare('UPDATE pd_projects SET title = ?, description = ? WHERE id = ?');
        $stmt->execute([$title, $description !== '' ? $description : null, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz proje ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_projects WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_students(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $classId = (int)($_GET['class_id'] ?? 0);
        $sql = 'SELECT s.id, s.class_id, s.student_no, s.full_name, s.project_id,
                       p.title AS project_title, c.name AS class_name
                FROM pd_students s
                LEFT JOIN pd_projects p ON p.id = s.project_id
                JOIN pd_classes c ON c.id = s.class_id';
        $params = [];
        if ($classId > 0) {
            $sql .= ' WHERE s.class_id = ?';
            $params[] = $classId;
        }
        $sql .= ' ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $students = $stmt->fetchAll();

        // Öğrencilerin tüm derslerdeki notları ve atanan soru sayıları
        $evalMap = [];
        $qCountMap = [];
        if (!empty($students)) {
            $ids = array_map(fn($r) => (int)$r['id'], $students);
            $in = implode(',', array_fill(0, count($ids), '?'));

            $evStmt = $pdo->prepare("SELECT student_id, course_id, total_score, rubric_total, question_total FROM pd_evaluations WHERE student_id IN ($in)");
            $evStmt->execute($ids);
            foreach ($evStmt->fetchAll() as $ev) {
                $evalMap[(int)$ev['student_id']][(int)$ev['course_id']] = [
                    'total_score' => (float)$ev['total_score'],
                    'rubric_total' => (float)$ev['rubric_total'],
                    'question_total' => (float)$ev['question_total'],
                ];
            }

            $qStmt = $pdo->prepare("SELECT student_id, course_id, COUNT(*) AS cnt FROM pd_student_questions WHERE student_id IN ($in) GROUP BY student_id, course_id");
            $qStmt->execute($ids);
            foreach ($qStmt->fetchAll() as $qr) {
                $qCountMap[(int)$qr['student_id']][(int)$qr['course_id']] = (int)$qr['cnt'];
            }
        }

        foreach ($students as &$s) {
            $sid = (int)$s['id'];
            $s['id'] = $sid;
            $s['class_id'] = (int)$s['class_id'];
            $s['project_id'] = $s['project_id'] !== null ? (int)$s['project_id'] : null;
            $s['evaluations'] = $evalMap[$sid] ?? new stdClass();
            $s['question_counts'] = $qCountMap[$sid] ?? new stdClass();
        }
        pd_json_response($students);
    }

    if ($method === 'POST') {
        pd_require_auth();
        $b = pd_get_json_body();
        $classId = (int)($b['class_id'] ?? 0);
        if ($classId <= 0) {
            pd_json_response(['error' => 'Sınıf seçilmelidir.'], 400);
        }

        // Toplu içe aktarma (CSV / Excel / PDF)
        if (isset($b['students']) && is_array($b['students'])) {
            $upsert = $pdo->prepare(
                'INSERT INTO pd_students (class_id, student_no, full_name, project_id)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE full_name = VALUES(full_name)'
            );
            $findProj = $pdo->prepare('SELECT id FROM pd_projects WHERE title = ? LIMIT 1');
            $insProj = $pdo->prepare('INSERT INTO pd_projects (title) VALUES (?)');

            $pdo->beginTransaction();
            try {
                $count = 0;
                foreach ($b['students'] as $row) {
                    $no = trim((string)($row['student_no'] ?? ''));
                    $name = trim((string)($row['full_name'] ?? ''));
                    if ($no === '' || $name === '') {
                        continue;
                    }
                    $projectId = isset($row['project_id']) && (int)$row['project_id'] > 0 ? (int)$row['project_id'] : null;
                    $projectTitle = trim((string)($row['project_title'] ?? ''));
                    if ($projectId === null && $projectTitle !== '') {
                        $findProj->execute([$projectTitle]);
                        $found = $findProj->fetch();
                        if ($found) {
                            $projectId = (int)$found['id'];
                        } else {
                            $insProj->execute([$projectTitle]);
                            $projectId = (int)$pdo->lastInsertId();
                        }
                    }
                    $upsert->execute([$classId, $no, $name, $projectId]);
                    $count++;
                }
                $pdo->commit();
                pd_json_response(['ok' => true, 'imported' => $count], 201);
            } catch (Throwable $e) {
                $pdo->rollBack();
                pd_json_response(['error' => 'Toplu öğrenci kaydı sırasında hata oluştu.'], 500);
            }
        }

        // Tekil öğrenci ekleme
        $studentNo = trim((string)($b['student_no'] ?? ''));
        $fullName = trim((string)($b['full_name'] ?? ''));
        $projectId = isset($b['project_id']) && (int)$b['project_id'] > 0 ? (int)$b['project_id'] : null;

        if ($studentNo === '' || $fullName === '') {
            pd_json_response(['error' => 'Öğrenci numarası ve ad soyad zorunludur.'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_students (class_id, student_no, full_name, project_id) VALUES (?, ?, ?, ?)'
        );
        try {
            $stmt->execute([$classId, $studentNo, $fullName, $projectId]);
        } catch (PDOException $e) {
            pd_json_response(['error' => 'Bu sınıfta aynı öğrenci numarası zaten mevcut.'], 409);
        }
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz öğrenci ID.'], 400);
        }

        // Sadece proje ataması güncellemesi
        if (array_key_exists('project_id', $b) && !isset($b['full_name']) && !isset($b['student_no'])) {
            $projectId = $b['project_id'] !== null && (int)$b['project_id'] > 0 ? (int)$b['project_id'] : null;
            $stmt = $pdo->prepare('UPDATE pd_students SET project_id = ? WHERE id = ?');
            $stmt->execute([$projectId, $id]);
            pd_json_response(['ok' => true]);
        }

        $studentNo = trim((string)($b['student_no'] ?? ''));
        $fullName = trim((string)($b['full_name'] ?? ''));
        $projectId = isset($b['project_id']) && (int)$b['project_id'] > 0 ? (int)$b['project_id'] : null;
        if ($studentNo === '' || $fullName === '') {
            pd_json_response(['error' => 'Öğrenci numarası ve ad soyad zorunludur.'], 400);
        }

        $stmt = $pdo->prepare('UPDATE pd_students SET student_no = ?, full_name = ?, project_id = ? WHERE id = ?');
        $stmt->execute([$studentNo, $fullName, $projectId, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz öğrenci ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_students WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}
