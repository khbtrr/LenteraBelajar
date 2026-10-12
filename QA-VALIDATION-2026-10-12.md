# Validasi aplikasi dan data demo hasil restore — 12 Oktober 2026

Build aplikasi commit `3936b6b307507632982217da061d1cfe2ded06e2` lulus pemeriksaan pada salinan data demo. Pemeriksaan awal menemukan snapshot yang hilang, sumber nilai yang sudah tidak tersedia, perbedaan scope cohort, dan celah preflight. Bagian akhir dokumen mencatat perbaikan berikutnya; temuan awal dipertahankan sebagai bukti, bukan status kode terbaru.

## Lingkungan dan batas pemeriksaan

- Sumber: container `lenterabelajar-db-1`, database `lenterabelajar`, serta uploads container `lenterabelajar-app-1`.
- Target: container `lenterabelajar-qa-postgres`, database `lentera_demo_restored_20261012`, uploads salinan `.qa/demo-backup-20261012/uploads-restored`.
- Aplikasi yang diuji: artifact standalone yang dibangun ulang dari commit di atas, bind `127.0.0.1:3006`. Ini bukan pengujian image Docker demo yang sedang melayani port 3000 atau deployment PM2/Nginx pada VM.
- Database demo asli tetap berjalan. Perbandingan fingerprint seluruh 42 tabel sumber dengan backup awal menunjukkan isi sumber tidak berubah selama pemeriksaan.
- Password beberapa akun pada database salinan diganti untuk login pengujian. Password database sumber tidak diubah. Server pengujian dihentikan setelah selesai; database QA tetap tersedia.
- Bukti mentah, identitas akun, screenshot, dan backup berada di `.qa/`, yang tidak masuk Git. Laporan ini tidak memuat credentials atau kunci jawaban.

## Hasil yang lulus

| Pemeriksaan | Hasil |
| --- | --- |
| Backup/restore awal | 42 tabel, 1.558 baris, 20 file cocok dengan sumber. |
| Upgrade schema pada salinan | Baseline diverifikasi setelah alignment terkontrol; tujuh migrasi lanjutan berhasil. Status delapan migrasi up to date; diff ke schema aplikasi kosong. |
| Pelestarian data saat migrasi | Fingerprint 42 tabel lama cocok setelah mengabaikan kolom baru yang mempunyai default. |
| Build artifact | Lulus; manifest mencatat commit `3936b6b`, working tree bersih saat build. TypeScript diperiksa sebagai bagian build. |
| Lint dan typecheck akhir | Lulus tanpa error/warning. Pemeriksaan lint awal memindai skrip sementara `.qa/` dan melaporkan tiga require-import error di artifact backup. Direktori artifact ditambahkan ke global ignore ESLint; lint dan `tsc --noEmit` kemudian lulus. |
| Unit test | 170/170 lulus. |
| Integration test | 19/19 lulus pada database fixture `lentera_qa`, terpisah dari database restore demo. |
| Browser pada data hasil restore | 77/77 pemeriksaan lulus: login lima role; dashboard pada 320, 768, dan 1280 px; drawer keyboard/focus; halaman role, profil, notifikasi, pesan, kalender; halaman course guru dan materi siswa. Tidak ada pageerror pada halaman yang diperiksa. |
| Rekonsiliasi file | Tujuh proposal registrasi file ditinjau melalui referensi resource dan SHA256, lalu disimulasikan hanya pada salinan. Tidak ada perubahan nilai historis atau penghapusan file. |
| Akses file setelah registrasi | PDF berwenang cocok SHA256; HTTP Range 206; PDF privat anonim dan file orphan ditolak; logo sekolah yang tepat dapat dibaca publik. |
| Route role | Siswa yang membuka halaman admin diarahkan kembali ke dashboard siswa. |
| Worker expiry | Tanpa secret ditolak 401. Dengan secret, respons 200: `finalized: 0`, `needsReview: 1`; attempt tanpa snapshot tidak dinilai otomatis. |
| Nilai historis setelah simulasi | Fingerprint Grade, QuizAttempt, QuizAnswer, dan AssignmentSubmission tetap cocok dengan backup awal setelah mengecualikan kolom migrasi baru. |
| Proyeksi nilai | Course pertama: satu rata-rata 91,7 dan satu pending/null. Course kedua: tiga pending/null. Tidak ada rata-rata di luar 0–100; satu submission bernilai 100 pada course kedua tidak termasuk scope cohort saat ini (lihat LV-06). |

## Temuan dan keputusan review

