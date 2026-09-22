# Design Direction: LenteraBelajar

> Arah identitas visual resmi platform LenteraBelajar untuk menjaga konsistensi desain, kejelasan hierarki, dan keterbacaan antarmuka agar terbebas dari pola generik AI Slop.

---

## 1. Identitas & Karakter Produk

- **Nama Produk**: LenteraBelajar
- **Kategori**: School Learning Management System (LMS) Modern
- **Pengguna Sasaran**: Siswa, Guru, Kepala Sekolah / Pengawas, dan Administrator Sekolah di Indonesia.
- **Karakter Visual**: Terpercaya, akademis, rapi, terstruktur, fokus pada keterbacaan materi & integritas evaluasi (CBT).

---

## 2. Dials (Liveliness Toolkit)

- **ENERGY: 1 (Tenang & Fokus)**
  - Mengutamakan kenyamanan membaca materi pelajaran dan pengerjaan ujian. Menghindari elemen visual yang berteriak atau mendistraksi fokus belajar.
- **RHYTHM: 2 (Hierarki Seimbang)**
  - Komposisi antarmuka teratur dengan penekanan terarah pada ringkasan metrik utama, daftar topik/bab, dan status pengerjaan tugas.
- **MOTION: 1 (Hover & Transisi Halus)**
  - Animasi terbatas pada interaksi fungsional (hover tombol, buka/tutup modal dialog, transisi tab). Bebas dari animasi loop atau elemen mengambang terus-menerus.

---

## 3. Palet Warna Resmi

- **Warna Utama (Primary / Brand)**: **Deep Navy (`#002446`)**
  - Digunakan untuk header navigasi, heading utama, tombol aksi primer, dan identitas institusi.
  - Skala turunan:
    - `brand-25`: `#f2f6fa`
    - `brand-50`: `#e5edf5`
    - `brand-100`: `#cddde9`
    - `brand-200`: `#9cbbd4`
    - `brand-300`: `#6b9abe`
    - `brand-400`: `#3b78a9`
    - `brand-500`: `#1a5b93`
    - `brand-600`: `#0c467a`
    - `brand-700`: `#053561`
    - `brand-800`: `#022b52`
    - `brand-900`: `#002446` (Anchor Deep Navy)
    - `brand-950`: `#001428`
- **Warna Aksen (Accent)**: **Vibrant Orange (`#FF8928`)**
  - Digunakan secara selektif pada momen penting: badge status aktif/penting, progres pencapaian kunci, tombol panggilan tindakan sekunder berbobot tinggi.
  - Skala turunan:
    - `accent-50`: `#fff7ed`
    - `accent-100`: `#ffedd5`
    - `accent-200`: `#fed7aa`
    - `accent-300`: `#fdba74`
    - `accent-400`: `#fb923c`
    - `accent-500`: `#ff8928` (Anchor Vibrant Orange)
    - `accent-600`: `#ea580c`
    - `accent-700`: `#c2410c`
- **Warna Netral (Base)**: Slate / Gray standar web modern untuk latar belakang, border, dan teks pendukung yang memenuhi standar rasio kontras WCAG AA (minimal 4.5:1).

---

## 4. Tipografi

- **Font Keluarga**: Outfit dengan cadangan Inter, system-ui, sans-serif.
- **Hierarki**: Heading berbobot tebal (`font-bold` / `font-semibold`), teks tubuh berbobot normal (`font-normal`), bebas dari huruf monospace dekoratif untuk elemen non-kode.

---

## 5. Pedoman Komponen & Craftsmanship

- **Permukaan Kartu**: Solid atau tint warna tunggal yang lembut. Hindari percampuran gradien acak (misal ungu ke hijau ke kuning) tanpa fungsi hierarki.
- **Bebas Em Dash (`—`)**: Gunakan tanda pemisah yang wajar (`:`, `,`, `-`, atau tanda kurung).
- **Aksesibilitas**: Seluruh elemen interaktif harus memiliki indikator fokus yang jelas (`focus-visible:ring-2`) dan dapat dioperasikan penuh melalui keyboard.
