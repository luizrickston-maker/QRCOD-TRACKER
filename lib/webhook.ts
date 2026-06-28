import { createServiceClient } from '@/lib/supabase/server'

export interface WebhookPayload {
  evento: 'form_submitted' | 'form_abandoned'
  telefone: string
  nome: string
  email: string
  mensagem: string
  origem: string
  qr_code_slug: string
  qr_code_nome: string
  respostas: Record<string, string>
  respostas_parciais?: Record<string, string>
  ultimo_campo?: string
  metadata: Record<string, unknown>
  [key: string]: unknown
}

interface WebhookConfig {
  qr_code_id: string
  webhook_url: string
  webhook_message_template: string
}

/**
 * Valida a URL de um webhook contra SSRF.
 * Lança Error se a URL não for http(s) ou apontar para host
 * interno/privado (localhost, IPs privados, link-local, metadata).
 */
export function assertSafeWebhookUrl(rawUrl: string): URL {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('URL de webhook inválida')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Webhook deve usar http(s)')
  }

  const host = url.hostname.toLowerCase()

  // Hostnames internos óbvios
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new Error('Webhook não pode apontar para host interno')
  }

  // IPv4 privado / loopback / link-local / metadata
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) || // link-local / 169.254.169.254 (metadata cloud)
      a === 0
    if (isPrivate) {
      throw new Error('Webhook não pode apontar para IP interno')
    }
  }

  // IPv6 loopback / link-local / unique-local
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    throw new Error('Webhook não pode apontar para IP interno')
  }

  return url
}

/**
 * Extrai telefone, nome e email das respostas com base no tipo ou label.
 */
export function extractContactFields(
  answers: Array<{ question_label: string; answer: string; type?: string }>
): { telefone: string; nome: string; email: string } {
  let telefone = ''
  let nome = ''
  let email = ''

  for (const a of answers) {
    const label = a.question_label.toLowerCase()
    const type = (a.type ?? '').toLowerCase()

    if (!telefone && (type === 'phone' || label.includes('telefone') || label.includes('whatsapp') || label.includes('celular'))) {
      telefone = a.answer
    }
    if (!email && (type === 'email' || label.includes('e-mail') || label.includes('email'))) {
      email = a.answer
    }
    if (!nome && (type === 'text' && (label.includes('nome') || label.includes('name')))) {
      nome = a.answer
    }
  }

  if (!nome) {
    const first = answers.find((a) => (a.type ?? '').toLowerCase() === 'text')
    if (first) nome = first.answer
  }

  return { telefone, nome, email }
}

/**
 * Interpola o template de mensagem com variáveis {{var}}.
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

/**
 * Dispara o webhook e loga o resultado. Nunca bloqueia o fluxo principal.
 */
export async function fireWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<void> {
  const supabase = createServiceClient()

  try {
    // Bloqueia SSRF antes de qualquer requisição de saída
    assertSafeWebhookUrl(config.webhook_url)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(config.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const responseBody = await res.text().catch(() => '')

    await supabase.from('webhook_logs').insert({
      qr_code_id: config.qr_code_id,
      event_type: payload.evento,
      payload: payload as unknown as Record<string, unknown>,
      response_status: res.status,
      response_body: responseBody.slice(0, 2000),
      success: res.ok,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook]', message)

    await supabase.from('webhook_logs').insert({
      qr_code_id: config.qr_code_id,
      event_type: payload.evento,
      payload: payload as unknown as Record<string, unknown>,
      response_status: null,
      response_body: null,
      success: false,
      error_message: message,
    }).catch(() => {})
  }
}

/**
 * Monta e dispara webhook para evento de submit.
 */
export async function fireSubmitWebhook(
  qr: { id: string; slug: string; name: string; webhook_url: string; webhook_message_template: string },
  answers: Array<{ question_label: string; answer: string; type?: string }>,
  meta: { city?: string; device?: string; time_to_complete_seconds?: number }
): Promise<void> {
  const { telefone, nome, email } = extractContactFields(answers)

  const respostas: Record<string, string> = {}
  for (const a of answers) {
    respostas[a.question_label] = a.answer
  }

  const mensagem = interpolateTemplate(
    qr.webhook_message_template || 'Novo formulário recebido via QR Code: {{qr_code_nome}}',
    { qr_code_nome: qr.name, qr_code_slug: qr.slug, telefone, nome, email }
  )

  const payload: WebhookPayload = {
    evento: 'form_submitted',
    telefone,
    nome,
    email,
    mensagem,
    origem: 'qr-tracker',
    qr_code_slug: qr.slug,
    qr_code_nome: qr.name,
    respostas,
    metadata: {
      cidade: meta.city ?? null,
      dispositivo: meta.device ?? null,
      tempo_preenchimento_segundos: meta.time_to_complete_seconds ?? null,
      data_hora: new Date().toISOString(),
    },
  }

  await fireWebhook(
    { qr_code_id: qr.id, webhook_url: qr.webhook_url, webhook_message_template: qr.webhook_message_template },
    payload
  )
}

/**
 * Monta e dispara webhook para evento de abandono.
 * Só dispara se telefone estiver preenchido.
 */
export async function fireAbandonWebhook(
  qr: { id: string; slug: string; name: string; webhook_url: string; webhook_message_template: string },
  partialAnswers: Record<string, string>,
  lastField: string,
  timeOnPage: number
): Promise<void> {
  const answersArray = Object.entries(partialAnswers).map(([label, answer]) => ({
    question_label: label,
    answer,
  }))
  const { telefone, nome, email } = extractContactFields(answersArray)

  if (!telefone) return

  const mensagem = interpolateTemplate(
    'Formulário abandonado — QR Code: {{qr_code_nome}}',
    { qr_code_nome: qr.name, qr_code_slug: qr.slug, telefone, nome, email }
  )

  const payload: WebhookPayload = {
    evento: 'form_abandoned',
    telefone,
    nome,
    email,
    mensagem,
    origem: 'qr-tracker',
    qr_code_slug: qr.slug,
    qr_code_nome: qr.name,
    respostas: {},
    respostas_parciais: partialAnswers,
    ultimo_campo: lastField,
    metadata: {
      tempo_na_pagina_segundos: timeOnPage,
      data_hora: new Date().toISOString(),
    },
  }

  await fireWebhook(
    { qr_code_id: qr.id, webhook_url: qr.webhook_url, webhook_message_template: qr.webhook_message_template },
    payload
  )
}
