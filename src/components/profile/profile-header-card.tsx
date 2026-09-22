'use client';

import React, { useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { UserProfileData, updateUserProfile, removeUserAvatar } from '@/lib/actions/profile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Camera,
  Trash2,
  Loader2,
  Building2,
  Mail,
  GraduationCap,
  Sparkles,
  Flame,
} from 'lucide-react';

interface ProfileHeaderCardProps {
  profile: UserProfileData;
  onAvatarUpdated?: (newAvatar: string | null) => void;
}

export function ProfileHeaderCard({
  profile,
  onAvatarUpdated,
}: ProfileHeaderCardProps) {
  const t = useTranslations('profile');
  const tRoles = useTranslations('roles');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleLabel = (role: string) => {
    try {
      return tRoles(role);
    } catch {
      return role;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'STUDENT':
        return 'secondary' as const;
      case 'TEACHER':
        return 'default' as const;
      case 'ADMIN':
      case 'SUPER_ADMIN':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage(t('formatError'));
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage(t('sizeError'));
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || t('uploadFailed'));
      }

      const uploadResult = await res.json();
      const newUrl = uploadResult.url;

      // Update database profile
      await updateUserProfile({ avatar: newUrl });
      setAvatarUrl(newUrl);
      onAvatarUpdated?.(newUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || t('uploadErrorGeneric'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    setErrorMessage(null);
    startTransition(async () => {
      try {
        await removeUserAvatar();
        setAvatarUrl(null);
        onAvatarUpdated?.(null);
      } catch (err: any) {
        setErrorMessage(err?.message || t('removeFailed'));
      }
    });
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs relative overflow-hidden">
      {/* Profile top cover banner */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-brand-50/80 dark:bg-brand-950/30 border-b border-brand-100 dark:border-gray-800" />

      <div className="relative pt-6 flex flex-col sm:flex-row items-center sm:items-end gap-5">
        {/* Avatar with Camera Action */}
        <div className="relative group">
          <Avatar className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-4 border-white dark:border-gray-900 shadow-md ring-1 ring-gray-100 dark:ring-gray-800">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={profile.name} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-brand-500 text-white font-bold text-2xl rounded-2xl">
              {getInitials(profile.name)}
            </AvatarFallback>
          </Avatar>

          {/* Upload Button Overlay */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isPending}
            className="absolute bottom-0 right-0 p-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md border-2 border-white dark:border-gray-900 transition-transform active:scale-95 cursor-pointer"
            title={t('changeAvatar')}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* User Details */}
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {profile.name}
            </h1>
            <Badge variant={getRoleBadgeVariant(profile.role)} className="px-2.5 py-0.5 text-xs">
              {getRoleLabel(profile.role)}
            </Badge>

            {/* Student Gamification summary chip */}
            {profile.role === 'STUDENT' && (
              <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('level', { level: profile.level })}</span>
                <span className="text-amber-400">•</span>
                <Flame className="w-3.5 h-3.5 text-orange-500 inline" />
                <span>{t('streakDays', { count: profile.streakDays })}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              {profile.email}
            </span>

            {profile.school && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                {profile.school.name}
              </span>
            )}

            {profile.cohort && (
              <span className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-gray-400" />
                {t('cohortClass', { cohort: profile.cohort })}
              </span>
            )}
          </div>
        </div>

        {/* Delete Avatar button (if photo exists) */}
        {avatarUrl && (
          <div className="self-center sm:self-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isPending || isUploading}
              className="text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border-gray-200 dark:border-gray-700 h-8 gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{t('removeAvatar')}</span>
            </Button>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-800">
          {errorMessage}
        </div>
      )}
    </div>
  );
}
