<?php
/**
 * Rubik Değerlendirme, Çoklu Ders Not Matrisi ve Dikey A4 (2 Öğrenci/Sayfa) Çıktı Verisi
 */

function pd_handle_evaluations(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $studentId = (int)($_GET['student_id'] ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        if ($studentId <= 0 || $courseId <= 0) {
            pd_json_response(['error' => 'student_id ve course_id zorunludur.'], 400);
        }

        // Öğrenci + Proje + Sınıf
        $stStmt = $pdo->prepare(
            'SELECT s.id, s.class_id, s.student_no, s.full_name, s.project_id,
                    p.title AS project_title, c.name AS class_name, c.academic_year, c.school_name
             FROM pd_students s
             JOIN pd_classes c ON c.id = s.class_id
             LEFT JOIN pd_projects p ON p.id = s.project_id
             WHERE s.id = ?'
        );
        $stStmt->execute([$studentId]);
        $student = $stStmt->fetch();
        if (!$student) {
            pd_json_response(['error' => 'Öğrenci bulunamadı.'], 404);
        }
        $student['id'] = (int)$student['id'];
        $student['class_id'] = (int)$student['class_id'];
        $student['project_id'] = $student['project_id'] !== null ? (int)$student['project_id'] : null;

        // Ders
        $coStmt = $pdo->prepare('SELECT id, name, short_code, question_points FROM pd_courses WHERE id = ?');
        $coStmt->execute([$courseId]);
        $course = $coStmt->fetch();
        if (!$course) {
            pd_json_response(['error' => 'Ders bulunamadı.'], 404);
        }
        $course['id'] = (int)$course['id'];
        $course['question_points'] = (int)$course['question_points'];

        // Kriterler
        $crStmt = $pdo->prepare(
            'SELECT id, course_id, outcome_id, name, max_score, rubric_levels, sort_order
             FROM pd_criteria WHERE course_id = ? ORDER BY outcome_id ASC, sort_order ASC, id ASC'
        );
        $crStmt->execute([$courseId]);
        $criteria = $crStmt->fetchAll();
        foreach ($criteria as &$cr) {
            $cr['id'] = (int)$cr['id'];
            $cr['course_id'] = (int)$cr['course_id'];
            $cr['outcome_id'] = (int)$cr['outcome_id'];
            $cr['max_score'] = (float)$cr['max_score'];
            $cr['rubric_levels'] = json_decode($cr['rubric_levels'], true) ?: [];
        }

        // Öğrencinin bu dersteki 3 sorusu
        $sqStmt = $pdo->prepare(
            'SELECT sq.id, sq.question_id, sq.sort_order, sq.max_score, sq.score, sq.note,
                    q.question_text, q.difficulty, q.expected_hint
             FROM pd_student_questions sq
             JOIN pd_questions q ON q.id = sq.question_id
             WHERE sq.student_id = ? AND sq.course_id = ?
             ORDER BY sq.sort_order ASC, sq.id ASC'
        );
        $sqStmt->execute([$studentId, $courseId]);
        $questions = $sqStmt->fetchAll();
        foreach ($questions as &$q) {
            $q['id'] = (int)$q['id'];
            $q['question_id'] = (int)$q['question_id'];
            $q['sort_order'] = (int)$q['sort_order'];
            $q['max_score'] = (float)$q['max_score'];
            $q['score'] = $q['score'] !== null ? (float)$q['score'] : null;
        }

        // Değerlendirme & Kriter Puanları
        $evStmt = $pdo->prepare('SELECT * FROM pd_evaluations WHERE student_id = ? AND course_id = ? LIMIT 1');
        $evStmt->execute([$studentId, $courseId]);
        $evaluation = $evStmt->fetch() ?: null;
        $scores = [];
        if ($evaluation) {
            $evaluation['id'] = (int)$evaluation['id'];
            $evaluation['rubric_total'] = (float)$evaluation['rubric_total'];
            $evaluation['question_total'] = (float)$evaluation['question_total'];
            $evaluation['total_score'] = (float)$evaluation['total_score'];

            $scStmt = $pdo->prepare('SELECT criterion_id, selected_level, score FROM pd_evaluation_scores WHERE evaluation_id = ?');
            $scStmt->execute([$evaluation['id']]);
            foreach ($scStmt->fetchAll() as $sc) {
                $scores[(int)$sc['criterion_id']] = [
                    'selected_level' => $sc['selected_level'] !== null ? (int)$sc['selected_level'] : null,
                    'score' => (float)$sc['score'],
                ];
            }
        }

        // Ders öğretmenleri
        $tStmt = $pdo->prepare(
            'SELECT u.id, u.full_name, u.branch, u.title
             FROM pd_class_course_teachers cct
             JOIN pd_users u ON u.id = cct.teacher_id
             WHERE cct.class_id = ? AND cct.course_id = ?
             ORDER BY cct.sort_order ASC, u.full_name ASC'
        );
        $tStmt->execute([$student['class_id'], $courseId]);
        $teachers = $tStmt->fetchAll();

        pd_json_response([
            'student' => $student,
            'course' => $course,
            'criteria' => $criteria,
            'questions' => $questions,
            'evaluation' => $evaluation,
            'scores' => empty($scores) ? new stdClass() : $scores,
            'teachers' => $teachers,
        ]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        $user = pd_require_auth();
        $b = pd_get_json_body();
        $studentId = (int)($b['student_id'] ?? 0);
        $courseId = (int)($b['course_id'] ?? 0);
        $notes = trim((string)($b['notes'] ?? ''));
        $criteriaScores = is_array($b['criteria_scores'] ?? null) ? $b['criteria_scores'] : [];
        $questionScores = is_array($b['question_scores'] ?? null) ? $b['question_scores'] : [];

        if ($studentId <= 0 || $courseId <= 0) {
            pd_json_response(['error' => 'Öğrenci ve ders seçilmelidir.'], 400);
        }

        $rubricTotal = 0.0;
        foreach ($criteriaScores as $item) {
            $rubricTotal += max(0.0, (float)($item['score'] ?? 0));
        }
        $questionTotal = 0.0;
        foreach ($questionScores as $qItem) {
            if (isset($qItem['score']) && $qItem['score'] !== '' && $qItem['score'] !== null) {
                $questionTotal += max(0.0, (float)$qItem['score']);
            }
        }
        $totalScore = round($rubricTotal + $questionTotal, 2);

        $pdo->beginTransaction();
        try {
            $upsertEval = $pdo->prepare(
                'INSERT INTO pd_evaluations (student_id, course_id, evaluator_id, rubric_total, question_total, total_score, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   evaluator_id = VALUES(evaluator_id),
                   rubric_total = VALUES(rubric_total),
                   question_total = VALUES(question_total),
                   total_score = VALUES(total_score),
                   notes = VALUES(notes)'
            );
            $upsertEval->execute([
                $studentId,
                $courseId,
                $user['id'],
                round($rubricTotal, 2),
                round($questionTotal, 2),
                $totalScore,
                $notes !== '' ? $notes : null,
            ]);

            $evIdStmt = $pdo->prepare('SELECT id FROM pd_evaluations WHERE student_id = ? AND course_id = ?');
            $evIdStmt->execute([$studentId, $courseId]);
            $evaluationId = (int)$evIdStmt->fetchColumn();

            $upsertScore = $pdo->prepare(
                'INSERT INTO pd_evaluation_scores (evaluation_id, criterion_id, selected_level, score)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE selected_level = VALUES(selected_level), score = VALUES(score)'
            );
            foreach ($criteriaScores as $item) {
                $cid = (int)($item['criterion_id'] ?? 0);
                if ($cid <= 0) {
                    continue;
                }
                $level = isset($item['selected_level']) && $item['selected_level'] !== null ? (int)$item['selected_level'] : null;
                $sc = max(0.0, (float)($item['score'] ?? 0));
                $upsertScore->execute([$evaluationId, $cid, $level, $sc]);
            }

            $updQ = $pdo->prepare('UPDATE pd_student_questions SET score = ?, note = ? WHERE id = ? AND student_id = ? AND course_id = ?');
            foreach ($questionScores as $qItem) {
                $sqId = (int)($qItem['id'] ?? 0);
                if ($sqId <= 0) {
                    continue;
                }
                $qScore = (isset($qItem['score']) && $qItem['score'] !== '' && $qItem['score'] !== null) ? max(0.0, (float)$qItem['score']) : null;
                $qNote = isset($qItem['note']) ? trim((string)$qItem['note']) : null;
                $updQ->execute([$qScore, $qNote !== '' ? $qNote : null, $sqId, $studentId, $courseId]);
            }

            $pdo->commit();
            pd_json_response([
                'ok' => true,
                'evaluation_id' => $evaluationId,
                'rubric_total' => round($rubricTotal, 2),
                'question_total' => round($questionTotal, 2),
                'total_score' => $totalScore,
            ]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Değerlendirme kaydedilemedi.'], 500);
        }
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_matrix(string $method): void {
    if ($method !== 'GET') {
        pd_json_response(['error' => 'Yalnızca GET desteklenir.'], 405);
    }
    pd_require_auth();
    $pdo = pd_db();
    $classId = (int)($_GET['class_id'] ?? 0);

    $courses = $pdo->query('SELECT id, name, short_code FROM pd_courses ORDER BY sort_order ASC, id ASC')->fetchAll();
    foreach ($courses as &$c) {
        $c['id'] = (int)$c['id'];
    }

    $stats = [
        'classes' => (int)$pdo->query('SELECT COUNT(*) FROM pd_classes')->fetchColumn(),
        'students' => (int)$pdo->query('SELECT COUNT(*) FROM pd_students')->fetchColumn(),
        'projects' => (int)$pdo->query('SELECT COUNT(*) FROM pd_projects')->fetchColumn(),
        'questions' => (int)$pdo->query('SELECT COUNT(*) FROM pd_questions')->fetchColumn(),
        'evaluations' => (int)$pdo->query('SELECT COUNT(*) FROM pd_evaluations')->fetchColumn(),
        'teachers' => (int)$pdo->query('SELECT COUNT(*) FROM pd_users WHERE is_active = 1')->fetchColumn(),
    ];

    $rows = [];
    if ($classId > 0) {
        $stStmt = $pdo->prepare(
            'SELECT s.id, s.student_no, s.full_name, p.title AS project_title
             FROM pd_students s
             LEFT JOIN pd_projects p ON p.id = s.project_id
             WHERE s.class_id = ?
             ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC'
        );
        $stStmt->execute([$classId]);
        $students = $stStmt->fetchAll();

        $evalMap = [];
        if (!empty($students)) {
            $ids = array_map(fn($r) => (int)$r['id'], $students);
            $in = implode(',', array_fill(0, count($ids), '?'));
            $evStmt = $pdo->prepare("SELECT student_id, course_id, total_score FROM pd_evaluations WHERE student_id IN ($in)");
            $evStmt->execute($ids);
            foreach ($evStmt->fetchAll() as $ev) {
                $evalMap[(int)$ev['student_id']][(int)$ev['course_id']] = (float)$ev['total_score'];
            }
        }

        foreach ($students as $s) {
            $sid = (int)$s['id'];
            $scores = $evalMap[$sid] ?? [];
            $vals = array_values($scores);
            $avg = count($vals) > 0 ? round(array_sum($vals) / count($vals), 2) : null;
            $rows[] = [
                'id' => $sid,
                'student_no' => $s['student_no'],
                'full_name' => $s['full_name'],
                'project_title' => $s['project_title'],
                'scores' => empty($scores) ? new stdClass() : $scores,
                'average' => $avg,
            ];
        }
    }

    pd_json_response([
        'stats' => $stats,
        'courses' => $courses,
        'rows' => $rows,
    ]);
}

function pd_handle_print_data(string $method): void {
    if ($method !== 'GET') {
        pd_json_response(['error' => 'Yalnızca GET desteklenir.'], 405);
    }
    pd_require_auth();
    $pdo = pd_db();
    $classId = (int)($_GET['class_id'] ?? 0);
    $courseId = (int)($_GET['course_id'] ?? 0);

    if ($classId <= 0 || $courseId <= 0) {
        pd_json_response(['error' => 'Sınıf ve ders seçilmelidir.'], 400);
    }

    $clStmt = $pdo->prepare('SELECT id, name, academic_year, school_name FROM pd_classes WHERE id = ?');
    $clStmt->execute([$classId]);
    $classInfo = $clStmt->fetch();
    if (!$classInfo) {
        pd_json_response(['error' => 'Sınıf bulunamadı.'], 404);
    }

    $coStmt = $pdo->prepare('SELECT id, name, short_code, question_points FROM pd_courses WHERE id = ?');
    $coStmt->execute([$courseId]);
    $courseInfo = $coStmt->fetch();
    if (!$courseInfo) {
        pd_json_response(['error' => 'Ders bulunamadı.'], 404);
    }
    $courseInfo['id'] = (int)$courseInfo['id'];
    $courseInfo['question_points'] = (int)$courseInfo['question_points'];

    $settingsRows = $pdo->query('SELECT setting_key, setting_value FROM pd_settings')->fetchAll();
    $settings = [];
    foreach ($settingsRows as $r) {
        $settings[$r['setting_key']] = $r['setting_value'];
    }

    $tStmt = $pdo->prepare(
        'SELECT u.id, u.full_name, u.branch, u.title
         FROM pd_class_course_teachers cct
         JOIN pd_users u ON u.id = cct.teacher_id
         WHERE cct.class_id = ? AND cct.course_id = ?
         ORDER BY cct.sort_order ASC, u.full_name ASC'
    );
    $tStmt->execute([$classId, $courseId]);
    $teachers = $tStmt->fetchAll();

    $outcomes = $pdo->query('SELECT id, code, name, default_weight, is_question_outcome, sort_order FROM pd_outcomes ORDER BY sort_order ASC')->fetchAll();
    foreach ($outcomes as &$o) {
        $o['id'] = (int)$o['id'];
        $o['default_weight'] = (int)$o['default_weight'];
        $o['is_question_outcome'] = (int)$o['is_question_outcome'];
    }

    $crStmt = $pdo->prepare(
        'SELECT id, outcome_id, name, max_score, sort_order FROM pd_criteria WHERE course_id = ? ORDER BY outcome_id ASC, sort_order ASC, id ASC'
    );
    $crStmt->execute([$courseId]);
    $criteria = $crStmt->fetchAll();
    foreach ($criteria as &$cr) {
        $cr['id'] = (int)$cr['id'];
        $cr['outcome_id'] = (int)$cr['outcome_id'];
        $cr['max_score'] = (float)$cr['max_score'];
    }

    $stStmt = $pdo->prepare(
        'SELECT s.id, s.student_no, s.full_name, p.title AS project_title
         FROM pd_students s
         LEFT JOIN pd_projects p ON p.id = s.project_id
         WHERE s.class_id = ?
         ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC'
    );
    $stStmt->execute([$classId]);
    $students = $stStmt->fetchAll();

    $qMap = [];
    $evalMap = [];
    $scoreMap = [];

    if (!empty($students)) {
        $ids = array_map(fn($r) => (int)$r['id'], $students);
        $in = implode(',', array_fill(0, count($ids), '?'));

        $sqStmt = $pdo->prepare(
            "SELECT sq.student_id, sq.sort_order, sq.max_score, sq.score, q.question_text
             FROM pd_student_questions sq
             JOIN pd_questions q ON q.id = sq.question_id
             WHERE sq.course_id = ? AND sq.student_id IN ($in)
             ORDER BY sq.sort_order ASC, sq.id ASC"
        );
        $sqStmt->execute(array_merge([$courseId], $ids));
        foreach ($sqStmt->fetchAll() as $qr) {
            $qMap[(int)$qr['student_id']][] = [
                'sort_order' => (int)$qr['sort_order'],
                'question_text' => $qr['question_text'],
                'max_score' => (float)$qr['max_score'],
                'score' => $qr['score'] !== null ? (float)$qr['score'] : null,
            ];
        }

        $evStmt = $pdo->prepare(
            "SELECT id, student_id, rubric_total, question_total, total_score, notes
             FROM pd_evaluations WHERE course_id = ? AND student_id IN ($in)"
        );
        $evStmt->execute(array_merge([$courseId], $ids));
        $evalIds = [];
        $evalIdToStudent = [];
        foreach ($evStmt->fetchAll() as $ev) {
            $sid = (int)$ev['student_id'];
            $eid = (int)$ev['id'];
            $evalIds[] = $eid;
            $evalIdToStudent[$eid] = $sid;
            $evalMap[$sid] = [
                'rubric_total' => (float)$ev['rubric_total'],
                'question_total' => (float)$ev['question_total'],
                'total_score' => (float)$ev['total_score'],
                'notes' => $ev['notes'],
            ];
        }

        if (!empty($evalIds)) {
            $evIn = implode(',', array_fill(0, count($evalIds), '?'));
            $scStmt = $pdo->prepare("SELECT evaluation_id, criterion_id, selected_level, score FROM pd_evaluation_scores WHERE evaluation_id IN ($evIn)");
            $scStmt->execute($evalIds);
            foreach ($scStmt->fetchAll() as $sc) {
                $sid = $evalIdToStudent[(int)$sc['evaluation_id']];
                $scoreMap[$sid][(int)$sc['criterion_id']] = (float)$sc['score'];
            }
        }
    }

    foreach ($students as &$s) {
        $sid = (int)$s['id'];
        $s['id'] = $sid;
        $s['questions'] = $qMap[$sid] ?? [];
        $s['evaluation'] = $evalMap[$sid] ?? null;
        $s['criterion_scores'] = isset($scoreMap[$sid]) ? $scoreMap[$sid] : new stdClass();
    }

    pd_json_response([
        'class_info' => $classInfo,
        'course' => $courseInfo,
        'settings' => $settings,
        'teachers' => $teachers,
        'outcomes' => $outcomes,
        'criteria' => $criteria,
        'students' => $students,
    ]);
}
