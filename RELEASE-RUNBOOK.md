# Runbook rilis LenteraBelajar

Jalur utama: VPS Linux/Node22/PM2, dengan maintenance terjadwal. Source, database, uploads, dan artifact harus ditentukan eksplisit. Perintah di bawah belum dijalankan ke produksi.

## Candidate dan schema

1. Jalankan release checks pada revision yang akan dirilis. `npm run build:artifact` menyiapkan server standalone, static/public, worker, PM2 config, dan manifest. Candidate working tree boleh dipakai untuk review lokal; rilis produksi memakai revision yang sudah ditinjau dan dicatat.
2. Simpan uploads di path absolut bersama di luar direktori release. Ekspor `UPLOAD_DIR`, `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, dan `CBT_WORKER_SECRET` dari file environment privat milik operator. App dan worker PM2 mewarisi environment tersebut. Konfigurasi default dua worker web dapat diubah dengan `WEB_CONCURRENCY`; pool per worker diatur `DB_POOL_MAX`.
3. `RELEASE_DATABASE_URL` memilih target untuk tool migrasi/review. Tool tidak mengambil database produksi secara diam-diam dari `.env`. Jalankan `npm run release:preflight`; tangani duplikat attempt aktif, tahun aktif ganda, pengajuan duplikat, dan snapshot aktif yang belum dapat dinilai.
4. Untuk DB existing tanpa riwayat migration, bandingkan schema aktual dengan schema baseline terlebih dahulu. Hanya jika cocok, operator dapat menjalankan `prisma migrate resolve --applied 20261009000000_baseline --config prisma.config.release.ts`. DB kosong langsung memakai migrate deploy. Rehearsal otomatis untuk dua jalur tersedia melalui `npm run test:migrations` dan hanya membuat database QA lokal.

## Rekonsiliasi tanpa tebakan

Set `RELEASE_UPLOAD_DIR` ke uploads target dan jalankan `npm run release:review-data`. Hasil JSON privat berisi proposal before/after dan SHA256, file missing/orphan/ambiguous, serta identitas Grade legacy yang belum dapat dipastikan. Script tidak menghapus file atau menimpa nilai saat dry-run.

Guru/operator meninjau apakah jawaban historis masih merepresentasikan submission final sebelum menyetujui perhitungan ulang. Snapshot yang hilang atau rusak tidak direkonstruksi dari kunci soal terbaru. Grade tidak dipasangkan berdasarkan judul saja. File lintas resource/sekolah yang ambigu diputuskan eksplisit; unknown tidak dipublikasikan.

Setelah laporan lengkap ditinjau, `npm run release:review-data -- --apply --approved-hash SHA256_LAPORAN` menerapkan proposal yang disetujui. Script memverifikasi target serta fingerprint jawaban/file, dan membatalkan transaksi jika keadaan berubah. Kasus `needsReview` tetap memerlukan penyelesaian tersendiri; command apply bukan sign-off untuk kasus itu.

## Backup, cutover, dan rollback

1. Hentikan attempt baru dan tuntaskan ujian aktif. Pastikan tidak ada attempt yang akan kehilangan draft atau harus dihentikan tanpa keputusan pengawas.
2. Bekukan write aplikasi dan hentikan worker. Backup konsisten dengan pg_dump beserta salinan uploads; uji restore ke DB/path terisolasi dan bandingkan jumlah/hash. Catat lokasi backup, revision lama/baru, waktu, dan hasil.
3. Siapkan artifact di direktori release baru. Jalankan preflight terbaru, baseline/migration yang sesuai, dan rekonsiliasi yang telah ditinjau. Lindungi report dan secrets; keduanya tidak diletakkan dalam public atau commit.
4. `deploy.sh` memerlukan `RELEASE_SOURCE_DIR`, `RELEASE_ARTIFACT_DIR`, `APP_CURRENT_DIR`, `RELEASE_DATABASE_URL`, serta tiga konfirmasi operator bernilai `yes`: `MAINTENANCE_CONFIRMED`, `BACKUP_VERIFIED`, `DATA_REVIEW_CONFIRMED`. Script tidak melakukan git pull/build setelah DB berubah, dan tidak menjanjikan zero downtime.
5. Login lama tanpa versi sesi valid harus masuk kembali. Verifikasi kelima role, scope sekolah, file, materi, normal submit/timeout/proctor, nilai dan export. Worker expiry wajib hidup dengan secret yang sama pada app dan worker. Nginx harus menimpa header IP forwarding; web server hanya bind127.0.0.1.
6. Buka kembali setelah smoke test dan observasi berhasil. Pantau error, pool DB, limiter global, expiry worker, proposal legacy, dan akses file.
7. Jika gagal, pertahankan maintenance. Rollback artifact hanya bila schema additive kompatibel. Jika perlu restore, gunakan DB+uploads dari checkpoint konsisten sebelum write publik dibuka. Setelah menerima data baru, backup lama tidak boleh direstore otomatis karena dapat membuang data baru.

Docker Compose yang ada merupakan lingkungan demo. Jalur rilis utama di atas menggunakan PM2; menjalankan image saja tidak menggantikan migration, review data, atau backup/restore.

## Dependency

Next16.3.8, sharp patched, dan SheetJS0.20.3 digunakan pada candidate ini. SheetJS berasal dari [CDN resmi yang didokumentasikan maintainer](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/), karena registry xlsx lama tidak menyediakan patch yang diperlukan. Override transitif tercatat di package/lockfile dan diperiksa dengan generate/build/test.

Audit runtime setelah update tidak menemukan advisory high/critical pada pemeriksaan lokal; masih ada advisory moderate. Rantai CLI Mammoth/sprintf-js belum mempunyai patch kompatibel di registry; aplikasi memanggil API konversi, tidak CLI formatter, dan DOCX dibatasi input serta ekstraksinya. Tool lint masih memiliki advisory braces untuk pola glob; pola lint berasal dari konfigurasi repo yang ditinjau, bukan input HTTP. Ini pembatasan keterjangkauan, bukan klaim semua dependency bebas advisory. Verifikasi advisory lagi saat cutover.
