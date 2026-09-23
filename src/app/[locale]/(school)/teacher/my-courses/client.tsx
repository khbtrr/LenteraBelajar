'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Plus, Users, Layers, Send, ExternalLink, FileSpreadsheet, CalendarCheck, MessageSquare } from 'lucide-react';
import { createCourse } from '@/lib/actions/course';
import { Link } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { useDialog } from '@/context/DialogContext';

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
  isCrossSchool?: boolean;
  school?: { id: string; name: string; code: string } | null;
  category: { id: string; name: string } | null;
  academicYear: { id: string; name: string; status: string };
  _count: { enrollments: number; modules: number };
}

interface AcademicYear {
  id: string;
  name: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  parent?: { id: string; name: string } | null;
}

export function TeacherCoursesClient({
  initialCourses,
  academicYears,
  categories,
  canCreateDirect = true,
  currentUserId,
}: {
  initialCourses: CourseItem[];
  academicYears: AcademicYear[];
  categories: Category[];
  canCreateDirect?: boolean;
  currentUserId: string;
}) {
  const t = useTranslations('teacherCourses');
  const { showAlert } = useDialog();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCrossSchool, setIsCrossSchool] = useState(false);
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');

  const handleCreateDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      await showAlert(t('selectYearWarn'), { type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const created = await createCourse({
        title,
        description,
        academicYearId,
        categoryId: categoryId || undefined,
        teacherId: currentUserId,
        isCrossSchool,
      });

      const selectedYear = academicYears.find((y) => y.id === academicYearId);
      const selectedCategory = categories.find((c) => c.id === categoryId);

      setCourses((prev) => [
        {
          ...created,
          isCrossSchool: created.isCrossSchool,
          category: selectedCategory || null,
          academicYear: selectedYear || { id: '', name: '-', status: 'ACTIVE' },
          _count: { enrollments: 0, modules: 0 },
        },
        ...prev,
      ]);

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setIsCrossSchool(false);
      await showAlert(t('successCreated', { title: created.title }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('failedCreated'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {t('totalTaught', { count: courses.length })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/request-course">
            <Button
              variant="outline"
              className="border-accent-500 text-accent-600 dark:text-accent-400 hover:bg-accent-500 hover:text-white dark:hover:bg-accent-600 flex items-center gap-1.5 transition-colors"
            >
              <Send className="h-4 w-4" /> {t('requestCourse')}
            </Button>
          </Link>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> {t('createDirect')}
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('emptyTitle')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                {t('emptyDesc')}
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={() => setIsCreateOpen(true)}>
                {t('createCourseNow')}
              </Button>
              <Link href="/teacher/request-course">
                <Button variant="outline">{t('requestToAdmin')}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const isActive = course.status === 'ACTIVE';
            return (
              <Card
                key={course.id}
                className="flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {course.category?.name || t('generalCategory')}
                      </Badge>
                      {course.school && (
                        <Badge variant="secondary" className="text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          {course.school.code.startsWith('REG') ? 'Reguler' : 'SMA Plus'}
                        </Badge>
                      )}
                      {course.isCrossSchool && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px] font-bold">
                          Student Day
                        </Badge>
                      )}
                    </div>
                    <Badge
                      className={
                        isActive
                          ? 'bg-accent-500 text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }
                    >
                      {isActive ? t('active') : t('archived')}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold line-clamp-2 mt-2">
                    {course.title}
                  </CardTitle>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {t('academicYear')}: {course.academicYear.name}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {course.description && (
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2 text-xs">
                      {course.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="h-4 w-4 text-accent-500" />
                      {t('enrolledStudents', { count: course._count.enrollments })}
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                      {t('modulesCount', { count: course._count.modules })}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex flex-col gap-2">
                  <div className="w-full grid grid-cols-3 gap-2">
                    <Link
                      href={`/teacher/course/${course.id}/modules`}
                      className="w-full"
                    >
                      <Button
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs"
                      >
                        <Layers className="h-3.5 w-3.5" /> {t('btnModules')}
                      </Button>
                    </Link>

                    <Link
                      href={`/teacher/course/${course.id}/enrollments`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs"
                      >
                        <Users className="h-3.5 w-3.5" /> {t('btnStudents')}
                      </Button>
                    </Link>

                    <Link
                      href={`/teacher/course/${course.id}/gradebook`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-accent-500 text-accent-600 dark:text-accent-400 hover:bg-accent-500 hover:text-white flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5" /> {t('btnGrades')}
                      </Button>
                    </Link>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <Link
                      href={`/teacher/course/${course.id}/attendance`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border border-emerald-300 dark:border-emerald-600/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-400 dark:hover:border-emerald-500 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
                      >
                        <CalendarCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {t('btnAttendance')}
                      </Button>
                    </Link>

                    <Link
                      href={`/teacher/course/${course.id}/forum`}
                      className="w-full"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border border-blue-300 dark:border-blue-600/50 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-400 dark:hover:border-blue-500 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> {t('btnForum')}
                      </Button>
                    </Link>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Buat Langsung */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateDirect}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {t('createModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tCourseTitle" className="text-gray-700 dark:text-gray-300">{t('courseTitle')}</Label>
                <Input
                  id="tCourseTitle"
                  placeholder={t('courseTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tCourseDesc" className="text-gray-700 dark:text-gray-300">{t('courseDesc')}</Label>
                <Input
                  id="tCourseDesc"
                  placeholder={t('courseDescPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tCourseYear" className="text-gray-700 dark:text-gray-300">{t('activeAcademicYear')}</Label>
                  <select
                    id="tCourseYear"
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === 'ACTIVE' ? `(${t('active')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tCourseCat" className="text-gray-700 dark:text-gray-300">{t('category')}</Label>
                  <select
                    id="tCourseCat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                  >
                    <option value="">{t('selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent ? `${c.parent.name} → ${c.name}` : `${c.name} (${t('academicYear')})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20">
                <input
                  type="checkbox"
                  id="tCourseCrossSchool"
                  checked={isCrossSchool}
                  onChange={(e) => setIsCrossSchool(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="tCourseCrossSchool" className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
                    Program Student Day (Lintas Sekolah)
                  </Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Buka pendaftaran siswa gabungan dari SMA Plus PGRI Cibinong & Reguler untuk kelas vokasi hari Sabtu.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? t('creating') : t('btnCreate')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
