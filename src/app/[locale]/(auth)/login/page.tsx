import { db } from '@/lib/db';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const school = await db.school.findFirst({
    where: { isActive: true },
    select: {
      name: true,
      logo: true,
    },
  });

  return <LoginForm school={school} />;
}
