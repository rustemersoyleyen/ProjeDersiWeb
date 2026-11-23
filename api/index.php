<?php
/**
 * Proje Değerlendirme ve Rubik Sistemi - Tek Giriş Noktalı PHP REST API
 * Kullanım: api/index.php?route=/auth/me
 */

declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/endpoints/users_courses.php';
require_once __DIR__ . '/endpoints/classes_students.php';
require_once __DIR__ . '/endpoints/criteria_questions.php';
require_once __DIR__ . '/endpoints/evaluations_print.php';

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$route = trim((string)($_GET['route'] ?? ''), '/');
$parts = $route !== '' ? explode('/', $route) : [];
$resource = $parts[0] ?? '';
$subAction = $parts[1] ?? '';

try {
    switch ($resource) {
        case 'auth':
            pd_handle_auth($subAction, $method);
            break;
        case 'settings':
            pd_handle_settings($method);
            break;
        case 'users':
            pd_handle_users($method);
            break;
        case 'courses':
            pd_handle_courses($method);
            break;
        case 'classes':
            pd_handle_classes($method);
            break;
        case 'class-teachers':
            pd_handle_class_teachers($method);
            break;
        case 'projects':
            pd_handle_projects($method);
            break;
        case 'students':
            pd_handle_students($method);
            break;
        case 'criteria':
            pd_handle_criteria($method);
            break;
        case 'questions':
            pd_handle_questions($method);
            break;
        case 'student-questions':
            pd_handle_student_questions($subAction, $method);
            break;
        case 'evaluations':
            pd_handle_evaluations($method);
            break;
        case 'matrix':
            pd_handle_matrix($method);
            break;
        case 'print-data':
            pd_handle_print_data($method);
            break;
        default:
            pd_json_response(['error' => 'Bilinmeyen API rotası: ' . $route], 404);
    }
} catch (Throwable $e) {
    $cfg = @require __DIR__ . '/config.php';
    $debug = is_array($cfg) && !empty($cfg['debug']);
    pd_json_response([
        'error' => $debug ? $e->getMessage() : 'Sunucu tarafında beklenmeyen bir hata oluştu.'
    ], 500);
}