| ID | Prioritas | Temuan, bukti, dan tindakan |
| --- | --- | --- |
| LV-01 | P1 — gate rilis | `release:preflight` melaporkan nol missing active snapshot, padahal satu attempt aktif mempunyai `questionSnapshot` berupa JSON `null`. Predicate hanya menangani SQL NULL dan array kosong. Perbaiki agar memvalidasi snapshot dengan kontrak grading, membedakan attempt voided, serta mendeteksi JSON null/bentuk rusak/kunci yang tidak tersedia. Worker berhasil menandai kasus ini sebagai needsReview, sehingga preflight dan worker belum konsisten. |
| LV-02 | P2 — jalur upgrade | Schema Docker demo tidak identik dengan baseline: QuizAnswer masih mempunyai FK ke soal live dan belum mempunyai index questionId serta unique attemptId/questionId. Tidak ada jawaban duplikat. Pada salinan, FK tersebut dilepas dan dua index dibuat, lalu diff baseline diverifikasi kosong sebelum migrate resolve. SQL alignment tersimpan sebagai bukti; ini belum menjadi jalur upgrade otomatis di repository. DB existing harus diperiksa terlebih dahulu, sesuai runbook. |
| LV-03 | P1 untuk membawa data ini | Ketiga attempt mempunyai snapshot JSON null: dua selesai dan satu aktif. Nilai historis tidak dapat dihitung ulang dari snapshot. Pertahankan skor/jawaban; jangan merekonstruksi kunci dari soal terbaru. Attempt aktif membutuhkan keputusan pengawas sebelum cutover. Karena data hanya demo, keputusan ini tidak boleh dianggap sebagai persetujuan membawa data demo ke produksi. |
| LV-04 | P2 — identitas nilai | Ada 15 Grade tanpa resourceKey. Penelusuran sourceId menemukan 11 tanpa resource yang masih tersedia, satu menunjuk attempt, satu menunjuk quiz, dan dua menunjuk assignment. Empat referensi yang tersedia cocok course-nya; reference attempt juga cocok user-nya. Jangan memasangkan 11 kasus lainnya berdasarkan label atau mengubah nilainya otomatis. Empat referensi yang bisa ditelusuri masih perlu rencana konversi/proyeksi yang menghindari duplikasi. Semua Grade dibiarkan utuh. |
| LV-05 | P2 — inventaris file | Dry-run menemukan tujuh file yang dapat diregistrasi, nol missing-file/ambiguous-file, dan 13 kandidat orphan berdasarkan resource yang dipindai skrip. Tujuh registrasi disimulasikan dan lolos tes akses. Tiga belas lainnya dipertahankan; label orphan dari skrip bukan izin menghapus file. |
| LV-06 | P2 — scope nilai legacy | Satu submission yang sudah dinilai 100 masih mempunyai enrollment, tetapi tidak memenuhi assignment cohort access saat ini. Proyeksi baru mengecualikannya dan menampilkan pending/null. Operator perlu memutuskan apakah konfigurasi cohort memang dimaksudkan demikian atau perlu koreksi membership/override. Jangan memperluas akses atau memasukkan nilai secara otomatis. |

Dry-run awal menghasilkan tujuh proposal file, 17 needsReview (15 identitas Grade dan dua snapshot attempt selesai), serta 13 kandidat orphan. Pemeriksaan tambahan menemukan snapshot attempt aktif dan perbedaan cohort di atas. Karena itu, angka dari satu skrip bukan daftar lengkap masalah data.

Server mencatat beberapa `The destination stream closed early` saat navigasi browser cepat, tanpa pageerror atau kegagalan halaman yang diperiksa. Respons 404 untuk file belum diregistrasi dan file yang sengaja ditolak juga tercatat. Error stream masih perlu diamati pada staging; hasil ini tidak membuktikan seluruh log server bebas error.

## Bukti lokal

- `.qa/demo-backup-20261012/report.json`: backup/restore dan hash arsip.
- `.qa/demo-validation-20261012/baseline-alignment.sql`, `baseline-diff.txt`, `migration-result.txt`: alignment dan migrasi.
- `.qa/demo-validation-20261012/release-preflight.json`: hasil gate saat ini, termasuk false negative LV-01.
- `.qa/demo-validation-20261012/reconciliation-review.json`, `reconciliation-applied.json`: proposal dan simulasi tujuh registrasi file pada salinan.
- `.qa/demo-validation-20261012/deep-review.json`, `snapshot-shapes.json`, `semantic-data-review.json`: pelestarian tabel, identitas nilai, bentuk snapshot, dan eligibility cohort.
- `.qa/demo-validation-20261012/browser-results.json`, screenshot, `application.log`: 77 pemeriksaan aplikasi.
- `.qa/demo-validation-20261012/worker-results.json`: expiry yang menolak penilaian tanpa snapshot.
- `.qa/demo-validation-20261012/final-data.json`: sumber tidak berubah, nilai historis tidak berubah, dan proyeksi nilai.

## Implikasi untuk VM produksi

