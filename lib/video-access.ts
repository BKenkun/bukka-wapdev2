/**
 * Helpers compartidos (client + server safe) para evaluar restricciones de acceso
 * y límite de trailers en tarjetas y vistas de video.
 */

export interface VideoAccessMetadata {
  minTierLevel?: number | null
  isDiamondExclusive?: boolean
  isLimitedEdition?: boolean
  limitedAccessUntil?: Date | string | null
}

export interface UserAccessMetadata {
  isAuthenticated: boolean
  planLevel?: number | null
  canAccessExclusive?: boolean
  canAccessLimitedEdition?: boolean
}

/**
 * Devuelve true si el video está actualmente dentro de su ventana de edición limitada / acceso anticipado.
 */
export function isActiveLimitedEdition(
  video: VideoAccessMetadata,
  nowMs: number = Date.now()
): boolean {
  if (!video.isLimitedEdition || !video.limitedAccessUntil) return false
  const untilMs =
    video.limitedAccessUntil instanceof Date
      ? video.limitedAccessUntil.getTime()
      : new Date(video.limitedAccessUntil).getTime()
  return Number.isFinite(untilMs) && untilMs > nowMs
}

/**
 * Devuelve true si el video tiene alguna restricción de nivel Free (level >= 1) o superior,
 * o es exclusivo Diamond, o está en ventana activa de edición limitada.
 *
 * Los videos sin restricción (minTierLevel == null) o con restricción Visitante (level <= 0)
 * y sin flags exclusivos activos devuelven false (son públicos / sin bloqueo).
 */
export function isVideoRestricted(
  video: VideoAccessMetadata,
  nowMs: number = Date.now()
): boolean {
  const minLevel = video.minTierLevel ?? 0
  if (minLevel > 0) return true
  if (video.isDiamondExclusive) return true
  if (isActiveLimitedEdition(video, nowMs)) return true
  return false
}

/**
 * Devuelve true si el usuario actual cumple los requisitos de acceso completo al video.
 */
export function userHasVideoAccess(
  user: UserAccessMetadata,
  video: VideoAccessMetadata,
  nowMs: number = Date.now()
): boolean {
  if (!isVideoRestricted(video, nowMs)) return true

  // Cualquier video con restricción (Free L1+ / exclusivo / edición limitada) requiere sesión
  if (!user.isAuthenticated) return false

  const userLevel = user.planLevel ?? 0
  const minLevel = video.minTierLevel ?? 0
  if (userLevel < minLevel) return false

  if (video.isDiamondExclusive && !user.canAccessExclusive) return false
  if (isActiveLimitedEdition(video, nowMs) && !user.canAccessLimitedEdition) return false

  return true
}

/**
 * Determina si aplica el límite de 3 trailers para este usuario en este video.
 *
 * - Videos sin restricción o Visitante (level <= 0): NUNCA aplican límite de trailers.
 * - Usuarios que ya tienen acceso completo al video: NUNCA aplican límite de trailers.
 * - Usuarios Premium+ (level >= 2): tienen trailers ilimitados.
 * - Visitantes (L0) o usuarios Free (L1) viendo videos restringidos a los que NO tienen acceso:
 *   SÍ aplica el límite de 3 trailers.
 */
export function shouldApplyTrailerLimit(
  user: UserAccessMetadata,
  video: VideoAccessMetadata,
  nowMs: number = Date.now()
): boolean {
  if (!isVideoRestricted(video, nowMs)) return false
  if (userHasVideoAccess(user, video, nowMs)) return false
  return !user.isAuthenticated || (user.planLevel ?? 0) <= 1
}
