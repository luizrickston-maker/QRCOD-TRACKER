import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'
import { assertSafeWebhookUrl } from '@/lib/webhook'

type Params = { params: Promise<{ id: string }> }

const requireAuth = getAdminUser

// GET /api/admin/qrcodes/[id] — detalhes completos (qr + questionnaire + questions)
export async function GET(_: NextRequest, { params }: Params) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: qr, error: qrError } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', id)
    .single()

  if (qrError || !qr) {
    return NextResponse.json({ error: 'QR code não encontrado' }, { status: 404 })
  }

  const { data: questionnaire } = await supabase
    .from('questionnaires')
    .select('*')
    .eq('qr_code_id', id)
    .single()

  const { data: questions } = questionnaire
    ? await supabase
        .from('questions')
        .select('*')
        .eq('questionnaire_id', questionnaire.id)
        .order('sort_order', { ascending: true })
    : { data: [] }

  return NextResponse.json({ qr, questionnaire, questions: questions ?? [] })
}

// PATCH /api/admin/qrcodes/[id] — atualiza qr code e/ou questionnaire
export async function PATCH(request: NextRequest, { params }: Params) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const supabase = createServiceClient()

  // Verifica lock antes de qualquer edição
  const { data: qr } = await supabase
    .from('qr_codes')
    .select('is_locked')
    .eq('id', id)
    .single()

  if (qr?.is_locked && body.action !== 'unlock') {
    return NextResponse.json(
      { error: 'Este QR Code está bloqueado. Desbloqueie-o antes de editar.' },
      { status: 403 }
    )
  }

  // Atualiza campos do QR code
  const qrFields: Record<string, unknown> = {}
  if (body.name !== undefined) qrFields.name = body.name
  if (body.brand_name !== undefined) qrFields.brand_name = body.brand_name
  if (body.is_active !== undefined) qrFields.is_active = body.is_active
  if (body.action === 'lock') qrFields.is_locked = true
  if (body.action === 'unlock') qrFields.is_locked = false

  // Webhook fields
  if (body.webhook_url !== undefined) {
    // Valida URL (anti-SSRF) quando não-vazia
    if (body.webhook_url) {
      try {
        assertSafeWebhookUrl(body.webhook_url)
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'URL de webhook inválida' },
          { status: 400 }
        )
      }
    }
    qrFields.webhook_url = body.webhook_url
  }
  if (body.webhook_events !== undefined) qrFields.webhook_events = body.webhook_events
  if (body.webhook_active !== undefined) qrFields.webhook_active = body.webhook_active
  if (body.webhook_message_template !== undefined) qrFields.webhook_message_template = body.webhook_message_template
  if (body.webhook_abandon_delay_minutes !== undefined) qrFields.webhook_abandon_delay_minutes = body.webhook_abandon_delay_minutes

  if (Object.keys(qrFields).length > 0) {
    const { error } = await supabase
      .from('qr_codes')
      .update(qrFields)
      .eq('id', id)
    if (error) {
      console.error('[qrcode-update]', error.message)
      return NextResponse.json({ error: 'Erro ao atualizar QR Code.' }, { status: 500 })
    }
  }

  // Atualiza questionário
  if (body.questionnaire) {
    const { questionnaire_id, ...qFields } = body.questionnaire
    await supabase
      .from('questionnaires')
      .update(qFields)
      .eq('qr_code_id', id)
  }

  // Salva perguntas (upsert + remove deletadas)
  if (body.questions !== undefined) {
    const { data: questionnaire } = await supabase
      .from('questionnaires')
      .select('id')
      .eq('qr_code_id', id)
      .single()

    if (questionnaire) {
      const qid = questionnaire.id
      const incoming: Array<Record<string, unknown>> = body.questions

      // Remove perguntas que não estão mais na lista
      const incomingIds = incoming
        .map((q) => q.id)
        .filter((x) => x && !String(x).startsWith('new-'))

      if (incomingIds.length > 0) {
        await supabase
          .from('questions')
          .delete()
          .eq('questionnaire_id', qid)
          .not('id', 'in', `(${incomingIds.join(',')})`)
      } else {
        await supabase
          .from('questions')
          .delete()
          .eq('questionnaire_id', qid)
      }

      // Upsert cada pergunta
      for (let i = 0; i < incoming.length; i++) {
        const q = incoming[i]
        const isNew = !q.id || String(q.id).startsWith('new-')

        const row = {
          questionnaire_id: qid,
          label: q.label,
          type: q.type,
          options: q.options ?? null,
          placeholder: q.placeholder ?? null,
          required: q.required ?? false,
          sort_order: i,
        }

        if (isNew) {
          await supabase.from('questions').insert(row)
        } else {
          await supabase.from('questions').update(row).eq('id', q.id)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/qrcodes/[id]
export async function DELETE(_: NextRequest, { params }: Params) {
  const user = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('is_locked')
    .eq('id', id)
    .single()

  if (qr?.is_locked) {
    return NextResponse.json(
      { error: 'QR Code bloqueado não pode ser excluído.' },
      { status: 403 }
    )
  }

  const { error } = await supabase.from('qr_codes').delete().eq('id', id)
  if (error) {
    console.error('[qrcode-delete]', error.message)
    return NextResponse.json({ error: 'Erro ao excluir QR Code.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
