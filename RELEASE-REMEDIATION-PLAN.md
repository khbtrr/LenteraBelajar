# Plan perbaikan menuju rilis LenteraBelajar

Tanggal: 9 Oktober 2026.

Acuan: [QA-AUDIT-2026-10-09.md](QA-AUDIT-2026-10-09.md), working tree saat penyusunan, README.md, DESIGN.md, schema Prisma, dan hasil grilling pengguna.

Status: implementasi dimulai atas instruksi pengguna. Delapan keputusan kebijakan disepakati; deployment produksi dan apply koreksi nilai historis tetap memerlukan review konkret sebagaimana runbook.

## Hasil yang dituju dan keputusan yang sudah disepakati

Rilis harus menutup **seluruh temuan valid dari 56 kelompok audit**. Temuan yang ternyata tidak berlaku ditutup dengan bukti reproduksi/verifikasi, bukan sekadar perubahan status. Masalah kritis baru yang ditemukan saat memperbaiki jalur yang sama dicatat dan menjadi bagian gate rilis.

| Keputusan | Kebijakan rilis |
| --- | --- |
| Cakupan | Semua P1, P2, dan P3 valid ditutup. |
| Data | Pertahankan seluruh data; tanpa reset DB. Backup dan dry-run wajib. Koreksi nilai historis ditinjau sebelum diterapkan. |
| Attempt | Nilai attempt terbaik yang sudah selesai dinilai menjadi nilai kuis. Attempt pending tidak dianggap nol. |
| Skala | Nilai tugas dinormalisasi ke 0–100. Rata-rata berbobot sama atas komponen yang sudah dinilai. |
| Remedial | Remedial memperbaiki nilai induk jika lebih tinggi, dengan batas KKM; bukan komponen rata-rata tambahan. |
| Manual/presensi | Masuk rata-rata hanya bila ditetapkan sebagai komponen penilaian eksplisit oleh guru. |
| Ujian habis/termination | Nilai draft yang sudah diterima server; tolak perubahan jawaban setelah batas. Retry hanya finalisasi, essay tetap menunggu koreksi. |
| Hak sekolah | SUPER_ADMIN mengatur assignment sekolah dan publikasi course lintas sekolah. ADMIN mengelola sekolah yang ditugaskan; TEACHER course sendiri; STUDENT harus enrolled; SUPERVISOR hanya membaca data sekolah yang ditugaskan. |
| Hosting | Jalur utama VPS/Linux + PM2. Rate limiter bersama memakai PostgreSQL yang sudah tersedia. |
| Cutover | Maintenance terjadwal diperbolehkan: hentikan attempt baru, tuntaskan ujian aktif, backup, migrasi, smoke test, kemudian buka kembali. |
| Antislop | Selama pekerjaan, mengikuti DESIGN.md: ENERGY1/RHYTHM2/MOTION1, navy/oranye, keyboard dan kontras yang jelas. |

Rumus remedial: `nilaiEfektif = max(nilaiIndukTerbaik, min(nilaiRemedialTerbaik, KKM))`. Jika induk belum memiliki nilai final, tandai kondisi itu untuk validasi kelayakan remedial; jangan menciptakan nilai induk nol otomatis. Nilai belum dinilai tetap `null/pending`, bukan nol. Pembulatan dilakukan konsisten pada batas tampilan/export agar semua tampilan memakai dasar perhitungan sama.

## Cara mengerjakan dan menilai kemajuan

Kerjakan dalam perubahan kecil per tahap. Setiap perubahan yang memperbaiki logika/keamanan harus mempunyai regression test yang memanggil modul produksi. Mock boleh mengganti dependency session/DB untuk test terfokus, tetapi tidak mengganti algoritme atau guard yang sedang diuji. Constraint/transaksi/concurrency harus diuji di PostgreSQL terisolasi, bukan hanya mock.

