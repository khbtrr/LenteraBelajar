import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Memperbarui penamaan sekolah di database...');

  const schools = await prisma.school.findMany();
  console.log('Sekolah sebelum update:', schools.map((s) => ({ id: s.id, name: s.name, code: s.code })));

  for (const s of schools) {
    if (s.code.startsWith('REG') || s.name.toLowerCase().includes('reguler')) {
      await prisma.school.update({
        where: { id: s.id },
        data: {
          name: 'Reguler (SMA Plus PGRI Cibinong Reguler)',
        },
      });
      console.log(`✅ Update sekolah reguler (${s.id}): Reguler (SMA Plus PGRI Cibinong Reguler)`);
    } else {
      await prisma.school.update({
        where: { id: s.id },
        data: {
          name: 'Unggulan-Internasional (SMA Plus PGRI Cibinong)',
        },
      });
      console.log(`✅ Update sekolah plus (${s.id}): Unggulan-Internasional (SMA Plus PGRI Cibinong)`);
    }
  }

  const updatedSchools = await prisma.school.findMany();
  console.log('Sekolah setelah update:', updatedSchools.map((s) => ({ id: s.id, name: s.name, code: s.code })));

  await pool.end();
}

main().catch(console.error);
