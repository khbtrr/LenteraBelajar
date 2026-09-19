import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Layers, CalendarCheck, MessageSquare } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getTranslations } from 'next-intl/server';

export default async function StudentMyCoursesPage() {
  const t = await getTranslations('studentCourses');
  const session = await auth();
  if (!session?.user) return null;

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true, status: true } },
          _count: {
            select: { modules: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">{t('title')}</h1>
        <p className="text-sm text-gray-500">
          {t('subtitle')}
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#002446]">
                {t('emptyTitle')}
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {t('emptyDesc')}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrollments.map((enr) => {
            const course = enr.course;
            const isArchived = course.status === 'ARCHIVED' || course.academicYear.status === 'ARCHIVED';

            return (
              <Card
                key={course.id}
                className="flex flex-col justify-between border hover:shadow-md transition-shadow bg-white"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      {course.category?.name || t('generalCategory')}
                    </Badge>
                    <Badge
                      className={
                        !isArchived
                          ? 'bg-[#FF8928] text-white'
                          : 'bg-gray-200 text-gray-700'
                      }
                    >
                      {!isArchived ? t('activeStatus') : t('archivedStatus')}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-[#002446] line-clamp-2 mt-2">
                    {course.title}
                  </CardTitle>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium mt-1">
                    <User className="h-3.5 w-3.5 text-[#002446]" />
                    <span>{course.teacher.name}</span>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {course.description && (
                    <p className="text-gray-600 line-clamp-2 text-xs">
                      {course.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Layers className="h-4 w-4 text-[#002446]" />
                      {t('modulesCount', { count: course._count.modules })}
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {course.academicYear.name}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t bg-gray-50/50 flex flex-col gap-2">
                  <Link
                    href={`/student/course/${course.id}/modules`}
                    className="w-full"
                  >
                    <Button
                      className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center justify-center gap-1.5"
                      size="sm"
                    >
                      <BookOpen className="h-4 w-4" /> {t('enterModulesBtn')}
                    </Button>
                  </Link>

                  <div className="w-full grid grid-cols-2 gap-2">
                    <Link
                      href={`/student/course/${course.id}/attendance`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                      >
                        <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" /> {t('attendanceBtn')}
                      </Button>
                    </Link>

                    <Link
                      href={`/student/course/${course.id}/forum`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs border-[#002446] text-[#002446] hover:bg-blue-50"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-[#002446]" /> {t('forumBtn')}
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