Simpan ledger temuan dengan kolom: ID QA, reproduksi awal, cakupan endpoint/action, perubahan kode/migrasi, regression test, bukti verifikasi akhir, dan status `open/reproduced/fixed/verified/disproved`. Status fixed belum berarti verified. Pertahankan laporan audit sebagai baseline; tulis hasil perbaikan pada ledger terpisah.

Working tree sudah mempunyai perubahan lokal/untracked. Inventaris dan simpan baseline sebelum implementasi; jangan melakukan reset/clean atau membuang perubahan tersebut. Jangan menggunakan DB produksi untuk menjalankan test, db:push, migrate reset, atau seed demo. Semua instalasi tool/dependency dan perintah yang membutuhkan approval lingkungan tetap mengikuti izin yang berlaku.

Urutan utama: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → sign-off**. Fondasi test/migrasi dimulai pada tahap0; migrasi additive diperluas sesuai tahap. Test dan review berlangsung pada tiap tahap, bukan ditunda sampai tahap7.

## Tahap 0: baseline, reproduksi, dan fondasi migrasi/test

Temuan: **QA-01, QA-55**. Menyiapkan QA-52 untuk deployment.

1. Inventaris source/action/API dan pemanggil client/server. Petakan seluruh ID audit ke test; verifikasi ulang diagnosis agar perbaikan tidak berdasarkan asumsi atau nomor baris lama.
2. Pulihkan build/typecheck secara minimal. Perbaikan getCourseById harus sekaligus membuang early return yang melewati guard/sanitasi; hasil getter rentan tidak boleh dianggap selesai hanya karena TypeScript sudah hijau.
3. Pisahkan test unit modul produksi, integration PostgreSQL, dan E2E browser. Tambahkan harness session dua sekolah, semua lima role, assigned-school user, cross-school course enrolled/non-enrolled, dan pengguna inactive/must-change-password.
4. Siapkan database test disposable dan fixture deterministik. Tambahkan browser harness, misalnya Playwright, untuk login, CBT, file, drawer, dan pemeriksaan interaksi. Kredensial test tidak dipakai di produksi.
5. Inventaris schema aktual target melalui akses read-only yang tersedia ketika implementasi. Bandingkan dengan schema repo. Buat migration baseline SQL berversi dari hasil yang diverifikasi: jalur DB kosong menerapkan migration; jalur existing dibaseline hanya setelah kesesuaian struktur terbukti. Jangan menandai migration applied pada DB yang belum diperiksa.
6. Siapkan preflight/dry-run untuk duplikat active attempt/tahun aktif, Grade yang ambigu, orphan progress, duplicate course approval, assignment sekolah, serta file missing/orphan. Belum mengubah record historis.

Selesai jika build/typecheck lulus pada baseline perbaikan awal, test harness dapat mengeksekusi kode produksi dan membuat dua tenant terisolasi, migration awal dapat dijalankan pada DB kosong, dan ledger memuat56 ID. Closure temuan berikutnya membutuhkan bukti khusus, bukan jumlah test.

## Tahap 1: identitas server, permission, dan batas respons

Temuan: **QA-02–QA-18**.

Bangun modul server-only untuk identitas/otorisasi resource; nama file baru merupakan usulan implementasi, bukan file yang sudah ada. Pisahkan identitas pengguna dari konteks sekolah aktif. Principal berisi user ID, role terkini, home school, assigned schools berwenang, active school tervalidasi, status aktif/password, dan versi sesi. Cookie active_school_id hanya memilih konteks yang diizinkan, bukan memberi izin.

