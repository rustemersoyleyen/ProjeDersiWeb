<?php
/**
 * Sınıflar (Öğretmen Kapsamlı), Sınıf-Ders Öğretmen Atamaları, Projeler,
 * Öğrenciler ve Proje Bazlı Opsiyonel Özel Ödev + Başlangıç Hayali Endpoint'leri
 */

function pd_handle_classes(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        $user = pd_require_auth();
        $allowedClassIds = pd_allowed_class_ids($user);

        if ($allowedClassIds !== null && empty($allowedClassIds)) {
            pd_json_response([]);
        }

        $sql = 'SELECT c.id, c.name, c.academic_year, c.school_name, c.created_at,
                       (SELECT COUNT(*) FROM pd_students s WHERE s.class_id = c.id) AS student_count
                FROM pd_classes c';
        $params = [];
        if ($allowedClassIds !== null) {
            $in = implode(',', array_fill(0, count($allowedClassIds), '?'));
            $sql .= " WHERE c.id IN ($in)";
            $params = $allowedClassIds;
        }
        $sql .= ' ORDER BY c.academic_year DESC, c.name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $classes = $stmt->fetchAll();

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
        $newClassId = (int)$pdo->lastInsertId();

        // Öğretmen kendi sınıf oluşturursa mevcut derslerine otomatik yetki ekle
        if ($user['role'] === 'teacher') {
            $myCourses = pd_allowed_course_ids($user);
            if (empty($myCourses)) {
                $myCourses = array_map(fn($r) => (int)$r['id'], $pdo->query('SELECT id FROM pd_courses')->fetchAll());
            }
            $ins = $pdo->prepare(
                'INSERT IGNORE INTO pd_class_course_teachers (class_id, course_id, teacher_id, sort_order) VALUES (?, ?, ?, 1)'
            );
            foreach ($myCourses as $cid) {
                $ins->execute([$newClassId, $cid, $user['id']]);
            }
        }

        pd_json_response(['ok' => true, 'id' => $newClassId], 201);
    }

    if ($method === 'PUT') {
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $academicYear = trim((string)($b['academic_year'] ?? '2025-2026'));
        $schoolName = trim((string)($b['school_name'] ?? ''));

        if ($id <= 0 || $name === '') {
            pd_json_response(['error' => 'Geçersiz sınıf bilgisi.'], 400);
        }
        pd_assert_can_access($user, $id);

        $stmt = $pdo->prepare('UPDATE pd_classes SET name = ?, academic_year = ?, school_name = ? WHERE id = ?');
        $stmt->execute([$name, $academicYear, $schoolName, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        $user = pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz sınıf ID.'], 400);
        }
        pd_assert_can_access($user, $id);
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
    pd_require_admin();
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
        $user = pd_require_auth();
        $classId = (int)($_GET['class_id'] ?? 0);
        $allowedClassIds = pd_allowed_class_ids($user);

        if ($classId > 0) {
            pd_assert_can_access($user, $classId);
        } elseif ($allowedClassIds !== null && empty($allowedClassIds)) {
            pd_json_response([]);
        }

        $sql = 'SELECT s.id, s.class_id, s.student_no, s.full_name, s.project_id,
                       p.title AS project_title, c.name AS class_name
                FROM pd_students s
                LEFT JOIN pd_projects p ON p.id = s.project_id
                JOIN pd_classes c ON c.id = s.class_id';
        $params = [];
        if ($classId > 0) {
            $sql .= ' WHERE s.class_id = ?';
            $params[] = $classId;
        } elseif ($allowedClassIds !== null) {
            $in = implode(',', array_fill(0, count($allowedClassIds), '?'));
            $sql .= " WHERE s.class_id IN ($in)";
            $params = $allowedClassIds;
        }
        $sql .= ' ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $students = $stmt->fetchAll();

        $evalMap = [];
        $qCountMap = [];
        $cpMap = [];
        if (!empty($students)) {
            $ids = array_map(fn($r) => (int)$r['id'], $students);
            $in = implode(',', array_fill(0, count($ids), '?'));

            $evStmt = $pdo->prepare("SELECT student_id, course_id, total_score, rubric_total, weekly_total, question_total FROM pd_evaluations WHERE student_id IN ($in)");
            $evStmt->execute($ids);
            foreach ($evStmt->fetchAll() as $ev) {
                $evalMap[(int)$ev['student_id']][(int)$ev['course_id']] = [
                    'total_score' => (float)$ev['total_score'],
                    'rubric_total' => (float)$ev['rubric_total'],
                    'weekly_total' => (float)$ev['weekly_total'],
                    'question_total' => (float)$ev['question_total'],
                ];
            }

            $qStmt = $pdo->prepare("SELECT student_id, course_id, COUNT(*) AS cnt FROM pd_student_questions WHERE student_id IN ($in) GROUP BY student_id, course_id");
            $qStmt->execute($ids);
            foreach ($qStmt->fetchAll() as $qr) {
                $qCountMap[(int)$qr['student_id']][(int)$qr['course_id']] = (int)$qr['cnt'];
            }

            $cpStmt = $pdo->prepare(
                "SELECT scp.student_id, scp.course_id, scp.project_id, scp.custom_title, scp.initial_vision_note,
                        p.title AS project_title
                 FROM pd_student_course_projects scp
                 LEFT JOIN pd_projects p ON p.id = scp.project_id
                 WHERE scp.student_id IN ($in)"
            );
            $cpStmt->execute($ids);
            foreach ($cpStmt->fetchAll() as $cp) {
                $cpMap[(int)$cp['student_id']][(int)$cp['course_id']] = [
                    'project_id' => $cp['project_id'] !== null ? (int)$cp['project_id'] : null,
                    'project_title' => $cp['project_title'],
                    'custom_title' => $cp['custom_title'],
                    'initial_vision_note' => $cp['initial_vision_note'],
                ];
            }
        }

        foreach ($students as &$s) {
            $sid = (int)$s['id'];
            $s['id'] = $sid;
            $s['class_id'] = (int)$s['class_id'];
            $s['project_id'] = $s['project_id'] !== null ? (int)$s['project_id'] : null;
            $s['evaluations'] = $evalMap[$sid] ?? new stdClass();
            $s['question_counts'] = $qCountMap[$sid] ?? new stdClass();
            $s['course_projects'] = $cpMap[$sid] ?? new stdClass();
        }
        pd_json_response($students);
    }

    if ($method === 'POST') {
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $classId = (int)($b['class_id'] ?? 0);
        if ($classId <= 0) {
            pd_json_response(['error' => 'Sınıf seçilmelidir.'], 400);
        }
        pd_assert_can_access($user, $classId);

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
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz öğrenci ID.'], 400);
        }

        $clsStmt = $pdo->prepare('SELECT class_id FROM pd_students WHERE id = ?');
        $clsStmt->execute([$id]);
        $clsId = (int)$clsStmt->fetchColumn();
        if ($clsId > 0) {
            pd_assert_can_access($user, $clsId);
        }

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
        $user = pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz öğrenci ID.'], 400);
        }
        $clsStmt = $pdo->prepare('SELECT class_id FROM pd_students WHERE id = ?');
        $clsStmt->execute([$id]);
        $clsId = (int)$clsStmt->fetchColumn();
        if ($clsId > 0) {
            pd_assert_can_access($user, $clsId);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_students WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

/**
 * Proje Bazlı Opsiyonel Ayrı Ödev / Proje Adı ve Başlangıç Hayali Notu
 */
function pd_handle_student_course_projects(string $method): void {
    if ($method !== 'POST' && $method !== 'PUT') {
        pd_json_response(['error' => 'Yalnızca POST/PUT desteklenir.'], 405);
    }
    $user = pd_require_auth();
    $pdo = pd_db();
    $b = pd_get_json_body();
    $courseId = (int)($b['course_id'] ?? 0);
    if ($courseId <= 0) {
        pd_json_response(['error' => 'Uygulama/ders seçilmelidir.'], 400);
    }

    $upsert = $pdo->prepare(
        'INSERT INTO pd_student_course_projects (student_id, course_id, project_id, custom_title, initial_vision_note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           project_id = VALUES(project_id),
           custom_title = VALUES(custom_title),
           initial_vision_note = VALUES(initial_vision_note)'
    );

    // Tüm sınıfa toplu proje/ödev adı atama
    if (!empty($b['class_id'])) {
        $classId = (int)$b['class_id'];
        pd_assert_can_access($user, $classId, $courseId);
        $projectId = isset($b['project_id']) && (int)$b['project_id'] > 0 ? (int)$b['project_id'] : null;
        $customTitle = trim((string)($b['custom_title'] ?? ''));

        $stStmt = $pdo->prepare('SELECT id FROM pd_students WHERE class_id = ?');
        $stStmt->execute([$classId]);
        $studentIds = array_map(fn($r) => (int)$r['id'], $stStmt->fetchAll());

        $curStmt = $pdo->prepare('SELECT initial_vision_note FROM pd_student_course_projects WHERE student_id = ? AND course_id = ?');
        $pdo->beginTransaction();
        try {
            foreach ($studentIds as $sid) {
                $curStmt->execute([$sid, $courseId]);
                $existingVision = $curStmt->fetchColumn();
                $upsert->execute([
                    $sid,
                    $courseId,
                    $projectId,
                    $customTitle !== '' ? $customTitle : null,
                    $existingVision !== false ? $existingVision : null,
                ]);
            }
            $pdo->commit();
            pd_json_response(['ok' => true, 'updated' => count($studentIds)]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Toplu ödev adı ataması başarısız.'], 500);
        }
    }

    // Tekil öğrenci güncelleme
    $studentId = (int)($b['student_id'] ?? 0);
    if ($studentId <= 0) {
        pd_json_response(['error' => 'Öğrenci seçilmelidir.'], 400);
    }
    $clsStmt = $pdo->prepare('SELECT class_id FROM pd_students WHERE id = ?');
    $clsStmt->execute([$studentId]);
    $clsId = (int)$clsStmt->fetchColumn();
    if ($clsId > 0) {
        pd_assert_can_access($user, $clsId, $courseId);
    }

    $curStmt = $pdo->prepare('SELECT project_id, custom_title, initial_vision_note FROM pd_student_course_projects WHERE student_id = ? AND course_id = ?');
    $curStmt->execute([$studentId, $courseId]);
    $cur = $curStmt->fetch() ?: ['project_id' => null, 'custom_title' => null, 'initial_vision_note' => null];

    $projectId = array_key_exists('project_id', $b)
        ? ($b['project_id'] !== null && (int)$b['project_id'] > 0 ? (int)$b['project_id'] : null)
        : ($cur['project_id'] !== null ? (int)$cur['project_id'] : null);
    $customTitle = array_key_exists('custom_title', $b)
        ? (trim((string)$b['custom_title']) !== '' ? trim((string)$b['custom_title']) : null)
        : $cur['custom_title'];
    $visionNote = array_key_exists('initial_vision_note', $b)
        ? (trim((string)$b['initial_vision_note']) !== '' ? trim((string)$b['initial_vision_note']) : null)
        : $cur['initial_vision_note'];

    $upsert->execute([$studentId, $courseId, $projectId, $customTitle, $visionNote]);
    pd_json_response(['ok' => true]);
}
