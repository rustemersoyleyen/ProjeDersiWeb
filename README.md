# Proje Değerlendirme ve Rubik Sistemi

Mesleki ve Teknik eğitim kurumlarında aynı öğrencinin **aynı proje ismiyle 4 farklı proje alanından (dersten) ayrı ayrı not alması**, **5 temel kazanıma göre rubik puanlaması**, **her ders için 52 hazır proje odaklı teknik sorudan öğrenciye rastgele 3 soru dağıtımı** ve **Dikey A4 (1 sayfada 2 öğrenci)** çıktı üretimi için geliştirilmiş web uygulaması.

---

## Mimari: GitHub Pages (Frontend) + `kiracbilisim.net` (MySQL API)

- **Canlı Arayüz (GitHub Pages):** `https://rustemersoyleyen.github.io/ProjeDersiWeb/`
  - `main` dalına her push yaptığınızda GitHub Actions otomatik derleyip yayınlar.
- **Veritabanı & API (`kiracbilisim.net`):**
  - `api/` klasörü bir kez `kiracbilisim.net/proje-api/` klasörüne yüklenir.
  - Tüm veriler `kiracbi8_okul360_db` içindeki **`pd_` ön ekli 13 izole tabloda** tutulur (mevcut `okul360_db` tablolarına kesinlikle dokunmaz).
  - GitHub Pages → `kiracbilisim.net` bağlantısı **CORS + HMAC-SHA256 imzalı `X-Auth-Token`** ile çalıştığı için tarayıcı çerez engellerine takılmaz.

---

## Canlı Kurulum Adımları (`kiracbilisim.net` Veritabanı + API)

### 1. Veritabanı Tablolarını ve 208 Soruyu İçe Aktarın (phpMyAdmin)
1. `kiracbilisim.net/pma` üzerinden `kiracbi8_okul360_db` veritabanını seçin.
2. **Import (İçe Aktar)** sekmesinden önce [`database/schema.sql`](database/schema.sql) dosyasını yükleyin.
3. Ardından 208 proje odaklı teknik soru için [`database/seed_questions.sql`](database/seed_questions.sql) dosyasını yükleyin.
   - *(Soruları daha önce yüklediyseniz yalnızca [`database/update_questions.sql`](database/update_questions.sql) dosyasını Import ederek ID `1..208` aralığını güncelleyebilirsiniz.)*

### 2. `api/` Klasörünü `kiracbilisim.net` Sunucusuna Yükleyin (Tek Seferlik)
1. `kiracbilisim.net` üzerinde `public_html/proje-api/` klasörü açın.
2. Bu projedeki `api/` klasörünün **içindeki** tüm dosyaları (`index.php`, `db.php`, `auth.php`, `.htaccess`, `config.example.php`, `endpoints/`) `public_html/proje-api/` içine yükleyin.
3. Sunucuda `config.example.php` dosyasını `config.php` olarak kopyalayıp MySQL bilgilerinizi girin:

```php
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'kiracbi8_okul360_db',
    'db_user' => 'MYSQL_KULLANICI_ADINIZ',
    'db_pass' => 'MYSQL_SIFRENIZ',
    'db_charset' => 'utf8mb4',
    'allowed_origins' => [
        'https://rustemersoyleyen.github.io',
        'https://kiracbilisim.net',
        'https://www.kiracbilisim.net',
        'http://localhost:5173',
    ],
    'token_secret' => 'BURAYA_UZUN_RASTGELE_BIR_ANAHTAR_YAZIN',
    'session_name' => 'PD_RUBRIK_SESSID',
    'debug' => false,
];
```

### 3. GitHub Pages Üzerinden Giriş Yapın
1. `https://rustemersoyleyen.github.io/ProjeDersiWeb/` adresini açın.
2. İsterseniz giriş formunun altındaki **Veritabanı API Adresi** bölümünden *"Kaydet & Bağlantıyı Test Et"* butonuna basıp MySQL bağlantısını anında doğrulayın (`https://kiracbilisim.net/proje-api/index.php`).
3. Varsayılan Yönetici bilgileri ile giriş yapın:
   - **Kullanıcı Adı:** `admin`
   - **Şifre:** `admin123`
4. İlk girişten sonra **Ayarlar & Şifre** ekranından şifrenizi değiştirin.

---

## Temel Özellikler

- **4 Proje Alanı / Ders:** Nesne Tabanlı Programlama (`NTP`), FrontEnd Web Tasarımı (`FEW`), Web Tabanlı Proje (`WTP`), Mobil Uygulama (`MOB`) — aynı öğrenci aynı proje ismiyle her dersten ayrı not alır.
- **5 Temel Kazanım (100 Puan Rubiği):** Planlama (15), Tasarım (20), Kodlama (35), Rapor (10), Teknik Soru/Cevap (20).
- **208 Proje Odaklı Hazır Teknik Soru:** Her alan için 52 basit, projeye dönük sözlü soru + her öğrenciye rastgele 3 benzersiz soru dağıtımı.
- **CSV / Excel / PDF (e-Okul) Öğrenci İçe Aktarma** + **Çoklu Ders Not Matrisi Excel Dışa Aktarma**.
- **Dikey A4 Çıktı (1 Sayfada 2 Öğrenci):** Üst/alt 2 öğrenci, kesme çizgisi, **Boş Form** veya **Puanlı Çıktı** modu, Ders Öğretmeni(leri) imza bloğu.
