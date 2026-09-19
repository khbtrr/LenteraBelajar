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
  const t = useTranslations('adminCategories');
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
      await showAlert(t('categoryCreatedAlert', { name: created.name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('categoryCreateFailedAlert'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmed = await showConfirm(
      t('deleteCategoryConfirmDesc', { name }),
      { title: t('deleteCategoryConfirmTitle'), confirmText: t('btnConfirmDelete'), confirmVariant: 'destructive' }
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
      await showAlert(t('categoryDeletedAlert', { name }), { type: 'success' });
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('categoryDeleteFailedAlert'), { type: 'error' });
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
              ? 'bg-white dark:bg-gray-800/90 border-[#002446]/20 dark:border-gray-700 font-semibold text-[#002446] dark:text-white shadow-sm'
              : depth === 1
              ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700/80 text-gray-800 dark:text-gray-200'
              : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 text-gray-700 dark:text-gray-300'
          }`}
          style={{ marginLeft: `${depth * 28}px` }}
        >
          <div className="flex items-center gap-3">
            {depth > 0 && <ChevronRight className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            <Folder
              className={`h-5 w-5 shrink-0 ${
                depth === 0
                  ? 'text-[#002446] dark:text-blue-400'
                  : depth === 1
                  ? 'text-[#FF8928] dark:text-orange-400'
                  : 'text-amber-500 dark:text-amber-400'
              }`}
            />
            <span className="text-base text-gray-900 dark:text-gray-100">{node.name || t('unnamed')}</span>
            <Badge variant="secondary" className="text-xs dark:bg-gray-700 dark:text-gray-300">
              {t('coursesCount', { count: node._count?.courses || 0 })}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-gray-500 hover:text-[#002446] hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/60"
              onClick={() => {
                setParentId(node.id);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('btnAddSub')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-sm text-[#002446] dark:text-blue-200 flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-[#FF8928] dark:text-orange-400 shrink-0" />
          <span>{t('hierarchyInfo')}</span>
        </div>

        <Button
          onClick={() => {
            setParentId('');
            setIsCreateOpen(true);
          }}
          className="bg-[#002446] hover:bg-[#002446]/90 dark:bg-brand-600 dark:hover:bg-brand-700 text-white flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" /> {t('btnAddMainCategory')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          {tree.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400 space-y-3">
              <FolderTree className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
              <p>{t('emptyTree')}</p>
              <Button
                variant="outline"
                onClick={() => {
                  setParentId('');
                  setIsCreateOpen(true);
                }}
              >
                {t('btnCreateFirstCategory')}
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
              <DialogTitle className="text-xl font-bold text-[#002446] dark:text-white">
                {t('modalTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="catName">{t('categoryNameLabel')}</Label>
                <Input
                  id="catName"
                  placeholder={t('categoryNamePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentCat">{t('parentCategoryLabel')}</Label>
                <select
                  id="parentCat"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#002446] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 transition-colors"
                >
                  <option value="">{t('mainCategoryOption')}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('parentCategoryHint')}
                </p>
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
