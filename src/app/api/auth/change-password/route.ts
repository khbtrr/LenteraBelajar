import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { compare, hash } from 'bcryptjs';
import { getClientIp } from '@/lib/rate-limit';
import { checkSharedRateLimit } from '@/lib/shared-rate-limit';
import { validatePassword } from '@/lib/password-policy';
import { recordAuditLog } from '@/lib/audit-log';
import { recordFailedPassword } from '@/lib/login-security';

export async function POST(request: Request) {
  try {
    const ipAddress = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || '';

    // Rate Limiting: Max 20 requests per minute
    const rateLimit = await checkSharedRateLimit(`change-password:${ipAddress}`, 20, 60 * 1000);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Terlalu banyak permintaan. Harap tunggu ${rateLimit.resetInSeconds} detik.` },
        { status: 429 }
      );
    }

    const session = await getServerSession({ allowPasswordChange: true });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Kata sandi saat ini dan kata sandi baru harus diisi' },
        { status: 400 }
      );
    }

    // Centralized Password Policy Check
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / (60 * 1000))
      );
      return NextResponse.json(
        { error: `Akun sedang dikunci sementara selama ${remainingMinutes} menit.` },
        { status: 423 }
      );
    }

    const isCurrentPasswordValid = await compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      const failure = await recordFailedPassword(user.id);
      await recordAuditLog({
        action: failure.lockoutMinutes ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
        userId: user.id,
        userEmail: user.email,
        ipAddress,
        userAgent,
        details: `Failed change-password attempt. Attempt ${failure.failed}/5`,
      });

      if (failure.lockoutMinutes) {
        return NextResponse.json(
          { error: `Terlalu banyak percobaan gagal. Akun dikunci sementara selama ${failure.lockoutMinutes} menit.` },
          { status: 423 }
        );
      }

      return NextResponse.json(
        { error: 'Kata sandi saat ini tidak tepat' },
        { status: 400 }
      );
    }

    const hashedNewPassword = await hash(newPassword, 12);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedNewPassword,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });

    await recordAuditLog({
      action: 'PASSWORD_CHANGED',
      userId: user.id,
      userEmail: user.email,
      ipAddress,
      userAgent,
      details: 'Password changed via API',
    });

    return NextResponse.json({ message: 'Kata sandi berhasil diubah' });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem' },
      { status: 500 }
    );
  }
}
