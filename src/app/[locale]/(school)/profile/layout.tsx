import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Medal,
  CalendarDays,
  PlusCircle,
  FileSpreadsheet,
  Megaphone,
  Calendar,
  FolderTree,
  Users,
  UsersRound,
  FileCheck,
  Settings,
  UserCheck,
  GraduationCap,
  FileBarChart,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';

export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');
  const tPortal = await getTranslations('portal');
  const tRoles = await getTranslations('roles');
  const role = session.user.role;

  const [school, user] = await Promise.all([
    session.user.schoolId
      ? db.school.findUnique({
          where: { id: session.user.schoolId },
          select: { name: true, logo: true },
        })
      : null,
    db.user.findUnique({
      where: { id: session.user.id },
      select: { avatar: true },
    }),
  ]);

  let title = tPortal('sharedTitle');
  let userRole = tRoles(role as any) || session.user.role;
  let sidebarItems: any[] = [];

  if (role === 'STUDENT') {
    title = tPortal('studentTitle');
    userRole = tRoles('STUDENT');
    sidebarItems = [
      { label: t('dashboard'), href: '/student/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('myCourses'), href: '/student/my-courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('grades'), href: '/student/grades', icon: <Trophy className="h-5 w-5" /> },
      { label: t('achievements'), href: '/student/achievements', icon: <Medal className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  } else if (role === 'TEACHER') {
    title = tPortal('teacherTitle');
    userRole = tRoles('TEACHER');
    sidebarItems = [
      { label: t('dashboard'), href: '/teacher/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('myCourses'), href: '/teacher/my-courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('cohortGrades'), href: '/teacher/leger', icon: <FileSpreadsheet className="h-5 w-5" /> },
      { label: t('requestCourse'), href: '/teacher/request-course', icon: <PlusCircle className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    title = tPortal('adminTitle');
    userRole = tRoles(role as any);
    sidebarItems = [
      { label: t('dashboard'), href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('announcements'), href: '/admin/announcements', icon: <Megaphone className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('messageModeration'), href: '/admin/messages', icon: <ShieldCheck className="h-5 w-5" /> },
      { label: t('academicYears'), href: '/admin/academic-years', icon: <Calendar className="h-5 w-5" /> },
      { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="h-5 w-5" /> },
      { label: t('courses'), href: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('cohorts'), href: '/admin/cohorts', icon: <UsersRound className="h-5 w-5" /> },
      { label: t('cohortGrades'), href: '/admin/grades/leger', icon: <FileSpreadsheet className="h-5 w-5" /> },
      { label: t('users'), href: '/admin/users', icon: <Users className="h-5 w-5" /> },
      { label: t('courseRequests'), href: '/admin/course-requests', icon: <FileCheck className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
      { label: t('settings'), href: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
    ];
  } else {
    // Supervisor
    title = tPortal('supervisorTitle');
    userRole = tRoles('SUPERVISOR');
    sidebarItems = [
      { label: t('dashboard'), href: '/supervisor/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('messageModeration'), href: '/admin/messages', icon: <ShieldCheck className="h-5 w-5" /> },
      { label: t('teacherActivity'), href: '/supervisor/teacher-activity', icon: <UserCheck className="h-5 w-5" /> },
      { label: t('studentActivity'), href: '/supervisor/student-activity', icon: <GraduationCap className="h-5 w-5" /> },
      { label: t('reports'), href: '/supervisor/reports', icon: <FileBarChart className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
  }

  return (
    <AppLayout
      items={sidebarItems}
      title={title}
      userName={session.user.name}
      userRole={userRole}
      userAvatar={user?.avatar}
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      {children}
    </AppLayout>
  );
}
