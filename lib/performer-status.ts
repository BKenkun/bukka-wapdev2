export const NEW_PERFORMER_WINDOW_DAYS = 7
export const NEW_PERFORMER_WINDOW_MS = NEW_PERFORMER_WINDOW_DAYS * 24 * 60 * 60 * 1000

export interface PerformerScheduleFields {
  comingSoon?: boolean | null
  comingSoonDate?: string | Date | null
  releasedAt?: string | Date | null
}

function toMs(value?: string | Date | null): number | null {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Returns true when a performer is currently scheduled (locked) with an upcoming or open-ended comingSoon state.
 */
export function isPerformerScheduled(
  performer: PerformerScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (!performer.comingSoon) return false
  const targetMs = toMs(performer.comingSoonDate)
  if (targetMs === null) return true
  return targetMs > nowMs
}

/**
 * Returns true when a performer is unlocked and within 7 days of release.
 */
export function isPerformerNew(
  performer: PerformerScheduleFields,
  nowMs: number = Date.now()
): boolean {
  if (isPerformerScheduled(performer, nowMs)) return false

  const releasedMs =
    toMs(performer.releasedAt) ??
    (performer.comingSoon ? toMs(performer.comingSoonDate) : null)

  if (releasedMs === null) return false

  const elapsed = nowMs - releasedMs
  return elapsed >= 0 && elapsed <= NEW_PERFORMER_WINDOW_MS
}
