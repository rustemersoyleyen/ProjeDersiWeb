<?php
/**
 * Veritabanı Yapılandırma Şablonu
 * Bu dosyayı "api/config.php" olarak kopyalayıp kendi kiracbilisim.net MySQL bilgilerinizi girin.
 * NOT: api/config.php dosyası .gitignore içindedir ve GitHub'a yüklenmez.
 */

return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'kiracbi8_okul360_db',
    'db_user' => 'DB_KULLANICI_ADINIZ',
    'db_pass' => 'DB_SIFRENIZ',
    'db_charset' => 'utf8mb4',
    // Oturum çerez adı
    'session_name' => 'PD_RUBRIK_SESSID',
    // Geliştirme ortamında hata detaylarını göster (canlı sunucuda false bırakın)
    'debug' => false,
];
