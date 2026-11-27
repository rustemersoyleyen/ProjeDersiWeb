<?php
/**
 * Kazanımlar, Rubik Kriterleri, 3 Kategorili Teknik Soru Havuzu ve Akıllı Rastgele 3 Soru Dağıtımı
 */

function pd_handle_criteria(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $courseId = (int)($_GET['course_id'] ?? 0);
        $outcomes = $pdo->query(
            'SELECT id, code, name, description, default_weight, is_question_outcome, sort_order
             FROM pd_outcomes ORDER BY sort_order ASC, id ASC'
        )->fetchAll();
        foreach ($outcomes as &$o) {
            $o['id'] = (int)$o['id'];
            $o['default_weight'] = (int)$o['default_weight'];
            $o['is_question_outcome'] = (int)$o['is_question_outcome'];
            $o['sort_order'] = (int)$o['sort_order'];
        }

        $sql = 'SELECT id, course_id, outcome_id, name, max_score, rubric_levels, sort_order
                FROM pd_criteria';
        $params = [];
        if ($courseId > 0) {
            $sql .= ' WHERE course_id = ?';
            $params[] = $courseId;
        }
        $sql .= ' ORDER BY outcome_id ASC, sort_order ASC, id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $criteria = $stmt->fetchAll();

        foreach ($criteria as &$cr) {
            $cr['id'] = (int)$cr['id'];
            $cr['course_id'] = (int)$cr['course_id'];
            $cr['outcome_id'] = (int)$cr['outcome_id'];
            $cr['max_score'] = (float)$cr['max_score'];
            $cr['sort_order'] = (int)$cr['sort_order'];
            $decoded = json_decode($cr['rubric_levels'], true);
            $cr['rubric_levels'] = is_array($decoded) ? $decoded : [];
        }

        pd_json_response([
            'outcomes' => $outcomes,
            'criteria' => $criteria,
        ]);
    }

    if ($method === 'POST') {
        pd_require_auth();
        $b = pd_get_json_body();
        $courseId = (int)($b['course_id'] ?? 0);
        $outcomeId = (int)($b['outcome_id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $maxScore = (float)($b['max_score'] ?? 10);
        $sortOrder = (int)($b['sort_order'] ?? 10);
        $levels = is_array($b['rubric_levels'] ?? null) ? $b['rubric_levels'] : pd_default_rubric_levels($maxScore);

        if ($courseId <= 0 || $outcomeId <= 0 || $name === '' || $maxScore <= 0) {
            pd_json_response(['error' => 'Ders, kazanım, kriter adı ve pozitif maksimum puan zorunludur.'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_criteria (course_id, outcome_id, name, max_score, rubric_levels, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$courseId, $outcomeId, $name, $maxScore, json_encode($levels, JSON_UNESCAPED_UNICODE), $sortOrder]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $outcomeId = (int)($b['outcome_id'] ?? 0);
        $name = trim((string)($b['name'] ?? ''));
        $maxScore = (float)($b['max_score'] ?? 10);
        $sortOrder = (int)($b['sort_order'] ?? 1);
        $levels = is_array($b['rubric_levels'] ?? null) ? $b['rubric_levels'] : pd_default_rubric_levels($maxScore);

        if ($id <= 0 || $outcomeId <= 0 || $name === '' || $maxScore <= 0) {
            pd_json_response(['error' => 'Geçersiz kriter bilgisi.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE pd_criteria SET outcome_id = ?, name = ?, max_score = ?, rubric_levels = ?, sort_order = ? WHERE id = ?'
        );
        $stmt->execute([$outcomeId, $name, $maxScore, json_encode($levels, JSON_UNESCAPED_UNICODE), $sortOrder, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz kriter ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_criteria WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_default_rubric_levels(float $maxScore): array {
    return [
        ['level' => 1, 'label' => 'Geliştirilmeli', 'description' => 'Temel beklentiler karşılanmamış', 'points' => round($maxScore * 0.25, 1)],
        ['level' => 2, 'label' => 'Orta', 'description' => 'Kısmen karşılanmış, eksikler var', 'points' => round($maxScore * 0.5, 1)],
        ['level' => 3, 'label' => 'İyi', 'description' => 'Beklentiler büyük ölçüde karşılanmış', 'points' => round($maxScore * 0.75, 1)],
        ['level' => 4, 'label' => 'Çok İyi', 'description' => 'Eksiksiz ve örnek düzeyde', 'points' => round($maxScore, 1)],
    ];
}

function pd_valid_question_type(string $val): string {
    return in_array($val, ['technical_easy', 'technical_hard', 'vision_comment'], true)
        ? $val
        : 'technical_easy';
}

function pd_handle_questions(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $courseId = (int)($_GET['course_id'] ?? 0);
        $sql = 'SELECT id, course_id, question_text, difficulty, question_type, expected_hint, created_at FROM pd_questions';
        $params = [];
        if ($courseId > 0) {
            $sql .= ' WHERE course_id = ?';
            $params[] = $courseId;
        }
        $sql .= ' ORDER BY id ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['course_id'] = (int)$r['course_id'];
            $r['question_type'] = $r['question_type'] ?: 'technical_easy';
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        pd_require_auth();
        $b = pd_get_json_body();
        $courseId = (int)($b['course_id'] ?? 0);
        if ($courseId <= 0) {
            pd_json_response(['error' => 'Ders seçilmelidir.'], 400);
        }

        if (isset($b['items']) && is_array($b['items'])) {
            $ins = $pdo->prepare(
                'INSERT INTO pd_questions (course_id, question_text, difficulty, question_type, expected_hint)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $defaultType = pd_valid_question_type((string)($b['question_type'] ?? 'technical_easy'));
            $count = 0;
            foreach ($b['items'] as $item) {
                $text = is_array($item) ? trim((string)($item['question_text'] ?? '')) : trim((string)$item);
                $diff = is_array($item) && in_array($item['difficulty'] ?? '', ['kolay', 'orta', 'zor'], true) ? $item['difficulty'] : 'kolay';
                $qType = is_array($item) && isset($item['question_type'])
                    ? pd_valid_question_type((string)$item['question_type'])
                    : $defaultType;
                $hint = is_array($item) ? trim((string)($item['expected_hint'] ?? '')) : '';
                if ($text !== '') {
                    $ins->execute([$courseId, $text, $diff, $qType, $hint !== '' ? $hint : null]);
                    $count++;
                }
            }
            pd_json_response(['ok' => true, 'inserted' => $count], 201);
        }

        $text = trim((string)($b['question_text'] ?? ''));
        $diff = in_array($b['difficulty'] ?? '', ['kolay', 'orta', 'zor'], true) ? $b['difficulty'] : 'kolay';
        $qType = pd_valid_question_type((string)($b['question_type'] ?? 'technical_easy'));
        $hint = trim((string)($b['expected_hint'] ?? ''));
        if ($text === '') {
            pd_json_response(['error' => 'Soru metni zorunludur.'], 400);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO pd_questions (course_id, question_text, difficulty, question_type, expected_hint)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$courseId, $text, $diff, $qType, $hint !== '' ? $hint : null]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $text = trim((string)($b['question_text'] ?? ''));
        $diff = in_array($b['difficulty'] ?? '', ['kolay', 'orta', 'zor'], true) ? $b['difficulty'] : 'kolay';
        $qType = pd_valid_question_type((string)($b['question_type'] ?? 'technical_easy'));
        $hint = trim((string)($b['expected_hint'] ?? ''));
        if ($id <= 0 || $text === '') {
            pd_json_response(['error' => 'Geçersiz soru bilgisi.'], 400);
        }
        $stmt = $pdo->prepare(
            'UPDATE pd_questions SET question_text = ?, difficulty = ?, question_type = ?, expected_hint = ? WHERE id = ?'
        );
        $stmt->execute([$text, $diff, $qType, $hint !== '' ? $hint : null, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz soru ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_questions WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

/**
 * Akıllı 3 Kategorili Seçim:
 * S1 -> technical_easy | S2 -> technical_hard | S3 -> vision_comment
 * Herhangi bir kova boşsa kalan havuzdan benzersiz olarak tamamlar.
 */
function pd_pick_balanced_three(array $poolRows): array {
    $buckets = [
        'technical_easy' => [],
        'technical_hard' => [],
        'vision_comment' => [],
    ];
    $allIds = [];
    foreach ($poolRows as $r) {
        $qid = (int)$r['id'];
        $allIds[] = $qid;
        $t = $r['question_type'] ?? 'technical_easy';
        if (isset($buckets[$t])) {
            $buckets[$t][] = $qid;
        } else {
            $buckets['technical_easy'][] = $qid;
        }
    }

    $picked = [];
    foreach (['technical_easy', 'technical_hard', 'vision_comment'] as $type) {
        $candidates = array_values(array_diff($buckets[$type], $picked));
        if (!empty($candidates)) {
            $picked[] = $candidates[random_int(0, count($candidates) - 1)];
        }
    }

    // Eksik slot kalırsa genel havuzdan benzersiz tamamla
    while (count($picked) < 3) {
        $remaining = array_values(array_diff($allIds, $picked));
        if (empty($remaining)) {
            break;
        }
        $picked[] = $remaining[random_int(0, count($remaining) - 1)];
    }

    return $picked;
}

function pd_handle_student_questions(string $subAction, string $method): void {
    $pdo = pd_db();
    $user = pd_require_auth();

    if ($subAction === '' && $method === 'GET') {
        $studentId = (int)($_GET['student_id'] ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        if ($studentId <= 0 || $courseId <= 0) {
            pd_json_response(['error' => 'student_id ve course_id zorunludur.'], 400);
        }
        $stmt = $pdo->prepare(
            'SELECT sq.id, sq.student_id, sq.course_id, sq.question_id, sq.sort_order,
                    sq.max_score, sq.score, sq.note, q.question_text, q.difficulty, q.question_type, q.expected_hint
             FROM pd_student_questions sq
             JOIN pd_questions q ON q.id = sq.question_id
             WHERE sq.student_id = ? AND sq.course_id = ?
             ORDER BY sq.sort_order ASC, sq.id ASC'
        );
        $stmt->execute([$studentId, $courseId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['student_id'] = (int)$r['student_id'];
            $r['course_id'] = (int)$r['course_id'];
            $r['question_id'] = (int)$r['question_id'];
            $r['sort_order'] = (int)$r['sort_order'];
            $r['max_score'] = (float)$r['max_score'];
            $r['score'] = $r['score'] !== null ? (float)$r['score'] : null;
        }
        pd_json_response($rows);
    }

    if ($subAction === 'assign-random' && $method === 'POST') {
        $b = pd_get_json_body();
        $courseId = (int)($b['course_id'] ?? 0);
        $classId = (int)($b['class_id'] ?? 0);
        $studentId = (int)($b['student_id'] ?? 0);
        $force = !empty($b['force']);

        if ($courseId <= 0 || ($classId <= 0 && $studentId <= 0)) {
            pd_json_response(['error' => 'Ders ve sınıf (veya öğrenci) seçilmelidir.'], 400);
        }
        if ($classId > 0) {
            pd_assert_can_access($user, $classId, $courseId);
        }

        $cStmt = $pdo->prepare('SELECT question_points FROM pd_courses WHERE id = ?');
        $cStmt->execute([$courseId]);
        $course = $cStmt->fetch();
        if (!$course) {
            pd_json_response(['error' => 'Ders bulunamadı.'], 404);
        }
        $pointsSplit = pd_split_question_points((int)$course['question_points']);

        $qStmt = $pdo->prepare('SELECT id, question_type FROM pd_questions WHERE course_id = ?');
        $qStmt->execute([$courseId]);
        $poolRows = $qStmt->fetchAll();
        if (count($poolRows) < 3) {
            pd_json_response(['error' => 'Rastgele 3 soru atamak için bu dersin havuzunda en az 3 soru olmalıdır.'], 400);
        }

        if ($studentId > 0) {
            $studentIds = [$studentId];
        } else {
            $sStmt = $pdo->prepare('SELECT id FROM pd_students WHERE class_id = ?');
            $sStmt->execute([$classId]);
            $studentIds = array_map(fn($r) => (int)$r['id'], $sStmt->fetchAll());
        }

        $chkStmt = $pdo->prepare('SELECT COUNT(*) FROM pd_student_questions WHERE student_id = ? AND course_id = ?');
        $delStmt = $pdo->prepare('DELETE FROM pd_student_questions WHERE student_id = ? AND course_id = ?');
        $insStmt = $pdo->prepare(
            'INSERT INTO pd_student_questions (student_id, course_id, question_id, sort_order, max_score)
             VALUES (?, ?, ?, ?, ?)'
        );

        $assignedStudents = 0;
        $pdo->beginTransaction();
        try {
            foreach ($studentIds as $sid) {
                $chkStmt->execute([$sid, $courseId]);
                $existing = (int)$chkStmt->fetchColumn();
                if ($existing >= 3 && !$force) {
                    continue;
                }
                $delStmt->execute([$sid, $courseId]);

                $picked = pd_pick_balanced_three($poolRows);
                foreach ($picked as $idx => $qid) {
                    $insStmt->execute([$sid, $courseId, $qid, $idx + 1, $pointsSplit[$idx]]);
                }
                $assignedStudents++;
            }
            $pdo->commit();
            pd_json_response(['ok' => true, 'assigned_students' => $assignedStudents]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Rastgele soru ataması sırasında hata oluştu.'], 500);
        }
    }

    if ($subAction === 'replace' && $method === 'POST') {
        $b = pd_get_json_body();
        $sqId = (int)($b['student_question_id'] ?? 0);
        $newQuestionId = (int)($b['new_question_id'] ?? 0);
        if ($sqId <= 0 || $newQuestionId <= 0) {
            pd_json_response(['error' => 'Geçersiz soru değiştirme isteği.'], 400);
        }
        try {
            $upd = $pdo->prepare('UPDATE pd_student_questions SET question_id = ?, score = NULL WHERE id = ?');
            $upd->execute([$newQuestionId, $sqId]);
            pd_json_response(['ok' => true]);
        } catch (PDOException $e) {
            pd_json_response(['error' => 'Bu soru zaten bu öğrenciye atanmış.'], 409);
        }
    }

    pd_json_response(['error' => 'Geçersiz öğrenci soruları isteği.'], 404);
}
