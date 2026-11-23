<?php
/**
 * Veritabanı ve Güvenlik Yapılandırma Şablonu
 * Bu dosyayı sunucuda "api/config.php" olarak kopyalayıp kendi kiracbilisim.net MySQL bilgilerinizi girin.
 * NOT: api/config.php dosyası .gitignore içindedir ve GitHub'a yüklenmez.
 */

return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'kiracbi8_okul360_db',
    'db_user' => 'DB_KULLANICI_ADINIZ',
    'db_pass' => 'DB_SIFRENIZ',
    'db_charset' => 'utf8mb4',

    // GitHub Pages ve lokal geliştirme CORS izin listesi
    'allowed_origins' => [
        'https://rustemersoyleyen.github.io',
        'https://kiracbilisim.net',
        'https://www.kiracbilisim.net',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],

    // Oturum token imzalama gizli anahtarı (canlıda rastgele uzun bir metinle değiştirin)
    'token_secret' => 'BURAYA_UZUN_RASTGELE_BIR_GIZLI_ANAHTAR_YAZIN_2026',

    // Oturum çerez adı
    'session_name' => 'PD_RUBRIK_SESSID',

    // Canlı sunucuda false bırakın
    'debug' => false,
];