1. Tambahkan sessionVersion secara additive; claim dibentuk saat login dan diperiksa terhadap DB di guard server yang menjadi sumber otoritatif. Increment pada reset password/deaktivasi/perubahan privilege/assignment. JWT lama tanpa versi ditolak saat cutover, dengan pesan login ulang yang jelas. Jaga pemisahan konfigurasi edge/server; jangan memasukkan Prisma ke konfigurasi bersama tanpa verifikasi runtime.
2. Pastikan action/API yang langsung memanggil auth juga memakai guard server. Middleware membantu routing; tidak menjadi satu-satunya perlindungan. mustChangePassword berasal dari DB dan hanya boleh selesai lewat perubahan password tervalidasi. Beri pengecualian sempit untuk change-password/logout, bukan akses semua action.
3. Guard resource memeriksa sekolah course, pengajar, enrollment, publikasi, item-cohort, target remedial, dan hubungan ID anak-parent. Semua pemeriksaan mutation bulk memvalidasi seluruh set target sebelum menulis.
4. SUPER_ADMIN saja mengubah assignment sekolah/publikasi lintas sekolah. ADMIN dapat mengelola pengguna pada sekolah berwenang tetapi tidak mengangkat dirinya ke tenant lain. Import akun existing memeriksa tenant/role sebelum update; email foreign/protected ditolak dengan laporan baris yang jelas.
5. Audit semua getter/mutator course, cohort, module, assignment, question bank, remedial, analisis, forum, pengumuman, monitoring, analytics, profil, dan ekspor. Validasi FK category/year/teacher/parent sesuai tenant dan role. Pertahankan akses TEACHER wali kelas untuk leger sesuai scope, bukan hak membaca semua course sekolah.
6. SUPERVISOR boleh monitoring/read dalam scope sekolah yang ditugaskan. Jalur penerbitan pengumuman/mutasi lain yang saat ini menerima SUPERVISOR diselaraskan ke kebijakan read-only yang dipilih pengguna; UI harus menyembunyikan aksi terlarang dan server tetap menolak panggilan langsung.
7. Gunakan DTO whitelist per role dan resource. Password hash, IP/status keamanan, token, kunci grading, snapshot private, dan enrollment lengkap tidak ikut serialisasi umum. Pisahkan DTO siswa, pengajar, dan admin security view. Jangan mengandalkan penghapusan satu field setelah mengambil object besar.
8. Pindahkan awardXp/createNotification serta helper internal lain dari file use server ke modul server-only. Entry point publik mengotorisasi caller/resource; caller tidak menentukan XP/penerima arbitrary. Periksa server-reference manifest hasil build.
9. Gabungkan filter tenant/search dengan AND. Hilangkan flag allSchools yang bebas dipakai role biasa. Lockout memakai transaksi/counter atomik; limiter per-IP bersama selesai di tahap7.

Selesai jika direct action/HTTP request dari siswa, guru lain, admin tenant lain, dan sesi revoked ditolak; operasi berwenang tetap bekerja, termasuk enrolled cross-school student dan assigned-school admin. Payload client/HTTP terbukti bebas data private. Uji izin negatif untuk seluruh entry point, bukan hanya satu helper guard.

## Tahap 2: file, HTML, media, dan batas impor

Temuan: **QA-19, QA-20, QA-45, QA-47**.

1. Tambahkan registri file dengan owner/uploader, metadata, status staged/attached/quarantined, serta binding resource/purpose. Satu file boleh mempunyai beberapa binding yang valid; tenant file tidak boleh menggantikan pemeriksaan course cross-school/enrollment.
2. Semua jalur upload/import memakai registri, termasuk gambar inline DOCX/quiz, aset Moodle, avatar/logo, attachment tugas, submission, serta file materi. Attach memverifikasi caller berhak mengubah resource; tidak boleh mengambil file staged pengguna lain.
3. Backfill scan field URL terstruktur **dan HTML/JSON**. Cocokkan URL eksak, inventaris file missing/multi-reference/orphan/unknown, dan laporkan binding ambigu. Jangan menghapus file lama atau membuat unknown public. File unknown dibatasi/quarantine sambil menunggu review; referensi sah harus direkonsiliasi sebelum sign-off.
4. Download memeriksa resource binding dan permission caller. Student tidak dapat membaca submission milik peserta lain; teacher hanya resource course sendiri, admin/supervisor sesuai scope read. Public logo ditentukan purpose eksplisit, bukan pencarian contains filename. Review cache agar private file tidak disajikan melewati revokasi akses.
5. Gunakan sanitizer HTML allowlist bersama untuk materi, soal, pengumuman, dan seluruh sink HTML lain. Bersihkan event handler, script, dangerous URL, serta inline embed yang tidak didukung. Pertahankan format pedagogis dan placeholder audio/video yang valid. Perlakukan HTML lama saat render; jangan overwrite historis secara massal tanpa laporan.
6. Selaraskan CSP dengan origin media/embed yang benar-benar didukung. Allowlist terbatas, verifikasi app tetap boot, dan uji payload XSS di browser. Jangan memakai wildcard eksternal sebagai perbaikan semua embed.
7. Batasi byte hasil dekompresi, jumlah entry, rasio/total arsip, dan waktu parsing. Batasi sebelum buffer besar dialokasikan; sekadar mengecek hasil setelah gunzip/getData selesai tidak menyelesaikan risiko. Buat fixture arsip kecil yang ditolak secara deterministik tanpa menghabiskan mesin test.

