<?php
/**
 * Oturum Yönetimi (HMAC-SHA256 İmzalı Token + PHP Session Çerez Desteği)
 * GitHub Pages -> kiracbilisim.net çapraz alan adı kullanımında %100 güvenilir çalışır.
 */

function pd_token_secret(): string {
    $cfg = pd_load_config();
    if (!empty($cfg['token_secret'])) {
        return (string)$cfg['token_secret'];
    }
    // config.php'de token_secret yoksa DB kimliğinden türetilmiş kararlı gizli anahtar
    return hash('sha256', ($cfg['db_name'] ?? '') . '|' . ($cfg['db_user'] ?? '') . '|' . ($cfg['db_pass'] ?? '') . '|pd_rubrik_v1');
}

function pd_base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function pd_base64url_decode(string $data): string {
    $pad = strlen($data) % 4;
    if ($pad > 0) {
        $data .= str_repeat('=', 4 - $pad);
    }
    return base64_decode(strtr($data, '-_', '+/')) ?: '';
}

function pd_issue_token(int $userId): string {
    $payload = json_encode([
        'uid' => $userId,
        'exp' => time() + (60 * 60 * 12), // 12 saat geçerli
    ]);
    $encoded = pd_base64url_encode((string)$payload);
    $sig = pd_base64url_encode(hash_hmac('sha256', $encoded, pd_token_secret(), true));
    return $encoded . '.' . $sig;
}

function pd_extract_token(): ?string {
    // 1. Öncelik: HTTPS query parametresi (_token) — IIS CORS preflight (OPTIONS) gerektirmez
    if (!empty($_GET['_token'])) {
        return trim((string)$_GET['_token']);
    }
    // 2. Öncelik: X-Auth-Token başlığı
    if (!empty($_SERVER['HTTP_X_AUTH_TOKEN'])) {
        return trim((string)$_SERVER['HTTP_X_AUTH_TOKEN']);
    }
    // 2. Öncelik: Authorization: Bearer <token>
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($auth === '' && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'x-auth-token') {
                return trim((string)$v);
            }
            if (strtolower($k) === 'authorization') {
                $auth = (string)$v;
            }
        }
    }
    if (preg_match('/^Bearer\s+(.+)$/i', trim($auth), $m)) {
        return trim($m[1]);
    }
    return null;
}

function pd_verify_token(?string $token): ?int {
    if (!$token || strpos($token, '.') === false) {
        return null;
    }
    [$encoded, $sig] = explode('.', $token, 2);
    $expected = pd_base64url_encode(hash_hmac('sha256', $encoded, pd_token_secret(), true));
    if (!hash_equals($expected, $sig)) {
        return null;
    }
    $payload = json_decode(pd_base64url_decode($encoded), true);
    if (!is_array($payload) || empty($payload['uid']) || empty($payload['exp'])) {
        return null;
    }
    if (time() > (int)$payload['exp']) {
        return null;
    }
    return (int)$payload['uid'];
}

function pd_start_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $cfg = pd_load_config();
    $sessionName = $cfg['session_name'] ?? 'PD_RUBRIK_SESSID';
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443);

    session_name($sessionName);
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 12,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => $isHttps ? 'None' : 'Lax',
    ]);
    session_start();
}

function pd_current_user(): ?array {
    $userId = pd_verify_token(pd_extract_token());

    if (!$userId) {
        pd_start_session();
        if (!empty($_SESSION['pd_user_id'])) {
            $userId = (int)$_SESSION['pd_user_id'];
        }
    }

    if (!$userId) {
        return null;
    }

    $pdo = pd_db();
    $stmt = $pdo->prepare(
        'SELECT id, username, full_name, branch, title, role, is_active, must_change_password
         FROM pd_users WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || (int)$user['is_active'] !== 1) {
        return null;
    }
    $user['id'] = (int)$user['id'];
    $user['is_active'] = (int)$user['is_active'];
    $user['must_change_password'] = (int)$user['must_change_password'];
    return $user;
}

function pd_require_auth(): array {
    $user = pd_current_user();
    if (!$user) {
        pd_json_response(['error' => 'Oturum gerekli. Lütfen giriş yapın.'], 401);
    }
    return $user;
}

function pd_require_admin(): array {
    $user = pd_require_auth();
    if ($user['role'] !== 'admin') {
        pd_json_response(['error' => 'Bu işlem için Yönetici (Admin) yetkisi gereklidir.'], 403);
    }
    return $user;
}

