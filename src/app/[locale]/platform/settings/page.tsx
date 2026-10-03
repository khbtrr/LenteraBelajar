import { getPlatformSettings } from '@/lib/actions/platform';
import { PlatformSettingsClient } from './client';

export default async function PlatformSettingsPage() {
  const data = await getPlatformSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#002446]">
          Pengaturan Platform
        </h1>
        <p className="text-sm text-gray-500">
          Konfigurasi parameter sistem LenteraBelajar, kebijakan keamanan global, dan preferensi akun Super Administrator.
        </p>
      </div>

      <PlatformSettingsClient
        initialData={data}
      />
    </div>
  );
}
