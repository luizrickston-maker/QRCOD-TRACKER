'use client'

import { useState, FormEvent, useRef } from 'react'
import { useUXTracker } from '@/hooks/useUXTracker'

interface Question {
  id: string
  label: string
  type: string
  options?: string[]
  placeholder?: string
  required: boolean
  sort_order: number
}

interface Questionnaire {
  title: string
  description: string | null
  submit_label: string
}

interface Props {
  slug: string
  brandName: string
  questionnaire: Questionnaire | null
  questions: Question[]
  scanId: string | null
}

export default function QuestionnaireClient({
  slug,
  brandName,
  questionnaire,
  questions,
  scanId,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTime = useRef(Date.now())

  const { onFieldFocus, onFieldBlur, onFieldClick, onSubmit: trackSubmit } = useUXTracker(scanId)

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  function toggleCheckbox(questionId: string, option: string) {
    setAnswers((prev) => {
      const current = (prev[questionId] as string[]) ?? []
      return {
        ...prev,
        [questionId]: current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option],
      }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const timeToComplete = Math.round((Date.now() - startTime.current) / 1000)

    const answersPayload = questions.map((q) => {
      const raw = answers[q.id]
      const answer = Array.isArray(raw) ? raw.join(', ') : (raw ?? '')
      return {
        question_id: q.id,
        question_label: q.label,
        answer,
      }
    })

    trackSubmit()

    const res = await fetch(`/api/submit/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scan_id: scanId,
        answers: answersPayload,
        time_to_complete_seconds: timeToComplete,
      }),
    })

    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json()
      setError(data.error ?? 'Erro ao enviar. Tente novamente.')
    }

    setSubmitting(false)
  }

  // Tela de sucesso
  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Obrigado!</h1>
          <p className="text-gray-500">Suas respostas foram registradas com sucesso.</p>
        </div>
      </div>
    )
  }

  const title = questionnaire?.title ?? 'Preencha o formulário'
  const description = questionnaire?.description
  const submitLabel = questionnaire?.submit_label ?? 'Enviar'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-lg mx-auto">
          <p className="text-sm font-semibold text-gray-900">{brandName}</p>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Title */}
            <div className="px-6 pt-6 pb-5 border-b border-gray-100">
              <h1 className="text-xl font-bold text-gray-900">{title}</h1>
              {description && (
                <p className="text-sm text-gray-500 mt-1">{description}</p>
              )}
            </div>

            {/* Fields */}
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
              {questions.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">
                  Este formulário não possui perguntas ainda.
                </p>
              ) : (
                questions.map((q) => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-800 mb-1.5">
                      {q.label}
                      {q.required && <span className="text-red-500 ml-1">*</span>}
                    </label>

                    {/* text / email / phone / number */}
                    {['text', 'email', 'phone', 'number'].includes(q.type) && (
                      <input
                        type={q.type === 'phone' ? 'tel' : q.type}
                        value={(answers[q.id] as string) ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        onFocus={() => onFieldFocus(q.label)}
                        onBlur={() => onFieldBlur(q.label)}
                        onClick={() => onFieldClick(q.label)}
                        required={q.required}
                        placeholder={q.placeholder ?? ''}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                      />
                    )}

                    {/* textarea */}
                    {q.type === 'textarea' && (
                      <textarea
                        value={(answers[q.id] as string) ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        onFocus={() => onFieldFocus(q.label)}
                        onBlur={() => onFieldBlur(q.label)}
                        required={q.required}
                        placeholder={q.placeholder ?? ''}
                        rows={3}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
                      />
                    )}

                    {/* select */}
                    {q.type === 'select' && (
                      <select
                        value={(answers[q.id] as string) ?? ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        onFocus={() => onFieldFocus(q.label)}
                        onBlur={() => onFieldBlur(q.label)}
                        required={q.required}
                        className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-gray-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-white"
                      >
                        <option value="">{q.placeholder || 'Selecione...'}</option>
                        {(q.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {/* radio */}
                    {q.type === 'radio' && (
                      <div className="space-y-2">
                        {(q.options ?? []).map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-3 cursor-pointer group"
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt}
                              checked={(answers[q.id] as string) === opt}
                              onChange={() => setAnswer(q.id, opt)}
                              onFocus={() => onFieldFocus(q.label)}
                              required={q.required}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* checkbox */}
                    {q.type === 'checkbox' && (
                      <div className="space-y-2">
                        {(q.options ?? []).map((opt) => (
                          <label
                            key={opt}
                            className="flex items-center gap-3 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={((answers[q.id] as string[]) ?? []).includes(opt)}
                              onChange={() => toggleCheckbox(q.id, opt)}
                              onFocus={() => onFieldFocus(q.label)}
                              className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{opt}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {error}
                </div>
              )}

              {questions.length > 0 && (
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-colors text-sm"
                >
                  {submitting ? 'Enviando...' : submitLabel}
                </button>
              )}
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
