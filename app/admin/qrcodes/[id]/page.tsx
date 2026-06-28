'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QuestionBuilder, { type Question } from '@/components/admin/QuestionBuilder'
import QRCodeDisplay from '@/components/admin/QRCodeDisplay'

interface QRCodeData {
  id: string
  name: string
  slug: string
  brand_name: string
  is_locked: boolean
  is_active: boolean
  webhook_url: string | null
  webhook_events: string[]
  webhook_active: boolean
  webhook_message_template: string
  webhook_abandon_delay_minutes: number
}

interface WebhookLog {
  id: string
  event_type: string
  response_status: number | null
  success: boolean
  error_message: string | null
  created_at: string
}

interface Questionnaire {
  id: string
  title: string
  description: string
  submit_label: string
}

export default function EditQRCodePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [qr, setQr] = useState<QRCodeData | null>(null)
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([])
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/qrcodes/${id}`)
    if (!res.ok) { router.push('/admin/qrcodes'); return }
    const data = await res.json()
    setQr(data.qr)
    setQuestionnaire(data.questionnaire)
    setQuestions(data.questions)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  // Carrega logs de webhook
  useEffect(() => {
    if (!id) return
    fetch(`/api/admin/qrcodes/${id}/webhooks`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setWebhookLogs(data) })
      .catch(() => {})
  }, [id])

  async function handleSave() {
    if (!qr || qr.is_locked) return
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/admin/qrcodes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: qr.name,
        brand_name: qr.brand_name,
        is_active: qr.is_active,
        webhook_url: qr.webhook_url,
        webhook_events: qr.webhook_events,
        webhook_active: qr.webhook_active,
        webhook_message_template: qr.webhook_message_template,
        webhook_abandon_delay_minutes: qr.webhook_abandon_delay_minutes,
        questionnaire: {
          title: questionnaire?.title,
          description: questionnaire?.description,
          submit_label: questionnaire?.submit_label,
        },
        questions,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="h-64 bg-gray-800 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!qr) return null

  const locked = qr.is_locked

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/qrcodes"
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{qr.name}</h1>
              {locked && (
                <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-950 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Bloqueado
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono">/q/{qr.slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {locked ? (
            <div className="text-xs text-gray-600 bg-gray-800 px-3 py-2 rounded-lg">
              Desbloqueie para editar
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-950 border border-red-800 rounded-xl text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="xl:col-span-2 space-y-6">
          {/* Configurações do QR code */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Configurações</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome interno</label>
                <input
                  type="text"
                  value={qr.name}
                  onChange={(e) => setQr({ ...qr, name: e.target.value })}
                  disabled={locked}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Nome público</label>
                <input
                  type="text"
                  value={qr.brand_name}
                  onChange={(e) => setQr({ ...qr, brand_name: e.target.value })}
                  disabled={locked}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>

            <label className={`flex items-center gap-2.5 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type="checkbox"
                checked={qr.is_active}
                onChange={(e) => !locked && setQr({ ...qr, is_active: e.target.checked })}
                disabled={locked}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-400">QR Code ativo (aceita scans)</span>
            </label>
          </div>

          {/* Configurações do questionário */}
          {questionnaire && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-300">Questionário</h2>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Título</label>
                <input
                  type="text"
                  value={questionnaire.title}
                  onChange={(e) => setQuestionnaire({ ...questionnaire, title: e.target.value })}
                  disabled={locked}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Descrição / Instrução</label>
                <textarea
                  value={questionnaire.description ?? ''}
                  onChange={(e) => setQuestionnaire({ ...questionnaire, description: e.target.value })}
                  disabled={locked}
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none"
                />
              </div>

              <div className="w-40">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Texto do botão</label>
                <input
                  type="text"
                  value={questionnaire.submit_label}
                  onChange={(e) => setQuestionnaire({ ...questionnaire, submit_label: e.target.value })}
                  disabled={locked}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          {/* Construtor de perguntas */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-300">
                Perguntas{' '}
                <span className="text-gray-600 font-normal">({questions.length})</span>
              </h2>
              {locked && (
                <span className="text-xs text-gray-600">Bloqueado — desbloqueie para editar</span>
              )}
            </div>
            <QuestionBuilder
              questions={questions}
              onChange={setQuestions}
              locked={locked}
            />
          </div>
        </div>

        {/* Sidebar: QR Code + Links */}
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">QR Code</h2>
            <QRCodeDisplay slug={qr.slug} />
          </div>

          {/* Links rápidos */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Links</h2>
            <Link
              href={`/admin/qrcodes/${id}/analytics`}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1"
            >
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Ver Analytics
            </Link>
            <Link
              href={`/admin/qrcodes/${id}/submissions`}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1"
            >
              <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Ver Respostas
            </Link>
            <a
              href={`/questionario/${qr.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors py-1"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Abrir questionário
            </a>
          </div>

          {/* Webhook / Integração */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Webhook
              </h2>
              <label className={`flex items-center gap-2 ${locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <span className="text-xs text-gray-500">{qr.webhook_active ? 'Ativo' : 'Inativo'}</span>
                <input
                  type="checkbox"
                  checked={qr.webhook_active}
                  onChange={(e) => !locked && setQr({ ...qr, webhook_active: e.target.checked })}
                  disabled={locked}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">URL (opcional)</label>
              <input
                type="url"
                value={qr.webhook_url ?? ''}
                onChange={(e) => setQr({ ...qr, webhook_url: e.target.value })}
                disabled={locked}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50 font-mono text-[11px]"
              />
              <p className="text-[10px] text-gray-600 mt-1">As mensagens são enviadas pelo AgZap (token no servidor). Este campo não é mais necessário.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Eventos</label>
              <div className="space-y-1.5">
                <label className={`flex items-center gap-2 ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={qr.webhook_events?.includes('form_submitted')}
                    onChange={(e) => {
                      if (locked) return
                      const events = new Set(qr.webhook_events ?? [])
                      if (e.target.checked) events.add('form_submitted')
                      else events.delete('form_submitted')
                      setQr({ ...qr, webhook_events: Array.from(events) })
                    }}
                    disabled={locked}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-gray-400">Enviado</span>
                </label>
                <label className={`flex items-center gap-2 ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={qr.webhook_events?.includes('form_abandoned')}
                    onChange={(e) => {
                      if (locked) return
                      const events = new Set(qr.webhook_events ?? [])
                      if (e.target.checked) events.add('form_abandoned')
                      else events.delete('form_abandoned')
                      setQr({ ...qr, webhook_events: Array.from(events) })
                    }}
                    disabled={locked}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-gray-400">Abandonado</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mensagem</label>
              <input
                type="text"
                value={qr.webhook_message_template ?? ''}
                onChange={(e) => setQr({ ...qr, webhook_message_template: e.target.value })}
                disabled={locked}
                placeholder="Olá {{nome}}! A Chapada Digital recebeu seu formulário..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-[11px] focus:outline-none focus:border-orange-500 disabled:opacity-50"
              />
              <p className="text-[10px] text-gray-600 mt-1">Variáveis: {`{{qr_code_nome}}`} {`{{telefone}}`} {`{{nome}}`} {`{{email}}`} · Em branco usa a mensagem padrão da Chapada Digital.</p>
            </div>

            {qr.webhook_events?.includes('form_abandoned') && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Delay abandono (min)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={qr.webhook_abandon_delay_minutes ?? 0}
                  onChange={(e) => setQr({ ...qr, webhook_abandon_delay_minutes: parseInt(e.target.value) || 0 })}
                  disabled={locked}
                  className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
                <p className="text-[10px] text-gray-600 mt-1">0 = imediato</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
              <button
                onClick={async () => {
                  const number = window.prompt('Número de WhatsApp para o teste (ex: (11) 99999-9999):')
                  if (!number) return
                  setTestingWebhook(true)
                  setTestResult(null)
                  try {
                    const r = await fetch(`/api/admin/qrcodes/${id}/webhooks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ number }),
                    })
                    const data = await r.json()
                    setTestResult({
                      success: data.success,
                      message: data.success ? `✓ enviado` : `✗ ${data.error ?? data.status}`,
                    })
                    fetch(`/api/admin/qrcodes/${id}/webhooks`)
                      .then((r) => r.json())
                      .then((data) => { if (Array.isArray(data)) setWebhookLogs(data) })
                  } catch {
                    setTestResult({ success: false, message: '✗ Erro' })
                  }
                  setTestingWebhook(false)
                }}
                disabled={locked || testingWebhook}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                {testingWebhook ? '...' : 'Testar'}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResult.message}
                </span>
              )}
            </div>

            {webhookLogs.length > 0 && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-[10px] font-medium text-gray-500 mb-1.5">Últimos disparos</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {webhookLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-[10px] py-1 px-1.5 bg-gray-800/50 rounded">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${log.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-gray-500">
                          {log.event_type === 'form_submitted' ? 'Envio' : log.event_type === 'form_abandoned' ? 'Aband.' : log.event_type === 'test' ? 'Teste' : log.event_type}
                        </span>
                      </div>
                      <span className="text-gray-600">
                        {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
