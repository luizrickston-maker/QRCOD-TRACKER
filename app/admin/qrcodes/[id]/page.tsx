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
        </div>
      </div>
    </div>
  )
}
