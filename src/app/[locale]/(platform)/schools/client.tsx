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
import { School, Plus, Search, Users, BookOpen } from 'lucide-react';
import { createSchool, toggleSchoolActive } from '@/lib/actions/school';
import { useDialog } from '@/context/DialogContext';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: {
    users: number;
    courses: number;
    academicYears: number;
  };
}

export function PlatformSchoolsClient({
  initialSchools,
}: {
  initialSchools: any[];
}) {
  const t = useTranslations('schools');
  const { showAlert } = useDialog();
  const [schools, setSchools] = useState<SchoolItem[]>(initialSchools);
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createSchool({ name, code, address });
      setSchools((prev) => [
        {
          ...created,
          _count: { users: 0, courses: 0, academicYears: 0 },
        },
        ...prev,
      ]);
      setIsCreateOpen(false);
      setName('');
      setCode('');
      setAddress('');
      await showAlert(t('schoolAddedSuccess', { name: created.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('schoolAddFailed'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (school: SchoolItem) => {
    try {
      const updated = await toggleSchoolActive(school.id);
      setSchools((prev) =>
        prev.map((s) => (s.id === school.id ? { ...s, isActive: updated.isActive } : s))
      );
      await showAlert(
        t('statusChangedSuccess', {
          name: school.name,
          status: updated.isActive ? t('active') : t('inactive'),
        }),
        { type: 'info' }
      );
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('statusChangeFailed'), { type: 'error' });
    }
  };

  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" /> {t('registerNewSchool')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>{t('colName')}</TableHead>
                <TableHead>{t('colTenantCode')}</TableHead>
                <TableHead>{t('colStats')}</TableHead>
                <TableHead>{t('colStatus')}</TableHead>
                <TableHead className="text-right">{t('colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                    {t('noSchools')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell>
                      <div className="font-semibold text-[#002446]">
                        {school.name}
                      </div>
                      {school.address && (
                        <div className="text-xs text-gray-500">{school.address}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {school.code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-[#FF8928]" />
                          {t('usersCount', { count: school._count.users })}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-[#002446]" />
                          {t('coursesCount', { count: school._count.courses })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        onClick={() => handleToggle(school)}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          school.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {school.isActive ? t('active') : t('inactive')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggle(school)}
                        className="text-xs text-gray-600"
                      >
                        {school.isActive ? t('deactivate') : t('activate')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Tambah Sekolah */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
                <School className="h-5 w-5 text-[#FF8928]" /> {t('registerNewSchool')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sName">{t('schoolNameLabel')}</Label>
                <Input
                  id="sName"
                  placeholder={t('schoolNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sCode">{t('tenantCodeLabel')}</Label>
                <Input
                  id="sCode"
                  placeholder={t('tenantCodePlaceholder')}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
                <p className="text-xs text-gray-500">
                  {t('tenantCodeHelp')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sAddress">{t('addressLabel')}</Label>
                <Input
                  id="sAddress"
                  placeholder={t('addressPlaceholder')}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
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
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
              >
                {loading ? t('submitting') : t('submit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
