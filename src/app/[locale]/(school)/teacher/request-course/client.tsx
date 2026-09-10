'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { requestCourse } from '@/lib/actions/course';

interface RequestItem {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminNote: string | null;
  createdAt: Date;
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

export function TeacherRequestCourseClient({
  initialRequests,
  academicYears,
  categories,
}: {
  initialRequests: any[];
  academicYears: AcademicYear[];
  categories: Category[];
}) {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [academicYearId, setAcademicYearId] = useState(
    academicYears.find((y) => y.status === 'ACTIVE')?.id || academicYears[0]?.id || ''
  );
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId) {
      alert('Pilih Tahun Ajaran aktif');
      return;
    }
    setLoading(true);
    setSuccessMsg('');
    try {
      const newReq = await requestCourse({
        title,
        description,
        academicYearId,
        categoryId: categoryId || undefined,
      });

      setRequests((prev) => [newReq, ...prev]);
      setTitle('');
      setDescription('');
      setSuccessMsg('Pengajuan course berhasil dikirim ke Administrator!');
    } catch (err) {
      console.error(err);
      alert('Gagal mengirim pengajuan course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Form Request */}
      <Card className="border-[#002446]/20 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-[#002446] flex items-center gap-2">
            <Send className="h-5 w-5 text-[#FF8928]" /> Formulir Pengajuan Course
          </CardTitle>
          <CardDescription>
            Setelah dikirim, Administrator akan meninjau dan mengaktifkan course Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {successMsg && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                {successMsg}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reqTitle">Judul Course yang Diajukan</Label>
              <Input
                id="reqTitle"
                placeholder="misal: Biologi Sel dan Genetika Kelas XII"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reqDesc">Rencana / Deskripsi Pembelajaran</Label>
              <Input
                id="reqDesc"
                placeholder="misal: Silabus materi semester ganjil, target kompetensi siswa"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reqYear">Tahun Ajaran</Label>
                <select
                  id="reqYear"
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
                <Label htmlFor="reqCat">Kategori Mata Pelajaran</Label>
                <select
                  id="reqCat"
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

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#FF8928] hover:bg-[#FF8928]/90 text-white flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                {loading ? 'Mengirim...' : 'Kirim Pengajuan'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Riwayat Pengajuan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-bold text-[#002446]">
            Riwayat Pengajuan Course Anda
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Judul Course</TableHead>
                <TableHead>Tanggal Pengajuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Catatan Administrator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    Belum ada riwayat pengajuan course.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-semibold text-[#002446]">{r.title}</div>
                      {r.description && (
                        <div className="text-xs text-gray-500 line-clamp-1">
                          {r.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(r.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === 'APPROVED'
                            ? 'bg-green-600 text-white'
                            : r.status === 'REJECTED'
                            ? 'bg-red-500 text-white'
                            : 'bg-amber-500 text-white'
                        }
                      >
                        {r.status === 'APPROVED' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Disetujui
                          </span>
                        ) : r.status === 'REJECTED' ? (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" /> Ditolak
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Menunggu Review
                          </span>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {r.adminNote || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
