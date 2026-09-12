'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookOpen, Plus, Search, Users, Layers, ExternalLink } from 'lucide-react';
import { createCourse } from '@/lib/actions/course';
import { Link } from '@/i18n/navigation';
import { useDialog } from '@/context/DialogContext';

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
  teacher: { id: string; name: string; email: string };
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

interface Teacher {
  id: string;
  name: string;
  email: string;
}

export function AdminCoursesClient({
  initialCourses,
  academicYears,
  categories,
  teachers,
}: {
  initialCourses: CourseItem[];
  academicYears: AcademicYear[];
  categories: Category[];
  teachers: Teacher[];
}) {
  const { showAlert } = useDialog();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      await showAlert('Pilih Tahun Ajaran aktif terlebih dahulu', { type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const created = await createCourse({
        title,
        description,
        academicYearId,
        categoryId: categoryId || undefined,
        teacherId: teacherId || undefined,
      });

      const selectedYear = academicYears.find((y) => y.id === academicYearId);
      const selectedCategory = categories.find((c) => c.id === categoryId);
      const selectedTeacher = teachers.find((t) => t.id === teacherId);

      setCourses((prev) => [
        {
          ...created,
          teacher: selectedTeacher || { id: '', name: '-', email: '' },
          category: selectedCategory || null,
          academicYear: selectedYear || { id: '', name: '-', status: 'ACTIVE' },
          _count: { enrollments: 0, modules: 0 },
        },
        ...prev,
      ]);

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      await showAlert(`Course "${created.title}" berhasil dibuat!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat course', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filtered = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.teacher.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.category?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari course, guru, atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
          >
            <option value="ALL">Semua Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DRAFT">Draf</option>
            <option value="ARCHIVED">Arsip</option>
          </select>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> Buat Course Baru
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Course</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Guru Pengampu</TableHead>
                <TableHead>Tahun Ajaran</TableHead>
                <TableHead>Siswa / Modul</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                    Tidak ada course ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="font-semibold text-[#002446]">
                        {course.title}
                      </div>
                      {course.description && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {course.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">
                        {course.category?.name || 'Tanpa Kategori'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {course.teacher.name}
                    </TableCell>
                    <TableCell className="text-sm">
                      {course.academicYear.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#FF8928]" />
                          {course._count.enrollments} Siswa
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-[#002446]" />
                          {course._count.modules} Modul
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          course.status === 'ACTIVE'
                            ? 'bg-[#FF8928] text-white'
                            : course.status === 'ARCHIVED'
                            ? 'bg-gray-200 text-gray-700'
                            : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {course.status === 'ACTIVE'
                          ? 'Aktif'
                          : course.status === 'ARCHIVED'
                          ? 'Arsip'
                          : 'Draf'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-3">
                      <Link
                        href={`/teacher/course/${course.id}/modules`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#002446] hover:underline"
                      >
                        Modul <ExternalLink className="h-3 w-3" />
                      </Link>
                      <Link
                        href={`/teacher/course/${course.id}/enrollments`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#FF8928] hover:underline"
                      >
                        Enrollment <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Buat Course Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Buat Course Baru
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cTitle">Judul Course</Label>
                <Input
                  id="cTitle"
                  placeholder="misal: Matematika Wajib Kelas X"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cDesc">Deskripsi (Opsional)</Label>
                <Input
                  id="cDesc"
                  placeholder="Keterangan singkat materi yang akan dipelajari"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cYear">Tahun Ajaran</Label>
                  <select
                    id="cYear"
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === 'ACTIVE' ? '(Aktif)' : '(Arsip)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cCategory">Kategori</Label>
                  <select
                    id="cCategory"
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

              <div className="space-y-2">
                <Label htmlFor="cTeacher">Guru Pengampu</Label>
                <select
                  id="cTeacher"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
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
                {loading ? 'Membuat...' : 'Buat Course'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