Jika produksi dimulai dengan database kosong, data demo ini tidak perlu direkonsiliasi atau dipindahkan. Jalankan migrasi fresh, masukkan data produksi, lalu lakukan smoke test, verifikasi role/scope, worker, backup/restore, serta pemeriksaan data target. Penutupan celah gate LV-01 dicatat pada bagian berikutnya.

## Perbaikan setelah review

| Temuan | Penanganan kode dan bukti |
| --- | --- |
| LV-01 | Preflight sekarang memakai readSnapshot yang sama dengan grading dan worker. JSON null, array kosong, bentuk rusak, opsi/kunci yang tidak cocok, kunci kosong/ambigu, serta poin tidak valid memblokir rilis. Attempt voided dikecualikan. Test PostgreSQL membuktikan JSON null dan kunci rusak diblokir, voided tidak dihitung aktif. Snapshot rusak konsisten memakai error LEGACY_SNAPSHOT_REVIEW agar worker melaporkan needsReview. |
| LV-02 | Schema baseline kini tersedia di repository. release:baseline membuat proposal alignment dengan hash, menolak drift yang tidak dikenal, data duplikat, hash tidak disetujui, serta migration history yang sudah ada. Apply memerlukan backup/maintenance, memeriksa ulang schema/data, hanya menjalankan tiga perubahan DDL yang dikenal, lalu memverifikasi diff kosong sebelum resolve. Rehearsal fresh/baseline/legacy Docker mempertahankan record dan lolos gate schema/data. |
| LV-03 | Review mencakup attempt aktif dan selesai. Snapshot hilang, jawaban di luar snapshot, dan essay dengan grading state tidak lengkap menjadi needsReview. Gate menolak rilis dataset tersebut. Tidak ada rekonstruksi kunci live atau pengubahan skor tanpa bukti. Ini memperbaiki penanganannya; tidak memulihkan bukti historis yang sudah hilang. |
| LV-04 | Tool menelusuri sourceId/course/user, mengusulkan resourceKey untuk referensi yang terbukti, mendeteksi collision, dan memverifikasi ulang fingerprint saat apply. Skor dipertahankan. Test membuktikan identity assignment dapat diterapkan tanpa perubahan skor dan ditolak setelah bukti berubah. Pada salinan demo, empat identity dapat diusulkan dan 11 yang kehilangan sumber tetap needsReview. |
| LV-05 | Review mencakup file snapshot attempt dan registry yang kehilangan binding. Apply memeriksa hash/size, resource/reference/sekolah, dan kondisi registry terbaru. Filename traversal dan symlink file ditolak; target report mencakup port/schema/user. Test membuktikan reference yang berubah ditolak, binding diperbaiki setelah evidence cocok, dan file snapshot tidak salah menjadi orphan. Orphan tetap disimpan tanpa publish/delete otomatis. |
| LV-06 | Review memakai proyeksi nilai produksi dengan client database target yang eksplisit. Submission graded di luar scope dan score tanpa gradedAt ditandai; tool tidak otomatis memperluas membership atau mengubah skor. Test PostgreSQL membuktikan kasus cohort masuk needsReview, skor tetap 100, dan membership tidak ditambahkan. |

deploy.sh menjalankan preflight pra-migrasi, migrasi, lalu release:gate sebelum mengubah symlink/menyalakan PM2. Gate memeriksa data, kolom/index rilis, status migration, dan diff schema; konfirmasi DATA_REVIEW tidak melewati blocker. Target demo hasil restore kini gagal gate karena satu snapshot aktif yang sebelumnya lolos. Tiga jalur rehearsal dengan data bersih lulus gate. Produksi baru menggunakan DB kosong sesuai rencana input data pada VM, sehingga dataset demo yang bermasalah tidak dibawa.

Verifikasi perbaikan: 190 unit test dan 27 integration test lulus; build/typecheck/lint lulus; 19 pengujian browser pada build candidate terbaru lulus. Ada log stream cancellation saat navigasi cepat; tidak ada kegagalan pengujian browser atau pageerror pada skenario tersebut. Pemeriksaan awal 77 browser tetap merupakan bukti build sebelum perbaikan, bukan jumlah ulang build terbaru.

Database demo asli tidak diubah oleh perbaikan ini. Target VM, beban produksi, konfigurasi TLS/Nginx/PM2, serta keseluruhan 56 skenario audit tetap harus dinilai sesuai batas sign-off ledger; laporan ini tidak mengubah temuan fixed menjadi verified tanpa bukti khusus.

Pengujian ini tidak mencakup seluruh mutation/import/export, pengujian beban, TLS/Nginx, PM2 multiworker pada Linux, cutover, atau keputusan operasional data legacy. Hasilnya cukup untuk membuktikan alur restore dan smoke aplikasi pada salinan demo, belum untuk menyatakan seluruh aplikasi siap rilis produksi.
