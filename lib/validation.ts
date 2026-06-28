// ============================================================
// Helpers de validação para os endpoints PÚBLICOS.
// Esses endpoints usam o service role (ignoram RLS), então a
// validação aqui é a principal barreira contra payloads abusivos
// (campos gigantes, spam, dados malformados).
// ============================================================

export const LIMITS = {
  MAX_ANSWERS: 100,
  MAX_LABEL_LEN: 500,
  MAX_ANSWER_LEN: 5000,
  MAX_EVENTS: 50,
  MAX_FIELD_NAME_LEN: 200,
  MAX_PARTIAL_KEYS: 100,
} as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Retorna o UUID se válido, senão null. */
export function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null
}

/** Converte para string e limita o tamanho. */
export function clampString(value: unknown, max: number): string {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'string' ? value : String(value)
  return s.length > max ? s.slice(0, max) : s
}
