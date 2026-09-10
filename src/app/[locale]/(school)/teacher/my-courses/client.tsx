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
import { BookOpen, Plus, Users, Layers, Send, ExternalLink, FileSpreadsheet } from 'lucide-react';
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
              className="border-[#FF8928] text-[#FF8928] hover:bg-[#FF8928] hover:text-white flex items-center gap-1.5"
            >
              <Send className="h-4 w-4" /> Ajukan Course ke Admin
            </Button>
          </Link>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Buat Langsung
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="space-y-4">
            <BookOpen className="h-16 w-16 mx-auto text-gray-300" />
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#002446]">Belum Ada Course</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Anda belum memiliki course aktif. Buat course secara langsung atau ajukan request ke administrator sekolah.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={() => setIsCreateOpen(true)} className="bg-[#002446] text-white">
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
                className="flex flex-col justify-between border hover:shadow-md transition-shadow bg-white"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-xs">
                      {course.category?.name || 'Umum'}
                    </Badge>
                    <Badge
                      className={
                        isActive
                          ? 'bg-[#FF8928] text-white'
                          : 'bg-gray-200 text-gray-700'
                      }
                    >
                      {isActive ? 'Aktif' : 'Arsip'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-[#002446] line-clamp-2 mt-2">
                    {course.title}
                  </CardTitle>
                  <div className="text-xs text-gray-500 font-medium">
                    Tahun Ajaran: {course.academicYear.name}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 text-sm">
                  {course.description && (
                    <p className="text-gray-600 line-clamp-2 text-xs">
                      {course.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-600">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="h-4 w-4 text-[#FF8928]" />
                      {course._count.enrollments} Siswa Terdaftar
                    </span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <Layers className="h-4 w-4 text-[#002446]" />
                      {course._count.modules} Modul
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t bg-gray-50/50 flex flex-col sm:flex-row items-center gap-2">
                  <Link
                    href={`/teacher/course/${course.id}/modules`}
                    className="w-full sm:flex-1"
                  >
                    <Button
                      size="sm"
                      className="w-full bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center justify-center gap-1 text-xs"
                    >
                      <Layers className="h-3.5 w-3.5" /> Modul
                    </Button>
                  </Link>

                  <Link
                    href={`/teacher/course/${course.id}/enrollments`}
                    className="w-full sm:flex-1"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1 text-xs"
                    >
                      <Users className="h-3.5 w-3.5" /> Siswa
                    </Button>
                  </Link>

                  <Link
                    href={`/teacher/course/${course.id}/gradebook`}
                    className="w-full sm:flex-1"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-[#FF8928] text-[#FF8928] hover:bg-[#FF8928] hover:text-white flex items-center justify-center gap-1 text-xs font-semibold"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Nilai
                    </Button>
                  </Link>
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
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Buat Course Langsung
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tCourseTitle">Judul Course</Label>
                <Input
                  id="tCourseTitle"
                  placeholder="misal: Fisika Dasar Semester 1"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tCourseDesc">Deskripsi</Label>
                <Input
                  id="tCourseDesc"
                  placeholder="Ringkasan materi atau tujuan pembelajaran"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tCourseYear">Tahun Ajaran</Label>
                  <select
                    id="tCourseYear"
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
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
                  <Label htmlFor="tCourseCat">Kategori</Label>
                  <select
                    id="tCourseCat"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
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
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
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
