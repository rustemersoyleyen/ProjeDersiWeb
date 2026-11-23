<?php
/**
 * PDO Veritabanı Bağlantısı ve Yardımcı JSON Fonksiyonları
 */

function pd_load_config(): array {
    $configPath = __DIR__ . '/config.php';
    if (!file_exists($configPath)) {
        pd_json_response([
            'error' => 'api/config.php dosyası bulunamadı. Lütfen api/config.example.php dosyasını kopyalayıp MySQL bilgilerinizi girin.'
        ], 500);
    }
    $cfg = require $configPath;
    if (!is_array($cfg)) {
        pd_json_response(['error' => 'Geçersiz config.php formatı.'], 500);
    }
    return $cfg;
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
        $msg = !empty($cfg['debug']) ? ('Veritabanı bağlantı hatası: ' . $e->getMessage()) : 'Veritabanına bağlanılamadı. Lütfen api/config.php bilgilerini kontrol edin.';
        pd_json_response(['error' => $msg], 500);
    }
    return $pdo;
}

function pd_json_response($data, int $status = 200): void {
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