Selesai jika user berwenang tetap dapat mengunduh aset lama/baru, foreign download ditolak, stored XSS inert, embed/audio/video yang didukung berjalan, serta impor melebihi budget ditolak dengan error jelas. Rekonsiliasi file tidak menghilangkan data.

## Tahap 3: satu lifecycle CBT, finalisasi, dan reward

Temuan: **QA-24–QA-29, QA-32, QA-37–QA-39**.

Pisahkan layanan CBT server-only dari wrapper Server Action/REST. Semua jalur start, draft, normal submit, timeout, proctor force submit/termination, dan heartbeat memakai state/transaksi yang sama.

1. Snapshot immutable menyimpan soal, opsi/kunci, poin, dan versi format di server untuk semua mode kuis. DTO peserta hanya memuat data tampilan. Soal baru diedit tidak mengubah grading attempt yang sudah dimulai. Validasi questionId/optionId terhadap snapshot untuk save/submit/essay.
2. Start mengotorisasi peserta, publikasi, token/target remedial, deadline dan jumlah kesempatan; reservasi attempt dilakukan atomik dengan lock per quiz/user dan constraint satu attempt aktif. Concurrent start mengembalikan attempt aktif yang sama. Periksa kuota di dalam critical section, bukan sebelum transaksi.
3. Server menentukan endAt dari batas durasi + extraTime dan deadline absolut yang berlaku. Tambahan waktu tidak dihitung dua kali. Heartbeat/status mengembalikan server time/endAt terbaru dan state final agar UI segera mengikuti perubahan proctor.
4. Save/draft hanya saat attempt masih aktif dan belum mencapai batas waktu. Guna menyelesaikan race, pemeriksaan waktu/state dan penulisan jawaban berada dalam critical section yang sama dengan finalisasi. Setelah endAt, finalizer membaca draft server tanpa menerima jawaban pengganti.
5. Finalisasi idempoten mengunci attempt, membekukan jawaban, memberi nilai objective berdasarkan snapshot, dan menandai essay pending. Normal submit sebelum batas boleh menyimpan payload final yang valid dalam transaksi tersebut. Finalisasi ulang mengembalikan hasil yang sama tanpa mengganti jawaban/nilai.
6. Force submit/termination memakai grader yang sama; jangan menjumlahkan score draft null. Proctor tidak dapat menilai ulang attempt final hanya dengan menekan force submit lagi. Simpan reason dan audit event transisi.
7. Finalisasi expiry tidak bergantung pada timer browser: jalankan saat akses/status serta worker terjadwal pada server. Worker memakai layanan idempoten yang sama sehingga aman overlap antar proses. Hindari attempt tertinggal aktif ketika browser offline.
8. Essay hanya untuk jawaban tipe essay; validasi angka finite 0..poin snapshot. Regrading oleh pengajar berwenang mempunyai audit trail dan sinkronisasi nilai; berbeda dari finalisasi attempt yang idempoten.
9. Reward memiliki event key stabil, misalnya attempt/lesson/session-user, untuk mencegah penggandaan pada retry/overlap. XP memakai increment atomik; progress memvalidasi content, course, enrollment dan publication. Pertahankan besaran reward yang ada kecuali perlu koreksi berdasarkan aturan yang disepakati.
10. Rekonsiliasi active attempt duplikat dan snapshot legacy melalui laporan sebelum menambahkan constraint. Snapshot historis yang tidak tersedia tidak dapat direkonstruksi pasti dari soal yang sudah diedit. Jangan diam-diam mengubah nilai lama memakai versi soal terbaru.

