-- ============================================================================
-- Proje Değerlendirme Sistemi — Faz 2 (v2) 3 Kategorili Akıllı Soru Havuzu
-- Kategoriler:
--   1) technical_easy : Temel teknik soru (Kolay)
--   2) technical_hard : Uygulama / derinlik teknik sorusu (Orta / Zor)
--   3) vision_comment : Proje yorum, eleştirel bakış & hayal gücü sorusu
--
-- NOT: Önce database/migration_v2.sql dosyasını çalıştırın, ardından bu dosyayı
-- phpMyAdmin'den Import edin. Mevcut 1..208 sorunun ID'lerini koruyarak kategorize
-- eder ve 4 alan için 60 yeni Yorum & Hayal Gücü sorusu (ID 209..268) ekler.
-- ============================================================================

SET NAMES utf8mb4;
START TRANSACTION;

-- A) Mevcut 208 soruyu zorluk ve içerik yapısına göre 3 kategoriye ayır
UPDATE `pd_questions` SET `question_type` = 'technical_easy' WHERE `id` BETWEEN 1 AND 208;

-- Teknik Orta / Derinlik soruları -> technical_hard
UPDATE `pd_questions` SET `question_type` = 'technical_hard', `difficulty` = 'orta'
WHERE `id` IN (
  -- NTP (course 1)
  8, 12, 15, 23, 25, 26, 30, 34, 35, 37, 38, 42, 43, 47, 48,
  -- FrontEnd (course 2)
  58, 60, 66, 69, 70, 71, 76, 78, 82, 83, 84, 91, 92, 94, 98,
  -- Web Tabanlı Proje (course 3)
  108, 109, 112, 115, 116, 117, 118, 121, 124, 125, 128, 131, 132, 133, 138, 141, 143, 145, 153, 156,
  -- Mobil Uygulama (course 4)
  161, 162, 164, 166, 167, 169, 171, 172, 173, 176, 181, 185, 186, 192, 195, 198, 202
);

-- Mevcut sorular içindeki yansıtıcı / yorum soruları -> vision_comment
UPDATE `pd_questions` SET `question_type` = 'vision_comment'
WHERE `id` IN (
  24, 40, 45, 49, 51, 52,
  88, 96, 99, 103, 104,
  147, 150, 152, 155,
  194, 197, 203, 204, 207, 208
);

-- B) Her 4 Proje Alanı için 15'er Yeni "Proje Yorum & Hayal Gücü" Sorusu (60 Yeni Soru, ID 209..268)
INSERT INTO `pd_questions` (`id`, `course_id`, `question_text`, `difficulty`, `question_type`, `expected_hint`) VALUES
-- 1) Nesne Tabanlı Programlama — Yorum & Hayal Gücü (id: 209..223)
(209, 1, 'Projeye başlarken hayal ettiğin özelliklerle şu an ortaya çıkan sonuç arasında seni en çok şaşırtan fark ne oldu?', 'kolay', 'vision_comment', 'Başlangıç hayali ile final ürün arasındaki gelişimi yorumlamalı'),
(210, 1, 'Bu projeyi bugün sıfırdan tekrar yazacak olsan hangi bölümünü tamamen farklı tasarlardın ve neden?', 'orta', 'vision_comment', 'Kendi mimari/tasarım kararlarına eleştirel bakabilme'),
(211, 1, 'Projendeki en mükemmel, "işte bunu gerçekten çok iyi yaptım" dediğin özellik hangisi?', 'kolay', 'vision_comment', 'En güçlü yanını somut gerekçeyle savunabilme'),
(212, 1, 'Projende yaparken sana en kolay gelen ve en keyif aldığın kısım neresiydi?', 'kolay', 'vision_comment', 'Üretim sürecindeki güçlü yönünü fark etmesi'),
(213, 1, 'Bu uygulamayı gerçek bir okul veya işletmede çalışan birine teslim etsen sence ilk neye teşekkür eder, ilk neyi eleştirir?', 'orta', 'vision_comment', 'Gerçek kullanıcı empatisi kurabilme'),
(214, 1, 'Sınırsız zamanın ve ekibin olsaydı bu programa hayalindeki hangi "çılgın" özelliği eklerdin?', 'kolay', 'vision_comment', 'Yaratıcı geliştirme vizyonu'),
(215, 1, 'Projenin adını bir yatırımcıya veya okul müdürüne 30 saniyede tanıtacak olsan hangi cümleyle başlardın?', 'kolay', 'vision_comment', 'Projenin değer önerisini özetleyebilme'),
(216, 1, 'Projende çıkardığın veya yarım kalan bir fikir oldu mu? Neden vazgeçtin ya da sonraya bıraktın?', 'kolay', 'vision_comment', 'Kapsam ve zaman yönetimi farkındalığı'),
(217, 1, 'Bu projeyi hiç bilgisayar bilmeyen biri kullansa en çok hangi ekranda zorlanabilir, onu nasıl basitleştirirdin?', 'orta', 'vision_comment', 'Kullanılabilirlik ve sadeleştirme fikri'),
(218, 1, 'Projendeki tasarım kararlarından birini bir arkadaşına tavsiye edecek olsan hangisini önerirdin?', 'kolay', 'vision_comment', 'Edindiği pratik tecrübeyi aktarabilme'),
(219, 1, 'Bu projeyi yaparken öğrendiğin ve bundan sonraki tüm projelerinde kesin kullanacağın en önemli alışkanlık ne oldu?', 'kolay', 'vision_comment', 'Kişisel gelişim ve öğrenme çıktısı'),
(220, 1, 'Projenin "2.0" sürümünü gelecek yıl çıkaracak olsan yol haritana ilk 3 madde olarak ne yazardın?', 'kolay', 'vision_comment', 'Sürdürülebilir ürün geliştirme düşüncesi'),
(221, 1, 'Projende manuel yapılan ama otomatikleşse harika olacak bir iş var mı? Nasıl otomatikleştirirdin?', 'orta', 'vision_comment', 'Otomasyon ve verimlilik bakış açısı'),
(222, 1, 'Projeye başlarken "kesin çok zor olur" diye korktuğun ama yapınca düşündüğünden kolay çıkan kısım neydi?', 'kolay', 'vision_comment', 'Özgüven ve süreç değerlendirmesi'),
(223, 1, 'Bu uygulamanın günlük hayatta gerçekten zaman kazandırdığını bir örnekle nasıl kanıtlarsın?', 'kolay', 'vision_comment', 'Projenin gerçek hayat faydasını örnekleme'),

