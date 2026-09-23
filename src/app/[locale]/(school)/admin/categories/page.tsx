import { getCategoryTree, getCategories } from '@/lib/actions/category';
import { requireSchool } from '@/lib/auth-utils';
import { CategoriesClient } from './client';
import { getTranslations } from 'next-intl/server';

export default async function CategoriesPage() {
  const session = await requireSchool();
  const t = await getTranslations('adminCategories');
  const [tree, allCategories] = await Promise.all([
    getCategoryTree(),
    getCategories(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446] dark:text-white">{t('pageTitle')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('pageDesc')}
        </p>
      </div>

      <CategoriesClient key={session.schoolId} initialTree={tree} flatCategories={allCategories} />
    </div>
  );
}
