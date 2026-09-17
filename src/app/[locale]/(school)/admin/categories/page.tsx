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
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">Manajemen Kategori Course</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Struktur kategori berjenjang: <strong className="text-gray-700 dark:text-gray-300">Tahun Ajaran (Kategori Utama)</strong> → <strong className="text-gray-700 dark:text-gray-300">Mata Pelajaran</strong> → <strong className="text-gray-700 dark:text-gray-300">Course Guru Mapel</strong>.
        </p>
      </div>

      <CategoriesClient initialTree={tree} flatCategories={allCategories} />
    </div>
  );
}