-- 2) FrontEnd Web Tasarımı — Yorum & Hayal Gücü (id: 224..238)
(224, 2, 'Tasarımına başlarken aklında hayal ettiğin site görünümüyle şu anki sayfa ne kadar örtüşüyor?', 'kolay', 'vision_comment', 'Başlangıç tasarım hayali ile final kıyaslaması'),
(225, 2, 'Bu web sitesinin tasarımında "en şık ve en dikkat çekici yer burası" dediğin bölüm hangisi, neden?', 'kolay', 'vision_comment', 'Estetik ve odak noktası değerlendirmesi'),
(226, 2, 'Siteni sıfırdan yeniden tasarlasan renk paletini, menüyü veya sayfa düzenini nasıl değiştirirdin?', 'orta', 'vision_comment', 'Tasarım özeleştirisi ve alternatif kurgu'),
(227, 2, 'Bu tasarımı kodlarken en kolay ve akıcı ilerlediğin sayfa veya bileşen hangisiydi?', 'kolay', 'vision_comment', 'FrontEnd geliştirme rahatlığı'),
(228, 2, 'Bir ziyaretçi sitene ilk 5 saniye baktığında sence ne hisseder ve ilk nereye tıklar?', 'kolay', 'vision_comment', 'İlk izlenim ve görsel hiyerarşi yorumu'),
(229, 2, 'Sitenin tasarımına tamamen hayal gücünle ekleyeceğin etkileşimli veya animasyonlu bir özellik ne olurdu?', 'kolay', 'vision_comment', 'Yaratıcı UI/UX hayal gücü'),
(230, 2, 'Görme zorluğu yaşayan veya yaşlı bir kullanıcı siteni açsa hangi görsel iyileştirmeyi yapman gerekir?', 'orta', 'vision_comment', 'Erişilebilirlik ve kapsayıcı tasarım bilinci'),
(231, 2, 'Projende beğendiğin başka bir web sitesinden esinlendiğin bir tasarım fikri oldu mu, nasıl uyarladın?', 'kolay', 'vision_comment', 'İlham alma ve özgünleştirme süreci'),
(232, 2, 'Sitenin masaüstü görünümü mü yoksa mobil görünümü mü sence daha başarılı oldu, neden?', 'kolay', 'vision_comment', 'Çoklu cihaz deneyimi değerlendirmesi'),
(233, 2, 'Tasarımında sadeleştirip çıkardığın veya "fazla kalabalık duruyor" deyip değiştirdiğin bir yer oldu mu?', 'kolay', 'vision_comment', 'Sadelik ve görsel denge anlayışı'),
(234, 2, 'Bu siteyi gerçek bir marka için tasarlıyor olsan müşteriyi ikna etmek için hangi 3 görsel detayı öne çıkarırdın?', 'kolay', 'vision_comment', 'Sunum ve tasarım savunması'),
(235, 2, 'Projende en çok zamanını alan görsel detay hangisiydi; sence harcadığın emeğe değdi mi?', 'kolay', 'vision_comment', 'Tasarım önceliklendirme farkındalığı'),
(236, 2, 'Gelecek yıl bu tasarıma yeni bir sayfa veya modern bir bileşen ekleyecek olsan ne eklerdin?', 'kolay', 'vision_comment', 'Arayüz geliştirme vizyonu'),
(237, 2, 'Renk ve yazı tipi dışında kullanıcıya güven veren başka hangi görsel detayları projende kullandın?', 'orta', 'vision_comment', 'Tutarlılık, boşluk, hizalama, ikon uyumu'),
(238, 2, 'Başka bir öğrenciye iyi bir web arayüzü tasarlaması için kendi projenden yola çıkarak hangi tek tavsiyeyi verirsin?', 'kolay', 'vision_comment', 'Öğrenilen tasarım ilkesini özetleme'),

