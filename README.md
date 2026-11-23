# Proje Değerlendirme ve Rubik Sistemi

Mesleki ve Teknik eğitim kurumlarında aynı öğrencinin **aynı proje ismiyle 4 farklı proje alanından (dersten) ayrı ayrı not alması**, **5 temel kazanıma göre rubik puanlaması**, **her ders için 50+ hazır teknik sorudan öğrenciye rastgele 3 soru dağıtımı** ve **Dikey A4 (1 sayfada 2 öğrenci)** çıktı üretimi için geliştirilmiş web uygulaması.

---

## Temel Özellikler

- **4 Proje Alanı / Ders (Hazır Yüklü & Düzenlenebilir):**
  1. Nesne Tabanlı Programlama (`NTP`)
  2. FrontEnd Web Tasarımı (`FEW`)
  3. Web Tabanlı Proje (`WTP`)
  4. Mobil Uygulama (`MOB`)
- **5 Temel Kazanım (Varsayılan 100 Puan Rubiği):**
  1. Planlama (15 Puan)
  2. Tasarım (20 Puan)
  3. Kodlama (35 Puan)
  4. Rapor (10 Puan)
  5. Teknik Soru/Cevap (20 Puan — Rastgele 3 soru)
- **Hazır Teknik Soru Havuzu:** `database/seed_questions.sql` içinde **4 × 52 = 208** basit ve projeye dönük teknik soru hazır gelir.
- **Toplu Öğrenci İçe Aktarma:** **CSV**, **Excel (`.xlsx`/`.xls`)** ve **PDF (e-Okul sınıf listesi)** dosyalarından önizlemeli içe aktarma.
- **Çoklu Ders Not Matrisi & Excel Çıktı:** Aynı öğrencinin 4 dersteki notlarını tek tabloda görüp `.xlsx` olarak indirme.
- **Dikey A4 Çıktı Merkezi (1 Sayfada 2 Öğrenci):** Üst yarıda 1. öğrenci, ortada kesme çizgisi, alt yarıda 2. öğrenci; **Boş Sınav Formu** ve **Puanlı Çıktı** modları + **Ders Öğretmeni(leri) İmza Bloğu**.
- **Yalnızca Yönetici (Admin) & Ders Öğretmeni Girişi:** Rol tabanlı güvenli oturum.
- **İzole MySQL Tabloları (`pd_*`):** Mevcut `kiracbi8_okul360_db` veritabanındaki hiçbir tabloya dokunmaz.

---

## `kiracbilisim.net` (cPanel + phpMyAdmin) Kurulum Rehberi

### 1. Veritabanı Tablolarını İçe Aktarın (phpMyAdmin)
1. `kiracbilisim.net/pma` üzerinden `kiracbi8_okul360_db` veritabanını seçin.
2. **Import (İçe Aktar)** sekmesinden önce [`database/schema.sql`](database/schema.sql) dosyasını yükleyip çalıştırın.
3. Ardından 208 hazır teknik soru için [`database/seed_questions.sql`](database/seed_questions.sql) dosyasını yükleyip çalıştırın.
   > Tüm tablolar `pd_` ön ekiyle açıldığı için mevcut `okul360_db` tablolarınız kesinlikle etkilenmez.

### 2. Frontend Build Alın
```bash
npm install
npm run build
```
Bu komut `dist/` klasörünü üretir.

### 3. Dosyaları Hostinginize Yükleyin
`kiracbilisim.net` üzerinde yeni bir klasör açın (ör. `public_html/proje/`):
- `dist/` içindeki tüm dosyaları (`index.html`, `assets/...`) `public_html/proje/` klasörüne yükleyin.
- Proje kökündeki `api/` klasörünü `public_html/proje/api/` olarak yükleyin.
- Sunucuda `api/config.example.php` dosyasını `api/config.php` olarak kopyalayıp MySQL kullanıcı adı ve şifrenizi girin:

```php
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'kiracbi8_okul360_db',
    'db_user' => 'MYSQL_KULLANICI_ADINIZ',
    'db_pass' => 'MYSQL_SIFRENIZ',
    'db_charset' => 'utf8mb4',
    'session_name' => 'PD_RUBRIK_SESSID',
    'debug' => false,
];
```

### 4. İlk Giriş
- Tarayıcıdan `https://kiracbilisim.net/proje/` adresine gidin.
- Varsayılan Yönetici bilgileri:
  - **Kullanıcı Adı:** `admin`
  - **Şifre:** `admin123`
- İlk girişte şifre otomatik olarak güvenli `bcrypt` formatına yükseltilir. Giriş yaptıktan sonra **Ayarlar & Şifre** bölümünden şifrenizi değiştirin.

---

## Bilgisayarınızda PHP/XAMPP Olmadan Hızlı Yerel Test

Canlı sunucuya yüklemeden önce tüm ekranları yerel bilgisayarınızda test etmek için:

1. Birinci terminalde yerel geliştirme API'sini başlatın (208 soruyu otomatik yükler):
   ```bash
   npm run dev:api
   ```
2. İkinci terminalde arayüzü başlatın:
   ```bash
   npm run dev
   ```
3. Tarayıcıda `http://localhost:5173` adresini açın (`admin` / `admin123`).

---

## GitHub'a Yükleme

`api/config.php` dosyası `.gitignore` içinde olduğu için MySQL şifreleriniz GitHub'a **gitmez**.

```bash
git init
git add .
git commit -m "Proje Degerlendirme ve Rubik Sistemi ilk surum"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/ProjeDersiWeb.git
git push -u origin main
```
