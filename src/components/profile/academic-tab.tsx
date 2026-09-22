'use client';

import React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { UserProfileData } from '@/lib/actions/profile';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  Flame,
  Award,
  BookOpen,
  Users,
  GraduationCap,
  Layers,
  School,
  Shield,
} from 'lucide-react';

interface AcademicTabProps {
  profile: UserProfileData;
}

export function AcademicTab({ profile }: AcademicTabProps) {
  const t = useTranslations('profile');
  const locale = useLocale();
  const dateLocale = locale === 'id' ? 'id-ID' : 'en-US';

  const isStudent = profile.role === 'STUDENT';
  const isTeacher = profile.role === 'TEACHER';
  const isAdminOrSupervisor = ['ADMIN', 'SUPERVISOR', 'SUPER_ADMIN'].includes(profile.role);

  return (
    <div className="space-y-6">
      {isStudent && (
        <>
          {/* Gamification Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Level Card */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('levelCardTitle')}
                </p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {t('level', { level: profile.level })}
                </h4>
                <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  {t('totalXp', { count: profile.xp })}
                </span>
              </div>
            </div>

            {/* Streak Card */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('streakCardTitle')}
                </p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {t('streakDays', { count: profile.streakDays })}
                </h4>
                <span className="text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                  {t('streakCardSubtitle')}
                </span>
              </div>
            </div>

            {/* Achievements Count Card */}
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('badgesCardTitle')}
                </p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {t('badgesCount', { count: profile.achievements.length })}
                </h4>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {t('badgesCardSubtitle')}
                </span>
              </div>
            </div>
          </div>

          {/* Badges / Achievements Collection */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <Award className="w-5 h-5 text-amber-500" />
              <span>{t('badgeCollectionTitle')}</span>
            </h3>

            {profile.achievements.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                {t('noBadges')}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {profile.achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center text-lg shrink-0">
                      {ach.icon || '🏅'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {ach.badgeName}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {new Date(ach.unlockedAt).toLocaleDateString(dateLocale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enrolled Courses */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-brand-500" />
              <span>{t('enrolledCoursesTitle')}</span>
            </h3>

            {profile.enrolledCourses.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                {t('noEnrolledCourses')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.enrolledCourses.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-brand-200 dark:hover:border-brand-800 transition-colors flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {c.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {t('teacherLabel', { name: c.teacherName })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isTeacher && (
        <>
          {/* Teacher Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('activeCoursesTitle')}
                </p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {t('coursesCount', { count: profile.taughtCourses.length })}
                </h4>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  {t('runningSemester')}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('guidedStudentsTitle')}
                </p>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">
                  {t('studentsCount', { count: profile.totalStudentsTaught })}
                </h4>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {t('guidedStudentsSubtitle')}
                </span>
              </div>
            </div>
          </div>

          {/* Courses Taught List */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-brand-500" />
              <span>{t('coursesTaughtTitle')}</span>
            </h3>

            {profile.taughtCourses.length === 0 ? (
              <div className="text-center py-8 text-xs text-gray-400">
                {t('noCoursesTaught')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.taughtCourses.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 flex items-start gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {c.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {t('studentsCount', { count: c.studentCount })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" /> {t('modulesCount', { count: c.moduleCount })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {isAdminOrSupervisor && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-brand-500" />
            <span>{t('authorityInfoTitle')}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {t('school')}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {profile.school?.name || t('allPlatform')}
              </p>
              {profile.school?.code && (
                <Badge variant="outline" className="text-[10px]">
                  {t('schoolCode', { code: profile.school.code })}
                </Badge>
              )}
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-500" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  {t('accessLevel')}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {profile.role === 'ADMIN'
                  ? t('adminAccess')
                  : profile.role === 'SUPERVISOR'
                    ? t('supervisorAccess')
                    : t('superAdminAccess')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
