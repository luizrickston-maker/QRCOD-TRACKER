import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fireSubmitWebhook } from '@/lib/webhook'
import { LIMITS, asUuid, clampString } from '@/lib/validation'

// POST /api/submit/[slug]
// Recebe o formulário preenchido e salva no banco
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { scan_id: rawScanId, answers: rawAnswers, time_to_complete_seconds: rawTtc } = body

    // ── Validação / sanitização ──
    const scan_id = asUuid(rawScanId)
    const time_to_complete_seconds =
      typeof rawTtc === 'number' && rawTtc >= 0 && rawTtc < 86400
        ? Math.floor(rawTtc)
        : null

    if (!Array.isArray(rawAnswers)) {
      return NextResponse.json({ error: 'answers inválido.' }, { status: 400 })
    }
    if (rawAnswers.length > LIMITS.MAX_ANSWERS) {
      return NextResponse.json({ error: 'Número de respostas excede o limite.' }, { status: 400 })
    }

    const answers = rawAnswers.map((a: Record<string, unknown>) => ({
      question_id: asUuid(a?.question_id),
      question_label: clampString(a?.question_label, LIMITS.MAX_LABEL_LEN),
      answer: clampString(a?.answer, LIMITS.MAX_ANSWER_LEN),
    }))

    const supabase = createServiceClient()

    // Busca qr_code pelo slug (inclui campos de webhook)
    const { data: qr, error: qrError } = await supabase
      .from('qr_codes')
      .select('id, name, slug, is_active, webhook_url, webhook_active, webhook_events, webhook_message_template')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (qrError || !qr) {
      return NextResponse.json(
        { error: 'Formulário não encontrado ou inativo.' },
        { status: 404 }
      )
    }

    // Cria submission
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .insert({
        scan_id: scan_id ?? null,
        qr_code_id: qr.id,
        time_to_complete_seconds: time_to_complete_seconds ?? null,
      })
      .select()
      .single()

    if (subError || !submission) {
      return NextResponse.json(
        { error: 'Erro ao salvar respostas.' },
        { status: 500 }
      )
    }

    // Salva as respostas individuais
    if (answers.length > 0) {
      const rows = answers.map((a) => ({
        submission_id: submission.id,
        question_id: a.question_id,
        question_label: a.question_label,
        answer: a.answer,
      }))

      await supabase.from('submission_answers').insert(rows)
    }

    // ── Webhook (fire-and-forget) ──
    const shouldFireWebhook =
      qr.webhook_active &&
      qr.webhook_url &&
      Array.isArray(qr.webhook_events) &&
      qr.webhook_events.includes('form_submitted')

    if (shouldFireWebhook) {
      // Busca tipos das perguntas para extração inteligente de telefone/nome/email
      const questionIds = answers
        .map((a) => a.question_id)
        .filter((id): id is string => !!id)

      let questionTypes: Record<string, string> = {}
      if (questionIds.length > 0) {
        const { data: qs } = await supabase
          .from('questions')
          .select('id, type')
          .in('id', questionIds)

        if (qs) {
          questionTypes = Object.fromEntries(qs.map((q: { id: string; type: string }) => [q.id, q.type]))
        }
      }

      const enrichedAnswers = answers.map((a) => ({
        ...a,
        type: a.question_id ? questionTypes[a.question_id] ?? undefined : undefined,
      }))

      // Busca geodados do scan para metadata
      let city: string | undefined
      let device: string | undefined
      if (scan_id) {
        const { data: scan } = await supabase
          .from('scans')
          .select('city, device_type')
          .eq('id', scan_id)
          .single()
        city = scan?.city ?? undefined
        device = scan?.device_type ?? undefined
      }

      await fireSubmitWebhook(qr, enrichedAnswers, {
        city,
        device,
        time_to_complete_seconds: time_to_complete_seconds ?? undefined,
      }).catch((e) => console.error('[submit-webhook]', e))
    }

    return NextResponse.json({ ok: true, submission_id: submission.id })
  } catch (error) {
    console.error('[submit-api]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