function pd_handle_auth(string $action, string $method): void {
    $pdo = pd_db();

    if ($action === 'me' && $method === 'GET') {
        $user = pd_current_user();
        if (!$user) {
            pd_json_response(['authenticated' => false, 'user' => null]);
        }
        $settingsRows = $pdo->query('SELECT setting_key, setting_value FROM pd_settings')->fetchAll();
        $settings = [];
        foreach ($settingsRows as $r) {
            $settings[$r['setting_key']] = $r['setting_value'];
        }
        $courses = $pdo->query('SELECT id, name, short_code, description, question_points, sort_order FROM pd_courses ORDER BY sort_order ASC, id ASC')->fetchAll();
        foreach ($courses as &$c) {
            $c['id'] = (int)$c['id'];
            $c['question_points'] = (int)$c['question_points'];
            $c['sort_order'] = (int)$c['sort_order'];
        }
        $outcomes = $pdo->query('SELECT id, code, name, description, default_weight, is_question_outcome, sort_order FROM pd_outcomes ORDER BY sort_order ASC, id ASC')->fetchAll();
        foreach ($outcomes as &$o) {
            $o['id'] = (int)$o['id'];
            $o['default_weight'] = (int)$o['default_weight'];
            $o['is_question_outcome'] = (int)$o['is_question_outcome'];
            $o['sort_order'] = (int)$o['sort_order'];
        }

        pd_json_response([
            'authenticated' => true,
            'user' => $user,
            'settings' => $settings,
            'courses' => $courses,
            'outcomes' => $outcomes,
        ]);
    }

    if ($action === 'login' && $method === 'POST') {
        pd_start_session();
        $body = pd_get_json_body();
        $username = trim((string)($body['username'] ?? ''));
        $password = (string)($body['password'] ?? '');

        if ($username === '' || $password === '') {
            pd_json_response(['error' => 'Kullanıcı adı ve şifre zorunludur.'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM pd_users WHERE username = ? LIMIT 1');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || (int)$user['is_active'] !== 1) {
            pd_json_response(['error' => 'Kullanıcı adı veya şifre hatalı.'], 401);
        }

        $valid = false;
        if ($user['password_hash'] === 'INIT_ADMIN123' && $password === 'admin123') {
            $valid = true;
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            $upd = $pdo->prepare('UPDATE pd_users SET password_hash = ? WHERE id = ?');
            $upd->execute([$newHash, (int)$user['id']]);
        } elseif (password_verify($password, $user['password_hash'])) {
            $valid = true;
        }

        if (!$valid) {
            pd_json_response(['error' => 'Kullanıcı adı veya şifre hatalı.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['pd_user_id'] = (int)$user['id'];
        $token = pd_issue_token((int)$user['id']);

        pd_json_response([
            'ok' => true,
            'token' => $token,
            'user' => [
                'id' => (int)$user['id'],
                'username' => $user['username'],
                'full_name' => $user['full_name'],
                'branch' => $user['branch'],
                'title' => $user['title'],
                'role' => $user['role'],
                'is_active' => (int)$user['is_active'],
                'must_change_password' => (int)$user['must_change_password'],
            ],
        ]);
    }

    if ($action === 'logout' && $method === 'POST') {
        pd_start_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        pd_json_response(['ok' => true]);
    }

    if ($action === 'change-password' && $method === 'POST') {
        $user = pd_require_auth();
        $body = pd_get_json_body();
        $current = (string)($body['current_password'] ?? '');
        $next = (string)($body['new_password'] ?? '');

        if (strlen($next) < 6) {
            pd_json_response(['error' => 'Yeni şifre en az 6 karakter olmalıdır.'], 400);
        }

        $stmt = $pdo->prepare('SELECT password_hash FROM pd_users WHERE id = ?');
        $stmt->execute([$user['id']]);
        $row = $stmt->fetch();

        $okCurrent = $row && (
            ($row['password_hash'] === 'INIT_ADMIN123' && $current === 'admin123')
            || password_verify($current, $row['password_hash'])
        );

        if (!$okCurrent) {
            pd_json_response(['error' => 'Mevcut şifre hatalı.'], 400);
        }

        $hash = password_hash($next, PASSWORD_DEFAULT);
        $upd = $pdo->prepare('UPDATE pd_users SET password_hash = ?, must_change_password = 0 WHERE id = ?');
        $upd->execute([$hash, $user['id']]);
        pd_json_response(['ok' => true]);
    }

    pd_json_response(['error' => 'Geçersiz kimlik doğrulama isteği.'], 404);
}
