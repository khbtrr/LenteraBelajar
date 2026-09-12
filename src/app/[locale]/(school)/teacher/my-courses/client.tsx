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

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
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
  currentUserId,
}: {
  initialCourses: any[];
  academicYears: AcademicYear[];
  categories: Category[];
  currentUserId: string;
}) {
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');

  const handleCreateDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      alert('Pilih Tahun Ajaran aktif terlebih dahulu');
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
      });

      const selectedYear = academicYears.find((y) => y.id === academicYearId);
      const selectedCategory = categories.find((c) => c.id === categoryId);

      setCourses((prev) => [
        {
          ...created,
          category: selectedCategory || null,
          academicYear: selectedYear || { id: '', name: '-', status: 'ACTIVE' },
          _count: { enrollments: 0, modules: 0 },
        },
        ...prev,
      ]);

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error(err);
      alert('Gagal membuat course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          Total <strong>{courses.length}</strong> course diampu
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link href="/teacher/request-course">
            <Button
              variant="outline"
              className="border-accent-500 text-accent-600 dark:text-accent-400 hover:bg-accent-500 hover:text-white dark:hover:bg-accent-600 flex items-center gap-1.5 transition-colors"
            >
              <Send className="h-4 w-4" /> Ajukan Course ke Admin
            </Button>
          </Link>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Buat Langsung
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300 dark:text-gray-600" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Belum Ada Course</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Anda belum memiliki course aktif. Buat course secara langsung atau ajukan request ke administrator sekolah.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={() => setIsCreateOpen(true)}>
                Buat Course Sekarang
              </Button>
              <Link href="/teacher/request-course">
                <Button variant="outline">Ajukan ke Admin</Button>
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
                    <Badge variant="outline" className="text-xs">
                      {course.category?.name || 'Umum'}
                    </Badge>
                    <Badge
                      className={
                        isActive
                          ? 'bg-accent-500 text-white'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }
                    >
                      {isActive ? 'Aktif' : 'Arsip'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold line-clamp-2 mt-2">
                    {course.title}
                  </CardTitle>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Tahun Ajaran: {course.academicYear.name}
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
                      {course._count.enrollments} Siswa Terdaftar
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="h-4 w-4 text-brand-500 dark:text-brand-400" />
                      {course._count.modules} Modul
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
                        <Layers className="h-3.5 w-3.5" /> Modul
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
                        <Users className="h-3.5 w-3.5" /> Siswa
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
                        <FileSpreadsheet className="h-3.5 w-3.5" /> Nilai
                      </Button>
                    </Link>
                  </div>

                  <div className="w-full grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                    <Link
                      href={`/teacher/course/${course.id}/attendance`}
                      className="w-full"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium"
                      >
                        <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" /> Presensi
                      </Button>
                    </Link>

                    <Link
                      href={`/teacher/course/${course.id}/forum`}
                      className="w-full"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full flex items-center justify-center gap-1 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium"
                      >
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" /> Forum
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
                Buat Course Langsung
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tCourseTitle" className="text-gray-700 dark:text-gray-300">Judul Course</Label>
                <Input
                  id="tCourseTitle"
                  placeholder="misal: Fisika Dasar Semester 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tCourseDesc" className="text-gray-700 dark:text-gray-300">Deskripsi</Label>
                <Input
                  id="tCourseDesc"
                  placeholder="Ringkasan materi atau tujuan pembelajaran"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tCourseYear" className="text-gray-700 dark:text-gray-300">Tahun Ajaran</Label>
                  <select
                    id="tCourseYear"
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === 'ACTIVE' ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tCourseCat" className="text-gray-700 dark:text-gray-300">Kategori</Label>
                  <select
                    id="tCourseCat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-brand-500 transition-colors"
                  >
                    <option value="">-- Pilih Kategori (Mapel) --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent ? `${c.parent.name} → ${c.name}` : `${c.name} (Tahun Ajaran)`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Buat Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