Selesai jika test PostgreSQL membuktikan start bersamaan tidak menambah kesempatan, submit/draft/proctor overlap menghasilkan satu hasil final, jawaban setelah batas ditolak, objective benar tetap dinilai pada termination, essay pending, XP tepat sekali, dan timer60+10 adalah70 serta berubah live.

## Tahap 4: nilai resmi, remedial, analisis, dan rekonsiliasi historis

Temuan: **QA-30, QA-31, QA-33–QA-36**. Bergantung pada snapshot/finalisasi tahap3.

1. Gunakan identitas resource stabil untuk komponen nilai: course/user/type/resource, bukan judul atau bentuk sourceId yang berubah-ubah. Nilai manual memiliki identitas komponen sendiri; jangan membuat unique constraint yang menggabungkan semua sourceId null menjadi satu komponen.
2. Bukti mentah tetap QuizAttempt/QuizAnswer/AssignmentSubmission dan penilaian manual. Satu layanan kebijakan menghitung nilai efektif, memilih attempt terbaik fully graded, normalisasi tugas, remedial induk/cap, dan rata-rata komponen. Grade menjadi proyeksi resmi yang tersinkronkan dari layanan ini, bukan tabel yang dimutasi dengan aturan berbeda pada tiap jalur.
3. Gradebook, overview siswa, leger, rapor/export, dan statistik memanggil layanan/query proyeksi yang sama. Pending ditampilkan eksplisit. Manual/presensi hanya included bila guru menetapkan komponen tersebut; hindari menghitung presensi dua kali karena punya record dan Grade.
4. Clamp/reject score dengan aturan tervalidasi yang sama pada submission, Grade, notifikasi, dan response. Dua kuis berjudul sama tetap mempunyai record nilai berbeda. Rekoreksi essay, including remedial, memakai mekanisme proyeksi yang sama.
5. Analisis bank soal membaca snapshot peserta, bukan quiz.questions kosong. Statistik mempunyai unit siswa dan attempt terpilih konsisten; parser complex sama dengan grader. Soal bank yang berbeda per peserta memerlukan denominator berdasarkan exposure soal, bukan total peserta yang tidak menerima soal itu. Generator remedial memakai sumber soal yang tervalidasi dan menjaga keterkaitan parent.
6. Backfill nilai dua tahap: (a) laporan mapping resource, collision, pending, snapshot missing, old/new score, dan alasan; (b) apply hanya hasil deterministik yang telah ditinjau. Pencocokan judul semata tidak cukup. Nilai resmi historis yang tidak bisa dibuktikan dipertahankan dengan status legacy/review; jangan overwrite otomatis atau hilangkan dari rapor.
7. Tambahkan constraint setelah duplikat/ambiguitas ditangani atau dipisahkan secara eksplisit. Backfill harus idempoten, dapat dilanjutkan, dan menyimpan provenance serta perbandingan before/after.

Selesai jika semua tampilan/export menghasilkan nilai sama: tugas10/10+kuis100 menghasilkan100; induk40+remedial100 dengan KKM75 menghasilkan75; attempt100 lalu0 tetap100; essay pending tidak masuk rata-rata; nilai di luar range tidak tersimpan. Semua perubahan historis mempunyai laporan review dan hasil rekonsiliasi.

## Tahap 5: transaksi akademik, presensi, forum, calendar, dan notifikasi

