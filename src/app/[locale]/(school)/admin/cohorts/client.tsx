'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  UsersRound,
  Plus,
  UserPlus,
  Trash2,
  Search,
  TrendingUp,
  Award,
  Download,
  CheckCircle2,
  UserMinus,
  CheckSquare,
  Square,
  AlertCircle,
  ArrowRight,
  Filter,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  UserCheck,
  UserX,
  Layers,
  HelpCircle,
  Sparkles,
  Pencil,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import {
  createCohort,
  updateCohort,
  toggleCohortActive,
  deleteCohort,
  bulkCreateCohorts,
  addStudentToCohort,
  removeStudentFromCohort,
  bulkAddStudentsToCohort,
  bulkRemoveStudentsFromCohort,
  promoteCohortStudents,
  graduateCohortStudents,
  batchPromoteExcel,
} from '@/lib/actions/cohort';
import { useDialog } from '@/context/DialogContext';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  name: string;
  email: string;
  nis: string | null;
  cohortMemberships?: {
    cohort: { id: string; name: string };
  }[];
}

interface CohortItem {
  id: string;
  name: string;
  isActive?: boolean;
  members: { user: Student }[];
  _count: {
    members: number;
    enrollments: number;
  };
}

export function CohortsClient({
  initialCohorts,
  availableStudents,
}: {
  initialCohorts: CohortItem[];
  availableStudents: Student[];
}) {
  const t = useTranslations('adminCohorts');
  const { showAlert, showConfirm } = useDialog();
  const [cohorts, setCohorts] = useState<CohortItem[]>(initialCohorts);
  const [students, setStudents] = useState<Student[]>(availableStudents);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Create Cohort Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [cohortName, setCohortName] = useState('');

  // 2. Manage Members Modal
  const [selectedCohort, setSelectedCohort] = useState<CohortItem | null>(null);
  const [manageTab, setManageTab] = useState<'current' | 'add'>('current');
  const [studentSearch, setStudentSearch] = useState('');
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false);
  const [selectedToAddStudentIds, setSelectedToAddStudentIds] = useState<Set<string>>(new Set());
  const [selectedToRemoveStudentIds, setSelectedToRemoveStudentIds] = useState<Set<string>>(new Set());

  // 3. Promotion (Kenaikan Kelas) Modal
  const [isPromoteOpen, setIsPromoteOpen] = useState(false);
  const [promoteTab, setPromoteTab] = useState<'excel' | 'linear'>('excel');
  const [removeFromSource, setRemoveFromSource] = useState(true);

  // Tab 1: Impor Pemetaan Berkas TU (Excel/CSV)
  interface ParsedExcelRow {
    nis: string;
    name: string;
    email: string;
    currentCohort: string;
    newCohortName: string;
    status: 'promote' | 'transfer_in' | 'transfer_out' | 'retained';
  }
  const [excelDownloadCohortIds, setExcelDownloadCohortIds] = useState<Set<string>>(new Set());
  const [parsedExcelRows, setParsedExcelRows] = useState<ParsedExcelRow[]>([]);
  const [excelFilterStatus, setExcelFilterStatus] = useState<'all' | 'promote' | 'transfer_in' | 'transfer_out' | 'retained'>('all');
  const [excelSearch, setExcelSearch] = useState('');
  const [excelFileName, setExcelFileName] = useState('');

  // Tab 2: Kenaikan Linier (1 ke 1)
  const [sourceCohortId, setSourceCohortId] = useState('');
  const [targetCohortMode, setTargetCohortMode] = useState<'new' | 'existing'>('new');
  const [newTargetCohortName, setNewTargetCohortName] = useState('');
  const [existingTargetCohortId, setExistingTargetCohortId] = useState('');
  const [promotedStudentIds, setPromotedStudentIds] = useState<Set<string>>(new Set());

  // 4. Graduation Modal
  const [isGraduationOpen, setIsGraduationOpen] = useState(false);
  const [gradCohortId, setGradCohortId] = useState('');
  const [graduatedStudentIds, setGraduatedStudentIds] = useState<Set<string>>(new Set());
  const [deactivateAccounts, setDeactivateAccounts] = useState(false);

  // Calculate unassigned students
  const unassignedStudentsCount = students.filter(
    (s) => !s.cohortMemberships || s.cohortMemberships.length === 0
  ).length;

  // 5. Status Filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // 6. Edit Cohort Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<CohortItem | null>(null);
  const [editCohortName, setEditCohortName] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // 7. Bulk Upload Cohort Modal
  interface BulkCohortRow {
    name: string;
    note?: string;
    isDuplicate: boolean;
  }
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkParsedRows, setBulkParsedRows] = useState<BulkCohortRow[]>([]);

  // Filter cohorts by search and status
  const activeCount = cohorts.filter((c) => c.isActive !== false).length;
  const inactiveCount = cohorts.filter((c) => c.isActive === false).length;

  const filteredCohorts = cohorts.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const isCohortActive = c.isActive !== false;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? isCohortActive
        : !isCohortActive;
    return matchesSearch && matchesStatus;
  });

  // Edit Cohort Handlers
  const handleOpenEdit = (cohort: CohortItem) => {
    setEditingCohort(cohort);
    setEditCohortName(cohort.name);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCohort || !editCohortName.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateCohort(editingCohort.id, editCohortName.trim());
      setCohorts((prev) =>
        prev.map((c) =>
          c.id === editingCohort.id ? { ...c, name: editCohortName.trim() } : c
        )
      );
      setIsEditOpen(false);
      await showAlert(t('editCohortSuccess'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      if (err?.message === 'DUPLICATE_NAME') {
        await showAlert(t('editCohortConflict'), { type: 'error' });
      } else {
        await showAlert(err?.message || t('editCohortFailed'), { type: 'error' });
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle Active/Nonactive Handlers
  const handleToggleActive = async (cohort: CohortItem) => {
    const willDeactivate = cohort.isActive !== false;
    const confirmed = await showConfirm(
      willDeactivate
        ? t('confirmDeactivateDesc', { name: cohort.name })
        : t('confirmActivateDesc', { name: cohort.name }),
      {
        title: willDeactivate ? t('confirmDeactivateTitle') : t('confirmActivateTitle'),
        confirmText: willDeactivate ? t('confirmDeactivateBtn') : t('confirmActivateBtn'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await toggleCohortActive(cohort.id, !willDeactivate);
      setCohorts((prev) =>
        prev.map((c) => (c.id === cohort.id ? { ...c, isActive: !willDeactivate } : c))
      );
      await showAlert(t('toggleStatusSuccess'), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('toggleStatusFailed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Delete Cohort Handler
  const handleDeleteCohort = async (cohort: CohortItem) => {
    const confirmed = await showConfirm(
      t('confirmDeleteDesc', { name: cohort.name }),
      {
        title: t('confirmDeleteTitle'),
        confirmText: t('confirmDeleteBtn'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteCohort(cohort.id);
      setCohorts((prev) => prev.filter((c) => c.id !== cohort.id));

      // Remove cohort memberships from local students state
      setStudents((prev) =>
        prev.map((s) => ({
          ...s,
          cohortMemberships: (s.cohortMemberships || []).filter(
            (cm) => cm.cohort.id !== cohort.id
          ),
        }))
      );

      await showAlert(t('deleteCohortSuccess', { name: cohort.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('deleteCohortFailed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Upload Handlers
  const handleOpenBulkUpload = () => {
    setIsBulkOpen(true);
    setBulkFileName('');
    setBulkParsedRows([]);
  };

  const handleDownloadBulkTemplateXlsx = () => {
    const sampleRows = [
      { 'Nama Kohort': 'Kelas 10-A', 'Keterangan': 'Tingkat X' },
      { 'Nama Kohort': 'Kelas 10-B', 'Keterangan': 'Tingkat X' },
      { 'Nama Kohort': 'Kelas 11-IPA-1', 'Keterangan': 'Tingkat XI MIPA' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Kohort');
    XLSX.writeFile(workbook, 'Template_Unggah_Kohort_Lentera.xlsx');
  };

  const handleDownloadBulkTemplateCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Nama Kohort,Keterangan', 'Kelas 10-A,Tingkat X', 'Kelas 10-B,Tingkat X', 'Kelas 11-IPA-1,Tingkat XI MIPA'].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Template_Unggah_Kohort_Lentera.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUploadBulkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        if (!json || json.length === 0) {
          showAlert(t('emptyExcelAlert'), { type: 'error' });
          return;
        }

        const existingNames = new Set(cohorts.map((c) => c.name.trim().toLowerCase()));
        const parsed: BulkCohortRow[] = [];
        const seenInFile = new Set<string>();

        for (const row of json) {
          const nameKey =
            Object.keys(row).find((k) =>
              /^(nama\s*kohor(t)?|nama\s*kelas|nama\s*rombel|nama|cohort|name|group)$/i.test(k.trim()) ||
              /kohor|rombel/i.test(k)
            ) || Object.keys(row)[0];

          const noteKey = Object.keys(row).find((k) =>
            /^(keterangan|deskripsi|tingkat|catatan|notes|description|grade)$/i.test(k.trim()) ||
            /ket|note|tingkat/i.test(k)
          );

          const cohortNameVal = String(row[nameKey || ''] || '').trim();
          const noteVal = noteKey ? String(row[noteKey] || '').trim() : undefined;

          if (!cohortNameVal) continue;

          const lowerName = cohortNameVal.toLowerCase();
          const isDup = existingNames.has(lowerName) || seenInFile.has(lowerName);
          seenInFile.add(lowerName);

          parsed.push({
            name: cohortNameVal,
            note: noteVal,
            isDuplicate: isDup,
          });
        }

        setBulkParsedRows(parsed);
      } catch (err) {
        console.error(err);
        showAlert(t('excelReadError'), { type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteBulkUpload = async () => {
    const toCreate = bulkParsedRows.filter((r) => !r.isDuplicate);
    if (toCreate.length === 0) {
      await showAlert(t('noNewCohortsAlert'), { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await bulkCreateCohorts(toCreate.map((r) => r.name));
      await showAlert(
        t('bulkUploadSuccessAlert', {
          created: res.createdCount,
          skipped: res.skippedCount + bulkParsedRows.filter((r) => r.isDuplicate).length,
        }),
        { type: 'success' }
      );
      setIsBulkOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('bulkUploadFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Export cohort members to Excel (.xlsx)
  const handleExportCohortExcel = (cohort: CohortItem) => {
    if (!cohort.members || cohort.members.length === 0) {
      showAlert(t('exportEmptyAlert', { name: cohort.name }), { type: 'error' });
      return;
    }

    const rows = cohort.members.map((m, idx) => ({
      [t('colNo')]: idx + 1,
      [t('sheetNis')]: m.user.nis || '-',
      [t('sheetFullName')]: m.user.name,
      [t('sheetStudentEmail')]: m.user.email,
      [t('sheetGroupName')]: cohort.name,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('sheetStudentList'));

    const safeFileName = `Daftar_Siswa_${cohort.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, safeFileName);
  };

  // Create Cohort Handler
  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortName.trim()) return;
    setLoading(true);
    try {
      const created = await createCohort(cohortName.trim());
      setCohorts((prev) => [
        {
          ...created,
          members: [],
          _count: { members: 0, enrollments: 0 },
        },
        ...prev,
      ]);
      setCohortName('');
      setIsCreateOpen(false);
      await showAlert(t('cohortCreatedAlert', { name: created.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      if (err?.message === 'DUPLICATE_NAME') {
        await showAlert(t('duplicateCohortNameError'), { type: 'error' });
      } else {
        await showAlert(err?.message || t('cohortCreateFailedAlert'), { type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  // Open Manage Members Modal
  const handleOpenManageMembers = (cohort: CohortItem) => {
    setSelectedCohort(cohort);
    setManageTab('current');
    setStudentSearch('');
    setSelectedToAddStudentIds(new Set());
    setSelectedToRemoveStudentIds(new Set());
  };

  // Bulk Add Students to Cohort
  const handleBulkAdd = async () => {
    if (!selectedCohort || selectedToAddStudentIds.size === 0) return;
    setLoading(true);
    try {
      const userIds = Array.from(selectedToAddStudentIds);
      await bulkAddStudentsToCohort(selectedCohort.id, userIds);

      const addedStudents = students.filter((s) => selectedToAddStudentIds.has(s.id));
      const newMembers = [
        ...selectedCohort.members,
        ...addedStudents.map((s) => ({ user: s })),
      ];

      const updatedCohort = {
        ...selectedCohort,
        members: newMembers,
        _count: {
          ...selectedCohort._count,
          members: newMembers.length,
        },
      };

      setSelectedCohort(updatedCohort);
      setCohorts((prev) =>
        prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
      );

      // Update student memberships locally
      setStudents((prev) =>
        prev.map((s) => {
          if (selectedToAddStudentIds.has(s.id)) {
            const existing = s.cohortMemberships || [];
            return {
              ...s,
              cohortMemberships: [...existing, { cohort: { id: selectedCohort.id, name: selectedCohort.name } }],
            };
          }
          return s;
        })
      );

      setSelectedToAddStudentIds(new Set());
      await showAlert(t('addSuccessAlert', { count: userIds.length, cohortName: selectedCohort.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('addFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Remove Students from Cohort
  const handleBulkRemove = async () => {
    if (!selectedCohort || selectedToRemoveStudentIds.size === 0) return;
    const confirmed = await showConfirm(
      t('confirmRemoveDesc', { count: selectedToRemoveStudentIds.size, cohortName: selectedCohort.name }),
      {
        title: t('confirmRemoveTitle'),
        confirmText: t('confirmRemoveButton'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const userIds = Array.from(selectedToRemoveStudentIds);
      await bulkRemoveStudentsFromCohort(selectedCohort.id, userIds);

      const remainingMembers = selectedCohort.members.filter(
        (m) => !selectedToRemoveStudentIds.has(m.user.id)
      );

      const updatedCohort = {
        ...selectedCohort,
        members: remainingMembers,
        _count: {
          ...selectedCohort._count,
          members: remainingMembers.length,
        },
      };

      setSelectedCohort(updatedCohort);
      setCohorts((prev) =>
        prev.map((c) => (c.id === selectedCohort.id ? updatedCohort : c))
      );

      // Update local student memberships
      setStudents((prev) =>
        prev.map((s) => {
          if (selectedToRemoveStudentIds.has(s.id)) {
            return {
              ...s,
              cohortMemberships: (s.cohortMemberships || []).filter(
                (cm) => cm.cohort.id !== selectedCohort.id
              ),
            };
          }
          return s;
        })
      );

      setSelectedToRemoveStudentIds(new Set());
      await showAlert(t('removeSuccessAlert', { count: userIds.length, cohortName: selectedCohort.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('removeFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Promotion Modal
  const handleOpenPromote = () => {
    setIsPromoteOpen(true);
    setPromoteTab('excel');
    setRemoveFromSource(true);

    // Reset Tab 1: Excel
    setExcelDownloadCohortIds(new Set());
    setParsedExcelRows([]);
    setExcelFilterStatus('all');
    setExcelSearch('');
    setExcelFileName('');

    // Reset Tab 2: Linier
    setSourceCohortId('');
    setTargetCohortMode('new');
    setNewTargetCohortName('');
    setExistingTargetCohortId('');
    setPromotedStudentIds(new Set());
  };

  const handleDownloadExcelTemplate = () => {
    const selectedCohorts = cohorts.filter((c) =>
      excelDownloadCohortIds.size > 0 ? excelDownloadCohortIds.has(c.id) : true
    );

    const studentMap = new Map<string, { user: Student; cohortName: string }>();
    selectedCohorts.forEach((c) => {
      c.members.forEach((m) => {
        if (!studentMap.has(m.user.id)) {
          studentMap.set(m.user.id, { user: m.user, cohortName: c.name });
        }
      });
    });

    const exportList = Array.from(studentMap.values());
    if (exportList.length === 0) {
      showAlert(t('noStudentToExport'), { type: 'error' });
      return;
    }

    const rows = exportList.map((item, idx) => ({
      'No': idx + 1,
      'NIS': item.user.nis || '',
      'Nama Lengkap': item.user.name,
      'Email Siswa': item.user.email,
      'Kelas Asal': item.cohortName,
      'Kelas Baru (Wajib Diisi)': '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pemetaan Siswa');

    XLSX.writeFile(workbook, 'Template_Kenaikan_Kelas_Lentera.xlsx');
  };

  const handleUploadExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        if (!json || json.length === 0) {
          showAlert(t('emptyExcelAlert'), { type: 'error' });
          return;
        }

        const studentByNis = new Map<string, Student>();
        students.forEach((s) => {
          if (s.nis) studentByNis.set(s.nis.trim().toLowerCase(), s);
        });

        const transferOutRegex = /^(mutasi|pindah|keluar|keluar\s+sekolah|mutasi\s+keluar|dropout|drop\s+out)$/i;
        const retainedRegex = /^(tinggal|tetap|tidak\s+naik|tinggal\s+kelas)$/i;

        const parsed: ParsedExcelRow[] = [];

        for (const row of json) {
          // Cari kolom NIS / Username / Nomor Induk
          const nisKey = Object.keys(row).find((k) =>
            /^(nis|username|user\s*name|nomor\s*induk|id\s*siswa|student\s*id)$/i.test(k.trim()) ||
            /nis|username|no\s*induk/i.test(k)
          );

          // Cari kolom Nama (termasuk Moodle firstname + lastname)
          const nameKey = Object.keys(row).find((k) =>
            /^(nama|nama\s*lengkap|name|fullname|full\s*name|nama\s*siswa)$/i.test(k.trim()) ||
            /nama|fullname/i.test(k)
          );
          const firstNameKey = Object.keys(row).find((k) => /^firstname$/i.test(k.trim()));
          const lastNameKey = Object.keys(row).find((k) => /^lastname$/i.test(k.trim()));

          // Cari kolom Email
          const emailKey = Object.keys(row).find((k) => /^(email|e-mail|surel)$/i.test(k.trim()) || /email/i.test(k));

          // Cari kolom Kelas Asal
          const currentKey = Object.keys(row).find((k) =>
            /^(kelas\s*asal|rombel\s*asal|rombel\s*lama|kohor\s*asal|current\s*cohort|old\s*cohort)$/i.test(k.trim()) ||
            /kelas\s*asal|rombel\s*lama/i.test(k)
          );

          // Cari kolom Kelas Baru / Rombel Baru / Moodle cohort1
          const targetKey = Object.keys(row).find((k) =>
            /^(kelas\s*baru|rombel\s*baru|kohor\s*baru|cohort1|cohort\s*1|kelas\s*tujuan|target|new\s*cohort)$/i.test(k.trim()) ||
            /kelas\s*baru|rombel\s*baru|cohort1|kelas\s*tujuan/i.test(k)
          );

          const nis = String(row[nisKey || ''] || '').trim();
          let name = String(row[nameKey || ''] || '').trim();
          if (!name && (firstNameKey || lastNameKey)) {
            const first = String(row[firstNameKey || ''] || '').trim();
            const last = String(row[lastNameKey || ''] || '').trim();
            name = `${first} ${last}`.trim();
          }

          const email = String(row[emailKey || ''] || '').trim();
          const currentCohort = String(row[currentKey || ''] || '').trim();
          const newCohortName = String(row[targetKey || ''] || '').trim();

          if (!nis && !name) continue;

          let status: ParsedExcelRow['status'] = 'promote';
          const existingStudent = nis ? studentByNis.get(nis.toLowerCase()) : undefined;

          if (transferOutRegex.test(newCohortName)) {
            status = 'transfer_out';
          } else if (
            retainedRegex.test(newCohortName) ||
            (currentCohort &&
              newCohortName &&
              currentCohort.toLowerCase() === newCohortName.toLowerCase())
          ) {
            status = 'retained';
          } else if (!existingStudent) {
            status = 'transfer_in';
          } else {
            status = 'promote';
          }

          parsed.push({
            nis,
            name: name || existingStudent?.name || `Siswa ${nis}`,
            email: email || existingStudent?.email || '',
            currentCohort:
              currentCohort || existingStudent?.cohortMemberships?.[0]?.cohort.name || '-',
            newCohortName,
            status,
          });
        }

        setParsedExcelRows(parsed);
      } catch (err) {
        console.error(err);
        showAlert(t('excelReadError'), { type: 'error' });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Deteksi siswa dari rombel asal terpilih yang belum terdata di berkas Excel dari TU
  const unlistedStudents = (() => {
    if (excelDownloadCohortIds.size === 0 || parsedExcelRows.length === 0) return [];
    const parsedNisSet = new Set(parsedExcelRows.map((r) => r.nis.toLowerCase().trim()));
    const unlisted: { user: Student; cohortName: string }[] = [];
    cohorts
      .filter((c) => excelDownloadCohortIds.has(c.id))
      .forEach((c) => {
        c.members.forEach((m) => {
          if (m.user.nis && !parsedNisSet.has(m.user.nis.toLowerCase().trim())) {
            unlisted.push({ user: m.user, cohortName: c.name });
          }
        });
      });
    return unlisted;
  })();

  const handleExecuteExcelPromotion = async () => {
    if (parsedExcelRows.length === 0) {
      showAlert(t('emptyExcelAlert'), { type: 'error' });
      return;
    }

    const validRows = parsedExcelRows.filter((r) => r.nis && r.newCohortName);
    if (validRows.length === 0) {
      showAlert(t('invalidExcelAlert'), { type: 'error' });
      return;
    }

    const promoteCount = parsedExcelRows.filter((r) => r.status === 'promote').length;
    const transferInCount = parsedExcelRows.filter((r) => r.status === 'transfer_in').length;
    const transferOutCount = parsedExcelRows.filter((r) => r.status === 'transfer_out').length;
    const retainedCount = parsedExcelRows.filter((r) => r.status === 'retained').length;

    const confirmed = await showConfirm(
      t('confirmExcelDesc', {
        promote: promoteCount,
        transferIn: transferInCount,
        transferOut: transferOutCount,
        retained: retainedCount,
      }),
      {
        title: t('confirmExcelTitle'),
        confirmText: t('confirmExcelBtn'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await batchPromoteExcel({
        rows: validRows.map((r) => ({
          nis: r.nis,
          name: r.name,
          email: r.email,
          newCohortName: r.newCohortName,
        })),
        sourceCohortIds: Array.from(excelDownloadCohortIds),
        removeFromSourceCohort: removeFromSource,
      });

      await showAlert(
        t('excelAppliedSuccess', {
        promoted: res.promotedCount,
        transferIn: res.transferInCount,
        transferOut: res.transferOutCount,
        retained: res.retainedCount,
      }),
      { type: 'success' }
      );
      setIsPromoteOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('excelApplyFailed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSourceCohort = (cId: string) => {
    setSourceCohortId(cId);
    const sourceCohort = cohorts.find((c) => c.id === cId);
    if (sourceCohort) {
      setPromotedStudentIds(new Set(sourceCohort.members.map((m) => m.user.id)));
      const suggestedName = sourceCohort.name
        .replace(/Kelas\s*X\b/i, 'Kelas XI')
        .replace(/Kelas\s*XI\b/i, 'Kelas XII')
        .replace(/X-/i, 'XI-')
        .replace(/XI-/i, 'XII-');
      setNewTargetCohortName(
        suggestedName !== sourceCohort.name ? suggestedName : `${sourceCohort.name} - Naik Kelas`
      );
    } else {
      setPromotedStudentIds(new Set());
      setNewTargetCohortName('');
    }
  };

  const handleExecutePromotion = async () => {
    if (!sourceCohortId) {
      await showAlert(t('pickSourceFirst'), { type: 'error' });
      return;
    }

    if (targetCohortMode === 'new' && !newTargetCohortName.trim()) {
      await showAlert(t('typeNewTargetName'), { type: 'error' });
      return;
    }

    if (targetCohortMode === 'existing' && !existingTargetCohortId) {
      await showAlert(t('pickExistingTarget'), { type: 'error' });
      return;
    }

    if (promotedStudentIds.size === 0) {
      await showAlert(t('pickMinOneStudent'), { type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const res = await promoteCohortStudents({
        sourceCohortId,
        targetCohortId: targetCohortMode === 'existing' ? existingTargetCohortId : undefined,
        newTargetCohortName: targetCohortMode === 'new' ? newTargetCohortName.trim() : undefined,
        studentIds: Array.from(promotedStudentIds),
        removeFromSourceCohort: removeFromSource,
      });

      await showAlert(
        t('linearSuccessAlert', { count: res.promotedCount }),
        { type: 'success' }
      );
      setIsPromoteOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('linearFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Open Graduation Modal
  const handleOpenGraduation = () => {
    setIsGraduationOpen(true);
    setGradCohortId('');
    setGraduatedStudentIds(new Set());
    setDeactivateAccounts(false);
  };

  const handleSelectGradCohort = (cId: string) => {
    setGradCohortId(cId);
    const sourceCohort = cohorts.find((c) => c.id === cId);
    if (sourceCohort) {
      setGraduatedStudentIds(new Set(sourceCohort.members.map((m) => m.user.id)));
    } else {
      setGraduatedStudentIds(new Set());
    }
  };

  const handleExecuteGraduation = async () => {
    if (!gradCohortId || graduatedStudentIds.size === 0) {
      await showAlert(t('pickCohortAndStudentAlert'), { type: 'error' });
      return;
    }

    const confirmed = await showConfirm(
      t('confirmGradDesc', {
        count: graduatedStudentIds.size,
        deactNote: deactivateAccounts ? t('confirmGradDeactNote') : '',
      }),
      {
        title: t('confirmGradTitle'),
        confirmText: t('confirmGradBtn'),
        cancelText: t('cancelButton'),
      }
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await graduateCohortStudents({
        cohortId: gradCohortId,
        studentIds: Array.from(graduatedStudentIds),
        deactivateAccount: deactivateAccounts,
      });

      await showAlert(t('gradSuccessAlert', { count: res.graduatedCount }), { type: 'success' });
      setIsGraduationOpen(false);
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('gradFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Candidate students to add (not yet in selected cohort)
  const availableToAdd = students.filter((s) => {
    const isAlreadyMember = selectedCohort?.members.some((m) => m.user.id === s.id);
    if (isAlreadyMember) return false;

    if (filterUnassignedOnly) {
      const hasAnyCohort = s.cohortMemberships && s.cohortMemberships.length > 0;
      if (hasAnyCohort) return false;
    }

    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    const hasMatchingCohort = s.cohortMemberships?.some((cm) =>
      cm.cohort.name.toLowerCase().includes(q)
    );

    return (
      s.name.toLowerCase().includes(q) ||
      (s.nis && s.nis.toLowerCase().includes(q)) ||
      s.email.toLowerCase().includes(q) ||
      Boolean(hasMatchingCohort)
    );
  });

  return (
    <div className="space-y-6">
      {/* Unassigned Students Notice Banner */}
      {unassignedStudentsCount > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <span className="font-bold">{t('unassignedBannerTitle', { count: unassignedStudentsCount })}</span>
              <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                {t('unassignedBannerDesc')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter Tabs & Action Bar */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
          <Button
            type="button"
            variant={statusFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={statusFilter === 'all' ? 'bg-[#002446] hover:bg-[#001b33] text-white text-xs h-8' : 'text-gray-600 dark:text-gray-400 text-xs h-8'}
          >
            {t('tabAll', { count: cohorts.length })}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'active' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('active')}
            className={statusFilter === 'active' ? 'bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8' : 'text-gray-600 dark:text-gray-400 text-xs h-8'}
          >
            {t('tabActive', { count: activeCount })}
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'inactive' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter('inactive')}
            className={statusFilter === 'inactive' ? 'bg-gray-600 hover:bg-gray-700 text-white text-xs h-8' : 'text-gray-600 dark:text-gray-400 text-xs h-8'}
          >
            {t('tabInactive', { count: inactiveCount })}
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Button
              onClick={handleOpenPromote}
              className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 text-xs font-semibold"
            >
              <TrendingUp className="w-4 h-4" />
              {t('btnPromote')}
            </Button>

            <Button
              onClick={handleOpenGraduation}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-300 dark:hover:bg-purple-950/30 flex items-center gap-1.5 text-xs font-semibold"
            >
              <Award className="w-4 h-4 text-purple-600" />
              {t('btnGraduation')}
            </Button>

            <Button
              onClick={handleOpenBulkUpload}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-purple-950/30 flex items-center gap-1.5 text-xs font-semibold"
            >
              <FileUp className="w-4 h-4 text-blue-600" />
              {t('btnBulkUpload')}
            </Button>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#002446] hover:bg-[#001b33] text-white flex items-center gap-1.5 text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              {t('btnCreateCohort')}
            </Button>
          </div>
        </div>
      </div>

      {/* Cohorts Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCohorts.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500 bg-white dark:bg-gray-900 rounded-xl border border-dashed p-8">
            <UsersRound className="h-10 w-10 mx-auto text-gray-400 mb-2" />
            <p className="font-semibold text-gray-700 dark:text-gray-300">{t('emptyCohortsTitle')}</p>
            <p className="text-xs text-gray-500 mt-1">
              {t('emptyCohortsDesc')}
            </p>
          </div>
        ) : (
          filteredCohorts.map((cohort) => (
            <Card
              key={cohort.id}
              className={`hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800 flex flex-col justify-between ${cohort.isActive === false ? 'opacity-80 bg-gray-50/60 dark:bg-gray-900/40' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {t('coursesSynced', { count: cohort._count.enrollments })}
                    </Badge>
                    <Badge className="bg-[#FF8928] text-white text-xs">
                      {t('studentsCount', { count: cohort._count.members })}
                    </Badge>
                  </div>
                  <div>
                    {cohort.isActive === false ? (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700 text-[11px] flex items-center gap-1">
                        <EyeOff className="w-3 h-3" />
                        {t('statusInactive')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[11px] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t('statusActive')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <CardTitle className="text-lg font-bold text-[#002446] dark:text-white truncate" title={cohort.name}>
                    {cohort.name}
                  </CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-500 hover:text-[#002446] dark:hover:text-white"
                      onClick={() => handleOpenEdit(cohort)}
                      title={t('editCohortTooltip')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${cohort.isActive === false ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'}`}
                      onClick={() => handleToggleActive(cohort)}
                      title={cohort.isActive === false ? t('activateTooltip') : t('deactivateTooltip')}
                    >
                      {cohort.isActive === false ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => handleDeleteCohort(cohort)}
                      title={t('deleteCohortTooltip')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[32px]">
                  {cohort.members.length > 0 ? (
                    cohort.members.map((m) => m.user.name).join(', ')
                  ) : (
                    <span className="italic text-gray-400">{t('noStudentsInGroup')}</span>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenManageMembers(cohort)}
                    className="flex-1 bg-[#002446] hover:bg-[#001b33] text-white text-xs flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t('manageMembers')}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportCohortExcel(cohort)}
                    className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-xs px-2.5"
                    title={t('exportExcelTooltip')}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>

                  <Link href={`/admin/grades/leger?cohortId=${cohort.id}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-xs px-2.5"
                      title={t('viewLegerTooltip')}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCohort}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
                {t('createModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="chName" className="font-medium">
                  {t('cohortNameLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="chName"
                  placeholder={t('cohortNamePlaceholder')}
                  value={cohortName}
                  onChange={(e) => setCohortName(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  {t('cohortNameHint')}
                </p>
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
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan Kohort'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
                {t('editCohortModalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="space-y-1.5">
                <Label htmlFor="editChName" className="font-medium">
                  {t('editCohortNameLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="editChName"
                  value={editCohortName}
                  onChange={(e) => setEditCohortName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
              >
                {t('cancelButton')}
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit || !editCohortName.trim()}
                className="bg-[#002446] hover:bg-[#001b33] text-white"
              >
                {isSavingEdit ? t('saving') : t('btnSave')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <FileUp className="w-5 h-5 text-blue-600" />
              {t('bulkUploadModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {t('bulkUploadModalDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto pr-1">
            {/* Template Download Buttons */}
            <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Format Berkas Impor
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Unduh template panduan untuk format kolom yang sesuai.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadBulkTemplateXlsx}
                  className="text-xs border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-800 dark:text-blue-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  .XLSX
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadBulkTemplateCsv}
                  className="text-xs border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-800 dark:text-blue-200 flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  .CSV
                </Button>
              </div>
            </div>

            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors relative bg-gray-50/50 dark:bg-gray-900/50">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleUploadBulkFile}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {bulkFileName ? (
                  <span className="font-semibold text-blue-600">{bulkFileName}</span>
                ) : (
                  t('uploadAreaTitle')
                )}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {t('uploadAreaHint')}
              </p>
            </div>

            {/* Preview Table */}
            {bulkParsedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {t('previewBulkTitle', { count: bulkParsedRows.length })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px]">
                      {bulkParsedRows.filter((r) => !r.isDuplicate).length} Baru
                    </Badge>
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[11px]">
                      {bulkParsedRows.filter((r) => r.isDuplicate).length} Duplikat (Skip)
                    </Badge>
                  </div>
                </div>

                <div className="border rounded-md overflow-hidden max-h-56 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:bg-gray-800 text-[11px]">
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{t('previewColCohortName')}</TableHead>
                        <TableHead>{t('previewColNote')}</TableHead>
                        <TableHead className="text-right">{t('previewBulkStatusCol')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {bulkParsedRows.map((row, idx) => (
                        <TableRow key={idx} className={row.isDuplicate ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}>
                          <TableCell className="font-mono text-gray-500">{idx + 1}</TableCell>
                          <TableCell className="font-semibold text-gray-900 dark:text-white">{row.name}</TableCell>
                          <TableCell className="text-gray-500">{row.note || '-'}</TableCell>
                          <TableCell className="text-right">
                            {row.isDuplicate ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                                <AlertCircle className="w-3 h-3" />
                                {t('statusDuplicate')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                {t('statusNew')}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBulkOpen(false)}
            >
              {t('cancelButton')}
            </Button>
            <Button
              type="button"
              disabled={loading || bulkParsedRows.filter((r) => !r.isDuplicate).length === 0}
              onClick={handleExecuteBulkUpload}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? t('processing') : t('btnExecuteBulkUpload', { count: bulkParsedRows.filter((r) => !r.isDuplicate).length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modal Kelola Anggota Kohort (Multi-Select & Bulk) */}
      <Dialog
        open={Boolean(selectedCohort)}
        onOpenChange={(open) => !open && setSelectedCohort(null)}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b pb-3 pr-8 sm:pr-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <UsersRound className="w-5 h-5 text-[#FF8928]" />
                  {selectedCohort?.name}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  {t('manageModalDesc', { count: selectedCohort?.members.length || 0 })}
                </DialogDescription>
              </div>
              {selectedCohort && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCohortExcel(selectedCohort)}
                  className="text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('exportExcelBtn')}
                </Button>
              )}
            </div>

            {/* Nav Tabs Inside Modal */}
            <div className="flex gap-2 pt-3">
              <button
                type="button"
                onClick={() => setManageTab('current')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  manageTab === 'current'
                    ? 'bg-[#002446] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {t('tabCurrentMembers', { count: selectedCohort?.members.length || 0 })}
              </button>
              <button
                type="button"
                onClick={() => setManageTab('add')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  manageTab === 'add'
                    ? 'bg-[#002446] text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {t('tabAddMembers')}
              </button>
            </div>
          </DialogHeader>

          {manageTab === 'current' && (
            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              {selectedCohort && selectedCohort.members.length > 0 && (
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/40 p-2.5 rounded-lg border text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAllRemove"
                      checked={
                        selectedCohort.members.length > 0 &&
                        selectedToRemoveStudentIds.size === selectedCohort.members.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedToRemoveStudentIds(
                            new Set(selectedCohort.members.map((m) => m.user.id))
                          );
                        } else {
                          setSelectedToRemoveStudentIds(new Set());
                        }
                      }}
                      className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                    />
                    <Label htmlFor="selectAllRemove" className="font-semibold cursor-pointer">
                      {t('selectAllMembers', { count: selectedCohort.members.length })}
                    </Label>
                  </div>

                  {selectedToRemoveStudentIds.size > 0 && (
                    <Button
                      size="sm"
                      onClick={handleBulkRemove}
                      disabled={loading}
                      className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7 px-2.5 flex items-center gap-1"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      {t('btnRemoveSelected', { count: selectedToRemoveStudentIds.size })}
                    </Button>
                  )}
                </div>
              )}

              <div className="flex-1 overflow-y-auto border rounded-lg max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                      <TableHead className="w-10"></TableHead>
                      <TableHead>{t('colNis')}</TableHead>
                      <TableHead>{t('colStudentName')}</TableHead>
                      <TableHead>{t('colEmail')}</TableHead>
                      <TableHead className="text-right">{t('colActions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!selectedCohort?.members || selectedCohort.members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500 text-xs">
                          {t('emptyCurrentMembers')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedCohort.members.map((m) => {
                        const isChecked = selectedToRemoveStudentIds.has(m.user.id);
                        return (
                          <TableRow key={m.user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = new Set(selectedToRemoveStudentIds);
                                  if (e.target.checked) updated.add(m.user.id);
                                  else updated.delete(m.user.id);
                                  setSelectedToRemoveStudentIds(updated);
                                }}
                                className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {m.user.nis || '-'}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-[#002446] dark:text-white">
                              {m.user.name}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {m.user.email}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 h-7 w-7 p-0"
                                onClick={() => {
                                  setSelectedToRemoveStudentIds(new Set([m.user.id]));
                                  handleBulkRemove();
                                }}
                                disabled={loading}
                                title={t('removeStudentTooltip')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {manageTab === 'add' && (
            <div className="space-y-3 py-2 flex-1 overflow-hidden flex flex-col">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border text-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder={t('searchStudentPlaceholder')}
                    className="pl-8 h-8 text-xs bg-white dark:bg-gray-900"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {availableToAdd.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const allSelected = availableToAdd.every((s) => selectedToAddStudentIds.has(s.id));
                        if (allSelected) {
                          const updated = new Set(selectedToAddStudentIds);
                          availableToAdd.forEach((s) => updated.delete(s.id));
                          setSelectedToAddStudentIds(updated);
                        } else {
                          const updated = new Set(selectedToAddStudentIds);
                          availableToAdd.forEach((s) => updated.add(s.id));
                          setSelectedToAddStudentIds(updated);
                        }
                      }}
                      className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300"
                    >
                      <CheckSquare className="w-3.5 h-3.5 mr-1" />
                      {availableToAdd.every((s) => selectedToAddStudentIds.has(s.id))
                        ? t('btnDeselectFiltered')
                        : t('btnSelectAllFiltered', { count: availableToAdd.length })}
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => setFilterUnassignedOnly(!filterUnassignedOnly)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      filterUnassignedOnly
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-300'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    {t('btnFilterUnassigned')}
                  </button>

                  <Button
                    size="sm"
                    onClick={handleBulkAdd}
                    disabled={selectedToAddStudentIds.size === 0 || loading}
                    className="bg-[#FF8928] hover:bg-[#ff7b10] text-white text-xs h-8 px-3 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('btnAddSelected', { count: selectedToAddStudentIds.size })}
                  </Button>
                </div>
              </div>

              {/* Table of Available Students */}
              <div className="flex-1 overflow-y-auto border rounded-lg max-h-[50vh]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/70 dark:bg-gray-800/50">
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={
                            availableToAdd.length > 0 &&
                            selectedToAddStudentIds.size === availableToAdd.length
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedToAddStudentIds(new Set(availableToAdd.map((s) => s.id)));
                            } else {
                              setSelectedToAddStudentIds(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded accent-[#002446] cursor-pointer"
                        />
                      </TableHead>
                      <TableHead>{t('colNis')}</TableHead>
                      <TableHead>{t('colStudentName')}</TableHead>
                      <TableHead>{t('colEmail')}</TableHead>
                      <TableHead>{t('colCurrentClassStatus')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableToAdd.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-400 text-xs">
                          {t('emptyAvailableToAdd')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      availableToAdd.map((s) => {
                        const isChecked = selectedToAddStudentIds.has(s.id);
                        const hasCohort = s.cohortMemberships && s.cohortMemberships.length > 0;
                        return (
                          <TableRow key={s.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const updated = new Set(selectedToAddStudentIds);
                                  if (e.target.checked) updated.add(s.id);
                                  else updated.delete(s.id);
                                  setSelectedToAddStudentIds(updated);
                                }}
                                className="w-4 h-4 rounded accent-[#002446] cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600 dark:text-gray-400">
                              {s.nis || '-'}
                            </TableCell>
                            <TableCell className="font-semibold text-xs text-[#002446] dark:text-white">
                              {s.name}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {s.email}
                            </TableCell>
                            <TableCell>
                              {hasCohort ? (
                                <Badge variant="outline" className="text-[10px] text-gray-600">
                                  {s.cohortMemberships?.map((cm) => cm.cohort.name).join(', ')}
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px]">
                                  {t('noClassBadge')}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedCohort(null)}
            >
              Selesai / Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modal Wizard Kenaikan Kelas (Pemetaan Berkas TU & Kenaikan Linier) */}
      <Dialog open={isPromoteOpen} onOpenChange={setIsPromoteOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b bg-gray-50/70 dark:bg-gray-900/70 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#002446] dark:text-white">
                  {t('promoteModalTitle')}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 dark:text-gray-400">
                  {t('promoteModalDesc')}
                </DialogDescription>
              </div>
            </div>

            {/* TAB SELECTOR (2 TABS) */}
            <div className="flex items-center gap-2 mt-4 p-1 bg-gray-200/80 dark:bg-gray-800 rounded-xl">
              <button
                type="button"
                onClick={() => setPromoteTab('excel')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  promoteTab === 'excel'
                    ? 'bg-white dark:bg-gray-900 text-[#002446] dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-[#002446]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>{t('tabImportTu')}</span>
                <Badge className="bg-blue-600 text-white text-[10px] py-0 px-1.5 hidden sm:inline-flex">
                  {t('mainMethodBadge')}
                </Badge>
              </button>

              <button
                type="button"
                onClick={() => setPromoteTab('linear')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  promoteTab === 'linear'
                    ? 'bg-white dark:bg-gray-900 text-[#002446] dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-[#002446]'
                }`}
              >
                <Layers className="w-4 h-4 text-purple-600" />
                <span>{t('tabLinear')}</span>
              </button>
            </div>
          </DialogHeader>

          {promoteTab === 'excel' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-sm text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600" />
                    {t('step1DownloadTitle')}
                  </Label>
                  <Button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    variant="outline"
                    className="h-8 text-xs font-semibold border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    {t('exportExcelBtn')}
                  </Button>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300">
                  {t('step1DownloadDesc')}
                </p>

                {/* Filter rombel yang diekspor */}
                <div className="space-y-1 pt-1">
                  <Label className="text-[11px] text-gray-500 font-semibold">
                    {t('selectCohortsToExport')}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                    {cohorts.map((c) => {
                      const isChecked = excelDownloadCohortIds.has(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            const updated = new Set(excelDownloadCohortIds);
                            if (isChecked) updated.delete(c.id);
                            else updated.add(c.id);
                            setExcelDownloadCohortIds(updated);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors ${
                            isChecked
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-900 text-gray-600 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {c.name} ({c.members.length})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 bg-white dark:bg-gray-900 rounded-lg border text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {t('instructionsTitle')}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>{t('instructionPromote')}</li>
                    <li>{t('instructionRetained')}</li>
                    <li>{t('instructionTransferOut')}</li>
                    <li>{t('instructionTransferIn')}</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                <Label className="font-bold text-sm text-[#002446] dark:text-white flex items-center gap-1.5">
                  <FileUp className="w-4 h-4 text-blue-600" />
                  {t('step2UploadTitle')}
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleUploadExcelFile}
                    className="text-xs bg-white dark:bg-gray-900"
                  />
                  {excelFileName && (
                    <Badge variant="outline" className="text-xs py-1">
                      {excelFileName}
                    </Badge>
                  )}
                </div>
              </div>

              {parsedExcelRows.length > 0 && (
                <div className="space-y-3">
                  {/* Summary Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold block">
                        {t('badgePromote')}
                      </span>
                      <span className="text-lg font-bold text-emerald-800 dark:text-emerald-200">
                        {t('studentsUnit', { count: parsedExcelRows.filter((r) => r.status === 'promote').length })}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border bg-blue-50 dark:bg-blue-950/30 border-blue-200">
                      <span className="text-[10px] text-blue-700 dark:text-blue-300 font-semibold block">
                        {t('badgeTransferIn')}
                      </span>
                      <span className="text-lg font-bold text-blue-800 dark:text-blue-200">
                        {t('studentsUnit', { count: parsedExcelRows.filter((r) => r.status === 'transfer_in').length })}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border bg-amber-50 dark:bg-amber-950/30 border-amber-200">
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold block">
                        {t('badgeRetained')}
                      </span>
                      <span className="text-lg font-bold text-amber-800 dark:text-amber-200">
                        {t('studentsUnit', { count: parsedExcelRows.filter((r) => r.status === 'retained').length })}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl border bg-red-50 dark:bg-red-950/30 border-red-200">
                      <span className="text-[10px] text-red-700 dark:text-red-300 font-semibold block">
                        {t('badgeTransferOut')}
                      </span>
                      <span className="text-lg font-bold text-red-800 dark:text-red-200">
                        {t('studentsUnit', { count: parsedExcelRows.filter((r) => r.status === 'transfer_out').length })}
                      </span>
                    </div>
                  </div>

                  {/* Warning banner jika ada siswa rombel asal yang tidak tercantum di file Excel dari TU */}
                  {unlistedStudents.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-amber-900 dark:text-amber-200">
                          {t('unlistedWarningTitle', { count: unlistedStudents.length })}
                        </p>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          {t('unlistedWarningDesc')}
                        </p>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
                          {unlistedStudents.map((u) => (
                            <Badge key={u.user.id} variant="outline" className="text-[10px] bg-white dark:bg-gray-900 text-amber-900 dark:text-amber-200 border-amber-200">
                              {u.user.name} ({u.cohortName})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Filter & Search */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {(['all', 'promote', 'transfer_in', 'retained', 'transfer_out'] as const).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => setExcelFilterStatus(st)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              excelFilterStatus === st
                                ? 'bg-[#002446] text-white dark:bg-blue-600'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 hover:bg-gray-200'
                            }`}
                          >
                            {st === 'all' && t('filterAll', { count: parsedExcelRows.length })}
                            {st === 'promote' && t('badgePromote')}
                            {st === 'transfer_in' && t('badgeTransferIn')}
                            {st === 'retained' && t('badgeRetained')}
                            {st === 'transfer_out' && t('badgeTransferOut')}
                          </button>
                        )
                      )}
                    </div>

                    <Input
                      value={excelSearch}
                      onChange={(e) => setExcelSearch(e.target.value)}
                      placeholder={t('searchPreviewPlaceholder')}
                      className="h-8 w-44 text-xs"
                    />
                  </div>

                  {/* Preview Table */}
                  <div className="border rounded-xl max-h-56 overflow-y-auto bg-white dark:bg-gray-900">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-800/60 sticky top-0">
                        <TableRow>
                          <TableHead className="w-10 text-[11px]">{t('colNo')}</TableHead>
                          <TableHead className="text-[11px]">{t('colNis')}</TableHead>
                          <TableHead className="text-[11px]">{t('colStudentName')}</TableHead>
                          <TableHead className="text-[11px]">{t('sheetGroupName')}</TableHead>
                          <TableHead className="text-[11px]">{t('previewColStatus')}</TableHead>
                          <TableHead className="text-[11px]">{t('previewColTarget')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedExcelRows
                          .filter((r) => (excelFilterStatus === 'all' ? true : r.status === excelFilterStatus))
                          .filter(
                            (r) =>
                              r.name.toLowerCase().includes(excelSearch.toLowerCase()) ||
                              r.nis.toLowerCase().includes(excelSearch.toLowerCase())
                          )
                          .map((r, idx) => (
                            <TableRow key={`${r.nis}-${idx}`} className="hover:bg-gray-50/50">
                              <TableCell className="font-mono text-gray-400">{idx + 1}</TableCell>
                              <TableCell className="font-mono font-semibold">{r.nis}</TableCell>
                              <TableCell className="font-medium text-[#002446] dark:text-white">
                                {r.name}
                              </TableCell>
                              <TableCell className="text-gray-500">{r.currentCohort}</TableCell>
                              <TableCell>
                                {r.status === 'promote' && (
                                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px]">
                                    {t('badgePromote')}
                                  </Badge>
                                )}
                                {r.status === 'transfer_in' && (
                                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 text-[10px]">
                                    {t('badgeTransferInNewAccount')}
                                  </Badge>
                                )}
                                {r.status === 'retained' && (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px]">
                                    {t('badgeRetained')}
                                  </Badge>
                                )}
                                {r.status === 'transfer_out' && (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 text-[10px]">
                                    {t('badgeTransferOutDeactivated')}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-semibold text-emerald-700 dark:text-emerald-300">
                                {r.newCohortName}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Option */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 border rounded-xl flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="removeSourceExcel"
                      checked={removeFromSource}
                      onChange={(e) => setRemoveFromSource(e.target.checked)}
                      className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                    />
                    <Label
                      htmlFor="removeSourceExcel"
                      className="text-xs font-semibold text-[#002446] dark:text-white cursor-pointer"
                    >
                      {t('optRemoveSourceExcel')}
                    </Label>
                  </div>
                </div>
              )}
            </div>
          )}

          {promoteTab === 'linear' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label className="font-semibold">
                  {t('step1SourceCohort')} <span className="text-red-500">*</span>
                </Label>
                <select
                  value={sourceCohortId}
                  onChange={(e) => handleSelectSourceCohort(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                >
                  <option value="">{t('selectSourcePlaceholder')}</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.members.length} Siswa)
                    </option>
                  ))}
                </select>
              </div>

              {sourceCohortId && (
                <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border">
                  <Label className="font-semibold">
                    {t('step2TargetCohort')} <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetCohortMode === 'new'}
                        onChange={() => setTargetCohortMode('new')}
                        className="accent-emerald-600"
                      />
                      <span>{t('optCreateNewCohort')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="targetMode"
                        checked={targetCohortMode === 'existing'}
                        onChange={() => setTargetCohortMode('existing')}
                        className="accent-emerald-600"
                      />
                      <span>{t('optUseExistingCohort')}</span>
                    </label>
                  </div>

                  {targetCohortMode === 'new' ? (
                    <div className="space-y-1">
                      <Input
                        value={newTargetCohortName}
                        onChange={(e) => setNewTargetCohortName(e.target.value)}
                        placeholder={t('newCohortPlaceholder')}
                        className="text-xs"
                      />
                      <p className="text-[11px] text-gray-500">
                        {t('newCohortHint')}
                      </p>
                    </div>
                  ) : (
                    <select
                      value={existingTargetCohortId}
                      onChange={(e) => setExistingTargetCohortId(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
                    >
                      <option value="">{t('selectTargetPlaceholder')}</option>
                      {cohorts
                        .filter((c) => c.id !== sourceCohortId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.members.length} Siswa)
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}

              {sourceCohortId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">
                      {t('step3PromotedStudents', { count: promotedStudentIds.size })}
                    </Label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const source = cohorts.find((c) => c.id === sourceCohortId);
                          if (source) setPromotedStudentIds(new Set(source.members.map((m) => m.user.id)));
                        }}
                        className="text-[11px] text-emerald-600 hover:underline font-semibold"
                      >
                        Pilih Semua
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setPromotedStudentIds(new Set())}
                        className="text-[11px] text-gray-500 hover:underline"
                      >
                        Batalkan Semua
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    {t('step3Hint')}
                  </p>

                  <div className="border rounded-lg max-h-48 overflow-y-auto divide-y bg-white dark:bg-gray-900">
                    {cohorts
                      .find((c) => c.id === sourceCohortId)
                      ?.members.map((m) => {
                        const isSelected = promotedStudentIds.has(m.user.id);
                        return (
                          <label
                            key={m.user.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const updated = new Set(promotedStudentIds);
                                  if (e.target.checked) updated.add(m.user.id);
                                  else updated.delete(m.user.id);
                                  setPromotedStudentIds(updated);
                                }}
                                className="w-4 h-4 rounded accent-emerald-600"
                              />
                              <div>
                                <span className="font-medium text-[#002446] dark:text-white">
                                  {m.user.name}
                                </span>
                                <span className="text-gray-400 ml-2 font-mono">
                                  {m.user.nis ? `(NIS: ${m.user.nis})` : ''}
                                </span>
                              </div>
                            </div>
                            <Badge variant={isSelected ? 'default' : 'secondary'} className="text-[10px]">
                              {isSelected ? t('badgePromote') : t('badgeRetained')}
                            </Badge>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              {sourceCohortId && (
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="removeSourceLinear"
                    checked={removeFromSource}
                    onChange={(e) => setRemoveFromSource(e.target.checked)}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer"
                  />
                  <Label
                    htmlFor="removeSourceLinear"
                    className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 cursor-pointer"
                  >
                    {t('optRemoveSourceLinear')}
                  </Label>
                </div>
              )}
            </div>
          )}

          {/* DIALOG FOOTER */}
          <DialogFooter className="p-4 border-t bg-gray-50/80 dark:bg-gray-900/80 shrink-0 flex items-center justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPromoteOpen(false)}
              disabled={loading}
              className="text-xs"
            >
              Batal
            </Button>

            <div className="flex items-center gap-2">
              {promoteTab === 'excel' && (
                <Button
                  onClick={handleExecuteExcelPromotion}
                  disabled={parsedExcelRows.length === 0 || loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  {loading ? t('applyingMapping') : t('btnApplyExcelMapping', { count: parsedExcelRows.length })}
                </Button>
              )}

              {promoteTab === 'linear' && (
                <Button
                  onClick={handleExecutePromotion}
                  disabled={!sourceCohortId || promotedStudentIds.size === 0 || loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  <TrendingUp className="w-4 h-4" />
                  {loading ? t('processing') : t('btnExecuteLinear', { count: promotedStudentIds.size })}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Modal Kelulusan Siswa (Graduation) */}
      <Dialog open={isGraduationOpen} onOpenChange={setIsGraduationOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              {t('gradModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t('gradModalDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">
                {t('gradSelectLabel')} <span className="text-red-500">*</span>
              </Label>
              <select
                value={gradCohortId}
                onChange={(e) => handleSelectGradCohort(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs"
              >
                <option value="">{t('gradSelectPlaceholder')}</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.members.length} Siswa)
                  </option>
                ))}
              </select>
            </div>

            {gradCohortId && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">
                    {t('gradStudentsList', { count: graduatedStudentIds.size })}
                  </Label>
                </div>
                <div className="border rounded-lg max-h-44 overflow-y-auto divide-y bg-white dark:bg-gray-900">
                  {cohorts
                    .find((c) => c.id === gradCohortId)
                    ?.members.map((m) => {
                      const isChecked = graduatedStudentIds.has(m.user.id);
                      return (
                        <label
                          key={m.user.id}
                          className="flex items-center gap-2.5 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = new Set(graduatedStudentIds);
                              if (e.target.checked) updated.add(m.user.id);
                              else updated.delete(m.user.id);
                              setGraduatedStudentIds(updated);
                            }}
                            className="w-4 h-4 rounded accent-purple-600"
                          />
                          <span className="font-medium text-[#002446] dark:text-white">
                            {m.user.name}
                          </span>
                        </label>
                      );
                    })}
                </div>

                <div className="p-3 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-xl flex items-center gap-3 mt-3">
                  <input
                    type="checkbox"
                    id="deact"
                    checked={deactivateAccounts}
                    onChange={(e) => setDeactivateAccounts(e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                  />
                  <Label htmlFor="deact" className="text-xs font-semibold text-purple-950 dark:text-purple-200 cursor-pointer">
                    {t('gradDeactivateOpt')}
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsGraduationOpen(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              onClick={handleExecuteGraduation}
              disabled={!gradCohortId || graduatedStudentIds.size === 0 || loading}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
            >
              {loading ? 'Memproses...' : `Luluskan (${graduatedStudentIds.size}) Siswa`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
