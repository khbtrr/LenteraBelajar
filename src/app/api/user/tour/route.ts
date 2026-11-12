import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-utils';
import { db } from '@/lib/db';

export async function POST() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { tourCompletedAt: new Date() },
  });

  return NextResponse.json({ success: true, tourCompletedAt: new Date().toISOString() });
}

export async function DELETE() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { tourCompletedAt: null },
  });

  return NextResponse.json({ success: true, tourCompletedAt: null });
}
