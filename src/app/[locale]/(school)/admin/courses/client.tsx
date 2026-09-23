'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
import {
  BookOpen,
  Plus,
  Search,
  Users,
  Layers,
  ExternalLink,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import {
  createCourse,
  updateCourse,
  toggleArchiveCourse,
  deleteCourse,
} from '@/lib/actions/course';
import { CourseStatus } from '@prisma/client';
import { Link } from '@/i18n/navigation';
import { useDialog } from '@/context/DialogContext';

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'ARCHIVED';
  isCrossSchool?: boolean;
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
  const t = useTranslations('adminCourses');
  const { showAlert, showConfirm } = useDialog();
  const [courses, setCourses] = useState<CourseItem[]>(initialCourses);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states (Create)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCrossSchool, setIsCrossSchool] = useState(false);
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');
  const [teacherId, setTeacherId] = useState(teachers[0]?.id || '');

  // Form states (Edit)
  const [editingCourseId, setEditingCourseId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsCrossSchool, setEditIsCrossSchool] = useState(false);
  const [editAcademicYearId, setEditAcademicYearId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editTeacherId, setEditTeacherId] = useState('');
  const [editStatus, setEditStatus] = useState<CourseStatus>(CourseStatus.ACTIVE);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      await showAlert(t('selectYearAlert'), { type: 'warning' });
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
        isCrossSchool,
      });

      const selectedYear = academicYears.find((y) => y.id === academicYearId);
      const selectedCategory = categories.find((c) => c.id === categoryId);
      const selectedTeacher = teachers.find((t) => t.id === teacherId);

      setCourses((prev) => [
        {
          ...created,
          isCrossSchool: created.isCrossSchool,
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
      setIsCrossSchool(false);
      await showAlert(t('courseCreatedAlert', { title: created.title }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('courseCreateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (course: CourseItem) => {
    setEditingCourseId(course.id);
    setEditTitle(course.title);
    setEditDescription(course.description || '');
    setEditIsCrossSchool(Boolean(course.isCrossSchool));
    setEditAcademicYearId(course.academicYear.id || academicYears[0]?.id || '');
    setEditCategoryId(course.category?.id || '');
    setEditTeacherId(course.teacher.id || teachers[0]?.id || '');
    setEditStatus(course.status as CourseStatus);
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAcademicYearId) {
      await showAlert(t('selectYearAlert'), { type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const updated = await updateCourse(editingCourseId, {
        title: editTitle,
        description: editDescription,
        academicYearId: editAcademicYearId,
        categoryId: editCategoryId || undefined,
        teacherId: editTeacherId,
        status: editStatus,
        isCrossSchool: editIsCrossSchool,
      });

      setCourses((prev) =>
        prev.map((c) =>
          c.id === editingCourseId
            ? {
                ...c,
                ...updated,
                isCrossSchool: updated.isCrossSchool,
                status: updated.status as any,
                academicYear: {
                  ...c.academicYear,
                  id: updated.academicYear.id,
                  name: updated.academicYear.name,
                  status: updated.academicYear.status,
                },
              }
            : c
        )
      );

      setIsEditOpen(false);
      await showAlert(t('courseUpdatedAlert', { title: updated.title }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('courseUpdateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (course: CourseItem) => {
    const isArchived = course.status === 'ARCHIVED';
    const confirmed = await showConfirm(
      isArchived
        ? t('unarchiveConfirmDesc', { title: course.title })
        : t('archiveConfirmDesc', { title: course.title }),
      {
        title: isArchived ? t('unarchiveConfirmTitle') : t('archiveConfirmTitle'),
        confirmText: isArchived ? t('confirmUnarchive') : t('confirmArchive'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const updated = await toggleArchiveCourse(course.id);
      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id
            ? {
                ...c,
                status: updated.status as any,
              }
            : c
        )
      );
      await showAlert(
        isArchived
          ? t('courseUnarchivedAlert', { title: course.title })
          : t('courseArchivedAlert', { title: course.title }),
        { type: 'success' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('courseArchiveFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (course: CourseItem) => {
    const confirmed = await showConfirm(
      t('deleteConfirmDesc', { title: course.title }),
      {
        title: t('deleteConfirmTitle'),
        confirmText: t('confirmDelete'),
        cancelText: t('cancelButton'),
        type: 'error',
        confirmVariant: 'destructive',
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      await showAlert(t('courseDeletedAlert', { title: course.title }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('courseDeleteFailedAlert'), { type: 'error' });
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
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
          >
            <option value="ALL">{t('statusAll')}</option>
            <option value="ACTIVE">{t('statusActive')}</option>
            <option value="DRAFT">{t('statusDraft')}</option>
            <option value="ARCHIVED">{t('statusArchived')}</option>
          </select>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> {t('btnCreateCourse')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colCourse')}</TableHead>
                <TableHead>{t('colCategory')}</TableHead>
                <TableHead>{t('colTeacher')}</TableHead>
                <TableHead>{t('colAcademicYear')}</TableHead>
                <TableHead>{t('colStudentsModules')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-gray-500 dark:text-gray-400">
                    {t('emptyCourses')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#002446] dark:text-white">
                          {course.title}
                        </span>
                        {course.isCrossSchool && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800 text-[10px] font-bold">
                            Student Day
                          </Badge>
                        )}
                      </div>
                      {course.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {course.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal dark:border-gray-700 dark:text-gray-300">
                        {course.category?.name || t('noCategory')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {course.teacher.name}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 dark:text-gray-300">
                      {course.academicYear.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#FF8928] dark:text-orange-400" />
                          {t('studentsCount', { count: course._count.enrollments })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-[#002446] dark:text-blue-400" />
                          {t('modulesCount', { count: course._count.modules })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          course.status === 'ACTIVE'
                            ? 'bg-[#FF8928] text-white'
                            : course.status === 'ARCHIVED'
                            ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                        }
                      >
                        {course.status === 'ACTIVE'
                          ? t('statusActive')
                          : course.status === 'ARCHIVED'
                          ? t('statusArchived')
                          : t('statusDraft')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        <Link
                          href={`/teacher/course/${course.id}/modules`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#002446] hover:bg-gray-100 rounded dark:text-blue-400 dark:hover:bg-gray-800 transition-colors"
                        >
                          {t('linkModules')} <ExternalLink className="h-3 w-3" />
                        </Link>
                        <Link
                          href={`/teacher/course/${course.id}/enrollments`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#FF8928] hover:bg-orange-50 rounded dark:text-orange-400 dark:hover:bg-orange-950/30 transition-colors"
                        >
                          {t('linkEnrollment')} <ExternalLink className="h-3 w-3" />
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(course)}
                          title={t('btnEdit')}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-gray-400 dark:hover:text-blue-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleArchive(course)}
                          title={course.status === 'ARCHIVED' ? t('btnUnarchive') : t('btnArchive')}
                          className={`h-8 w-8 p-0 transition-colors ${
                            course.status === 'ARCHIVED'
                              ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30'
                              : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30'
                          }`}
                        >
                          {course.status === 'ARCHIVED' ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(course)}
                          title={t('btnDelete')}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Edit Course */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('editModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editTitle">{t('courseTitleLabel')}</Label>
                <Input
                  id="editTitle"
                  placeholder={t('courseTitlePlaceholder')}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDesc">{t('courseDescLabel')}</Label>
                <Input
                  id="editDesc"
                  placeholder={t('courseDescPlaceholder')}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editYear">{t('academicYearLabel')}</Label>
                  <select
                    id="editYear"
                    value={editAcademicYearId}
                    onChange={(e) => setEditAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === 'ACTIVE' ? `(${t('statusActive')})` : `(${t('statusArchived')})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editCategory">{t('categoryLabel')}</Label>
                  <select
                    id="editCategory"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                  >
                    <option value="">{t('categoryPlaceholder')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent ? `${c.parent.name} → ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editTeacher">{t('teacherLabel')}</Label>
                  <select
                    id="editTeacher"
                    value={editTeacherId}
                    onChange={(e) => setEditTeacherId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                    required
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="editStatus">{t('courseStatusLabel')}</Label>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as CourseStatus)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                  >
                    <option value={CourseStatus.ACTIVE}>{t('statusActive')}</option>
                    <option value={CourseStatus.DRAFT}>{t('statusDraft')}</option>
                    <option value={CourseStatus.ARCHIVED}>{t('statusArchived')}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20">
                <input
                  type="checkbox"
                  id="editCrossSchool"
                  checked={editIsCrossSchool}
                  onChange={(e) => setEditIsCrossSchool(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="editCrossSchool" className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
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
                onClick={() => setIsEditOpen(false)}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              >
                {loading ? t('updating') : t('updateButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Buat Course Baru */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('modalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="cTitle">{t('courseTitleLabel')}</Label>
                <Input
                  id="cTitle"
                  placeholder={t('courseTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cDesc">{t('courseDescLabel')}</Label>
                <Input
                  id="cDesc"
                  placeholder={t('courseDescPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cYear">{t('academicYearLabel')}</Label>
                  <select
                    id="cYear"
                    value={academicYearId}
                    onChange={(e) => setAcademicYearId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === 'ACTIVE' ? `(${t('statusActive')})` : `(${t('statusArchived')})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cCategory">{t('categoryLabel')}</Label>
                  <select
                    id="cCategory"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                  >
                    <option value="">{t('categoryPlaceholder')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.parent ? `${c.parent.name} → ${c.name}` : c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cTeacher">{t('teacherLabel')}</Label>
                <select
                  id="cTeacher"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20">
                <input
                  type="checkbox"
                  id="cCrossSchool"
                  checked={isCrossSchool}
                  onChange={(e) => setIsCrossSchool(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="cCrossSchool" className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
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
                {t('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white"
              >
                {loading ? t('saving') : t('saveButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
