'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useDialog } from '@/context/DialogContext';
import { reviewCourseRequest } from '@/lib/actions/course';
import {
  Users,
  BookOpen,
  GraduationCap,
  ClipboardCheck,
  FileCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Settings,
  FolderTree,
  UserPlus,
  UsersRound,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Award,
} from 'lucide-react';

interface DashboardData {
  school: {
    id: string;
    name: string;
    code: string;
    logo: string | null;
    defaultPassingGrade: number | null;
  } | null;
  activeAcademicYear: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
  } | null;
  users: {
    total: number;
    students: number;
    teachers: number;
    staff: number;
    active: number;
    inactive: number;
    studentTeacherRatio: number;
  };
  academics: {
    totalCourses: number;
    activeCourses: number;
    archivedCourses: number;
    totalCohorts: number;
    totalModules: number;
  };
  cbt: {
    totalQuizzes: number;
    totalAttempts: number;
    averageScore: number;
    passingRate: number;
    passingThreshold: number;
    recentAttempts: {
      id: string;
      score: number | null;
      submittedAt: Date | null;
      user: { name: string };
      quiz: { title: string; passingGrade: number | null };
    }[];
  };
  pendingRequests: {
    items: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      createdAt: Date;
      requester: { id: string; name: string; email: string };
    }[];
    total: number;
  };
}

interface AdminDashboardClientProps {
  initialData: DashboardData;
  adminName: string;
}

