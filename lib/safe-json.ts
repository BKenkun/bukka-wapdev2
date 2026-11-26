export async function safeParseJson<T = Record<string, unknown>>(
  res: Response
): Promise<T | null> {
  try {
    const text = await res.text()
    if (!text) return null
    const trimmed = text.trim()
    if (trimmed.startsWith("<")) {
      return null
    }
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}
