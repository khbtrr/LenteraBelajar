# Ledger perbaikan QA

Baseline: QA-AUDIT-2026-10-09.md. Implementasi dilakukan pada working tree yang sudah berisi perubahan lokal; snapshot source/diff awal disimpan di `.qa/`. Tidak ada deployment, reset DB aplikasi, atau apply koreksi historis produksi.

`fixed` berarti kode perbaikan tersedia dan pemeriksaan umum lulus; `verified` mempunyai regression/integration/browser khusus. Ini belum sign-off database produksi: schema drift, data ambigu, kapasitas, serta cutover memerlukan gate runbook pada target nyata.

| ID | Status | Implementasi dan bukti |
| --- | --- | --- |
| QA-01 | verified | Getter course diperbaiki; typecheck dan build produksi lulus. |
| QA-02 | verified | Assignment sekolah hanya SUPER_ADMIN; test admin self-assignment lintas tenant ditolak. |
| QA-03 | verified | DTO user whitelist dan role guard; test PostgreSQL respons tanpa passwordHash. |
| QA-04 | verified | Course guard + module DTO siswa; unit/integration akses privat lintas tenant ditolak. |
| QA-05 | fixed | Cohort/enrollment/promosi/kelulusan memvalidasi resource, sekolah, role, dan membership sumber; test foreign enrollment ditolak. |
| QA-06 | fixed | Preflight import serta create/update terpisah dengan scope predicate; tidak upsert akun global tanpa otorisasi. |
| QA-07 | fixed | Direktori siswa dibatasi role/school; kandidat lintas sekolah hanya lewat course management yang diotorisasi. |
| QA-08 | fixed | Update isCrossSchool membatasi perubahan ke SUPER_ADMIN. |
| QA-09 | fixed | Validasi year/category/teacher/parent dan target cohort pada mutation/import. |
| QA-10 | verified | SessionVersion dan status DB pada server guard/JWT callback; semua jalur reset/change password mencabut sesi. Unit akun inactive/revoked lulus. |
| QA-11 | verified | Flag ganti password berasal dari DB; client update tidak menghapus kewajiban; unit regression lulus. |
| QA-12 | verified | Counter failed-password row lock; lima permintaan bersamaan mencapai threshold5. |
| QA-13 | verified | Helper reward/notifikasi menjadi server-only; manifest candidate tidak mendaftarkan awardXp/createNotification/touchDailyStreak sebagai action. |
| QA-14 | verified | Filter conversation menggunakan AND; pencarian peserta B oleh admin A menghasilkan nol hasil. |
| QA-15 | fixed | Guard course/module/item/bank diterapkan ke mutator; negative module/roster tests lulus. |
| QA-16 | verified | Enrollment/publication/cohort/target-remedial menjadi guard bersama; materi siswa difilter dan token dibuang. |
| QA-17 | fixed | Analisis/remedial menolak siswa dan memeriksa scope course untuk staff. |
| QA-18 | fixed | Kategori bank dan query pool diikat course target; jumlah pilihan divalidasi. |
| QA-19 | verified | Registri/binding file, private no-store, staged uploader dan resource checks; test foreign read ditolak, authorized read/Range lulus. |
| QA-20 | verified | Sanitizer pada input/render HTML; unit malicious HTML dan browser legacy SVG handler inert. |
| QA-21 | fixed | Bulk attendance memvalidasi seluruh record dan update id+sessionId. |
| QA-22 | fixed | Calendar mutation memvalidasi scope/creator/course; supervisor read-only. |
| QA-23 | fixed | Comment/parent/answer harus berasal dari thread target. |
| QA-24 | verified | Waktu server menolak perubahan jawaban setelah batas; integration mempertahankan draft sebelum expiry. |
| QA-25 | verified | Submit/force/termination memakai finalizer sama; saved correct answer force-submit menghasilkan100. |
| QA-26 | verified | Getter siswa menghapus snapshot grading; unit/integration/browser payload tanpa _correctData. |
| QA-27 | verified | Participant lock dan unique active attempt; delapan start bersamaan menghasilkan satu attempt. |
| QA-28 | verified | Save/finalize/proctor menggunakan lock yang sama dan finalisasi idempoten; dua submit menghasilkan hasil sama, draft final ditolak. |
| QA-29 | verified | Essay dibatasi poin snapshot dan jenis soal; score20 pada max2 ditolak, score2 menghasilkan100. |
| QA-30 | verified | Submission/Grade transaction memakai score tervalidasi sama; score120 pada max10 ditolak. |
| QA-31 | verified | Layanan course grades/proyeksi remedial bersama; integration bank remedial menghasilkan nilai induk75. |
| QA-32 | verified | Semua grading memakai snapshot; perubahan kunci setelah start tidak mengubah hasil jawaban awal. |
| QA-33 | fixed | Identitas Grade course/user/resourceKey, bukan judul; essay/proctor/objective memakai sinkronisasi bersama. |
| QA-34 | fixed | Gradebook/overview/leger memakai course-grades; pending dikecualikan dan tugas dinormalisasi. |
| QA-35 | verified | Analisis/generator membaca snapshot bank; integration menghasilkan butir dan remedial dari versi yang tersimpan. |
| QA-36 | verified | Satu best graded attempt per siswa, denominator exposure, parser complex bersama; opsi JSON dihitung benar. |
| QA-37 | fixed | Server endAt dan heartbeat memperbarui timer; duration tidak ditambah dua kali. |
| QA-38 | verified | REST/action/proctor memakai finalizer+reward eventKey sama; XP tercatat lewat jalur normal. |
| QA-39 | fixed | Progress memvalidasi content/course/enrollment; progress/reward atomic dan XP increment/idempotency key. |
| QA-40 | fixed | Record virtual di-upsert dari session/user yang terdaftar; UI mengirim sessionId. |
| QA-41 | fixed | Check-in memeriksa startTime dan endTime server. |
| QA-42 | verified | PLANNED untuk makeActive=false; PostgreSQL regression lulus. |
| QA-43 | verified | Aktivasi/arsip transaction dengan validasi target dan school lock; invalid target tidak mengarsipkan tahun aktif. |
| QA-44 | fixed | Review request row lock, transisi PENDING/idempoten, create course atomik dan unique courseId. |
| QA-45 | verified | Batas byte/entries/ratio/time, inflate bounded sebelum buffer besar; ZIP/gzip oversized regression ditolak. |
| QA-46 | fixed | Filter mencakup tipe legacy/produsen forum/pengumuman. |
| QA-47 | fixed | CSP frame/media allowlist dan normalize URL; custom provider perlu origin yang ditinjau. |
| QA-48 | verified | CTA oranye diselaraskan navy/dark-orange, termasuk override dark default; browser assertion minimal4.5 lulus, navy/oranye terukur6.61:1. Pemeriksaan seluruh screen tetap gate staging. |
| QA-49 | fixed | Accessible names, focus-visible global, sidebar collapsed labels dan theme control. |
| QA-50 | verified | Drawer Radix, closed DOM tidak focusable, Escape/focus restore; browser mobile/tablet lulus pada pemeriksaan awal. |
| QA-51 | fixed | Loop pulse/ping dekoratif dihapus; reduced-motion diterapkan. |
| QA-52 | verified | Migration SQL berversi, config target eksplisit, fresh/existing-schema rehearsal dan Docker bootstrap service. Restore QA mempertahankan record legacy. |
| QA-53 | verified | PostgreSQL limiter dibuktikan dua proses:16 permintaan,10 accepted,6 rejected. |
| QA-54 | verified | Enam direktori skill lokal tersedia; pointer AGENTS.md dapat dibaca. |
| QA-55 | verified | Test produksi ditambahkan pada unit, PostgreSQL, worker/migration, dan browser autentikasi nyata; test salinan lama bukan bukti utama. |
| QA-56 | fixed | Badge memakai total unread count, terpisah dari daftar20 terbaru. |

