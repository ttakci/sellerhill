import { AdminWarningKind, AdminWarningLevel, type AdminWarningDto } from '@repo/shared';

export function calculateFailureRate(failed: number, total: number): number {
  if (!Number.isFinite(failed) || !Number.isFinite(total) || total <= 0) {return 0;}
  return Math.min(100, Math.max(0, (failed / total) * 100));
}

export function thresholdWarning(
  kind: AdminWarningKind,
  value: number,
  threshold: number,
  criticalMultiplier = 2
): AdminWarningDto | null {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || value < threshold) {return null;}
  return {
    kind,
    level: value >= threshold * criticalMultiplier ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING,
    value,
    threshold,
  };
}
