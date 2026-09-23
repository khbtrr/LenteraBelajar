import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Menyiapkan relasi multi-school penugasan...');

  // 1. Ambil kedua sekolah
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: 'asc' },
  });
  console.log('Sekolah terdaftar:', schools.map((s) => `${s.name} (${s.id})`));

  const plusSchool = schools.find((s) => s.code.includes('20232396') && !s.code.startsWith('REG')) || schools[0];
  const regulerSchool = schools.find((s) => s.code.startsWith('REG') || s.name.includes('Reguler')) || schools[1];

  if (!plusSchool || !regulerSchool) {
    console.error('Sekolah Plus atau Reguler tidak ditemukan!');
    return;
  }

  // Cari semua admin
  const admins = await prisma.user.findMany({
    where: { role: { in: [Role.ADMIN, Role.SUPER_ADMIN] } },
    select: { id: true, email: true, name: true, role: true, schoolId: true },
  });
  console.log('Daftar Admin:', admins);

  // Daftarkan semua admin non-reguler (atau admin pertama) ke KEDUA SEKOLAH
  for (const admin of admins) {
    if (admin.email !== 'admin.reguler@smapluspgri.sch.id') {
      await prisma.userSchool.upsert({
        where: {
          userId_schoolId: {
            userId: admin.id,
            schoolId: plusSchool.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          schoolId: plusSchool.id,
        },
      });

      await prisma.userSchool.upsert({
        where: {
          userId_schoolId: {
            userId: admin.id,
            schoolId: regulerSchool.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          schoolId: regulerSchool.id,
        },
      });

      console.log(`✅ Admin ${admin.email} (${admin.name}) berhasil dikaitkan ke KEDUA SEKOLAH!`);
    }
  }

  await pool.end();
}

main().catch(console.error);