## Verifikasi yang sudah dilakukan

- Unit:170 test pada23 file lulus pada pemeriksaan terakhir.
- PostgreSQL:19 test terhadap modul/action produksi lulus.
- Rehearsal: DB kosong dan schema existing berhasil; record legacy dipertahankan. Backup/restore DB QA dan uploads hash cocok.
- Worker limiter: dua proses menggunakan satu kuota global.
- Build artifact: Next16.3.8 standalone berhasil; tracing uploads dan deprecation middleware diperbaiki.
- Browser candidate terakhir:19 skenario lulus dengan exit0 dalam39.8s, memakai tombol tema nyata dan assertion kontras pada320/768/1280 px. Ada log SSR stream cancellation saat navigasi cepat; tidak ada pageerror pada skenario yang diperiksa, tetapi observasi server tetap diperlukan di staging.
- Lint/typecheck: pemeriksaan terakhir bersih tanpa error/warning lint. Artifact standalone terakhir berhasil dibangun.

## Batas sign-off

Target produksi belum diperiksa atau diubah. Proposal rekonsiliasi belum di-apply. `fixed` yang belum mempunyai test khusus tetap memerlukan verifikasi lanjutan; tidak seluruh56 dinyatakan verified. Kapasitas peserta nyata, semua kombinasi feature/role/browser, dan data legacy ambigu belum ditutup oleh fixture QA ini. Runbook menjelaskan gate dan rollback sebelum membuka rilis.
