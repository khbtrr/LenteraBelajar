# LenteraBelajar: School Learning Management System

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat-square&logo=tailwind-css)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)

**LenteraBelajar** adalah Learning Management System (LMS) berbasis web untuk sekolah di Indonesia. Platform ini mengusung arsitektur multi-tenancy per sekolah, ujian online (CBT) dengan proctoring dan lockdown browser, rekap nilai otomatis, presensi kelas via QR code dan token, serta forum diskusi siswa dan guru.

---

## Fitur Utama

### 1. Ujian Online (CBT) dan Keamanan Evaluasi
- **Token Akses Ujian**: Token 6 digit acak atau manual, dilengkapi opsi pengisian otomatis langsung dari halaman tunggu ujian.
- **Tampilan Proyektor Guru**: Modal layar proyektor dengan QR code dinamis untuk absensi atau pembagian token ujian di kelas.
- **Lingkungan Ujian Terkunci (CBT Lockdown)**:
  - Mode layar penuh otomatis dengan banner status ujian.
  - Pembatasan klik kanan, proteksi seleksi teks, dan penonaktifan pintasan keyboard (`Ctrl+C`, `Ctrl+V`, `Ctrl+U`, `F12`, `PrintScreen`).
  - Pencatatan log perpindahan tab atau aplikasi siswa, disertai toleransi peringatan sebelum pengumpulan otomatis.
- **Dasbor Pengawas Langsung (Live Proctoring)**:
  - Pemantauan progres siswa secara berkala (interval 6 detik) dengan indikator status koneksi.
  - Tindakan pengawas di tempat: penambahan waktu ujian (+10 menit), pengumpulan paksa, dan reset sesi pengerjaan.
- **Tampilan Satu Soal per Halaman**:
  - Navigasi keyboard (panah kiri dan kanan), palet nomor soal, dan penyimpanan berkala jawaban draft ke penyimpanan lokal dan server.

### 2. Multi-Tenancy dan Peran Pengguna
- **Lima Tingkatan Hak Akses**:
  - `SUPER_ADMIN`: Kelola instansi sekolah dan konfigurasi platform.
  - `ADMIN`: Kelola tahun ajaran, kurikulum, rombongan belajar (kohort), dan data akun pengguna.
  - `SUPERVISOR`: Pemantauan mutu proses belajar bagi Kepala Sekolah dan Pengawas.
  - `TEACHER`: Pembuatan modul ajar, bank soal, kuis CBT, penugasan, presensi, buku nilai, dan forum.
  - `STUDENT`: Pengerjaan kuis dan tugas, absensi mandiri, partisipasi forum, dan pengecekan rekap nilai.
- **Impor dan Ekspor Data**:
  - Format berkas Excel (.xlsx) untuk impor massal akun pengguna dan ekspor rekap nilai serta presensi.

### 3. Modul Materi dan Bank Soal
- Modul belajar terstruktur per topik atau bab pertemuan.
- Dukungan materi teks, berkas dokumen, dan tautan video.
- Impor butir soal dari dokumen Word (.docx) dan Excel (.xlsx).
- Pilihan Ganda dengan penilaian otomatis dan Soal Esai dengan antarmuka koreksi manual bagi guru.

### 4. Presensi Kelas
- Pembuatan sesi presensi per pertemuan atau bab materi.
- Pencatatan kehadiran mandiri oleh siswa melalui token 6 karakter atau pemindaian QR code.
- Sinkronisasi persentase kehadiran langsung ke buku nilai (gradebook).

### 5. Forum Diskusi dan Pengumuman
- Pengumuman resmi kursus dengan fitur semat pesan dan kolom komentar.
- Forum tanya jawab topik materi dengan fitur penandaan jawaban terbaik oleh guru.

### 6. Desain Sistem dan Aksesibilitas
- Palet warna institusional: Deep Navy (`#002446`) dan Vibrant Orange (`#FF8928`).
- Dialog konfirmasi, formulir, dan notifikasi menggunakan komponen modal kustom (tanpa alert bawaan peramban), dengan dukungan dark mode dan navigasi keyboard penuh.

---

## Teknologi

