'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users,
  HelpCircle,
  ClipboardList,
  FileText,
  Check,
  Plus,
  X,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  getCohortAccessForModule,
  setCohortAccess,
  addStudentOverride,
  removeStudentOverride,
  getCourseCohortsAndStudents,
  ModuleAccessSettings,
  ItemCohortAccessInfo,
} from '@/lib/actions/cohort-access';
import { AccessItemType } from '@prisma/client';

interface ModuleCohortAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  onUpdated?: () => void;
}

export function ModuleCohortAccessModal({
  isOpen,
  onClose,
  moduleId,
  moduleTitle,
  courseId,
  onUpdated,
}: ModuleCohortAccessModalProps) {
  const t = useTranslations('cohortAccess');

  const [loading, setLoading] = useState(true);
  const [accessData, setAccessData] = useState<ModuleAccessSettings | null>(null);
  const [availableCohorts, setAvailableCohorts] = useState<Array<{ id: string; name: string }>>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<
    Array<{ id: string; name: string; email: string; nis: string | null; cohortName: string | null }>
  >([]);

  // Draft state for cohort selection per item: `${itemType}_${itemId}` -> Set of cohortIds
  const [selectedCohortsMap, setSelectedCohortsMap] = useState<Record<string, string[]>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedSuccessKey, setSavedSuccessKey] = useState<string | null>(null);

  // Tab filter: 'ALL' | 'QUIZ' | 'ASSIGNMENT' | 'CONTENT'
  const [activeTab, setActiveTab] = useState<'ALL' | 'QUIZ' | 'ASSIGNMENT' | 'CONTENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Student override picker modal state
  const [overrideModalItem, setOverrideModalItem] = useState<{
    itemId: string;
    itemType: AccessItemType;
    title: string;
  } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [addingStudentId, setAddingStudentId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [modAccess, courseInfo] = await Promise.all([
        getCohortAccessForModule(moduleId),
        getCourseCohortsAndStudents(courseId),
      ]);
      setAccessData(modAccess);
      setAvailableCohorts(courseInfo.cohorts);
      setEnrolledStudents(courseInfo.enrolledStudents);

      // Initialize selected cohorts map
      const initialMap: Record<string, string[]> = {};
      for (const item of [...modAccess.quizzes, ...modAccess.assignments, ...modAccess.contents]) {
        initialMap[`${item.itemType}_${item.itemId}`] = item.allowedCohorts.map((c) => c.id);
      }
      setSelectedCohortsMap(initialMap);
    } catch (err) {
      console.error('Failed to load cohort access data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, moduleId, courseId]);

  const toggleCohort = (itemKey: string, cohortId: string) => {
    setSelectedCohortsMap((prev) => {
      const current = prev[itemKey] || [];
      const next = current.includes(cohortId)
        ? current.filter((id) => id !== cohortId)
        : [...current, cohortId];
      return { ...prev, [itemKey]: next };
    });
  };

  const resetToAllCohorts = (itemKey: string) => {
    setSelectedCohortsMap((prev) => ({
      ...prev,
      [itemKey]: [],
    }));
  };

  const handleSaveItem = async (item: ItemCohortAccessInfo) => {
    const key = `${item.itemType}_${item.itemId}`;
    const cohortIds = selectedCohortsMap[key] || [];
    setSavingKey(key);
    try {
      await setCohortAccess(item.itemType, item.itemId, cohortIds);
      setSavedSuccessKey(key);
      setTimeout(() => setSavedSuccessKey(null), 2500);
      onUpdated?.();
    } catch (err) {
      console.error('Failed to save cohort access:', err);
      alert(t('saveFailed'));
    } finally {
      setSavingKey(null);
    }
  };

  const handleAddOverride = async (userId: string) => {
    if (!overrideModalItem) return;
    setAddingStudentId(userId);
    try {
      await addStudentOverride(overrideModalItem.itemType, overrideModalItem.itemId, userId);
      await fetchData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to add student override:', err);
    } finally {
      setAddingStudentId(null);
    }
  };

  const handleRemoveOverride = async (
    itemType: AccessItemType,
    itemId: string,
    userId: string
  ) => {
    try {
      await removeStudentOverride(itemType, itemId, userId);
      await fetchData();
      onUpdated?.();
    } catch (err) {
      console.error('Failed to remove student override:', err);
    }
  };

  const allItems: ItemCohortAccessInfo[] = accessData
    ? [...accessData.quizzes, ...accessData.assignments, ...accessData.contents]
    : [];

  const filteredItems = allItems.filter((item) => {
    if (activeTab !== 'ALL' && item.itemType !== activeTab) return false;
    if (searchQuery.trim() && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
          <DialogHeader className="p-5 border-b bg-gray-50/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-[#002446] text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-[#002446]">
                  {t('modalTitle')}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5">
                  Bab: <span className="font-semibold text-gray-800">{moduleTitle}</span> • {t('modalSubtitle')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Filters Bar */}
          <div className="p-4 border-b flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              <Button
                variant={activeTab === 'ALL' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('ALL')}
                className={`text-xs h-8 ${
                  activeTab === 'ALL' ? 'bg-[#002446] text-white hover:bg-[#002446]/90' : ''
                }`}
              >
                Semua ({allItems.length})
              </Button>
              <Button
                variant={activeTab === 'QUIZ' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('QUIZ')}
                className={`text-xs h-8 ${
                  activeTab === 'QUIZ' ? 'bg-amber-600 text-white hover:bg-amber-700' : ''
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 mr-1" />
                {t('itemTypeQuiz')} ({accessData?.quizzes.length || 0})
              </Button>
              <Button
                variant={activeTab === 'ASSIGNMENT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('ASSIGNMENT')}
                className={`text-xs h-8 ${
                  activeTab === 'ASSIGNMENT' ? 'bg-purple-600 text-white hover:bg-purple-700' : ''
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5 mr-1" />
                {t('itemTypeAssignment')} ({accessData?.assignments.length || 0})
              </Button>
              <Button
                variant={activeTab === 'CONTENT' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('CONTENT')}
                className={`text-xs h-8 ${
                  activeTab === 'CONTENT' ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                }`}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                {t('itemTypeContent')} ({accessData?.contents.length || 0})
              </Button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Cari materi / kuis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-gray-50 focus-visible:ring-1 focus-visible:ring-[#002446]"
              />
            </div>
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                <Loader2 className="h-7 w-7 animate-spin text-[#002446]" />
                <span className="text-xs">Memuat data akses rombel...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">
                  {t('noItemsInModule')}
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const key = `${item.itemType}_${item.itemId}`;
                const selectedCohorts = selectedCohortsMap[key] || [];
                const isRestricted = selectedCohorts.length > 0;
                const isSaving = savingKey === key;
                const isSaved = savedSuccessKey === key;

                return (
                  <div
                    key={key}
                    className="p-4 rounded-xl border border-gray-200 bg-white shadow-xs space-y-3.5 hover:border-gray-300 transition-colors"
                  >
                    {/* Item Title & Type */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        {item.itemType === 'QUIZ' ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1 text-[11px] font-semibold">
                            <HelpCircle className="h-3 w-3" /> {t('itemTypeQuiz')}
                          </Badge>
                        ) : item.itemType === 'ASSIGNMENT' ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1 text-[11px] font-semibold">
                            <ClipboardList className="h-3 w-3" /> {t('itemTypeAssignment')}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1 text-[11px] font-semibold">
                            <FileText className="h-3 w-3" /> {t('itemTypeContent')}
                          </Badge>
                        )}
                        <h4 className="font-bold text-sm text-[#002446]">{item.title}</h4>
                      </div>

                      <div className="flex items-center gap-2">
                        {isRestricted ? (
                          <Badge className="bg-amber-50 text-amber-800 border border-amber-300 text-xs">
                            {t('restrictedTo', { count: selectedCohorts.length })}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs">
                            {t('allCohortsOpen')}
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          onClick={() => handleSaveItem(item)}
                          disabled={isSaving}
                          className={`h-7 text-xs flex items-center gap-1.5 transition-colors ${
                            isSaved
                              ? 'bg-emerald-600 hover:bg-emerald-600 text-white'
                              : 'bg-[#002446] hover:bg-[#002446]/90 text-white'
                          }`}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t('saving')}
                            </>
                          ) : isSaved ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Tersimpan
                            </>
                          ) : (
                            t('saveChanges')
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Cohort Selector Checkboxes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span className="font-medium text-gray-700">
                          {t('selectCohortsLabel')}
                        </span>
                        {isRestricted && (
                          <button
                            type="button"
                            onClick={() => resetToAllCohorts(key)}
                            className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
                          >
                            <RotateCcw className="h-3 w-3" />
                            Kembalikan Terbuka untuk Semua
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {availableCohorts.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">
                            Belum ada rombel terdaftar pada sekolah ini.
                          </p>
                        ) : (
                          availableCohorts.map((cohort) => {
                            const isChecked = selectedCohorts.includes(cohort.id);
                            return (
                              <button
                                key={cohort.id}
                                type="button"
                                onClick={() => toggleCohort(key, cohort.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                  isChecked
                                    ? 'bg-[#002446] text-white border-[#002446] shadow-xs'
                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <span
                                  className={`h-3.5 w-3.5 rounded flex items-center justify-center border text-[9px] ${
                                    isChecked
                                      ? 'bg-white text-[#002446] border-white font-bold'
                                      : 'border-gray-400 bg-white'
                                  }`}
                                >
                                  {isChecked && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                                </span>
                                {cohort.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Individual Overrides Section */}
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-600">
                          {t('tableOverrides')}:
                        </span>
                        {item.overrides.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">
                            Tidak ada pengecualian
                          </span>
                        ) : (
                          item.overrides.map((ov) => (
                            <Badge
                              key={ov.id}
                              variant="outline"
                              className="text-xs bg-gray-50 text-gray-700 border-gray-300 flex items-center gap-1.5 pr-1"
                            >
                              <span>
                                {ov.name} {ov.nis ? `(${ov.nis})` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveOverride(item.itemType, item.itemId, ov.userId)
                                }
                                className="text-gray-400 hover:text-red-600 rounded p-0.5"
                                title={t('removeOverride')}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setOverrideModalItem({
                            itemId: item.itemId,
                            itemType: item.itemType,
                            title: item.title,
                          })
                        }
                        className="h-7 text-xs border-dashed border-gray-300 text-gray-600 hover:text-[#002446] hover:border-[#002446] flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t('addStudentOverride')}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-gray-50/80 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              * Item tanpa centang rombel dapat diakses bebas oleh seluruh siswa yang terdaftar di course ini.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 border-gray-300"
            >
              {t('closeBtn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-Dialog: Add Individual Student Override */}
      {overrideModalItem && (
        <Dialog
          open={!!overrideModalItem}
          onOpenChange={(open) => {
            if (!open) {
              setOverrideModalItem(null);
              setStudentSearch('');
            }
          }}
        >
          <DialogContent className="sm:max-w-md bg-white p-5">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#002446]">
                {t('studentOverrideModalTitle')}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Pilih siswa enrolled untuk diberikan akses ke &quot;{overrideModalItem.title}&quot;.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Ketik nama siswa atau NIS..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-gray-50"
                  autoFocus
                />
              </div>

              <div className="max-h-60 overflow-y-auto divide-y border rounded-lg bg-gray-50/40">
                {enrolledStudents
                  .filter((s) => {
                    const q = studentSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      (s.nis && s.nis.toLowerCase().includes(q)) ||
                      s.email.toLowerCase().includes(q)
                    );
                  })
                  .slice(0, 20)
                  .map((student) => {
                    const isAlreadyOverridden =
                      accessData &&
                      [
                        ...accessData.quizzes,
                        ...accessData.assignments,
                        ...accessData.contents,
                      ]
                        .find(
                          (i) =>
                            i.itemId === overrideModalItem.itemId &&
                            i.itemType === overrideModalItem.itemType
                        )
                        ?.overrides.some((o) => o.userId === student.id);

                    const isAdding = addingStudentId === student.id;

                    return (
                      <div
                        key={student.id}
                        className="p-2.5 flex items-center justify-between text-xs hover:bg-white transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-gray-800">{student.name}</div>
                          <div className="text-[11px] text-gray-500">
                            {student.nis ? `NIS: ${student.nis} • ` : ''}
                            {student.cohortName || 'Tanpa Rombel'}
                          </div>
                        </div>

                        {isAlreadyOverridden ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                            Sudah Terdaftar
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAddOverride(student.id)}
                            disabled={isAdding}
                            className="h-7 text-xs bg-[#002446] hover:bg-[#002446]/90 text-white"
                          >
                            {isAdding ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              t('addBtn')
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOverrideModalItem(null);
                  setStudentSearch('');
                }}
                className="text-xs h-8"
              >
                {t('closeBtn')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
