import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeUserTour, resetUserTour } from '@/lib/actions/tour';

const mockUser = vi.hoisted(() => ({
  id: 'user-test-1',
  role: 'STUDENT',
  tourCompletedAt: null as Date | null,
}));

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(async () => ({
    user: {
      id: mockUser.id,
      role: mockUser.role,
      name: 'Test Student',
      email: 'student@test.local',
      tourCompleted: Boolean(mockUser.tourCompletedAt),
    },
  })),
  getServerSession: vi.fn(async () => ({
    user: {
      id: mockUser.id,
      role: mockUser.role,
      name: 'Test Student',
      email: 'student@test.local',
      tourCompleted: Boolean(mockUser.tourCompletedAt),
    },
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { tourCompletedAt: Date | null } }) => {
        if (where.id === mockUser.id) {
          mockUser.tourCompletedAt = data.tourCompletedAt;
        }
        return { ...mockUser, tourCompletedAt: data.tourCompletedAt };
      }),
    },
  },
}));

describe('User Tour Onboarding Action', () => {
  beforeEach(() => {
    mockUser.tourCompletedAt = null;
  });

  it('completes the user tour and updates database timestamp', async () => {
    expect(mockUser.tourCompletedAt).toBeNull();
    const result = await completeUserTour();

    expect(result.success).toBe(true);
    expect(mockUser.tourCompletedAt).toBeInstanceOf(Date);
  });

  it('resets the user tour to allow replay', async () => {
    mockUser.tourCompletedAt = new Date();
    expect(mockUser.tourCompletedAt).not.toBeNull();

    const result = await resetUserTour();

    expect(result.success).toBe(true);
    expect(mockUser.tourCompletedAt).toBeNull();
  });
});