- **Framework**: [Next.js 16 (App Router & Turbopack)](https://nextjs.org/)
- **Frontend UI**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) dengan [Prisma ORM 7](https://www.prisma.io/)
- **Autentikasi**: [NextAuth.js v5 Beta](https://authjs.dev/)
- **Internasionalisasi**: [next-intl](https://next-intl-docs.vercel.app/) (Bahasa Indonesia dan Bahasa Inggris)
- **Editor & Pengolahan Dokumen**: TipTap Editor, Mammoth, docx, XLSX, QRCode

---

## Instalasi Lokal

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18.18+ atau 20+
- Database [PostgreSQL](https://www.postgresql.org/) aktif

### 1. Salin Repositori
```bash
git clone https://github.com/khbtrr/LenteraBelajar.git
cd LenteraBelajar
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (.env)
Salin berkas `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Sesuaikan konfigurasi koneksi database dan rahasia sesi:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/lenterabelajar?schema=public"
NEXTAUTH_SECRET="kunci-rahasia-sesi-acak-minimal-32-karakter"
NEXTAUTH_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=50
NEXT_PUBLIC_APP_NAME="LenteraBelajar"
```

### 4. Setup Database dan Data Awal (Seeding)
Jalankan migrasi skema database Prisma dan isi data awal untuk pengujian:
```bash
# Sinkronkan skema ke PostgreSQL
npm run db:push

# Masukkan data demo sekolah, akun, dan tahun ajaran
npm run db:seed
```

### 5. Jalankan Server Pengembangan
```bash
npm run dev
```
Akses aplikasi melalui peramban di [http://localhost:3000](http://localhost:3000).

---

## Akun Demo Pengujian

Setelah menjalankan `npm run db:seed`, akun uji coba berikut siap digunakan:

| Peran (Role) | Email | Password | Keterangan |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@lenterabelajar.com` | `SuperAdmin123!` | Manajemen platform multi-sekolah |
| **Admin Sekolah** | `admin@sekolah.sch.id` | `Admin123!` | Kelola akun, kohort, dan tahun ajaran |
| **Kepala Sekolah** | `kepsek@sekolah.sch.id` | `Kepsek123!` | Pengawas dan pemantauan pembelajaran |
| **Guru** | `guru@sekolah.sch.id` | `Guru123!` | Pengampu mata pelajaran, CBT, dan buku nilai |
| **Siswa** | `siswa@sekolah.sch.id` | `20261001` | Password awal menggunakan NIS siswa |

---

## Perintah NPM

```bash
# Menjalankan server pengembangan
npm run dev

# Membangun bundle produksi
npm run build

# Menjalankan server hasil build produksi
npm run start

# Menjalankan rangkaian unit test
npm run test

# Menjalankan linter kode
npm run lint

# Utilitas Prisma ORM
npm run db:push      # Menerapkan skema ke database
npm run db:seed      # Mengisi data awal demo
npm run db:studio    # Membuka antarmuka grafis Prisma Studio
```

---

## Struktur Direktori

```plaintext
LenteraBelajar/
├── prisma/                  # Skema database dan skrip seeding Prisma
│   ├── schema.prisma
│   └── seed.ts
├── public/                  # Aset publik, logo, dan berkas statis
├── src/
│   ├── app/                 # Next.js App Router (Halaman, tata letak, dan rute API)
│   │   ├── [locale]/        # Rute dengan lokalisasi bahasa (id/en)
│   │   │   ├── (platform)/  # Rute manajemen Super Admin platform
│   │   │   ├── (school)/    # Rute sekolah (admin, guru, siswa, supervisor)
│   │   │   └── dashboard/   # Pengarah rute berbasis peran pengguna
│   │   └── api/             # Endpoint REST API (unggah berkas, draft kuis, ekspor)
│   ├── components/          # Komponen antarmuka (elemen dasar, dialog, tabel)
│   │   ├── providers/       # Theme, Session, Sidebar, dan Dialog Providers
│   │   └── ui/              # Pustaka komponen Radix UI dan Tailwind CSS
│   ├── context/             # React Context (DialogContext, ThemeContext, SidebarContext)
│   ├── lib/                 # Utilitas autentikasi, database, dan Server Actions
│   │   ├── actions/         # Server Actions (kuis, proctoring, presensi, forum, dll.)
│   │   ├── auth.ts          # Konfigurasi NextAuth v5
│   │   └── db.ts            # Klien Prisma singleton
│   └── i18n/                # Konfigurasi kamus bahasa dan routing next-intl
├── package.json
└── README.md
```

---

## Lisensi

Proyek ini dikembangkan secara tertutup untuk kebutuhan digitalisasi sekolah. Hak cipta dilindungi oleh **LenteraBelajar**.