export function AdminDashboardClient({ initialData, adminName }: AdminDashboardClientProps) {
  const router = useRouter();
  const t = useTranslations('adminDashboard');
  const locale = useLocale();
  const { showAlert } = useDialog();
  const [data, setData] = useState<DashboardData>(initialData);
  const [selectedRequest, setSelectedRequest] = useState<DashboardData['pendingRequests']['items'][0] | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const studentPercent = data.users.total > 0 ? Math.round((data.users.students / data.users.total) * 100) : 0;
  const teacherPercent = data.users.total > 0 ? Math.round((data.users.teachers / data.users.total) * 100) : 0;
  const staffPercent = Math.max(0, 100 - studentPercent - teacherPercent);

  const handleOpenReview = (req: DashboardData['pendingRequests']['items'][0], action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setReviewAction(action);
    setAdminNote('');
  };

  const handleConfirmReview = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      await reviewCourseRequest(selectedRequest.id, reviewAction, adminNote);
      // Remove from local list
      setData((prev) => ({
        ...prev,
        pendingRequests: {
          items: prev.pendingRequests.items.filter((item) => item.id !== selectedRequest.id),
          total: Math.max(0, prev.pendingRequests.total - 1),
        },
        academics: {
          ...prev.academics,
          activeCourses: reviewAction === 'APPROVE' ? prev.academics.activeCourses + 1 : prev.academics.activeCourses,
          totalCourses: reviewAction === 'APPROVE' ? prev.academics.totalCourses + 1 : prev.academics.totalCourses,
        },
      }));

      await showAlert(
        reviewAction === 'APPROVE'
          ? t('dialogApprovedAlert', { title: selectedRequest.title })
          : t('dialogRejectedAlert', { title: selectedRequest.title }),
        { type: 'success' }
      );
      setSelectedRequest(null);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      await showAlert(err?.message || t('dialogFailedAlert'), { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#002446] to-[#013566] text-white p-6 rounded-2xl shadow-sm">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20">
              {t('controlCenter')}
            </span>
            {data.school?.code && (
              <span className="text-xs text-white/80 font-mono">
                NPSN: {data.school.code}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('welcome', { name: adminName || 'Admin' })}
          </h1>
          <p className="text-xs md:text-sm text-gray-200">
            {t('description', { school: data.school?.name || 'LenteraBelajar' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data.activeAcademicYear ? (
            <div className="flex items-center gap-2.5 bg-white/10 px-3.5 py-2 rounded-xl border border-white/15">
              <Calendar className="w-4 h-4 text-[#FF8928]" />
              <div className="text-left">
                <div className="text-[10px] uppercase font-semibold text-white/70 tracking-wider">
                  {t('activeAcademicYear')}
                </div>
                <div className="text-xs font-bold text-white">
                  {data.activeAcademicYear.name}
                </div>
              </div>
            </div>
          ) : (
            <Link
              href="/admin/academic-years"
              className="text-xs bg-[#FF8928] hover:bg-[#ff790f] text-white font-medium px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              {t('setupAcademicYear')}
            </Link>
          )}

          <Link
            href="/admin/settings"
            className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium p-2.5 rounded-xl transition-colors"
            title={t('schoolSettings')}
          >
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 2. Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {/* Metric 1: Total Pengguna */}
        <Card className="hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('totalUsers')}
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold text-[#002446] dark:text-white">
              {data.users.total}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {t('studentsCount', { count: data.users.students })}
              </span>
              <span>•</span>
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {t('teachersCount', { count: data.users.teachers })}
              </span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded font-mono ml-auto">
                1:{data.users.studentTeacherRatio}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 2: Total Kursus */}
        <Card className="hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('learningCourses')}
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-[#FF8928] flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold text-[#002446] dark:text-white">
              {data.academics.activeCourses}
              <span className="text-sm font-normal text-gray-500 ml-1.5">
                / {data.academics.totalCourses}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-emerald-600 font-medium">
                {t('activeRunning', { active: data.academics.activeCourses })}
              </span>
              <span>•</span>
              <span>{t('cohortGroups', { count: data.academics.totalCohorts })}</span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 3: Kuis & CBT */}
        <Card className="hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('cbtEvaluation')}
            </CardTitle>
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold text-[#002446] dark:text-white">
              {data.cbt.totalQuizzes}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{t('completedExams', { count: data.cbt.totalAttempts })}</span>
              <span className="text-purple-600 font-medium ml-auto">
                {t('kkmStandard', { kkm: data.cbt.passingThreshold })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Metric 4: Pengajuan Pending */}
        <Card className="hover:shadow-md transition-shadow border-gray-200 dark:border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('courseRequests')}
            </CardTitle>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                data.pendingRequests.total > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 animate-pulse'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
              }`}
            >
              <FileCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-3xl font-bold text-[#002446] dark:text-white">
              {data.pendingRequests.total}
            </div>
            <div className="flex items-center text-xs">
              {data.pendingRequests.total > 0 ? (
                <span className="text-rose-600 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {t('needsAction', { count: data.pendingRequests.total })}
                </span>
              ) : (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {t('allReviewed')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Visual Analytics (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: User Distribution & Health */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-[#002446] dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#FF8928]" />
              {t('roleDistributionTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('roleDistributionDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Multi-segment visual bar */}
            <div className="space-y-1.5">
              <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${studentPercent}%` }}
                  className="bg-blue-600 transition-all duration-500"
                  title={`${t('students')}: ${studentPercent}%`}
                />
                <div
                  style={{ width: `${teacherPercent}%` }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`${t('teachers')}: ${teacherPercent}%`}
                />
                <div
                  style={{ width: `${staffPercent}%` }}
                  className="bg-[#002446] dark:bg-sky-400 transition-all duration-500"
                  title={`${t('staffAdmin')}: ${staffPercent}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>0%</span>
                <span>{t('totalAccounts', { count: data.users.total })}</span>
                <span>100%</span>
              </div>
            </div>

            {/* Role Breakdown Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  {t('students')}
                </div>
                <div className="text-lg font-bold text-blue-950 dark:text-blue-100">
                  {data.users.students}
                </div>
                <div className="text-[10px] text-blue-700/80 dark:text-blue-400">
                  {studentPercent}% {t('fromTotal')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('teachers')}
                </div>
                <div className="text-lg font-bold text-amber-950 dark:text-amber-100">
                  {data.users.teachers}
                </div>
                <div className="text-[10px] text-amber-700/80 dark:text-amber-400">
                  {teacherPercent}% {t('fromTotal')}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#002446] dark:bg-sky-400" />
                  {t('staffAdmin')}
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {data.users.staff}
                </div>
                <div className="text-[10px] text-slate-500">
                  {staffPercent}% {t('fromTotal')}
                </div>
              </div>
            </div>

            {/* Quick Link to Users */}
            <div className="pt-2 flex justify-end">
              <Link
                href="/admin/users"
                className="text-xs text-[#002446] dark:text-sky-400 hover:underline font-semibold inline-flex items-center gap-1"
              >
                {t('manageAllUsers')}
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Right: CBT Evaluation & Passing Rate */}
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold text-[#002446] dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#FF8928]" />
                {t('cbtTitle')}
              </CardTitle>
              <Badge
                variant="secondary"
                className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
              >
                {t('kkmStandard', { kkm: data.cbt.passingThreshold })}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {t('cbtDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Pass Rate Gauge */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-100 dark:border-purple-900/40 flex items-center gap-4">
                {/* Simple Circular Meter */}
                <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-200 dark:text-gray-800"
                      strokeWidth="3.8"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-purple-600 transition-all duration-700"
                      strokeDasharray={`${data.cbt.passingRate}, 100`}
                      strokeWidth="3.8"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="absolute text-xs font-bold text-purple-950 dark:text-purple-200">
                    {data.cbt.passingRate}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-bold text-purple-950 dark:text-purple-100">
                    {t('passingRate')}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('studentsPassed', { kkm: data.cbt.passingThreshold })}
                  </div>
                </div>
              </div>

              {/* Average Score */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-center">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('averageScore')}
                </div>
                <div className="text-2xl font-bold text-[#002446] dark:text-white mt-1">
                  {data.cbt.averageScore}
                  <span className="text-xs font-normal text-gray-500 ml-1">/ 100</span>
                </div>
                <div className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                  <TrendingUp className="w-3 h-3" />
                  {t('fromAttempts', { count: data.cbt.totalAttempts })}
                </div>
              </div>
            </div>

            {/* Recent Completed CBT Attempts */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                {t('recentAttempts')}
              </div>
              {data.cbt.recentAttempts.length > 0 ? (
                <div className="space-y-2">
                  {data.cbt.recentAttempts.map((attempt) => {
                    const passGrade = attempt.quiz.passingGrade ?? data.cbt.passingThreshold;
                    const isPassed = (attempt.score ?? 0) >= passGrade;
                    return (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-gray-900 dark:text-white truncate">
                            {attempt.user.name}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {attempt.quiz.title}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge
                            className={
                              isPassed
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-rose-600 text-white hover:bg-rose-700'
                            }
                          >
                            {t('scoreLabel', { score: attempt.score ?? 0 })}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-gray-400 border border-dashed rounded-lg">
                  {t('noAttempts')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Operational Section (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Pending Course Requests with Direct Action */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 dark:border-gray-800 h-full flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-[#002446] dark:text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#FF8928]" />
                  {t('requestsTitle')}
                </CardTitle>
                <Link
                  href="/admin/course-requests"
                  className="text-xs text-[#002446] dark:text-sky-400 hover:underline font-semibold flex items-center gap-1"
                >
                  {t('viewAll')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <CardDescription className="text-xs">
                {t('requestsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {data.pendingRequests.items.length > 0 ? (
                <div className="space-y-3">
                  {data.pendingRequests.items.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 bg-white dark:bg-gray-900 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#002446] dark:text-white truncate">
                            {req.title}
                          </span>
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px]">
                            {t('needsAction', { count: 1 }).toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {t('proposedBy')}: {req.requester.name}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(req.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'id-ID', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </div>
                        {req.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                            {req.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenReview(req, 'APPROVE')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {t('reviewAction')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReview(req, 'REJECT')}
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 text-xs h-8 px-3 flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('rejectAction')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    {t('noPending')}
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {t('allReviewedDesc')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right (1 col): Quick Action Shortcuts */}
        <div>
          <Card className="border-gray-200 dark:border-gray-800 h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-[#002446] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF8928]" />
                {t('quickActionsTitle')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('quickActionsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5 flex-1">
              <Link
                href="/admin/users"
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('addUser')}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {t('addUserDesc')}
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/cohorts"
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <UsersRound className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('createCohort')}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {t('createCohortDesc')}
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/academic-years"
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('academicYear')}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {t('academicYearDesc')}
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/categories"
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <FolderTree className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('courseCategories')}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {t('courseCategoriesDesc')}
                  </div>
                </div>
              </Link>

              <Link
                href="/admin/settings"
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors flex items-center gap-3 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#002446] text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <Settings className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-gray-900 dark:text-white">
                    {t('schoolSettings')}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {t('schoolSettingsDesc')}
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review Modal Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reviewAction === 'APPROVE' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>{t('dialogApproveTitle')}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>{t('dialogRejectTitle')}</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-xs space-y-1">
                <div>
                  <span className="text-gray-500">{t('dialogCourseTitle')}:</span>{' '}
                  <span className="font-semibold text-[#002446] dark:text-white">
                    {selectedRequest.title}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">{t('dialogProposedBy')}:</span>{' '}
                  <span className="font-semibold">{selectedRequest.requester.name}</span> (
                  {selectedRequest.requester.email})
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="adminNote" className="text-xs font-medium">
                  {t('dialogAdminNote')}
                </Label>
                <Input
                  id="adminNote"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={t('dialogAdminNotePlaceholder')}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isProcessing}
            >
              {t('dialogCancel')}
            </Button>
            <Button
              onClick={handleConfirmReview}
              disabled={isProcessing}
              className={
                reviewAction === 'APPROVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
            >
              {isProcessing
                ? t('dialogProcessing')
                : reviewAction === 'APPROVE'
                ? t('dialogConfirmApprove')
                : t('dialogConfirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
