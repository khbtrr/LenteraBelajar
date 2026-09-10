import { getCategoryTree, getCategories } from '@/lib/actions/category';
import { CategoriesClient } from './client';

export default async function CategoriesPage() {
  const [tree, allCategories] = await Promise.all([
    getCategoryTree(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">Manajemen Kategori Course</h1>
        <p className="text-sm text-gray-500">
          Struktur kategori berjenjang: <strong>Tahun Ajaran (Kategori Utama)</strong> → <strong>Mata Pelajaran</strong> → <strong>Course Guru Mapel</strong>.
        </p>
      </div>

      <CategoriesClient initialTree={tree} flatCategories={allCategories} />
    </div>
  );
}
