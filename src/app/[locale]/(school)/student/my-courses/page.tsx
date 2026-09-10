import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User, Layers, CheckCircle } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function StudentMyCoursesPage() {
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
        <h1 className="text-2xl font-bold text-[#002446]">Course Saya</h1>
        <p className="text-sm text-gray-500">
          Daftar mata pelajaran yang Anda ikuti pada semester / tahun ajaran aktif.
        </p>
      </div>

      {enrollments.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#002446]">
                Belum Terdaftar di Course
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Anda belum terdaftar pada course manapun. Guru mata pelajaran atau administrator sekolah akan mendaftarkan Anda melalui grup kohort kelas Anda.
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
                      {course.category?.name || 'Umum'}
                    </Badge>
                    <Badge
                      className={
                        !isArchived
                          ? 'bg-[#FF8928] text-white'
                          : 'bg-gray-200 text-gray-700'
                      }
                    >
                      {!isArchived ? 'Aktif' : 'Arsip'}
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
                      {course._count.modules} Modul Materi
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      {course.academicYear.name}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t bg-gray-50/50">
                  <Link
                    href={`/student/course/${course.id}/modules`}
                    className="w-full"
                  >
                    <Button
                      className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center justify-center gap-1.5"
                      size="sm"
                    >
                      <BookOpen className="h-4 w-4" /> Masuk ke Kelas
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
