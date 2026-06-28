import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'
import { assertSafeWebhookUrl } from '@/lib/webhook'

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
    .select('id, slug, name, webhook_url, webhook_message_template')
    .eq('id', id)
    .single()

  // Usa URL do body (formulário) se disponível, senão do banco
  const webhookUrl = body.webhook_url || qr?.webhook_url

  if (!qr || !webhookUrl) {
    return NextResponse.json({ error: 'Webhook URL não configurada' }, { status: 400 })
  }

  // Bloqueia SSRF (URL interna/privada) antes de testar
  try {
    assertSafeWebhookUrl(webhookUrl)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'URL inválida' },
      { status: 400 }
    )
  }

  // Payload de teste
  const testPayload = {
    evento: 'test',
    telefone: '(00) 00000-0000',
    nome: 'Teste QR Tracker',
    email: 'teste@qrtracker.com',
    mensagem: `[TESTE] Webhook do QR Code: ${qr.name}`,
    origem: 'qr-tracker',
    qr_code_slug: qr.slug,
    qr_code_nome: qr.name,
    respostas: {
      'Nome completo': 'Teste QR Tracker',
      'Telefone / WhatsApp': '(00) 00000-0000',
      'E-mail': 'teste@qrtracker.com',
    },
    metadata: {
      teste: true,
      data_hora: new Date().toISOString(),
    },
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const responseBody = await res.text().catch(() => '')

    await supabase.from('webhook_logs').insert({
      qr_code_id: qr.id,
      event_type: 'test',
      payload: testPayload,
      response_status: res.status,
      response_body: responseBody.slice(0, 2000),
      success: res.ok,
    })

    return NextResponse.json({ success: res.ok, status: res.status, body: responseBody.slice(0, 500) })
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
