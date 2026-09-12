# 📚 LenteraBelajar - Modern School Learning Management System (LMS)

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

**LenteraBelajar** adalah Learning Management System (LMS) modern berbasis web yang dirancang khusus untuk sekolah dan institusi pendidikan di Indonesia. Platform ini mengadopsi arsitektur multi-tenancy sekolah, mendukung kurikulum modern, menyuguhkan lingkungan ujian online aman (CBT Lockdown & Proctoring), buku nilai otomatis, presensi QR & token, serta forum interaktif guru dan siswa.

---

## ✨ Fitur Unggulan

### 1. 🛡️ CBT & Keamanan Ujian Lanjutan (Computer Based Test)
- **Token Akses Ujian**: Kode token 6 digit dinamis (dapat di-generate acak atau diatur manual oleh guru) dengan tombol *satu-klik gunakan token* di landing ujian siswa.
- **Mode Proyektor Guru**: Modal layar proyektor berukuran besar dilengkapi QR Code dinamis untuk ditampilkan di depan kelas/aula ujian.
- **CBT Lockdown Environment**:
  - Fullscreen paksa otomatis dengan banner panduan melayang.
  - Pemblokiran klik kanan (*context menu*), proteksi seleksi teks (`select-none`), serta blokir shortcut (`Ctrl+C`, `Ctrl+V`, `Ctrl+U`, `F12`, `PrintScreen`).
  - **Deteksi Pindah Tab/Aplikasi**: Mencatat pelanggaran setiap kali siswa meninggalkan jendela ujian. Dilengkapi peringatan bertahap dan auto-submit paksa saat melampaui toleransi (`maxTabSwitches`).
- **Live Proctoring Dashboard**:
  - Pemantauan ujian real-time (auto-polling 6 detik) dengan indikator koneksi heartbeat online/offline.
  - Aksi pengawas langsung: **+10 Menit Waktu Tambahan**, **Force Submit**, dan **Reset Attempt**.
- **Moodle-Style 1 Question Per Page**: Navigasi keyboard (panah kiri/kanan), palet status nomor soal, serta auto-save draft berkala (lokal & background API).

### 2. 👥 Multi-Role & Multi-Tenancy Sekolah
- **5 Tingkatan Hak Akses**:
  - `SUPER_ADMIN`: Manajemen platform & data sekolah mitra.
  - `ADMIN`: Konfigurasi tahun ajaran, kurikulum/kategori, kelompok belajar (kohort), dan akun pengguna sekolah.
  - `SUPERVISOR`: Monitoring mutu pembelajaran oleh Kepala Sekolah / Pengawas.
  - `TEACHER`: Pembuatan modul, bank soal, kuis CBT, tugas, presensi, buku nilai, dan forum.
  - `STUDENT`: Pengerjaan kuis/tugas, absensi mandiri, partisipasi forum, dan pantau rapor nilai.
- **Import/Export Data Massal**: Dukungan Excel (.xlsx) untuk import pengguna dan export rekap nilai/presensi.

### 3. 📝 Modul Belajar & Bank Soal
- Modul belajar modular per topik/bab pertemuan.
- Dukungan materi interaktif, tautan video/dokumen, serta bank soal terpusat yang bisa diimpor dari dokumen Word (.docx) & Excel (.xlsx).
- Soal Pilihan Ganda (auto-graded) & Essay (dengan interface koreksi manual oleh guru).

### 4. 📅 Presensi Sesi & Token QR Code
- Pembuatan sesi presensi fleksibel (per pertemuan atau topik).
- Mode Absensi Siswa: Token 6-karakter atau scan QR Code langsung di kelas.
- Integrasi 1-klik sinkronisasi persentase kehadiran ke **Buku Nilai (Gradebook)**.

### 5. 💬 Forum Diskusi & Pengumuman Kursus
- Saluran pengumuman resmi kursus dengan kemampuan sematkan (*pin*) & tanggapan komentar.
- Forum tanya-jawab siswa dan guru dengan penandaan **Jawaban Terbaik (Mark as Answer)**.

