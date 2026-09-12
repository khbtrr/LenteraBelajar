'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Calendar, Plus, Archive, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  createAcademicYear,
  setActiveAcademicYear,
  archiveAcademicYear,
} from '@/lib/actions/academic-year';
import { useDialog } from '@/context/DialogContext';

interface AcademicYear {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: 'ACTIVE' | 'ARCHIVED';
  _count?: {
    courses: number;
  };
}

export function AcademicYearsClient({
  initialYears,
}: {
  initialYears: AcademicYear[];
}) {
  const { showAlert, showConfirm } = useDialog();
  const [years, setYears] = useState<AcademicYear[]>(initialYears);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [makeActive, setMakeActive] = useState(true);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createAcademicYear({
        name,
        startDate,
        endDate,
        makeActive,
      });

      if (makeActive) {
        setYears((prev) =>
          prev.map((y) => ({
            ...y,
            status: 'ARCHIVED',
          }))
        );
      }

      setYears((prev) => [
        { ...created, _count: { courses: 0 } },
        ...prev,
      ]);
      setIsCreateOpen(false);
      setName('');
      setStartDate('');
      setEndDate('');
      await showAlert(`Tahun ajaran ${created.name} berhasil dibuat!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat tahun ajaran', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (id: string) => {
    const confirmed = await showConfirm(
      'Aktifkan tahun ajaran ini? Tahun ajaran aktif lainnya akan diarsipkan secara otomatis.',
      { title: 'Konfirmasi Aktivasi Tahun Ajaran', confirmText: 'Ya, Aktifkan' }
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    try {
      await setActiveAcademicYear(id);
      setYears((prev) =>
        prev.map((y) => ({
          ...y,
          status: y.id === id ? 'ACTIVE' : 'ARCHIVED',
        }))
      );
      await showAlert('Tahun ajaran berhasil diaktifkan!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengaktifkan tahun ajaran', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setLoading(true);
    try {
      await archiveAcademicYear(archiveTarget.id);
      setYears((prev) =>
        prev.map((y) =>
          y.id === archiveTarget.id ? { ...y, status: 'ARCHIVED' } : y
        )
      );
      setArchiveTarget(null);
      await showAlert('Tahun ajaran berhasil diarsipkan!', { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal mengarsipkan tahun ajaran', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Tambah Tahun Ajaran
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {years.map((year) => {
          const isActive = year.status === 'ACTIVE';
          return (
            <Card
              key={year.id}
              className={`border-2 transition-all ${
                isActive ? 'border-[#FF8928] shadow-md bg-white' : 'border-gray-200 bg-gray-50'
              }`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Calendar
                    className={`h-5 w-5 ${isActive ? 'text-[#FF8928]' : 'text-gray-400'}`}
                  />
                  <CardTitle className="text-xl font-bold text-[#002446]">
                    {year.name}
                  </CardTitle>
                </div>
                <Badge
                  className={
                    isActive
                      ? 'bg-[#FF8928] text-white'
                      : 'bg-gray-200 text-gray-700'
                  }
                >
                  {isActive ? 'Aktif' : 'Arsip'}
                </Badge>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">Periode:</span>{' '}
                    {new Date(year.startDate).toLocaleDateString('id-ID')} —{' '}
                    {new Date(year.endDate).toLocaleDateString('id-ID')}
                  </p>
                  <p>
                    <span className="font-medium">Course Terdaftar:</span>{' '}
                    {year._count?.courses || 0}
                  </p>
                </div>

                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  {!isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetActive(year.id)}
                      disabled={loading}
                      className="border-[#002446] text-[#002446] hover:bg-[#002446] hover:text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
                      Aktifkan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setArchiveTarget(year)}
                      disabled={loading}
                      className="flex items-center gap-1"
                    >
                      <Archive className="h-4 w-4" /> Arsipkan
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog Tambah Tahun Ajaran */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Tambah Tahun Ajaran
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="yearName">Nama Tahun Ajaran</Label>
                <Input
                  id="yearName"
                  placeholder="misal: 2026/2027"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Tanggal Mulai</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Tanggal Selesai</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="makeActive"
                  checked={makeActive}
                  onChange={(e) => setMakeActive(e.target.checked)}
                  className="rounded border-gray-300 text-[#FF8928] focus:ring-[#002446]"
                />
                <Label htmlFor="makeActive" className="text-sm font-normal cursor-pointer">
                  Jadikan sebagai Tahun Ajaran Aktif saat ini
                </Label>
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
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Konfirmasi Arsip */}
      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-bold text-lg">
              <AlertTriangle className="h-5 w-5" /> Arsipkan Tahun Ajaran?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm text-gray-600 space-y-3">
            <p>
              Anda akan mengarsipkan <strong>{archiveTarget?.name}</strong>.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs leading-relaxed">
              <strong>Perhatian:</strong> Seluruh course, penugasan, dan nilai yang terdaftar pada tahun ajaran ini akan otomatis diarsipkan menjadi <strong>hanya baca (read-only)</strong>.
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleArchive}
              disabled={loading}
            >
              {loading ? 'Mengarsipkan...' : 'Ya, Arsipkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