Temuan: **QA-21–QA-23, QA-40–QA-44, QA-46, QA-56**.

1. Bulk presensi mengikat record ke sessionId yang sudah diotorisasi. Untuk siswa baru gunakan upsert session-user, bukan virtual recordId. Check-in menerapkan start/endTime server dan reward tepat sekali.
2. Tambahkan status tahun ajaran belum aktif, misalnya PLANNED, agar makeActive=false benar-benar berbeda dari ACTIVE/ARCHIVED. Terapkan satu active year per sekolah setelah rekonsiliasi; aktivasi/archiving course dilakukan dalam satu transaksi dengan validasi target terlebih dahulu.
3. Review course request hanya transisi PENDING, create course dan update request atomik, serta relasi request-course unik/idempoten. Retry tidak membuat course baru. Duplicate existing masuk laporan rekonsiliasi, bukan dihapus otomatis.
4. Calendar memakai guard sekolah/course pada create/update/delete dan scope notifikasi yang sama. Forum memvalidasi comment/parent berasal dari thread target, termasuk mark answer.
5. Definisikan tipe dan pemetaan kategori notifikasi bersama; baca tipe legacy agar notifikasi lama tetap muncul. Badge unread memakai total count seluruh unread, terpisah dari daftar20 terbaru. Reward/notifikasi internal tetap tidak menjadi action publik bebas.

Selesai jika invalid aktivasi tidak mengarsipkan data lama, hanya satu active year, approval double click menghasilkan satu course, presensi siswa baru berhasil, check-in awal ditolak, foreign calendar/forum mutation ditolak, dan unread lama tetap dihitung.

## Tahap 6: UI, aksesibilitas, dan instruksi antislop

Temuan: **QA-48–QA-51, QA-54**. Melengkapi browser verifikasi QA-47 dan seluruh flow sebelumnya.

1. Perbaiki contrast token/CTA secara konsisten; teks kecil4.5:1, teks besar3:1. Oranye tetap aksen identitas tanpa memaksakan teks putih di permukaan yang gagal kontras.
2. Ikon tombol/link memiliki accessible name; focus-visible ring tersedia, termasuk sidebar collapsed dan achievement link. Semua aksi yang tersedia bagi suatu role dapat dilakukan keyboard.
3. Drawer mobile memakai dialog/drawer primitive dengan inert saat tertutup, focus trap saat terbuka, Escape, label, dan focus restore. Periksa nested dialogs, menu, fullscreen ujian, dan perubahan viewport.
4. Hapus animasi loop yang bertentangan dengan MOTION1, serta hormati reduced-motion. Perbaiki loading/empty/error/retry pada flow yang berubah karena server menolak akses atau state final.
5. Perbaiki referensi skill AGENTS.md yang rusak menggunakan path/bundle yang tersedia dan dapat dijalankan di mesin tim. Perubahan dokumen mengikuti instruksi repo; tidak memasang plugin/skill eksternal tanpa kebutuhan/otorisasi.
6. Uji browser semua role pada320/375/768/desktop, light/dark, keyboard, dan teks panjang. Catat overflow, focus, dialog, console error, toast/notifikasi, material/file/media, serta flow English/Indonesia yang terdampak. Audit awal berbasis kode bukan bukti screenshot, jadi temuan/closure visual perlu bukti browser baru.

Selesai jika flow tersedia dapat dioperasikan, contrast/focus/keyboard memenuhi gate, closed drawer tidak ikut tab order, dark mode dan reflow tidak rusak, dan instruksi skill dapat dibaca di lingkungan tim.

## Tahap 7: limiter bersama, CI, rehearsal, dan paket rilis

Temuan: **QA-52, QA-53**, serta pembuktian penutupan semua tahap.

