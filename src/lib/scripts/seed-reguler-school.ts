import 'dotenv/config';
import { PrismaClient, Role, AcademicYearStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashSync } from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Mendaftarkan entitas SMA Plus PGRI Cibinong Reguler...');

  // 1. Daftarkan / Upsert Sekolah Reguler
  const schoolReguler = await prisma.school.upsert({
    where: { code: 'REG-20232396' },
    update: {
      name: 'SMA Plus PGRI Cibinong Reguler',
      isActive: true,
    },
    create: {
      name: 'SMA Plus PGRI Cibinong Reguler',
      code: 'REG-20232396',
      address: 'Jl. Golf Ciriung No. 1, Cibinong, Kab. Bogor',
      isActive: true,
      defaultPassingGrade: 75,
    },
  });
  console.log('✅ Sekolah Reguler terdaftar:', schoolReguler.name, `(${schoolReguler.id})`);

  // 2. Tahun Ajaran Aktif untuk Sekolah Reguler
  const currentYear = new Date().getFullYear();
  const academicYearReguler = await prisma.academicYear.upsert({
    where: {
      id: `ay-reguler-${currentYear}`,
    },
    update: {},
    create: {
      id: `ay-reguler-${currentYear}`,
      name: `${currentYear}/${currentYear + 1} Ganjil`,
      startDate: new Date(`${currentYear}-07-01`),
      endDate: new Date(`${currentYear}-12-31`),
      status: AcademicYearStatus.ACTIVE,
      schoolId: schoolReguler.id,
    },
  });
  console.log('✅ Tahun Ajaran Sekolah Reguler:', academicYearReguler.name);

  // 3. Akun Admin Sekolah Reguler
  const adminRegulerEmail = 'admin.reguler@smapluspgri.sch.id';
  const adminReguler = await prisma.user.upsert({
    where: { email: adminRegulerEmail },
    update: {
      schoolId: schoolReguler.id,
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      email: adminRegulerEmail,
      passwordHash: hashSync('Lentera123!', 12),
      name: 'Admin SMA Plus PGRI Reguler',
      role: Role.ADMIN,
      schoolId: schoolReguler.id,
      mustChangePassword: false,
    },
  });
  console.log('✅ Admin Sekolah Reguler:', adminReguler.email);

  // 4. Buat Rombel Reguler Contoh (misal: X-REG-1)
  const cohortReguler = await prisma.cohort.upsert({
    where: { id: 'cohort-x-reg-1' },
    update: {},
    create: {
      id: 'cohort-x-reg-1',
      name: 'X-REG-1',
      schoolId: schoolReguler.id,
      isActive: true,
    },
  });
  console.log('✅ Rombel Sekolah Reguler:', cohortReguler.name);

  // 5. Buat Akun Siswa Reguler Contoh untuk pengujian
  const studentRegulerEmail = 'siswa.reguler@smapluspgri.sch.id';
  const studentReguler = await prisma.user.upsert({
    where: { email: studentRegulerEmail },
    update: {
      schoolId: schoolReguler.id,
      role: Role.STUDENT,
      isActive: true,
    },
    create: {
      email: studentRegulerEmail,
      passwordHash: hashSync('Lentera123!', 12),
      name: 'Rian Pratama (Reguler)',
      nis: '23241099',
      role: Role.STUDENT,
      schoolId: schoolReguler.id,
      mustChangePassword: false,
    },
  });

  // Masukkan siswa ke rombel reguler
  await prisma.cohortMember.upsert({
    where: {
      cohortId_userId: {
        cohortId: cohortReguler.id,
        userId: studentReguler.id,
      },
    },
    update: {},
    create: {
      cohortId: cohortReguler.id,
      userId: studentReguler.id,
    },
  });
  console.log('✅ Siswa Sekolah Reguler Terdaftar:', studentReguler.name, `(${studentReguler.email})`);

  console.log('🎉 Seeding Sekolah Reguler Selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Gagal seeding sekolah reguler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
