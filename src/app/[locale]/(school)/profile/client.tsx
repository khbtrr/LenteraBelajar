'use client';

import React, { useState } from 'react';
import { UserProfileData } from '@/lib/actions/profile';
import { ProfileHeaderCard } from '@/components/profile/profile-header-card';
import { AccountTab } from '@/components/profile/account-tab';
import { SecurityTab } from '@/components/profile/security-tab';
import { AcademicTab } from '@/components/profile/academic-tab';
import { User, ShieldCheck, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileClientProps {
  initialProfile: UserProfileData;
}

type TabType = 'account' | 'security' | 'academic';

export function ProfileClient({ initialProfile }: ProfileClientProps) {
  const [profile, setProfile] = useState<UserProfileData>(initialProfile);
  const [activeTab, setActiveTab] = useState<TabType>('account');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'account',
      label: 'Informasi Akun',
      icon: <User className="w-4 h-4" />,
    },
    {
      id: 'security',
      label: 'Keamanan & Kata Sandi',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'academic',
      label: 'Statistik & Akademik',
      icon: <GraduationCap className="w-4 h-4" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Profile Header Card with Avatar Upload */}
      <ProfileHeaderCard
        profile={profile}
        onAvatarUpdated={(newAvatar) =>
          setProfile((prev) => ({ ...prev, avatar: newAvatar }))
        }
      />

      {/* Tab Navigation Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 space-x-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer',
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-50/40 dark:bg-brand-950/20 rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content Panels */}
      <div>
        {activeTab === 'account' && (
          <AccountTab
            profile={profile}
            onProfileUpdated={(newName) =>
              setProfile((prev) => ({ ...prev, name: newName }))
            }
          />
        )}

        {activeTab === 'security' && <SecurityTab />}

        {activeTab === 'academic' && <AcademicTab profile={profile} />}
      </div>
    </div>
  );
}
