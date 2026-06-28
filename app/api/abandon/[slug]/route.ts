import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fireAbandonWebhook } from '@/lib/webhook'
import { LIMITS, clampString } from '@/lib/validation'

// POST /api/abandon/[slug]
// Recebe dados parciais via sendBeacon quando o usuário abandona o formulário
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { partial_answers: rawPartial, last_field, time_on_page_seconds: rawTime } = body

    if (!rawPartial || typeof rawPartial !== 'object' || Array.isArray(rawPartial)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Sanitiza partial_answers: limita nº de chaves e tamanho dos valores
    const partial_answers: Record<string, string> = {}
    for (const [key, value] of Object.entries(rawPartial as Record<string, unknown>).slice(0, LIMITS.MAX_PARTIAL_KEYS)) {
      partial_answers[clampString(key, LIMITS.MAX_LABEL_LEN)] = clampString(value, LIMITS.MAX_ANSWER_LEN)
    }

    const time_on_page_seconds =
      typeof rawTime === 'number' && rawTime >= 0 && rawTime < 86400 ? Math.floor(rawTime) : 0

    const supabase = createServiceClient()

    // Busca QR code com config de webhook
    const { data: qr } = await supabase
      .from('qr_codes')
      .select('id, slug, name, webhook_url, webhook_active, webhook_events, webhook_message_template, webhook_abandon_delay_minutes')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (!qr) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Verifica se webhook de abandono está ativo
    const shouldFireWebhook =
      qr.webhook_active &&
      Array.isArray(qr.webhook_events) &&
      qr.webhook_events.includes('form_abandoned')

    if (shouldFireWebhook) {
      // Dispara imediatamente (fire-and-forget)
      // Nota: webhook_abandon_delay_minutes é gerenciado via automação externa (AgZap)
      // já que serverless functions não suportam setTimeout longo de forma confiável
      await fireAbandonWebhook(
        qr,
        partial_answers,
        last_field ? clampString(last_field, LIMITS.MAX_FIELD_NAME_LEN) : 'unknown',
        time_on_page_seconds
      ).catch((e) => console.error('[abandon-webhook]', e))
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[abandon-api]', error)
    return NextResponse.json({ ok: true }) // Nunca bloqueia
  }
}
