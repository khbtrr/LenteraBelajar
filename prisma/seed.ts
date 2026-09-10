import 'dotenv/config';
import { PrismaClient, Role, AcademicYearStatus, CourseStatus, EnrollmentMethod } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashSync } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Memulai proses seeding database LenteraBelajar...');

  // 1. Super Admin (Platform level)
  const superAdminEmail = 'superadmin@lenterabelajar.com';
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      email: superAdminEmail,
      passwordHash: hashSync('SuperAdmin123!', 10),
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      schoolId: null,
      mustChangePassword: false,
    },
  });
  console.log('✅ Super Admin:', superAdmin.email);

  // 2. Demo School (Tenant)
  const school = await prisma.school.upsert({
    where: { code: 'SMALH' },
    update: {},
    create: {
      name: 'SMA Lentera Harapan',
      code: 'SMALH',
      address: 'Jl. Pendidikan No. 10, Jakarta',
      isActive: true,
    },
  });
  console.log('✅ Sekolah Demo:', school.name);

  // 3. Admin Sekolah
  const admin = await prisma.user.upsert({
    where: { email: 'admin@sekolah.sch.id' },
    update: {},
    create: {
      email: 'admin@sekolah.sch.id',
      passwordHash: hashSync('Admin123!', 10),
      name: 'Administrator Sekolah',
      role: Role.ADMIN,
      schoolId: school.id,
      mustChangePassword: false,
    },
  });
  console.log('✅ Admin Sekolah:', admin.email);

  // 4. Guru Pengampu
  const teacher = await prisma.user.upsert({
    where: { email: 'guru@sekolah.sch.id' },
    update: {},
    create: {
      email: 'guru@sekolah.sch.id',
      passwordHash: hashSync('Guru123!', 10),
      name: 'Budi Santoso, S.Pd.',
      nip: '198501012010011001',
      role: Role.TEACHER,
      schoolId: school.id,
      mustChangePassword: false,
    },
  });
  console.log('✅ Guru:', teacher.email);

  // 5. Kepala Sekolah / Supervisor
  const supervisor = await prisma.user.upsert({
    where: { email: 'kepsek@sekolah.sch.id' },
    update: {},
    create: {
      email: 'kepsek@sekolah.sch.id',
      passwordHash: hashSync('Kepsek123!', 10),
      name: 'Dr. H. Ahmad Wijaya, M.Pd.',
      nip: '197505122000031002',
      role: Role.SUPERVISOR,
      schoolId: school.id,
      mustChangePassword: false,
    },
  });
  console.log('✅ Kepala Sekolah / Supervisor:', supervisor.email);

  // 6. Siswa (Password awal = NIS 20261001)
  const student = await prisma.user.upsert({
    where: { email: 'siswa@sekolah.sch.id' },
    update: {},
    create: {
      email: 'siswa@sekolah.sch.id',
      passwordHash: hashSync('20261001', 10), // Password default adalah NIS
      name: 'Ahmad Fauzan',
      nis: '20261001',
      role: Role.STUDENT,
      schoolId: school.id,
      mustChangePassword: true, // Wajib ganti password saat login pertama kali
    },
  });
  console.log('✅ Siswa:', student.email, '(Password: 20261001 - Sesuai NIS)');

  // 7. Tahun Ajaran Aktif
  const academicYear = await prisma.academicYear.upsert({
    where: { id: 'ay-2026-2027' },
    update: {},
    create: {
      id: 'ay-2026-2027',
      name: '2026/2027',
      startDate: new Date('2026-07-15'),
      endDate: new Date('2027-06-20'),
      status: AcademicYearStatus.ACTIVE,
      schoolId: school.id,
    },
  });
  console.log('✅ Tahun Ajaran Aktif:', academicYear.name);

  // 8. Kategori: Tahun Ajaran (Utama) -> Mata Pelajaran
  const rootCategory = await prisma.category.upsert({
    where: { id: 'cat-ta-2026' },
    update: {},
    create: {
      id: 'cat-ta-2026',
      name: 'TA 2026/2027',
      slug: 'ta-2026-2027',
      parentId: null,
      schoolId: school.id,
      order: 0,
    },
  });

  const subjectCategory = await prisma.category.upsert({
    where: { id: 'cat-mapel-mtk' },
    update: {},
    create: {
      id: 'cat-mapel-mtk',
      name: 'Matematika',
      slug: 'matematika',
      parentId: rootCategory.id,
      schoolId: school.id,
      order: 1,
    },
  });
  console.log('✅ Kategori:', rootCategory.name, '->', subjectCategory.name);

  // 9. Course Demo
  const course = await prisma.course.upsert({
    where: { id: 'course-mtk-x' },
    update: {},
    create: {
      id: 'course-mtk-x',
      title: 'Matematika Wajib Kelas X',
      description: 'Mata pelajaran Matematika Wajib untuk seluruh siswa kelas X semester ganjil.',
      schoolId: school.id,
      teacherId: teacher.id,
      categoryId: subjectCategory.id,
      academicYearId: academicYear.id,
      status: CourseStatus.ACTIVE,
    },
  });
  console.log('✅ Course Demo:', course.title);

  // 10. Grup Kohort
  const cohort = await prisma.cohort.upsert({
    where: { id: 'cohort-x-mipa-1' },
    update: {},
    create: {
      id: 'cohort-x-mipa-1',
      name: 'Kohort-X-MIPA-1-2026',
      schoolId: school.id,
    },
  });

  // Masukkan siswa ke dalam kohort
  await prisma.cohortMember.upsert({
    where: {
      cohortId_userId: {
        cohortId: cohort.id,
        userId: student.id,
      },
    },
    update: {},
    create: {
      cohortId: cohort.id,
      userId: student.id,
    },
  });

  // Daftarkan siswa ke course via Cohort Sync
  await prisma.enrollment.upsert({
    where: {
      courseId_userId: {
        courseId: course.id,
        userId: student.id,
      },
    },
    update: {},
    create: {
      courseId: course.id,
      userId: student.id,
      cohortId: cohort.id,
      method: EnrollmentMethod.COHORT_SYNC,
    },
  });
  console.log('✅ Grup Kohort & Enrollment Siswa Siap!');

  console.log('🎉 Seeding selesai! Database siap digunakan.');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
