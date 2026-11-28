<?php
/**
 * Haftalık Çalışma Görevleri (pd_weekly_tasks) ve Haftalık Kontrol Puanları (pd_student_weekly_scores)
 */

function pd_handle_weekly_tasks(string $method): void {
    $pdo = pd_db();

    if ($method === 'GET') {
        pd_require_auth();
        $courseId = (int)($_GET['course_id'] ?? 0);
        if ($courseId <= 0) {
            pd_json_response(['error' => 'course_id zorunludur.'], 400);
        }
        $stmt = $pdo->prepare(
            'SELECT wt.id, wt.course_id, wt.outcome_id, o.code AS outcome_code, o.name AS outcome_name,
                    wt.week_no, wt.title, wt.description, wt.max_score, wt.due_date, wt.sort_order
             FROM pd_weekly_tasks wt
             LEFT JOIN pd_outcomes o ON o.id = wt.outcome_id
             WHERE wt.course_id = ?
             ORDER BY wt.week_no ASC, wt.sort_order ASC, wt.id ASC'
        );
        $stmt->execute([$courseId]);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['id'] = (int)$r['id'];
            $r['course_id'] = (int)$r['course_id'];
            $r['outcome_id'] = $r['outcome_id'] !== null ? (int)$r['outcome_id'] : null;
            $r['week_no'] = (int)$r['week_no'];
            $r['max_score'] = (float)$r['max_score'];
            $r['sort_order'] = (int)$r['sort_order'];
        }
        pd_json_response($rows);
    }

    if ($method === 'POST') {
        pd_require_auth();
        $b = pd_get_json_body();
        $courseId = (int)($b['course_id'] ?? 0);
        if ($courseId <= 0) {
            pd_json_response(['error' => 'Proje/uygulama seçilmelidir.'], 400);
        }

        // Toplu haftalık plan yükleme
        if (isset($b['items']) && is_array($b['items'])) {
            $ins = $pdo->prepare(
                'INSERT INTO pd_weekly_tasks (course_id, outcome_id, week_no, title, description, max_score, due_date, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $count = 0;
            foreach ($b['items'] as $idx => $item) {
                $title = trim((string)($item['title'] ?? ''));
                if ($title === '') {
                    continue;
                }
                $outcomeId = isset($item['outcome_id']) && (int)$item['outcome_id'] > 0 ? (int)$item['outcome_id'] : null;
                $weekNo = max(1, (int)($item['week_no'] ?? ($idx + 1)));
                $desc = trim((string)($item['description'] ?? ''));
                $maxScore = max(0.5, (float)($item['max_score'] ?? 10));
                $dueDate = trim((string)($item['due_date'] ?? ''));
                $ins->execute([$courseId, $outcomeId, $weekNo, $title, $desc !== '' ? $desc : null, $maxScore, $dueDate !== '' ? $dueDate : null, $idx + 1]);
                $count++;
            }
            pd_json_response(['ok' => true, 'inserted' => $count], 201);
        }

        $outcomeId = isset($b['outcome_id']) && (int)$b['outcome_id'] > 0 ? (int)$b['outcome_id'] : null;
        $weekNo = max(1, (int)($b['week_no'] ?? 1));
        $title = trim((string)($b['title'] ?? ''));
        $desc = trim((string)($b['description'] ?? ''));
        $maxScore = max(0.5, (float)($b['max_score'] ?? 10));
        $dueDate = trim((string)($b['due_date'] ?? ''));
        $sortOrder = (int)($b['sort_order'] ?? $weekNo);

        if ($title === '') {
            pd_json_response(['error' => 'Haftalık görev başlığı zorunludur.'], 400);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pd_weekly_tasks (course_id, outcome_id, week_no, title, description, max_score, due_date, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$courseId, $outcomeId, $weekNo, $title, $desc !== '' ? $desc : null, $maxScore, $dueDate !== '' ? $dueDate : null, $sortOrder]);
        pd_json_response(['ok' => true, 'id' => (int)$pdo->lastInsertId()], 201);
    }

    if ($method === 'PUT') {
        pd_require_auth();
        $b = pd_get_json_body();
        $id = (int)($b['id'] ?? 0);
        $outcomeId = isset($b['outcome_id']) && (int)$b['outcome_id'] > 0 ? (int)$b['outcome_id'] : null;
        $weekNo = max(1, (int)($b['week_no'] ?? 1));
        $title = trim((string)($b['title'] ?? ''));
        $desc = trim((string)($b['description'] ?? ''));
        $maxScore = max(0.5, (float)($b['max_score'] ?? 10));
        $dueDate = trim((string)($b['due_date'] ?? ''));
        $sortOrder = (int)($b['sort_order'] ?? $weekNo);

        if ($id <= 0 || $title === '') {
            pd_json_response(['error' => 'Geçersiz görev bilgisi.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE pd_weekly_tasks SET outcome_id = ?, week_no = ?, title = ?, description = ?, max_score = ?, due_date = ?, sort_order = ? WHERE id = ?'
        );
        $stmt->execute([$outcomeId, $weekNo, $title, $desc !== '' ? $desc : null, $maxScore, $dueDate !== '' ? $dueDate : null, $sortOrder, $id]);
        pd_json_response(['ok' => true]);
    }

    if ($method === 'DELETE') {
        pd_require_auth();
        $id = (int)($_GET['id'] ?? (pd_get_json_body()['id'] ?? 0));
        if ($id <= 0) {
            pd_json_response(['error' => 'Geçersiz görev ID.'], 400);
        }
        $stmt = $pdo->prepare('DELETE FROM pd_weekly_tasks WHERE id = ?');
        $stmt->execute([$id]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}

function pd_handle_weekly_scores(string $method): void {
    $pdo = pd_db();
    $user = pd_require_auth();

    if ($method === 'GET') {
        $classId = (int)($_GET['class_id'] ?? 0);
        $courseId = (int)($_GET['course_id'] ?? 0);
        if ($classId <= 0 || $courseId <= 0) {
            pd_json_response(['error' => 'class_id ve course_id zorunludur.'], 400);
        }
        pd_assert_can_access($user, $classId, $courseId);

        $tStmt = $pdo->prepare(
            'SELECT wt.id, wt.course_id, wt.outcome_id, o.code AS outcome_code, o.name AS outcome_name,
                    wt.week_no, wt.title, wt.description, wt.max_score, wt.due_date, wt.sort_order
             FROM pd_weekly_tasks wt
             LEFT JOIN pd_outcomes o ON o.id = wt.outcome_id
             WHERE wt.course_id = ?
             ORDER BY wt.week_no ASC, wt.sort_order ASC, wt.id ASC'
        );
        $tStmt->execute([$courseId]);
        $tasks = $tStmt->fetchAll();
        foreach ($tasks as &$t) {
            $t['id'] = (int)$t['id'];
            $t['course_id'] = (int)$t['course_id'];
            $t['outcome_id'] = $t['outcome_id'] !== null ? (int)$t['outcome_id'] : null;
            $t['week_no'] = (int)$t['week_no'];
            $t['max_score'] = (float)$t['max_score'];
        }

        $sStmt = $pdo->prepare(
            'SELECT s.id, s.student_no, s.full_name,
                    COALESCE(NULLIF(scp.custom_title, ""), p_over.title, p_base.title) AS project_title
             FROM pd_students s
             LEFT JOIN pd_projects p_base ON p_base.id = s.project_id
             LEFT JOIN pd_student_course_projects scp ON scp.student_id = s.id AND scp.course_id = ?
             LEFT JOIN pd_projects p_over ON p_over.id = scp.project_id
             WHERE s.class_id = ?
             ORDER BY CAST(s.student_no AS UNSIGNED) ASC, s.student_no ASC, s.full_name ASC'
        );
        $sStmt->execute([$courseId, $classId]);
        $students = $sStmt->fetchAll();

        $scoresMap = [];
        $totalsMap = [];
        if (!empty($students) && !empty($tasks)) {
            $sIds = array_map(fn($r) => (int)$r['id'], $students);
            $tIds = array_map(fn($r) => (int)$r['id'], $tasks);
            $sIn = implode(',', array_fill(0, count($sIds), '?'));
            $tIn = implode(',', array_fill(0, count($tIds), '?'));

            $scStmt = $pdo->prepare(
                "SELECT student_id, weekly_task_id, status, score, note
                 FROM pd_student_weekly_scores
                 WHERE student_id IN ($sIn) AND weekly_task_id IN ($tIn)"
            );
            $scStmt->execute(array_merge($sIds, $tIds));
            foreach ($scStmt->fetchAll() as $row) {
                $sid = (int)$row['student_id'];
                $tid = (int)$row['weekly_task_id'];
                $sc = (float)$row['score'];
                $scoresMap[$sid][$tid] = [
                    'status' => $row['status'],
                    'score' => $sc,
                    'note' => $row['note'],
                ];
                $totalsMap[$sid] = round(($totalsMap[$sid] ?? 0.0) + $sc, 2);
            }
        }

        foreach ($students as &$st) {
            $sid = (int)$st['id'];
            $st['id'] = $sid;
            $st['weekly_scores'] = isset($scoresMap[$sid]) ? $scoresMap[$sid] : new stdClass();
            $st['weekly_total'] = $totalsMap[$sid] ?? 0.0;
        }

        pd_json_response([
            'tasks' => $tasks,
            'students' => $students,
        ]);
    }

    if ($method === 'POST' || $method === 'PUT') {
        $b = pd_get_json_body();
        $courseId = (int)($b['course_id'] ?? 0);
        $items = isset($b['items']) && is_array($b['items']) ? $b['items'] : [$b];

        $upsert = $pdo->prepare(
            'INSERT INTO pd_student_weekly_scores (student_id, weekly_task_id, status, score, note, checked_by)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               status = VALUES(status),
               score = VALUES(score),
               note = VALUES(note),
               checked_by = VALUES(checked_by)'
        );

        $touchedStudents = [];
        $pdo->beginTransaction();
        try {
            foreach ($items as $item) {
                $sid = (int)($item['student_id'] ?? 0);
                $tid = (int)($item['weekly_task_id'] ?? 0);
                if ($sid <= 0 || $tid <= 0) {
                    continue;
                }
                $status = in_array($item['status'] ?? '', ['done', 'partial', 'missing'], true) ? $item['status'] : 'missing';
                $score = max(0.0, (float)($item['score'] ?? 0));
                $note = trim((string)($item['note'] ?? ''));
                $upsert->execute([$sid, $tid, $status, $score, $note !== '' ? $note : null, $user['id']]);
                $touchedStudents[$sid] = true;
            }

            // Eğer proje weekly_plus_final modundaysa mevcut değerlendirme satırının weekly_total & total_score'unu tazele
            if ($courseId > 0 && !empty($touchedStudents)) {
                $mStmt = $pdo->prepare('SELECT evaluation_mode FROM pd_courses WHERE id = ?');
                $mStmt->execute([$courseId]);
                $mode = (string)$mStmt->fetchColumn();
                if ($mode === 'weekly_plus_final') {
                    $sumStmt = $pdo->prepare(
                        'SELECT COALESCE(SUM(sws.score), 0)
                         FROM pd_student_weekly_scores sws
                         JOIN pd_weekly_tasks wt ON wt.id = sws.weekly_task_id
                         WHERE sws.student_id = ? AND wt.course_id = ?'
                    );
                    $evUpd = $pdo->prepare(
                        'UPDATE pd_evaluations
                         SET weekly_total = ?,
                             total_score = ROUND(? + COALESCE(final_completion_score, 0) + COALESCE(final_report_score, 0) + question_total, 2)
                         WHERE student_id = ? AND course_id = ?'
                    );
                    foreach (array_keys($touchedStudents) as $sid) {
                        $sumStmt->execute([$sid, $courseId]);
                        $wSum = round((float)$sumStmt->fetchColumn(), 2);
                        $evUpd->execute([$wSum, $wSum, $sid, $courseId]);
                    }
                }
            }

            $pdo->commit();
            pd_json_response(['ok' => true, 'saved' => count($touchedStudents)]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            pd_json_response(['error' => 'Haftalık puanlar kaydedilemedi.'], 500);
        }
    }

    pd_json_response(['error' => 'Desteklenmeyen yöntem.'], 405);
}
