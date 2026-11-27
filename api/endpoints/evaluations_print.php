<?php
/**
 * Çok Modlu Değerlendirme (Standart Rubik / Haftalık + Final / Uygulama Ödevi),
 * Çoklu Ders Not Matrisi ve Dikey A4 (2 Öğrenci/Sayfa) Çıktı Verisi
 */

function pd_handle_evaluations(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        $user = pd_require_auth();
        $studentId = (int)($_GET['student_id'] ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        if ($studentId <= 0 || $courseId <= 0) {
            pd_json_response(['error' => 'student_id ve course_id zorunludur.'], 400);
        }

        // Öğrenci + Ana Proje + Proje Bazlı Özel Ödev & Başlangıç Hayali
        $stStmt = $pdo->prepare(
            'SELECT s.id, s.class_id, s.student_no, s.full_name, s.project_id,
                    p.title AS base_project_title,
                    scp.project_id AS override_project_id,
                    p_over.title AS override_project_title,
                    scp.custom_title AS override_custom_title,
                    scp.initial_vision_note,
                    c.name AS class_name, c.academic_year, c.school_name
             FROM pd_students s
             JOIN pd_classes c ON c.id = s.class_id
             LEFT JOIN pd_projects p ON p.id = s.project_id
             LEFT JOIN pd_student_course_projects scp ON scp.student_id = s.id AND scp.course_id = ?
             LEFT JOIN pd_projects p_over ON p_over.id = scp.project_id
             WHERE s.id = ?'
        );
        $stStmt->execute([$courseId, $studentId]);
        $student = $stStmt->fetch();
        if (!$student) {
            pd_json_response(['error' => 'Öğrenci bulunamadı.'], 404);
        }
        $student['id'] = (int)$student['id'];
        $student['class_id'] = (int)$student['class_id'];
        $student['project_id'] = $student['project_id'] !== null ? (int)$student['project_id'] : null;
        pd_assert_can_access($user, $student['class_id'], $courseId);

        $effectiveTitle = trim((string)($student['override_custom_title'] ?? '')) !== ''
            ? $student['override_custom_title']
            : ($student['override_project_title'] ?: $student['base_project_title']);
        $student['project_title'] = $effectiveTitle ?: null;

        // Ders bilgisi
        $coStmt = $pdo->prepare(
            'SELECT c.id, c.subject_id, s.name AS subject_name, s.model_type,
                    c.name, c.short_code, c.question_points, c.evaluation_mode,
                    c.final_completion_points, c.final_report_points
             FROM pd_courses c
             LEFT JOIN pd_subjects s ON s.id = c.subject_id
             WHERE c.id = ?'
        );
        $coStmt->execute([$courseId]);
        $course = $coStmt->fetch();
        if (!$course) {
            pd_json_response(['error' => 'Ders bulunamadı.'], 404);
        }
        $course['id'] = (int)$course['id'];
        $course['subject_id'] = (int)$course['subject_id'];
        $course['question_points'] = (int)$course['question_points'];
        $course['final_completion_points'] = (int)$course['final_completion_points'];
        $course['final_report_points'] = (int)$course['final_report_points'];

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

        // Haftalık görevler + öğrencinin haftalık puanları
        $wtStmt = $pdo->prepare(
            'SELECT wt.id, wt.week_no, wt.title, wt.description, wt.max_score, wt.due_date,
                    sws.status, sws.score, sws.note
             FROM pd_weekly_tasks wt
             LEFT JOIN pd_student_weekly_scores sws ON sws.weekly_task_id = wt.id AND sws.student_id = ?
             WHERE wt.course_id = ?
             ORDER BY wt.week_no ASC, wt.sort_order ASC, wt.id ASC'
        );
        $wtStmt->execute([$studentId, $courseId]);
        $weeklyItems = $wtStmt->fetchAll();
        $weeklySum = 0.0;
        $weeklyMax = 0.0;
        foreach ($weeklyItems as &$wi) {
            $wi['id'] = (int)$wi['id'];
            $wi['week_no'] = (int)$wi['week_no'];
            $wi['max_score'] = (float)$wi['max_score'];
            $wi['score'] = $wi['score'] !== null ? (float)$wi['score'] : 0.0;
            $wi['status'] = $wi['status'] ?: 'missing';
            $weeklySum += $wi['score'];
            $weeklyMax += $wi['max_score'];
        }

        // Öğrencinin bu dersteki 3 sorusu
        $sqStmt = $pdo->prepare(
            'SELECT sq.id, sq.question_id, sq.sort_order, sq.max_score, sq.score, sq.note,
                    q.question_text, q.difficulty, q.question_type, q.expected_hint
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
            $q['question_type'] = $q['question_type'] ?: 'technical_easy';
        }

        // Değerlendirme & Kriter Puanları
        $evStmt = $pdo->prepare('SELECT * FROM pd_evaluations WHERE student_id = ? AND course_id = ? LIMIT 1');
        $evStmt->execute([$studentId, $courseId]);
        $evaluation = $evStmt->fetch() ?: null;
        $scores = [];
        if ($evaluation) {
            $evaluation['id'] = (int)$evaluation['id'];
            $evaluation['rubric_total'] = (float)$evaluation['rubric_total'];
            $evaluation['weekly_total'] = (float)$evaluation['weekly_total'];
            $evaluation['final_completion_score'] = $evaluation['final_completion_score'] !== null ? (float)$evaluation['final_completion_score'] : null;
            $evaluation['final_report_score'] = $evaluation['final_report_score'] !== null ? (float)$evaluation['final_report_score'] : null;
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
            'weekly_items' => $weeklyItems,
            'weekly_summary' => [
                'earned' => round($weeklySum, 2),
                'max' => round($weeklyMax, 2),
            ],
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

        $clsStmt = $pdo->prepare('SELECT class_id FROM pd_students WHERE id = ?');
        $clsStmt->execute([$studentId]);
        $classId = (int)$clsStmt->fetchColumn();
        if ($classId > 0) {
            pd_assert_can_access($user, $classId, $courseId);
        }

        $coStmt = $pdo->prepare('SELECT evaluation_mode FROM pd_courses WHERE id = ?');
        $coStmt->execute([$courseId]);
        $evalMode = (string)$coStmt->fetchColumn() ?: 'rubric_full';

        $questionTotal = 0.0;
        foreach ($questionScores as $qItem) {
            if (isset($qItem['score']) && $qItem['score'] !== '' && $qItem['score'] !== null) {
                $questionTotal += max(0.0, (float)$qItem['score']);
            }
        }

        $rubricTotal = 0.0;
        $weeklyTotal = 0.0;
        $finalCompletion = null;
        $finalReport = null;

        if ($evalMode === 'weekly_plus_final') {
            $wSumStmt = $pdo->prepare(
                'SELECT COALESCE(SUM(sws.score), 0)
                 FROM pd_student_weekly_scores sws
                 JOIN pd_weekly_tasks wt ON wt.id = sws.weekly_task_id
                 WHERE sws.student_id = ? AND wt.course_id = ?'
            );
            $wSumStmt->execute([$studentId, $courseId]);
            $weeklyTotal = round((float)$wSumStmt->fetchColumn(), 2);

            $finalCompletion = isset($b['final_completion_score']) && $b['final_completion_score'] !== '' && $b['final_completion_score'] !== null
                ? max(0.0, (float)$b['final_completion_score'])
                : 0.0;
            $finalReport = isset($b['final_report_score']) && $b['final_report_score'] !== '' && $b['final_report_score'] !== null
                ? max(0.0, (float)$b['final_report_score'])
                : 0.0;
            $rubricTotal = round($finalCompletion + $finalReport, 2);
            $totalScore = round($weeklyTotal + $finalCompletion + $finalReport + $questionTotal, 2);
        } else {
            foreach ($criteriaScores as $item) {
                $rubricTotal += max(0.0, (float)($item['score'] ?? 0));
            }
            $totalScore = round($rubricTotal + $questionTotal, 2);
        }

        $pdo->beginTransaction();
        try {
            $upsertEval = $pdo->prepare(
                'INSERT INTO pd_evaluations
                   (student_id, course_id, evaluator_id, rubric_total, weekly_total, final_completion_score, final_report_score, question_total, total_score, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   evaluator_id = VALUES(evaluator_id),
                   rubric_total = VALUES(rubric_total),
                   weekly_total = VALUES(weekly_total),
                   final_completion_score = VALUES(final_completion_score),
                   final_report_score = VALUES(final_report_score),
                   question_total = VALUES(question_total),
                   total_score = VALUES(total_score),
                   notes = VALUES(notes)'
            );
            $upsertEval->execute([
                $studentId,
                $courseId,
                $user['id'],
                round($rubricTotal, 2),
                $weeklyTotal,
                $finalCompletion,
                $finalReport,
                round($questionTotal, 2),
                $totalScore,
                $notes !== '' ? $notes : null,
            ]);

            $evIdStmt = $pdo->prepare('SELECT id FROM pd_evaluations WHERE student_id = ? AND course_id = ?');
            $evIdStmt->execute([$studentId, $courseId]);
            $evaluationId = (int)$evIdStmt->fetchColumn();

            if ($evalMode !== 'weekly_plus_final') {
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

            // İsteğe bağlı başlangıç hayali notu değerlendirme ekranından da kaydedilebilir
            if (array_key_exists('initial_vision_note', $b)) {
                $vision = trim((string)$b['initial_vision_note']);
                $vStmt = $pdo->prepare(
                    'INSERT INTO pd_student_course_projects (student_id, course_id, initial_vision_note)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE initial_vision_note = VALUES(initial_vision_note)'
                );
                $vStmt->execute([$studentId, $courseId, $vision !== '' ? $vision : null]);
            }

            $pdo->commit();
            pd_json_response([
                'ok' => true,
                'evaluation_id' => $evaluationId,
                'rubric_total' => round($rubricTotal, 2),
                'weekly_total' => $weeklyTotal,
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
    $user = pd_require_auth();
    $pdo = pd_db();
    $classId = (int)($_GET['class_id'] ?? 0);
    $subjectId = (int)($_GET['subject_id'] ?? 0);

    if ($classId > 0) {
        pd_assert_can_access($user, $classId);
    }

    $allowedClassIds = pd_allowed_class_ids($user);
    $allowedCourseIds = pd_allowed_course_ids($user, $classId > 0 ? $classId : null);

    // Ders listesi (sınıf + ana ders + öğretmen kapsamına göre)
    if ($allowedCourseIds !== null && empty($allowedCourseIds)) {
        $courses = [];
    } else {
        $cWhere = [];
        $cParams = [];
        if ($subjectId > 0) {
            $cWhere[] = 'subject_id = ?';
            $cParams[] = $subjectId;
        }
        if ($allowedCourseIds !== null) {
            $in = implode(',', array_fill(0, count($allowedCourseIds), '?'));
            $cWhere[] = "id IN ($in)";
            $cParams = array_merge($cParams, $allowedCourseIds);
        }
        $cSql = 'SELECT id, subject_id, name, short_code, evaluation_mode FROM pd_courses';
        if (!empty($cWhere)) {
            $cSql .= ' WHERE ' . implode(' AND ', $cWhere);
        }
        $cSql .= ' ORDER BY subject_id ASC, sort_order ASC, id ASC';
        $cStmt = $pdo->prepare($cSql);
        $cStmt->execute($cParams);
        $courses = $cStmt->fetchAll();
        foreach ($courses as &$c) {
            $c['id'] = (int)$c['id'];
            $c['subject_id'] = (int)$c['subject_id'];
        }
    }

    // İstatistikler (öğretmen için kendi kapsamı, admin için tümü)
    if ($allowedClassIds === null) {
        $stats = [
            'classes' => (int)$pdo->query('SELECT COUNT(*) FROM pd_classes')->fetchColumn(),
            'students' => (int)$pdo->query('SELECT COUNT(*) FROM pd_students')->fetchColumn(),
            'projects' => (int)$pdo->query('SELECT COUNT(*) FROM pd_projects')->fetchColumn(),
            'questions' => (int)$pdo->query('SELECT COUNT(*) FROM pd_questions')->fetchColumn(),
            'evaluations' => (int)$pdo->query('SELECT COUNT(*) FROM pd_evaluations')->fetchColumn(),
            'teachers' => (int)$pdo->query('SELECT COUNT(*) FROM pd_users WHERE is_active = 1')->fetchColumn(),
        ];
    } else {
        $stCount = 0;
        $evCount = 0;
        if (!empty($allowedClassIds)) {
            $in = implode(',', array_fill(0, count($allowedClassIds), '?'));
            $stC = $pdo->prepare("SELECT COUNT(*) FROM pd_students WHERE class_id IN ($in)");
            $stC->execute($allowedClassIds);
            $stCount = (int)$stC->fetchColumn();

            $evC = $pdo->prepare(
                "SELECT COUNT(*) FROM pd_evaluations e
                 JOIN pd_students s ON s.id = e.student_id
                 WHERE s.class_id IN ($in)"
            );
            $evC->execute($allowedClassIds);
            $evCount = (int)$evC->fetchColumn();
        }
        $stats = [
            'classes' => count($allowedClassIds),
            'students' => $stCount,
            'projects' => (int)$pdo->query('SELECT COUNT(*) FROM pd_projects')->fetchColumn(),
            'questions' => (int)$pdo->query('SELECT COUNT(*) FROM pd_questions')->fetchColumn(),
            'evaluations' => $evCount,
            'teachers' => (int)$pdo->query('SELECT COUNT(*) FROM pd_users WHERE is_active = 1')->fetchColumn(),
        ];
    }

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
        $visibleCourseIds = array_map(fn($c) => $c['id'], $courses);
        if (!empty($students) && !empty($visibleCourseIds)) {
            $ids = array_map(fn($r) => (int)$r['id'], $students);
            $in = implode(',', array_fill(0, count($ids), '?'));
            $cIn = implode(',', array_fill(0, count($visibleCourseIds), '?'));
            $evStmt = $pdo->prepare(
                "SELECT student_id, course_id, total_score
                 FROM pd_evaluations WHERE student_id IN ($in) AND course_id IN ($cIn)"
            );
            $evStmt->execute(array_merge($ids, $visibleCourseIds));
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
    $user = pd_require_auth();
    $pdo = pd_db();
    $classId = (int)($_GET['class_id'] ?? 0);
    $courseId = (int)($_GET['course_id'] ?? 0);

    if ($classId <= 0 || $courseId <= 0) {
        pd_json_response(['error' => 'Sınıf ve ders seçilmelidir.'], 400);
    }
    pd_assert_can_access($user, $classId, $courseId);

    $clStmt = $pdo->prepare('SELECT id, name, academic_year, school_name FROM pd_classes WHERE id = ?');
    $clStmt->execute([$classId]);
    $classInfo = $clStmt->fetch();
    if (!$classInfo) {
        pd_json_response(['error' => 'Sınıf bulunamadı.'], 404);
    }

    $coStmt = $pdo->prepare(
        'SELECT c.id, c.subject_id, s.name AS subject_name, s.model_type,
                c.name, c.short_code, c.question_points, c.evaluation_mode,
                c.final_completion_points, c.final_report_points
         FROM pd_courses c
         LEFT JOIN pd_subjects s ON s.id = c.subject_id
         WHERE c.id = ?'
    );
    $coStmt->execute([$courseId]);
    $courseInfo = $coStmt->fetch();
    if (!$courseInfo) {
        pd_json_response(['error' => 'Ders bulunamadı.'], 404);
    }
    $courseInfo['id'] = (int)$courseInfo['id'];
    $courseInfo['subject_id'] = (int)$courseInfo['subject_id'];
    $courseInfo['question_points'] = (int)$courseInfo['question_points'];
    $courseInfo['final_completion_points'] = (int)$courseInfo['final_completion_points'];
    $courseInfo['final_report_points'] = (int)$courseInfo['final_report_points'];

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

    $wtStmt = $pdo->prepare(
        'SELECT id, week_no, title, max_score FROM pd_weekly_tasks WHERE course_id = ? ORDER BY week_no ASC, sort_order ASC, id ASC'
    );
    $wtStmt->execute([$courseId]);
    $weeklyTasks = $wtStmt->fetchAll();
    foreach ($weeklyTasks as &$wt) {
        $wt['id'] = (int)$wt['id'];
        $wt['week_no'] = (int)$wt['week_no'];
        $wt['max_score'] = (float)$wt['max_score'];
    }

    $stStmt = $pdo->prepare(
        'SELECT s.id, s.student_no, s.full_name,
                COALESCE(NULLIF(scp.custom_title, ""), p_over.title, p_base.title) AS project_title,
                scp.initial_vision_note
         FROM pd_students s
         LEFT JOIN pd_projects p_base ON p_base.id = s.project_id
         LEFT JOIN pd_student_course_projects scp ON scp.student_id = s.id AND scp.course_id = ?
         LEFT JOIN pd_projects p_over ON p_over.id = scp.project_id
         WHERE s.class_id = ?
         ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC'
    );
    $stStmt->execute([$courseId, $classId]);
    $students = $stStmt->fetchAll();

    $qMap = [];
    $evalMap = [];
    $scoreMap = [];
    $weeklyScoreMap = [];

    if (!empty($students)) {
        $ids = array_map(fn($r) => (int)$r['id'], $students);
        $in = implode(',', array_fill(0, count($ids), '?'));

        $sqStmt = $pdo->prepare(
            "SELECT sq.student_id, sq.sort_order, sq.max_score, sq.score, q.question_text, q.question_type
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
                'question_type' => $qr['question_type'] ?: 'technical_easy',
                'max_score' => (float)$qr['max_score'],
                'score' => $qr['score'] !== null ? (float)$qr['score'] : null,
            ];
        }

        if (!empty($weeklyTasks)) {
            $tIds = array_map(fn($w) => $w['id'], $weeklyTasks);
            $tIn = implode(',', array_fill(0, count($tIds), '?'));
            $wsStmt = $pdo->prepare(
                "SELECT student_id, weekly_task_id, status, score
                 FROM pd_student_weekly_scores
                 WHERE student_id IN ($in) AND weekly_task_id IN ($tIn)"
            );
            $wsStmt->execute(array_merge($ids, $tIds));
            foreach ($wsStmt->fetchAll() as $ws) {
                $weeklyScoreMap[(int)$ws['student_id']][(int)$ws['weekly_task_id']] = [
                    'status' => $ws['status'],
                    'score' => (float)$ws['score'],
                ];
            }
        }

        $evStmt = $pdo->prepare(
            "SELECT id, student_id, rubric_total, weekly_total, final_completion_score, final_report_score, question_total, total_score, notes
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
                'weekly_total' => (float)$ev['weekly_total'],
                'final_completion_score' => $ev['final_completion_score'] !== null ? (float)$ev['final_completion_score'] : null,
                'final_report_score' => $ev['final_report_score'] !== null ? (float)$ev['final_report_score'] : null,
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
        $s['weekly_scores'] = isset($weeklyScoreMap[$sid]) ? $weeklyScoreMap[$sid] : new stdClass();
        $wTotal = 0.0;
        if (isset($weeklyScoreMap[$sid])) {
            foreach ($weeklyScoreMap[$sid] as $ws) {
                $wTotal += $ws['score'];
            }
        }
        $s['weekly_total'] = round($wTotal, 2);
    }

    pd_json_response([
        'class_info' => $classInfo,
        'course' => $courseInfo,
        'settings' => $settings,
        'teachers' => $teachers,
        'outcomes' => $outcomes,
        'criteria' => $criteria,
        'weekly_tasks' => $weeklyTasks,
        'students' => $students,
    ]);
}
