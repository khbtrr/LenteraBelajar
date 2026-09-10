import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { School, Users, BookOpen } from 'lucide-react';

export default async function PlatformDashboard() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  const [schoolCount, userCount, courseCount] = await Promise.all([
    db.school.count(),
    db.user.count(),
    db.course.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#002446]">
        {t('welcome', { name: session?.user?.name || 'Admin' })}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('totalSchools')}
            </CardTitle>
            <School className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{schoolCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('totalUsers')}
            </CardTitle>
            <Users className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{userCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('totalCourses')}
            </CardTitle>
            <BookOpen className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{courseCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