### 6. 🎨 Antarmuka Modern & Bebas Native Dialog
- Desain bersih bertema *Deep Navy* (`#002446`) dan *Vibrant Orange* (`#FF8928`).
- **100% Bebas dari `window.alert` & `window.confirm`**: Menggunakan komponen custom dialog modal yang estetik, responsive, accessible, dan mendukung dark mode.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16 (App Router & Turbopack)](https://nextjs.org/)
- **Frontend UI**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) dengan [Prisma ORM 7](https://www.prisma.io/)
- **Autentikasi**: [NextAuth.js v5 Beta](https://authjs.dev/)
- **Internasionalisasi**: [next-intl](https://next-intl-docs.vercel.app/) (Dukungan Bahasa Indonesia & Inggris)
- **Editor & Dokumen**: TipTap Editor, Mammoth, docx, XLSX, QRCode

---

## 🚀 Memulai Instalasi Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18.18+ atau 20+
- [PostgreSQL](https://www.postgresql.org/) database aktif

### 1. Clone Repositori
```bash
git clone https://github.com/khbtrr/LenteraBelajar.git
cd LenteraBelajar
```

### 2. Instal Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variable
Salin berkas `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan isi `.env` dengan kredensial PostgreSQL lokal Anda:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/lenterabelajar?schema=public"
NEXTAUTH_SECRET="kunci-rahasia-anda-yang-panjang-dan-acak"
NEXTAUTH_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=50
NEXT_PUBLIC_APP_NAME="LenteraBelajar"
```

### 4. Setup Database & Seeding Demo
Jalankan migrasi skema database Prisma dan isi data awal (sekolah demo, tahun ajaran, dan akun uji coba):
```bash
# Sinkronkan skema ke PostgreSQL
npm run db:push

# Isi data demo (seeding)
npm run db:seed
```

### 5. Jalankan Server Development
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## 🔑 Akun Demo Pengujian (Hasil Seeding)

Setelah menjalankan `npm run db:seed`, Anda dapat langsung masuk dengan akun-akun berikut:

| Peran (Role) | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@lenterabelajar.com` | `SuperAdmin123!` | Manajemen platform multi-sekolah |
| **Admin Sekolah** | `admin@sekolah.sch.id` | `Admin123!` | Kelola pengguna, kohort, tahun ajaran |
| **Kepala Sekolah** | `kepsek@sekolah.sch.id` | `Kepsek123!` | Supervisor & pantau aktivitas pembelajaran |
| **Guru** | `guru@sekolah.sch.id` | `Guru123!` | Pengampu mata pelajaran, CBT & proctoring |
| **Siswa** | `siswa@sekolah.sch.id` | `20261001` | Password awal menggunakan NIS siswa |

---

## 📜 Skrip NPM yang Tersedia

```bash
# Menjalankan development server
npm run dev

# Membangun bundle produksi (typecheck + generate)
npm run build

# Menjalankan server hasil build produksi
npm run start

# Menjalankan linter kode
npm run lint

# Prisma CLI shortcuts
npm run db:push      # Push skema langsung ke database
npm run db:seed      # Menjalankan skrip seed demo
npm run db:studio    # Membuka GUI Prisma Studio di browser
```

---

## 📂 Struktur Direktori Proyek

```plaintext
LenteraBelajar/
├── prisma/                  # Skema database & skrip seeding Prisma
│   ├── schema.prisma
│   └── seed.ts
├── public/                  # Asset publik, ikon, dan template
├── src/
│   ├── app/                 # Next.js App Router (Pages, layouts, & API routes)
│   │   ├── [locale]/        # Halaman dengan routing multibahasa (id/en)
│   │   │   ├── (platform)/  # Rute khusus Super Admin platform
│   │   │   ├── (school)/    # Rute sekolah (admin, guru, siswa, supervisor)
│   │   │   └── dashboard/   # Router redirect role-based
│   │   └── api/             # REST Endpoints (upload, submit draft kuis, export)
│   ├── components/          # Komponen UI (atoms, cards, dialogs, tables)
│   │   ├── providers/       # Theme, Session, Sidebar, dan Dialog Providers
│   │   └── ui/              # Radix UI & Tailwind component library
│   ├── context/             # React Context (DialogContext, ThemeContext, SidebarContext)
│   ├── lib/                 # Utilitas autentikasi, database, dan Server Actions
│   │   ├── actions/         # Server Actions (quiz, proctor, attendance, forum, course, dll.)
│   │   ├── auth.ts          # Konfigurasi NextAuth v5
│   │   └── db.ts            # Client singleton Prisma
│   └── i18n/                # Konfigurasi kamus bahasa & routing next-intl
├── package.json
└── README.md
```

---

## 🤝 Kontribusi & Lisensi
Proyek ini dikembangkan secara tertutup untuk kebutuhan digitalisasi sekolah. Seluruh hak cipta dilindungi oleh **LenteraBelajar**.
