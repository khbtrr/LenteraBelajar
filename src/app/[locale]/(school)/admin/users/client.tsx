'use client';

import { useState, useEffect } from 'react';
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
  UserPlus,
  Upload,
  Search,
  KeyRound,
  CheckCircle,
  Pencil,
  Trash2,
  Download,
  Unlock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  createUser,
  updateUser,
  deleteUser,
  bulkImportUsers,
  toggleUserActive,
  resetUserPassword,
} from '@/lib/actions/user';
import { unlockUserAccount } from '@/lib/actions/auth-lockout';
import { generateDefaultPassword } from '@/lib/password-policy';
import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { useDialog } from '@/context/DialogContext';

interface UserSchoolItem {
  id: string;
  schoolId: string;
  school: { id: string; name: string; code: string };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: Role;
  nis: string | null;
  nip: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  failedLoginAttempts?: number;
  lockedUntil?: Date | string | null;
  createdAt: Date;
  schoolId?: string | null;
  school?: { id: string; name: string; code: string } | null;
  assignedSchools?: UserSchoolItem[];
}

export function AdminUsersClient({
  initialUsers,
  availableSchools = [],
}: {
  initialUsers: any[];
  availableSchools?: { id: string; name: string; code: string }[];
}) {
  const t = useTranslations('adminUsers');
  const { showAlert, showConfirm } = useDialog();
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter, pageSize]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(Role.STUDENT);
  const [nis, setNis] = useState('');
  const [nip, setNip] = useState('');
  const [selectedSchoolIds, setSelectedSchoolIds] = useState<string[]>([]);

  const [editUserId, setEditUserId] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>(Role.STUDENT);
  const [editNis, setEditNis] = useState('');
  const [editNip, setEditNip] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSelectedSchoolIds, setEditSelectedSchoolIds] = useState<string[]>([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createUser({
        name,
        email,
        role,
        nis: role === Role.STUDENT ? nis : undefined,
        nip: role === Role.TEACHER ? nip : undefined,
        assignedSchoolIds: (role === Role.TEACHER || role === Role.ADMIN) ? selectedSchoolIds : undefined,
      });

      setUsers((prev) => [created as any, ...prev]);
      setIsCreateOpen(false);
      setName('');
      setEmail('');
      setNis('');
      setNip('');
      setSelectedSchoolIds([]);
      await showAlert(t('userAddedAlert', { name: created.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('userAddFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setEditUserId(user.id);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditNis(user.nis || '');
    setEditNip(user.nip || '');
    setEditIsActive(user.isActive);

    const userSchools = (user.assignedSchools || []).map((as) => as.schoolId);
    if (user.schoolId && !userSchools.includes(user.schoolId)) {
      userSchools.push(user.schoolId);
    }
    setEditSelectedSchoolIds(userSchools);
    setIsEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateUser(editUserId, {
        name: editName,
        email: editEmail,
        role: editRole,
        nis: editRole === Role.STUDENT ? editNis : null,
        nip: editRole === Role.TEACHER ? editNip : null,
        isActive: editIsActive,
        assignedSchoolIds: (editRole === Role.TEACHER || editRole === Role.ADMIN) ? editSelectedSchoolIds : undefined,
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === editUserId ? { ...u, ...updated } : u))
      );
      setIsEditOpen(false);
      await showAlert(t('userUpdatedAlert', { name: updated.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('userUpdateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    const confirmed = await showConfirm(
      t('deactivateConfirmDesc', { name: user.name }),
      {
        title: t('deactivateConfirmTitle'),
        confirmText: t('confirmDeactivate'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await deleteUser(user.id, false);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u))
      );
      await showAlert(
        res.message || t('userDeactivatedAlert', { name: user.name }),
        { type: 'success' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('userDeactivateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadUserTemplateXlsx = () => {
    const sampleRows = [
      {
        'Nama': 'Ahmad Fauzi',
        'Email': 'ahmad.fauzi@sekolah.sch.id',
        'Role': 'STUDENT',
        'NIS': '1001',
        'NIP': '',
        'Kelas': 'X-1',
      },
      {
        'Nama': 'Siti Rahma',
        'Email': 'siti.rahma@sekolah.sch.id',
        'Role': 'STUDENT',
        'NIS': '1002',
        'NIP': '',
        'Kelas': 'X-1',
      },
      {
        'Nama': 'Budi Santoso, S.Pd.',
        'Email': 'budi.santoso@sekolah.sch.id',
        'Role': 'TEACHER',
        'NIS': '',
        'NIP': '198501012010011001',
        'Kelas': '',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Pengguna');
    XLSX.writeFile(workbook, 'Template_Impor_Pengguna_Lentera.xlsx');
  };

  const handleDownloadUserTemplateCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Nama,Email,Role,NIS,NIP,Kelas',
        'Ahmad Fauzi,ahmad.fauzi@sekolah.sch.id,STUDENT,1001,,X-1',
        'Siti Rahma,siti.rahma@sekolah.sch.id,STUDENT,1002,,X-1',
        'Budi Santoso S.Pd.,budi.santoso@sekolah.sch.id,TEACHER,,198501012010011001,',
      ].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Template_Impor_Pengguna_Lentera.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        // Normalize data
        const parsed = data.map((row: any) => {
          const classKey = Object.keys(row).find((k) =>
            /^(kelas|rombel|kohor(t)?|class|cohort)$/i.test(k.trim()) ||
            /kelas|rombel|kohor/i.test(k)
          );

          return {
            name: row.Nama || row.nama || row.Name || row.name || '',
            email: row.Email || row.email || '',
            role: (row.Role || row.role || 'STUDENT').toUpperCase() as Role,
            nis: String(row.NIS || row.nis || ''),
            nip: String(row.NIP || row.nip || ''),
            className: classKey ? String(row[classKey] || '').trim() : '',
          };
        });

        setPreviewData(parsed.filter((p) => p.email && p.name));
      } catch (err) {
        console.error(err);
        showAlert(t('invalidFileFormat'), { type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (previewData.length === 0) return;
    setLoading(true);
    setImportStatus(null);
    try {
      const res = await bulkImportUsers(previewData);
      const successMsg =
        res.cohortAssignedCount && res.cohortAssignedCount > 0
          ? t('importSuccessWithCohort', { count: res.count, cohortCount: res.cohortAssignedCount })
          : t('importSuccess', { count: res.count });
      setImportStatus(successMsg);
      await showAlert(successMsg, { type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('importFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const updated = await toggleUserActive(user.id);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.isActive } : u))
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('statusUpdateFailedAlert'), { type: 'error' });
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    const defaultText = generateDefaultPassword(user.nis || user.nip);
    const confirmed = await showConfirm(
      t('resetConfirmDesc', { name: user.name, defaultText }),
      { title: t('resetConfirmTitle'), confirmText: t('confirmReset'), cancelText: t('cancelButton') }
    );
    if (!confirmed) {
      return;
    }
    try {
      await resetUserPassword(user.id);
      await showAlert(t('resetSuccessAlert', { name: user.name, defaultText }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('resetFailedAlert'), { type: 'error' });
    }
  };

  const handleUnlockAccount = async (user: UserItem) => {
    const confirmed = await showConfirm(
      t('unlockConfirmDesc', { name: user.name, email: user.email }),
      { title: t('unlockConfirmTitle'), confirmText: t('confirmUnlock'), cancelText: t('cancelButton') }
    );
    if (!confirmed) return;

    try {
      await unlockUserAccount(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, lockedUntil: null, failedLoginAttempts: 0 }
            : u
        )
      );
      await showAlert(t('unlockSuccessAlert', { name: user.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('unlockFailedAlert'), { type: 'error' });
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.nis || '').includes(q) ||
      (u.nip || '').includes(q);
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);

    return matchSearch && matchRole && matchStatus;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedUsers = filtered.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validCurrentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (validCurrentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <Input
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-gray-800/60 dark:border-gray-700 dark:text-white dark:placeholder:text-gray-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
          >
            <option value="ALL">{t('allRoles')}</option>
            <option value="TEACHER">{t('roleTeacher')}</option>
            <option value="STUDENT">{t('roleStudent')}</option>
            <option value="SUPERVISOR">{t('roleSupervisor')}</option>
            <option value="ADMIN">{t('roleAdmin')}</option>
          </select>

          {/* Status Filter (Active / Inactive / All) */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
          >
            <option value="ACTIVE">{t('statusActive')}</option>
            <option value="INACTIVE">{t('statusInactive')}</option>
            <option value="ALL">{t('statusAll')}</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setIsImportOpen(true)}
            className="border-[#FF8928] text-[#FF8928] hover:bg-[#FF8928] hover:text-white dark:border-[#FF8928] dark:text-[#FF8928] dark:hover:bg-[#FF8928] dark:hover:text-white flex items-center gap-1.5"
          >
            <Upload className="h-4 w-4" /> {t('importButton')}
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" /> {t('addUserButton')}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('colName')}</TableHead>
                <TableHead>{t('colEmail')}</TableHead>
                <TableHead>{t('colRole')}</TableHead>
                <TableHead>{t('colIdentity')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-gray-500 dark:text-gray-400">
                    {t('emptyUsers')}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium text-[#002446] dark:text-white">
                        {user.name}
                      </div>
                      {user.assignedSchools && user.assignedSchools.length > 1 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {user.assignedSchools.map((as) => (
                            <span
                              key={as.schoolId}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                            >
                              {as.school?.code?.startsWith('REG') ? 'Reguler' : 'Plus'}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.role === Role.ADMIN
                            ? 'bg-purple-600 text-white'
                            : user.role === Role.TEACHER
                            ? 'bg-[#002446] text-white'
                            : user.role === Role.STUDENT
                            ? 'bg-[#FF8928] text-white'
                            : 'bg-emerald-600 text-white'
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {user.nis ? `NIS: ${user.nis}` : user.nip ? `NIP: ${user.nip}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          onClick={() => handleToggleActive(user)}
                          title={t('clickToToggleStatus')}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border dark:border-green-800'
                              : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border dark:border-red-800'
                          }`}
                        >
                          {user.isActive ? t('activeBadge') : t('inactiveBadge')}
                        </span>
                        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800"
                            title={t('lockedUntil', { time: new Date(user.lockedUntil).toLocaleTimeString() })}
                          >
                            {t('lockedBadge')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.lockedUntil && new Date(user.lockedUntil) > new Date() && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUnlockAccount(user)}
                            title={t('unlockAccountTitle')}
                            className="h-8 w-8 p-0 text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                          >
                            <Unlock className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(user)}
                          title={t('editUserTitle')}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-gray-400 dark:hover:text-blue-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetPassword(user)}
                          title={t('resetPasswordTitle')}
                          className="h-8 w-8 p-0 text-gray-500 hover:text-[#002446] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(user)}
                          title={user.isActive ? t('deactivateUserTitle') : t('alreadyInactiveTitle')}
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

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-800 text-sm">
            <div className="flex flex-wrap items-center gap-3 text-gray-500 dark:text-gray-400">
              <span>
                {t('showingPagination', {
                  start: totalItems === 0 ? 0 : startIndex + 1,
                  end: endIndex,
                  total: totalItems,
                })}
              </span>
              <div className="flex items-center gap-1.5">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 px-2 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value={10}>10 {t('perPage')}</option>
                  <option value={25}>25 {t('perPage')}</option>
                  <option value={50}>50 {t('perPage')}</option>
                  <option value={100}>100 {t('perPage')}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={validCurrentPage === 1}
                className="h-8 w-8 p-0 dark:border-gray-700"
                title={t('firstPage')}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={validCurrentPage === 1}
                className="h-8 w-8 p-0 dark:border-gray-700"
                title={t('prevPage')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1 mx-1">
                {getPageNumbers().map((page, idx) =>
                  typeof page === 'number' ? (
                    <Button
                      key={idx}
                      variant={validCurrentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 min-w-[32px] px-2 text-xs ${
                        validCurrentPage === page
                          ? 'bg-[#002446] hover:bg-[#002446]/90 text-white dark:bg-brand-600 dark:hover:bg-brand-700'
                          : 'dark:border-gray-700'
                      }`}
                    >
                      {page}
                    </Button>
                  ) : (
                    <span key={idx} className="px-1 text-gray-400 dark:text-gray-600 text-xs">
                      {page}
                    </span>
                  )
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={validCurrentPage === totalPages || totalItems === 0}
                className="h-8 w-8 p-0 dark:border-gray-700"
                title={t('nextPage')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validCurrentPage === totalPages || totalItems === 0}
                className="h-8 w-8 p-0 dark:border-gray-700"
                title={t('lastPage')}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Tambah Pengguna */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('addUserModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="uName">{t('fullNameLabel')}</Label>
                <Input
                  id="uName"
                  placeholder={t('fullNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uEmail">{t('emailLabel')}</Label>
                <Input
                  id="uEmail"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uRole">{t('userRoleLabel')}</Label>
                <select
                  id="uRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value={Role.STUDENT}>{t('roleStudent')}</option>
                  <option value={Role.TEACHER}>{t('roleTeacher')}</option>
                  <option value={Role.SUPERVISOR}>{t('roleSupervisor')}</option>
                  <option value={Role.ADMIN}>{t('roleAdmin')}</option>
                </select>
              </div>

              {role === Role.STUDENT ? (
                <div className="space-y-2">
                  <Label htmlFor="uNis">{t('nisLabel')}</Label>
                  <Input
                    id="uNis"
                    placeholder={t('nisPlaceholder')}
                    value={nis}
                    onChange={(e) => setNis(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('nisHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="uNip">{t('nipLabel')}</Label>
                  <Input
                    id="uNip"
                    placeholder={t('nipPlaceholder')}
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                  />
                </div>
              )}

              {(role === Role.TEACHER || role === Role.ADMIN) && availableSchools.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Penugasan Unit Sekolah (Multi-School):
                  </Label>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Centang sekolah tempat guru/admin ini ditugaskan mengajar/bertugas.
                  </p>
                  <div className="space-y-2 pt-1">
                    {availableSchools.map((s) => {
                      const checked = selectedSchoolIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSchoolIds((prev) => [...prev, s.id]);
                              } else {
                                setSelectedSchoolIds((prev) => prev.filter((id) => id !== s.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                          />
                          <span>{s.name} ({s.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
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

      {/* Modal Edit Pengguna */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('editUserModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">{t('fullNameLabel')}</Label>
                <Input
                  id="editName"
                  placeholder={t('fullNamePlaceholder')}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editEmail">{t('emailLabel')}</Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRole">{t('userRoleLabel')}</Label>
                <select
                  id="editRole"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value={Role.STUDENT}>{t('roleStudent')}</option>
                  <option value={Role.TEACHER}>{t('roleTeacher')}</option>
                  <option value={Role.SUPERVISOR}>{t('roleSupervisor')}</option>
                  <option value={Role.ADMIN}>{t('roleAdmin')}</option>
                </select>
              </div>

              {editRole === Role.STUDENT ? (
                <div className="space-y-2">
                  <Label htmlFor="editNis">{t('nisLabel')}</Label>
                  <Input
                    id="editNis"
                    placeholder={t('nisPlaceholder')}
                    value={editNis}
                    onChange={(e) => setEditNis(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="editNip">{t('nipLabel')}</Label>
                  <Input
                    id="editNip"
                    placeholder={t('nipPlaceholder')}
                    value={editNip}
                    onChange={(e) => setEditNip(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="editStatus">{t('accountStatusLabel')}</Label>
                <select
                  id="editStatus"
                  value={editIsActive ? 'ACTIVE' : 'INACTIVE'}
                  onChange={(e) => setEditIsActive(e.target.value === 'ACTIVE')}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value="ACTIVE">{t('statusActiveOption')}</option>
                  <option value="INACTIVE">{t('statusInactiveOption')}</option>
                </select>
              </div>

              {(editRole === Role.TEACHER || editRole === Role.ADMIN) && availableSchools.length > 0 && (
                <div className="space-y-2 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Penugasan Unit Sekolah (Multi-School):
                  </Label>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Centang sekolah tempat guru/admin ini ditugaskan mengajar/bertugas.
                  </p>
                  <div className="space-y-2 pt-1">
                    {availableSchools.map((s) => {
                      const checked = editSelectedSchoolIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-xs text-gray-800 dark:text-gray-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditSelectedSchoolIds((prev) => [...prev, s.id]);
                              } else {
                                setEditSelectedSchoolIds((prev) => prev.filter((id) => id !== s.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-[#002446] focus:ring-[#002446]"
                          />
                          <span>{s.name} ({s.code})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
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
                {loading ? t('saving') : t('updateButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Impor Excel/CSV */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Upload className="h-5 w-5 text-[#FF8928]" /> {t('importModalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs text-blue-900 dark:text-blue-200">
              <div className="space-y-1">
                <p className="font-semibold">{t('importFormatTitle')}</p>
                <p>{t('importFormatCols')}</p>
                <p className="text-[#FF8928] dark:text-orange-400 font-medium">{t('importFormatHint')}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadUserTemplateXlsx}
                  className="text-xs bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  .XLSX
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadUserTemplateCsv}
                  className="text-xs bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  .CSV
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileInput">{t('chooseFile')}</Label>
              <Input
                id="fileInput"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="cursor-pointer file:cursor-pointer file:font-semibold file:text-brand-600 dark:file:text-brand-400"
              />
            </div>

            {previewData.length > 0 && (
              <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colEmail')}</TableHead>
                      <TableHead>{t('colRole')}</TableHead>
                      <TableHead>{t('colIdentity')}</TableHead>
                      <TableHead>{t('colClass')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 15).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-xs text-gray-900 dark:text-gray-100">{row.name}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-300">{row.email}</TableCell>
                        <TableCell className="text-xs text-gray-600 dark:text-gray-300">{row.role}</TableCell>
                        <TableCell className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          {row.nis || row.nip || '-'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.className ? (
                            <Badge variant="outline" className="text-[11px] bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                              {row.className}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewData.length > 15 && (
                  <div className="p-2 text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-200 dark:border-gray-800">
                    {t('andMoreRows', { count: previewData.length - 15 })}
                  </div>
                )}
              </div>
            )}

            {importStatus && (
              <div className="p-3 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300 text-sm rounded-lg flex items-center gap-2 border border-green-200 dark:border-green-800">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                {importStatus}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsImportOpen(false);
                setPreviewData([]);
                setImportStatus(null);
              }}
            >
              {t('closeButton')}
            </Button>
            <Button
              type="button"
              disabled={previewData.length === 0 || loading}
              onClick={handleConfirmImport}
              className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white"
            >
              {loading ? t('importing') : t('confirmImport', { count: previewData.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