-- 3) Web Tabanlı Proje — Yorum & Hayal Gücü (id: 239..253)
(239, 3, 'Projeye başlarken kafanda kurduğun sistemle şu an çalışan web uygulaması arasında hangi farklar oluştu?', 'kolay', 'vision_comment', 'Başlangıç hedefi vs gerçekleşen sistem analizi'),
(240, 3, 'Web projendeki en güçlü, "bu özellik projeyi gerçekten farklı kılıyor" dediğin kısım hangisi?', 'kolay', 'vision_comment', 'Projenin ayırt edici değerini vurgulama'),
(241, 3, 'Bu sistemi baştan kursan veritabanı tablolarında veya ekran akışında neleri farklı yapardın?', 'orta', 'vision_comment', 'Veri modeli ve mimari özeleştirisi'),
(242, 3, 'Bu web projesini aynı anda 1000 öğrenci veya müşteri kullanacak olsa sence ilk hangi özellik eksik kalır?', 'orta', 'vision_comment', 'Ölçeklenebilirlik ve gerçek kullanım senaryosu'),
(243, 3, 'Projende yaparken sana en kolay gelen ve hızla bitirdiğin modül hangisiydi?', 'kolay', 'vision_comment', 'Teknik özgüven ve modül hakimiyeti'),
(244, 3, 'Sistemine hayalindeki bir yapay zeka, bildirim veya otomasyon özelliği ekleyebilsen ne yapmasını isterdin?', 'kolay', 'vision_comment', 'Yenilikçi ve hayal kurdurucu bakış açısı'),
(245, 3, 'Bu projeyi bir kuruma satacak veya sunacak olsan sistemin en büyük 2 avantajını nasıl anlatırdın?', 'kolay', 'vision_comment', 'Ürünün iş değerini ifade edebilme'),
(246, 3, 'Sisteminde bir yönetici (admin) olarak senin işini en çok kolaylaştıran ekran hangisi oldu?', 'kolay', 'vision_comment', 'Yönetim paneli kullanılabilirlik yorumu'),
(247, 3, 'Projende güvenlik veya kullanıcı hatası açısından "keşke şunu da ekleseydim" dediğin bir kontrol var mı?', 'orta', 'vision_comment', 'Güvenlik ve veri bütünlüğü farkındalığı'),
(248, 3, 'Bu projeyi yapmadan önce kafanda çok büyüttüğün ama yapınca mantığını kolayca kavradığın kısım neydi?', 'kolay', 'vision_comment', 'Backend/DB öğrenme kırılımını anlatması'),
(249, 3, 'Projenin farklı bir sektöre (örneğin okul yerine hastane veya mağaza) uyarlanmasını isteseler ne kadar kolay uyarlanır?', 'orta', 'vision_comment', 'Sistemin esnekliğini değerlendirebilme'),
(250, 3, 'Projende veritabanında tutup da ileride güzel bir grafik/rapor çıkarabileceğin en değerli veri hangisi?', 'orta', 'vision_comment', 'Veriden anlamlı rapor/karar üretme vizyonu'),
(251, 3, 'Sistemde kağıt-kalemle yapılan hangi zahmetli işi tamamen ortadan kaldırdın?', 'kolay', 'vision_comment', 'Dijital dönüşüm faydasını somutlaştırma'),
(252, 3, 'Projenin bir sonraki sürümünde kullanıcıların en çok sevineceği yeni özellik sence ne olurdu?', 'kolay', 'vision_comment', 'Kullanıcı odaklı yol haritası'),
(253, 3, 'Bu projeyi geliştirme sürecinden sonra kendi güçlü yönün sence daha çok tasarım mı, veritabanı mı yoksa kodlama mı?', 'kolay', 'vision_comment', 'Kişisel alan farkındalığı ve öz değerlendirme'),

