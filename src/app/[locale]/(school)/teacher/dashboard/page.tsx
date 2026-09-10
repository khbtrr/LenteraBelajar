import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, ClipboardList, Users } from 'lucide-react';

export default async function TeacherDashboard() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  if (!session?.user) return null;

  const [courseCount, activeCourseCount] = await Promise.all([
    db.course.count({ where: { teacherId: session.user.id } }),
    db.course.count({ where: { teacherId: session.user.id, status: 'ACTIVE' } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#002446]">
        {t('welcome', { name: session.user.name })}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{t('totalCourses')}</CardTitle>
            <BookOpen className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{courseCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{t('activeCourses')}</CardTitle>
            <ClipboardList className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{activeCourseCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{t('totalStudents')}</CardTitle>
            <Users className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">0</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
