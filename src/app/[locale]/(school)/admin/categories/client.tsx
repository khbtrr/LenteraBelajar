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
import { FolderTree, Plus, Trash2, ChevronRight, Folder } from 'lucide-react';
import { createCategory, deleteCategory } from '@/lib/actions/category';
import { useDialog } from '@/context/DialogContext';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: CategoryNode[];
  _count?: {
    courses: number;
  };
}

export function CategoriesClient({
  initialTree,
  flatCategories,
}: {
  initialTree: CategoryNode[];
  flatCategories: CategoryNode[];
}) {
  const { showAlert, showConfirm } = useDialog();
  const [tree, setTree] = useState<CategoryNode[]>(initialTree);
  const [categories, setCategories] = useState<CategoryNode[]>(flatCategories);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await createCategory({
        name,
        parentId: parentId || undefined,
      });

      const newNode: CategoryNode = {
        id: created.id,
        name: created.name,
        slug: created.slug,
        parentId: created.parentId,
        children: [],
        _count: { courses: 0 },
      };

      setCategories((prev) => [...prev, newNode]);

      if (!created.parentId) {
        setTree((prev) => [...prev, newNode]);
      } else {
        const attachChild = (nodes: CategoryNode[]): CategoryNode[] => {
          return nodes.map((node) => {
            if (node.id === created.parentId) {
              return {
                ...node,
                children: [...(node.children || []), newNode],
              };
            }
            if (node.children) {
              return {
                ...node,
                children: attachChild(node.children),
              };
            }
            return node;
          });
        };
        setTree((prev) => attachChild(prev));
      }

      setIsCreateOpen(false);
      setName('');
      setParentId('');
      await showAlert(`Kategori "${created.name}" berhasil dibuat!`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal membuat kategori', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      `Hapus kategori "${name}"?\n\nKategori dan sub-kategori di dalamnya juga akan terpengaruh.`,
      { title: 'Hapus Kategori', confirmText: 'Ya, Hapus', confirmVariant: 'destructive' }
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    try {
      await deleteCategory(id);
      const removeNode = (nodes: CategoryNode[]): CategoryNode[] => {
        return nodes
          .filter((n) => n.id !== id)
          .map((n) => ({
            ...n,
            children: n.children ? removeNode(n.children) : [],
          }));
      };
      setTree((prev) => removeNode(prev));
      setCategories((prev) => prev.filter((c) => c.id !== id));
      await showAlert(`Kategori "${name}" berhasil dihapus.`, { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || 'Gagal menghapus kategori', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderCategoryNode = (node: CategoryNode, depth = 0) => {
    return (
      <div key={node.id} className="space-y-2">
        <div
          className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
            depth === 0
              ? 'bg-white border-[#002446]/20 font-semibold text-[#002446]'
              : depth === 1
              ? 'bg-gray-50 border-gray-200 text-gray-800'
              : 'bg-amber-50/40 border-amber-200/60 text-gray-700'
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          <div className="flex items-center gap-3">
            {depth > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
            <Folder
              className={`h-5 w-5 ${
                depth === 0
                  ? 'text-[#002446]'
                  : depth === 1
                  ? 'text-[#FF8928]'
                  : 'text-amber-500'
              }`}
            />
            <span className="text-base">{node.name}</span>
            <Badge variant="secondary" className="text-xs">
              {node._count?.courses || 0} Course
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-[#002446]"
              onClick={() => {
                setParentId(node.id);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Tambah Sub
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => handleDelete(node.id, node.name)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div className="space-y-2">
            {node.children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-[#002446] flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-[#FF8928]" />
          <span>
            Hierarki: <strong>Tahun Ajaran</strong> (Level 1) →{' '}
            <strong>Mata Pelajaran</strong> (Level 2) → <strong>Course Guru Mapel</strong>{' '}
            (Level 3)
          </span>
        </div>

        <Button
          onClick={() => {
            setParentId('');
            setIsCreateOpen(true);
          }}
          className="bg-[#002446] hover:bg-[#002446]/90 text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Tambah Tahun Ajaran (Kategori Utama)
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {tree.length === 0 ? (
            <div className="text-center py-12 text-gray-500 space-y-3">
              <FolderTree className="h-12 w-12 mx-auto text-gray-300" />
              <p>Belum ada kategori yang dibuat.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setParentId('');
                  setIsCreateOpen(true);
                }}
              >
                Buat Kategori Pertama
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tree.map((node) => renderCategoryNode(node, 0))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Tambah Kategori */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#002446]">
                Tambah Kategori Course
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="catName">Nama Kategori</Label>
                <Input
                  id="catName"
                  placeholder="misal: TA 2026/2027 (Kategori Utama) atau Matematika (Mata Pelajaran)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentCat">Kategori Induk</Label>
                <select
                  id="parentCat"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#002446]"
                >
                  <option value="">-- Kategori Utama (Tahun Ajaran) --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  Pilih induk jika ini adalah sub-kategori (misal: Mata Pelajaran di dalam Tahun Ajaran).
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
                className="bg-[#002446] hover:bg-[#002446]/90 text-white"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
