// ============================================================
// Integração com a API do AgZap (envio de WhatsApp).
// Doc: POST https://app.agzap.com.br/send
//   body: { token, number, type: "text", message }
//   number: formato internacional só dígitos (ex: 5511999999999)
//   resposta: 200 { success: true, ... } | { success: false, message }
// ============================================================

const AGZAP_ENDPOINT = 'https://app.agzap.com.br/send'

/**
 * Normaliza um telefone brasileiro para o formato do AgZap (DDI+DDD+número,
 * só dígitos). Retorna null se não parecer um número válido.
 *   "(11) 99999-9999"  -> "5511999999999"
 *   "11 3333-4444"     -> "551133334444"
 *   "5511999999999"    -> "5511999999999"
 */
export function normalizeBrazilPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return null

  // Já vem com DDI 55 + (10 ou 11) dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }
  // DDD + número (10 fixo, 11 celular) -> prefixa DDI 55
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits
  }
  return null
}

export interface AgZapResult {
  ok: boolean
  status: number | null
  body: string
}

/**
 * Envia uma mensagem de texto via AgZap.
 * Lança Error se AGZAP_TOKEN não estiver configurado.
 */
export async function sendAgZapText(number: string, message: string): Promise<AgZapResult> {
  const token = process.env.AGZAP_TOKEN
  if (!token) throw new Error('AGZAP_TOKEN não configurado')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(AGZAP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, number, type: 'text', message }),
      signal: controller.signal,
    })
    const body = await res.text().catch(() => '')

    // O AgZap pode responder 200 com { success: false }. Detecta isso.
    let ok = res.ok
    try {
      const parsed = JSON.parse(body)
      if (typeof parsed?.success === 'boolean') ok = parsed.success
    } catch {
      // corpo não-JSON: mantém res.ok
    }

    return { ok, status: res.status, body: body.slice(0, 2000) }
  } finally {
    clearTimeout(timeout)
  }
}
