import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, BookOpen, GraduationCap, UserCheck } from 'lucide-react';

export default async function SupervisorDashboard() {
  const session = await auth();
  const t = await getTranslations('dashboard');
  const schoolId = session?.user?.schoolId;

  if (!schoolId) return null;

  const [teacherCount, studentCount, courseCount, activeCourseCount] = await Promise.all([
    db.user.count({ where: { schoolId, role: 'TEACHER' } }),
    db.user.count({ where: { schoolId, role: 'STUDENT' } }),
    db.course.count({ where: { schoolId } }),
    db.course.count({ where: { schoolId, status: 'ACTIVE' } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#002446]">
        {t('welcome', { name: session?.user?.name || '' })}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{t('totalTeachers')}</CardTitle>
            <UserCheck className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{teacherCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">{t('totalStudents')}</CardTitle>
            <GraduationCap className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{studentCount}</p>
          </CardContent>
        </Card>
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
            <Users className="h-5 w-5 text-[#FF8928]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#002446]">{activeCourseCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
