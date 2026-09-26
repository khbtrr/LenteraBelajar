import { requireAuth } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { db } from '@/lib/db';
import { AppLayout } from '@/components/layout/app-layout';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  CalendarDays,
  FileSpreadsheet,
  MessageSquare,
  Megaphone,
  ShieldCheck,
  Calendar,
  FolderTree,
  UsersRound,
  Users,
  FileCheck,
  Settings,
  UserCheck,
  GraduationCap,
  FileBarChart,
} from 'lucide-react';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const role = session?.user?.role;
  const isTeacher = role === 'TEACHER';
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSupervisor = role === 'SUPERVISOR';

  if (!isTeacher && !isAdmin && !isSupervisor) {
    redirect('/login');
  }

  const t = await getTranslations('sidebar');
  const tPortal = await getTranslations('portal');
  const tRoles = await getTranslations('roles');

  let school = null;
  if (session.user.schoolId) {
    school = await db.school.findUnique({
      where: { id: session.user.schoolId },
      select: { name: true, logo: true },
    });
  }

  let sidebarItems = [
    { label: t('dashboard'), href: '/teacher/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { label: t('myCourses'), href: '/teacher/my-courses', icon: <BookOpen className="h-5 w-5" /> },
    { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
    { label: t('requestCourse'), href: '/teacher/request-course', icon: <PlusCircle className="h-5 w-5" /> },
    { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
  ];

  let portalTitle = tPortal('teacherTitle');

  if (isAdmin) {
    sidebarItems = [
      { label: t('dashboard'), href: '/admin/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('announcements'), href: '/admin/announcements', icon: <Megaphone className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('messageModeration'), href: '/admin/messages', icon: <ShieldCheck className="h-5 w-5" /> },
      { label: t('academicYears'), href: '/admin/academic-years', icon: <Calendar className="h-5 w-5" /> },
      { label: t('categories'), href: '/admin/categories', icon: <FolderTree className="h-5 w-5" /> },
      { label: t('courses'), href: '/admin/courses', icon: <BookOpen className="h-5 w-5" /> },
      { label: t('cohorts'), href: '/admin/cohorts', icon: <UsersRound className="h-5 w-5" /> },
      { label: t('users'), href: '/admin/users', icon: <Users className="h-5 w-5" /> },
      { label: t('courseRequests'), href: '/admin/course-requests', icon: <FileCheck className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
      { label: t('settings'), href: '/admin/settings', icon: <Settings className="h-5 w-5" /> },
    ];
    portalTitle = tPortal('adminTitle');
  } else if (isSupervisor) {
    sidebarItems = [
      { label: t('dashboard'), href: '/supervisor/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
      { label: t('messages'), href: '/messages', icon: <MessageSquare className="h-5 w-5" /> },
      { label: t('teacherActivity'), href: '/supervisor/teacher-activity', icon: <UserCheck className="h-5 w-5" /> },
      { label: t('studentActivity'), href: '/supervisor/student-activity', icon: <GraduationCap className="h-5 w-5" /> },
      { label: t('reports'), href: '/supervisor/reports', icon: <FileBarChart className="h-5 w-5" /> },
      { label: t('calendar'), href: '/calendar', icon: <CalendarDays className="h-5 w-5" /> },
    ];
    portalTitle = tPortal('supervisorTitle');
  }

  return (
    <AppLayout
      items={sidebarItems}
      title={portalTitle}
      userName={session.user.name}
      userRole={tRoles(session.user.role)}
      schoolName={school?.name}
      schoolLogo={school?.logo}
    >
      <div key={session.user.schoolId} className="w-full">
        {children}
      </div>
    </AppLayout>
  );
}