1. Implementasikan limiter PostgreSQL dengan key/window, update atomic, expiry/cleanup, dan indeks. Uji request tersebar antar minimal dua worker PM2; kuota tetap global. Counter akun lockout dan limiter per-IP adalah perlindungan terpisah. Ukur query/beban dan pastikan kegagalan limiter tidak diam-diam menghilangkan proteksi.
2. Tambahkan CI/release checks untuk typecheck, lint, unit produksi, integration Postgres, migration dan E2E. Warning yang masih ada ditangani atau diberi alasan spesifik yang ditinjau; jangan mematikan aturan lint global untuk membuat gate hijau.
3. Build artifact terlebih dahulu, baru preflight/migration/deploy. Artifact pinned ke revision dan lockfile; hindari git pull di direktori aplikasi aktif sebagai satu-satunya mekanisme rilis. Pastikan uploads memakai path/volume stabil yang tidak ikut diganti bersama artifact.
4. Jalur VPS/PM2 menjadi runbook utama. Docker, jika tetap ditawarkan sebagai jalur runnable, juga mempunyai migration/bootstrap yang benar dan tidak diklaim siap produksi tanpa test; dokumentasi harus membedakan demo dan rilis utama.
5. Lakukan dua rehearsal: instal DB kosong dan upgrade salinan existing DB+uploads. Verifikasi schema drift, jumlah/checksum record, metadata file, backfill deterministik, constraint, privilege, session invalidation, nilai before/after, dan runtime smoke tests.
6. Lakukan backup/restore drill DB beserta uploads; dokumentasikan waktu dan hasil nyata. Jangan menjanjikan pemulihan hanya karena file backup berhasil dibuat. Siapkan rollback artifact dan strategi data yang sesuai kompatibilitas migration.

Selesai jika seluruh ledger berstatus verified/disproved dengan bukti, dua jalur DB berhasil, browser/HTTP/security/concurrency lulus pada candidate yang sama, limiter multi-worker benar, dan restore diuji. Parameter kapasitas/jumlah peserta nyata ditetapkan saat staging berdasarkan target sekolah, bukan angka performa yang dibuat-buat dalam plan.

## Pemetaan seluruh audit ke tahap utama

| Tahap | ID audit |
| --- | --- |
| 0 | QA-01, QA-55 |
| 1 | QA-02, QA-03, QA-04, QA-05, QA-06, QA-07, QA-08, QA-09, QA-10, QA-11, QA-12, QA-13, QA-14, QA-15, QA-16, QA-17, QA-18 |
| 2 | QA-19, QA-20, QA-45, QA-47 |
| 3 | QA-24, QA-25, QA-26, QA-27, QA-28, QA-29, QA-32, QA-37, QA-38, QA-39 |
| 4 | QA-30, QA-31, QA-33, QA-34, QA-35, QA-36 |
| 5 | QA-21, QA-22, QA-23, QA-40, QA-41, QA-42, QA-43, QA-44, QA-46, QA-56 |
| 6 | QA-48, QA-49, QA-50, QA-51, QA-54 |
| 7 | QA-52, QA-53 |

Tiap ID muncul satu kali pada pemetaan utama. Perbaikan lintas tahap tetap membawa regression test ke tahap berikutnya.

## Bukti minimum untuk sign-off

| Area | Bukti wajib |
| --- | --- |
| Akses | Matrix2 sekolah ×5 role, teacher owner/non-owner, enrolled/non-enrolled, assigned school/cross-school, inactive/revoked/must-change-password; direct action/API/file request, bukan klik UI saja. |
| Respons | Snapshot/keys/passwordHash/token/private security fields tidak ada pada DTO peserta/client payload; helper internal tidak terdaftar sebagai public server action. |
| CBT | Clock terkontrol, expiry tanpa browser, extra-time live, snapshot edited question, token/target/draft publication, retry, start/submit/draft/proctor overlap, essay pending dan reward exactly-once. |
| Nilai | Fixture numeric kebijakan di tahap4; semua tampilan/export cocok, dua judul sama tidak collide, manual/presensi inclusion eksplisit, nilai historis tidak dikoreksi tanpa review. |
| File/HTML/import | Legacy/new binding, unauthorized/staged/unknown download, public logo eksak, HTML malicious inert, media valid, compression budget sebelum alokasi besar. |
| DB | Migration fresh+existing copy, duplicate preflight, dry-run/apply idempotent, jumlah/checksum/provenance, backup restore DB+uploads. |
| UI | Browser setiap role, keyboard/focus, viewport320/375/768/desktop, light/dark, reduced-motion, console/error/loading states. |
| Operasional | Candidate artifact yang diuji sama dengan yang dideploy; limiter minimal2 worker, worker expiry idempoten, migration runbook dan rollback teruji. |