-- 4) Mobil Uygulama — Yorum & Hayal Gücü (id: 254..268)
(254, 4, 'Uygulamaya başlarken telefonunda hayal ettiğin deneyimle şu an elinde çalışan uygulama ne kadar benziyor?', 'kolay', 'vision_comment', 'Başlangıç hayali ve final uygulama kıyaslaması'),
(255, 4, 'Mobil uygulamanın "en havalı / en kullanışlı" dediğin özelliği veya ekranı hangisi?', 'kolay', 'vision_comment', 'En güçlü mobil özelliği öne çıkarma'),
(256, 4, 'Bu uygulamayı sıfırdan tekrar geliştirsen hangi ekranı veya akışı tamamen farklı yapardın?', 'orta', 'vision_comment', 'Mobil UX ve mimari özeleştirisi'),
(257, 4, 'Uygulamanı geliştirirken sana en kolay ve en eğlenceli gelen bölüm hangisiydi?', 'kolay', 'vision_comment', 'Geliştirme motivasyonu ve yetkinlik'),
(258, 4, 'Telefonun donanım özelliklerini (kamera, GPS, sesli komut, NFC vb.) sınırsız kullanabilsen uygulamana hayalindeki hangi özelliği eklerdin?', 'kolay', 'vision_comment', 'Mobil donanım ve yaratıcı hayal gücü'),
(259, 4, 'Uygulamanı Play Store a koysan kullanıcılar yorumlarda sence en çok neyi över, ne için 1 yıldız kırabilir?', 'orta', 'vision_comment', 'Gerçek son kullanıcı eleştirisi öngörüsü'),
(260, 4, 'İnsanların bu uygulamayı her gün telefonlarında açması için içine hangi motive edici özelliği eklerdin?', 'kolay', 'vision_comment', 'Kullanıcı bağlılığı ve ürün düşüncesi'),
(261, 4, 'Uygulamanı bir otobüste tek elle kullanan bir kişiyi hayal et; hangi ekran kolay, hangisi zor olurdu?', 'orta', 'vision_comment', 'Gerçek mobil ergonomi empatisi'),
(262, 4, 'Aynı proje fikrini web sitesi yerine mobil uygulama olarak kullanmanın kullanıcıya en büyük avantajı sence ne?', 'kolay', 'vision_comment', 'Mobil platform değerini kavrama'),
(263, 4, 'Uygulaman için 2 cümlelik bir mağaza tanıtım yazısı yazacak olsan ne yazardın?', 'kolay', 'vision_comment', 'Kısa ve etkili ürün tanıtımı'),
(264, 4, 'Projeye başlarken eklemeyi hayal edip zaman yetmediği için 2. sürüme bıraktığın özellik ne oldu?', 'kolay', 'vision_comment', 'Planlama ve önceliklendirme bilinci'),
(265, 4, 'Uygulamanda internetsiz (çevrimdışı) çalışabilse harika olacak en önemli özellik hangisi?', 'orta', 'vision_comment', 'Mobil çevrimdışı deneyim vizyonu'),
(266, 4, 'Uygulamanı bir arkadaşına ilk kez verdiğinde hiç açıklama yapmadan tüm ekranları çözebildi mi?', 'kolay', 'vision_comment', 'Sezgisel arayüz gözlemi'),
(267, 4, 'Bu mobil projeyi yaparken "bunu öğrenmem çok iyi oldu" dediğin en değerli deneyim neydi?', 'kolay', 'vision_comment', 'Öğrenme kazanımını ifade etme'),
(268, 4, 'Bu uygulamayı tüm okulun aktif kullandığını hayal et; bir ay sonra en çok hangi yeni özellik istenirdi?', 'kolay', 'vision_comment', 'Gerçek kullanıcı geri bildirimi hayal etme')
ON DUPLICATE KEY UPDATE
  `course_id` = VALUES(`course_id`),
  `question_text` = VALUES(`question_text`),
  `difficulty` = VALUES(`difficulty`),
  `question_type` = VALUES(`question_type`),
  `expected_hint` = VALUES(`expected_hint`);

COMMIT;
