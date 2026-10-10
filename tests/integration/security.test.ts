import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
const actor = vi.hoisted(() => ({ id: '', sessionVersion: 0 }));
vi.mock('@/lib/auth', () => ({ auth: async () => ({ user: { id: actor.id, sessionVersion: actor.sessionVersion } }) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));

import { db } from '@/lib/db';
import { getCourseById } from '@/lib/actions/course';
import { getUsersInSchool, updateUser } from '@/lib/actions/user';
import { deleteModule } from '@/lib/actions/module';
import { manualEnrollStudent } from '@/lib/actions/cohort';
import { getQuizById } from '@/lib/actions/quiz';
import { startQuiz, saveQuizDraft, submitQuiz } from '@/lib/cbt';
import { forceSubmitAttempt } from '@/lib/actions/proctor';
import { createAcademicYear, setActiveAcademicYear, getAcademicYears } from '@/lib/actions/academic-year';
import { getCourseGradebook, gradeAssignmentSubmission, gradeQuizEssayAnswer } from '@/lib/actions/grade';
import { getSchoolConversations } from '@/lib/actions/message-admin';
import { recordFailedPassword } from '@/lib/login-security';
import { getItemAnalysisData } from '@/lib/actions/item-analysis';
import { getRemedialEligibleData, generateRemedialQuiz } from '@/lib/actions/remedial';
import { registerUploadedFile, bindFileReferences, authorizeFileRead } from '@/lib/files';
import { getUserGamificationProfile } from '@/lib/actions/gamification';

const prefix = `qa-${Date.now()}`;
const a = `${prefix}-a`, b = `${prefix}-b`;
const studentA = `${prefix}-student-a`, studentB = `${prefix}-student-b`, adminA = `${prefix}-admin-a`;
const teacherB = `${prefix}-teacher-b`, courseB = `${prefix}-course-b`, moduleB = `${prefix}-module-b`, quizB = `${prefix}-quiz-b`;
const supervisorA = `${prefix}-supervisor-a`, supervisorB = `${prefix}-supervisor-b`, superAdmin = `${prefix}-super-admin`;

beforeAll(async () => {
  await db.school.createMany({ data: [{ id: a, code: a, name: 'QA A' }, { id: b, code: b, name: 'QA B' }] });
  await db.user.createMany({ data: [
    { id: studentA, schoolId: a, role: 'STUDENT', name: 'Student A', email: `${studentA}@qa.test`, passwordHash: 'private-hash' },
    { id: studentB, schoolId: b, role: 'STUDENT', name: 'Student B', email: `${studentB}@qa.test`, passwordHash: 'private-hash' },
    { id: adminA, schoolId: a, role: 'ADMIN', name: 'Admin A', email: `${adminA}@qa.test`, passwordHash: 'private-hash' },
    { id: teacherB, schoolId: b, role: 'TEACHER', name: 'Teacher B', email: `${teacherB}@qa.test`, passwordHash: 'private-hash' },
    { id: supervisorA, schoolId: a, role: 'SUPERVISOR', name: 'Supervisor A', email: `${supervisorA}@qa.test`, passwordHash: 'private-hash' },
    { id: supervisorB, schoolId: b, role: 'SUPERVISOR', name: 'Supervisor B', email: `${supervisorB}@qa.test`, passwordHash: 'private-hash' },
    { id: superAdmin, schoolId: a, role: 'SUPER_ADMIN', name: 'Super Admin', email: `${superAdmin}@qa.test`, passwordHash: 'private-hash' },
  ] });
  const year = await db.academicYear.create({ data: { schoolId: b, name: 'QA year', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') } });
  await db.course.create({ data: { id: courseB, schoolId: b, teacherId: teacherB, academicYearId: year.id, title: 'Private B' } });
  await db.module.create({ data: { id: moduleB, courseId: courseB, title: 'Module B' } });
  await db.quiz.create({ data: { id: quizB, moduleId: moduleB, title: 'Exam B', token: 'SECRET', isPublished: true } });
  await db.enrollment.create({ data: { courseId: courseB, userId: studentB, method: 'MANUAL' } });
  await db.quizAttempt.create({ data: { quizId: quizB, userId: studentB, questionSnapshot: [{ id: 'q', _correctData: [{ id: 'a', isCorrect: true }] }] } });
});
afterAll(async () => { await db.$disconnect(); });

describe('production actions against isolated PostgreSQL', () => {
  it('creates a planned year when activation was not requested', async () => {
    actor.id = adminA;
    const year = await createAcademicYear({ name: 'Future year', startDate: '2027-07-01', endDate: '2028-06-30', makeActive: false });
    expect(year.status).toBe('PLANNED');
  });
  it('keeps the active academic year when a target activation fails', async () => {
    actor.id = adminA;
    const active = await createAcademicYear({ name: 'Current year', startDate: '2026-07-01', endDate: '2027-06-30', makeActive: true });
    await expect(setActiveAcademicYear('missing-year')).rejects.toThrow();
    expect((await getAcademicYears()).find((year) => year.id === active.id)?.status).toBe('ACTIVE');
  });
  it('blocks private course access across tenants', async () => {
    actor.id = studentA;
    await expect(getCourseById(courseB)).rejects.toThrow(/Akses ditolak/);
  });
  it('keeps school password hashes out of an admin response', async () => {
    actor.id = adminA;
    const users = await getUsersInSchool();
    expect(users.length).toBe(4);
    expect(JSON.stringify(users)).not.toContain('private-hash');
    expect(users[0]).not.toHaveProperty('passwordHash');
  });
  it('blocks an admin assigning itself a foreign school', async () => {
    actor.id = adminA;
    await expect(updateUser(adminA, { name: 'Admin A', email: `${adminA}@qa.test`, role: 'ADMIN', assignedSchoolIds: [a, b] })).rejects.toThrow(/Akses ditolak/);
  });
  it('blocks deleting a module from another tenant', async () => {
    actor.id = adminA;
    await expect(deleteModule(moduleB)).rejects.toThrow(/Akses ditolak/);
  });
  it('blocks enrolling an administrator into a foreign course', async () => {
    actor.id = adminA;
    await expect(manualEnrollStudent(courseB, adminA)).rejects.toThrow(/Akses ditolak/);
  });
  it('never includes a grading snapshot in the student quiz response', async () => {
    actor.id = studentB;
    const quiz = await getQuizById(quizB);
    expect(quiz?.attempts[0].questionSnapshot).toBeNull();
    expect(JSON.stringify(quiz)).not.toContain('_correctData');
  });
  it('grades the saved correct answer when the teacher forces submission', async () => {
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Force exam', isPublished: true,
      questions: { create: { type: 'MULTIPLE_CHOICE', text: 'One', points: 2, options: [{ id: 'a', text: 'A', isCorrect: true }] } } } });
    actor.id = studentB;
    const started = await startQuiz(quiz.id);
    await saveQuizDraft(started.attempt.id, [{ questionId: started.questions[0].id, answer: 'a' }]);
    actor.id = teacherB;
    await forceSubmitAttempt(started.attempt.id);
    actor.id = studentB;
    const result = await submitQuiz(started.attempt.id, []);
    expect(result.score).toBe(100);
    expect(result.isGraded).toBe(true);
  });
  it('returns the same active attempt to concurrent start requests', async () => {
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Concurrent exam', isPublished: true, maxAttempts: 1,
      questions: { create: { type: 'MULTIPLE_CHOICE', text: 'One', options: [{ id: 'a', text: 'A', isCorrect: true }] } } } });
    actor.id = studentB;
    const attempts = await Promise.all(Array.from({ length: 8 }, () => startQuiz(quiz.id)));
    expect(new Set(attempts.map((result) => result.attempt.id)).size).toBe(1);
    const id = attempts[0].attempt.id;
    const questionId = attempts[0].questions[0].id;
    const results = await Promise.all([
      submitQuiz(id, [{ questionId, answer: 'a' }]), submitQuiz(id, [{ questionId, answer: '' }]),
    ]);
    expect(results[0].score).toBe(results[1].score);
    await expect(startQuiz(quiz.id)).rejects.toThrow(/Batas kesempatan/);
  });
  it('grades the original snapshot even after the author changes a key', async () => {
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Snapshot exam', isPublished: true,
      questions: { create: { type: 'MULTIPLE_CHOICE', text: 'One', options: [{ id: 'a', text: 'A', isCorrect: true }] } } } });
    actor.id = studentB;
    const started = await startQuiz(quiz.id);
    const questionId = started.questions[0].id;
    await db.quizQuestion.update({ where: { id: questionId }, data: { options: [{ id: 'b', text: 'B', isCorrect: true }] } });
    expect((await submitQuiz(started.attempt.id, [{ questionId, answer: 'a' }])).score).toBe(100);
  });
  it('rejects late answer changes and finalizes the draft saved before expiry', async () => {
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Timed exam', isPublished: true, duration: 1,
      questions: { create: { type: 'MULTIPLE_CHOICE', text: 'One', options: [{ id: 'a', text: 'A', isCorrect: true }] } } } });
    actor.id = studentB;
    const started = await startQuiz(quiz.id);
    const questionId = started.questions[0].id;
    await saveQuizDraft(started.attempt.id, [{ questionId, answer: 'a' }]);
    await db.quizAttempt.update({ where: { id: started.attempt.id }, data: { startedAt: new Date(Date.now() - 120000) } });
    const result = await submitQuiz(started.attempt.id, [{ questionId, answer: 'wrong' }]);
    expect(result.score).toBe(100);
    expect('answersRejected' in result && result.answersRejected).toBe(true);
    await expect(saveQuizDraft(started.attempt.id, [{ questionId, answer: 'wrong' }])).rejects.toThrow(/sudah dikumpulkan/);
  });
  it('allows school supervision to read while preventing supervision mutations', async () => {
    actor.id = supervisorA;
    await expect(getCourseById(courseB)).rejects.toThrow(/Akses ditolak/);
    actor.id = supervisorB;
    expect((await getCourseGradebook(courseB))?.course.id).toBe(courseB);
    await expect(deleteModule(moduleB)).rejects.toThrow(/Akses ditolak/);
    actor.id = superAdmin;
    expect((await getCourseById(courseB))?.id).toBe(courseB);
  });
  it('never loses failed-password increments under concurrent attempts', async () => {
    const failures = await Promise.all(Array.from({ length: 5 }, () => recordFailedPassword(studentA)));
    expect(Math.max(...failures.map((failure) => failure.failed))).toBe(5);
    expect(failures.filter((failure) => failure.lockoutMinutes > 0)).toHaveLength(1);
  });
  it('keeps a foreign conversation private when the admin searches its participant', async () => {
    await db.conversation.create({ data: { participants: { create: [{ userId: studentB }, { userId: teacherB }] } } });
    actor.id = adminA;
    const conversations = await getSchoolConversations(`${teacherB}@qa.test`);
    expect(conversations.total).toBe(0);
    expect(conversations.conversations).toEqual([]);
  });
  it('protects staged and attached files across tenants', async () => {
    actor.id = teacherB;
    const filename = `${prefix}-file.txt`;
    await registerUploadedFile(filename, Buffer.from('QA file'), 'text/plain');
    expect((await authorizeFileRead(filename)).publicLogo).toBe(false);
    const content = await db.content.create({ data: { moduleId: moduleB, title: 'Private file', type: 'FILE', fileUrl: `/api/files/${filename}` } });
    await bindFileReferences('CONTENT', content.id, content);
    actor.id = studentA;
    await expect(authorizeFileRead(filename)).rejects.toThrow(/Akses ditolak/);
    actor.id = studentB;
    expect((await authorizeFileRead(filename)).asset.filename).toBe(filename);
  });
  it('keeps essay pending, rejects excessive points, and synchronizes its final grade', async () => {
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Essay exam', isPublished: true,
      questions: { create: { type: 'ESSAY', text: 'Explain', points: 2 } } } });
    actor.id = studentB;
    const started = await startQuiz(quiz.id);
    const submitted = await submitQuiz(started.attempt.id, [{ questionId: started.questions[0].id, answer: 'Explanation' }]);
    expect(submitted.score).toBeNull();
    const quizData = await getQuizById(quiz.id);
    const answerId = quizData!.attempts[0].answers[0].id;
    actor.id = teacherB;
    await expect(gradeQuizEssayAnswer(answerId, { score: 20 })).rejects.toThrow(/poin soal/);
    expect((await gradeQuizEssayAnswer(answerId, { score: 2 })).score).toBe(100);
    expect((await getCourseGradebook(courseB))?.students[0].quizScores[quiz.id]).toBe(100);
  });
  it('handles bank-soal analysis and creates remedial from the saved question version', async () => {
    const category = await db.questionBankCategory.create({ data: { courseId: courseB, name: 'QA bank' } });
    await db.questionBank.create({ data: { courseId: courseB, categoryId: category.id, type: 'MULTIPLE_CHOICE_COMPLEX', text: 'Choose two', points: 1,
      options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: true }, { id: 'c', text: 'C', isCorrect: false }] } });
    const quiz = await db.quiz.create({ data: { moduleId: moduleB, title: 'Bank exam', isPublished: true, useQuestionBank: true, maxAttempts: 2, passingGrade: 75,
      questionBankSelections: { create: { categoryId: category.id, count: 1 } } } });
    actor.id = studentB;
    const started = await startQuiz(quiz.id);
    await submitQuiz(started.attempt.id, [{ questionId: started.questions[0].id, answer: '["a","c"]' }]);
    actor.id = teacherB;
    const analysis = await getItemAnalysisData(quiz.id);
    expect(analysis?.totalParticipants).toBe(1);
    expect(analysis?.questions[0].type).toBe('MULTIPLE_CHOICE_COMPLEX');
    expect(analysis?.questions[0].optionsStats.find((option) => option.id === 'a')?.count).toBe(1);
    const eligible = await getRemedialEligibleData(quiz.id);
    const remedial = await generateRemedialQuiz({ parentQuizId: quiz.id, title: 'Remedial bank', selectedQuestionIds: [eligible!.mostFailedQuestions[0].questionId], targetStudentIds: [studentB] });
    actor.id = studentB;
    const retry = await startQuiz(remedial.id);
    await submitQuiz(retry.attempt.id, [{ questionId: retry.questions[0].id, answer: '["a","b"]' }]);
    actor.id = teacherB;
    expect((await getCourseGradebook(courseB))?.students[0].quizScores[quiz.id]).toBe(75);
  });
  it('normalizes assignment scales and rejects scores outside the allowed range', async () => {
    const assignment = await db.assignment.create({ data: { moduleId: moduleB, title: 'Ten points', isPublished: true, maxScore: 10 } });
    const submission = await db.assignmentSubmission.create({ data: { assignmentId: assignment.id, userId: studentB, fileUrl: '/qa', fileName: 'qa.txt', fileSize: 1 } });
    actor.id = teacherB;
    await expect(gradeAssignmentSubmission(submission.id, { score: 120 })).rejects.toThrow(/skala tugas/);
    await gradeAssignmentSubmission(submission.id, { score: 10 });
    expect((await getCourseGradebook(courseB))?.students[0].assignmentScores[assignment.id]).toBe(10);
    actor.id = studentB;
    expect((await getUserGamificationProfile())?.totalXp).toBeGreaterThan(0);
  });
});