Tidak perlu test baru untuk setiap perubahan kosmetik kecil; bukti browser/contrast cukup untuk perubahan UI sederhana. Jalur keamanan, data, dan concurrency memerlukan regression/integration yang substantif.

## Runbook cutover yang direncanakan

1. Pastikan delapan tahap dan sign-off candidate selesai. Tetapkan maintenance window dan operator; komunikasi ke pengguna dilakukan oleh operator yang berwenang, bukan dikirim otomatis oleh pekerjaan plan ini.
2. Hentikan start attempt baru; biarkan ujian aktif selesai. Jika masih ada attempt aktif yang tidak bisa dituntaskan, tunda cutover dan putuskan kasusnya secara eksplisit. Jangan menghentikan atau memberi nilai nol otomatis demi jadwal deploy.
3. Bekukan write aplikasi, hentikan worker yang dapat menulis, dan backup konsisten DB+uploads. Jalankan preflight pada schema/data terbaru, bukan hanya salinan rehearsal lama.
4. Terapkan baseline/expand migration yang sesuai dan backfill deterministik yang telah disetujui. Jalankan verifikasi; kasus nilai/snapshot/file ambigu masuk laporan untuk review, tidak diperbaiki dengan tebakan.
5. Aktifkan artifact candidate, restart semua worker agar tidak ada versi campuran, invalidasi sesi sesuai sessionVersion cutover, dan jalankan smoke test login/per-role/course/file/CBT/grade/export.
6. Buka akses setelah pemeriksaan berhasil. Pantau denial/error, expiry worker, nilai/reward, pool DB/limiter, dan akses file selama observasi awal.
7. Jika gate gagal, pertahankan maintenance dan rollback sesuai runbook. Rollback aplikasi hanya bila schema additive kompatibel; jika perlu restore, lakukan DB+uploads dari checkpoint konsisten sebelum aplikasi dibuka. Setelah write publik kembali berjalan, jangan restore backup lama secara otomatis karena akan membuang data baru.

Contract migration/drop kolom lama bukan bagian cutover awal. Lakukan setelah kompatibilitas, backfill, dan observasi berhasil serta tidak ada reader lama yang bergantung padanya.

## Hal yang belum diketahui dan tidak diasumsikan dalam plan

Schema/data produksi aktual, jumlah record historis/ujian aktif, origin embed yang benar-benar digunakan, lokasi/path uploads, kapasitas VPS/PM2, waktu restore, dan volume peserta belum dibuktikan dari repo. Hal ini menjadi preflight/staging gate yang diperiksa saat implementasi; tidak menghalangi penyusunan plan dan tidak boleh diganti dengan asumsi aman.

Tidak ada estimasi durasi kalender yang diklaim. Ukuran pekerjaan baru dapat diperkirakan setelah reproduksi tahap0 dan inventaris migrasi historis, terutama Grade/sourceId, snapshot legacy, dan file bindings.

## Konfirmasi pemahaman akhir

Keputusan pengguna Q1–Q8 sudah dimasukkan. Sebelum memulai implementasi, konfirmasikan bahwa urutan, aturan nilai/ujian/permission, serta batas koreksi data dan cutover di dokumen ini sesuai. Ini mengikuti skill grilling: “Do not act on it until the user confirms you have reached a shared understanding.” Konfirmasi plan tidak otomatis mengotorisasi apply koreksi nilai historis atau deployment produksi.
