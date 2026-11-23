<?php
/**
 * PDO Veritabanı Bağlantısı, CORS ve Yardımcı JSON Fonksiyonları
 */

function pd_try_load_config(): ?array {
    static $cached = null;
    static $loaded = false;
    if ($loaded) {
        return $cached;
    }
    $loaded = true;
    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        return null;
    }
    $cfg = require $configPath;
    $cached = is_array($cfg) ? $cfg : null;
    return $cached;
}

function pd_load_config(): array {
    $cfg = pd_try_load_config();
    if (!$cfg) {
        pd_json_response([
            'error' => 'api/config.php dosyası bulunamadı. Lütfen api/config.example.php dosyasını kopyalayıp MySQL bilgilerinizi girin.'
        ], 500);
    }
    return $cfg;
}

function pd_send_cors_headers(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $cfg = pd_try_load_config();
    $allowed = $cfg['allowed_origins'] ?? [
        'https://rustemersoyleyen.github.io',
        'https://kiracbilisim.net',
        'https://www.kiracbilisim.net',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ];
    if (in_array('*', $allowed, true) || in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');
        header('Access-Control-Max-Age: 86400');
    }
}

function pd_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    $cfg = pd_load_config();
    $host = $cfg['db_host'] ?? 'localhost';
    $port = $cfg['db_port'] ?? 3306;
    $dbname = $cfg['db_name'] ?? '';
    $charset = $cfg['db_charset'] ?? 'utf8mb4';
    $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset={$charset}";
    try {
        $pdo = new PDO($dsn, $cfg['db_user'] ?? '', $cfg['db_pass'] ?? '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        $msg = !empty($cfg['debug'])
            ? ('Veritabanı bağlantı hatası: ' . $e->getMessage())
            : 'Veritabanına bağlanılamadı. Lütfen api/config.php bilgilerini kontrol edin.';
        pd_json_response(['error' => $msg], 500);
    }
    return $pdo;
}

function pd_json_response($data, int $status = 200): void {
    pd_send_cors_headers();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function pd_get_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function pd_split_question_points(int $totalPoints): array {
    $base = intdiv($totalPoints, 3);
    $rem = $totalPoints % 3;
    return [
        $base + ($rem >= 1 ? 1 : 0),
        $base + ($rem >= 2 ? 1 : 0),
        $base,
    ];
}
