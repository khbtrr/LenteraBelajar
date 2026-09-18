import { db } from '@/lib/db';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_CHANGED';

export interface AuditLogParams {
  action: AuditAction;
  userId?: string | null;
  userEmail?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: string | null;
}

/**
 * Record a security event to the AuditLog table
 * Errors are caught and logged to console to prevent blocking main authentication flows
 */
export async function recordAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: params.action,
        userId: params.userId || null,
        userEmail: params.userEmail || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        details: params.details || null,
      },
    });
  } catch (error) {
    console.error('[AuditLog] Failed to record audit log:', error);
  }
}
