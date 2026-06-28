import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'
import { normalizeBrazilPhone, sendAgZapText } from '@/lib/agzap'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/qrcodes/[id]/webhooks — Últimos logs de webhook
export async function GET(_: NextRequest, { params }: Params) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('id, event_type, response_status, success, error_message, created_at')
    .eq('qr_code_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(logs ?? [])
}

// POST /api/admin/qrcodes/[id]/webhooks — Teste de webhook
export async function POST(request: NextRequest, { params }: Params) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json().catch(() => ({}))

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('id, slug, name, webhook_message_template')
    .eq('id', id)
    .single()

  if (!qr) {
    return NextResponse.json({ error: 'QR Code não encontrado' }, { status: 404 })
  }

  // Número de destino do teste (informado pelo admin)
  const number = normalizeBrazilPhone(body.number)
  if (!number) {
    return NextResponse.json(
      { error: 'Informe um número válido (ex: (11) 99999-9999).' },
      { status: 400 }
    )
  }

  const mensagem = `[TESTE] ${qr.name}: integração do AgZap funcionando ✅`

  const testPayload = {
    evento: 'test',
    number,
    mensagem,
    qr_code_slug: qr.slug,
    qr_code_nome: qr.name,
    metadata: { teste: true, data_hora: new Date().toISOString() },
  }

  try {
    const result = await sendAgZapText(number, mensagem)

    await supabase.from('webhook_logs').insert({
      qr_code_id: qr.id,
      event_type: 'test',
      payload: testPayload,
      response_status: result.status,
      response_body: result.body,
      success: result.ok,
    })

    return NextResponse.json({ success: result.ok, status: result.status, body: result.body.slice(0, 500) })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    await supabase.from('webhook_logs').insert({
      qr_code_id: qr.id,
      event_type: 'test',
      payload: testPayload,
      success: false,
      error_message: message,
    }).catch(() => {})

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
