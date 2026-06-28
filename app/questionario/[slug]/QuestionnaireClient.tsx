'use client'

import { useState, useEffect, useCallback, FormEvent, useRef } from 'react'
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

// ── Validação e formatação ──

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10 || digits.length === 11
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function QuestionnaireClient({
  slug,
  brandName,
  questionnaire,
  questions,
  scanId,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startTime = useRef(Date.now())
  const submittedRef = useRef(false)
  const lastFieldRef = useRef<string>('')

  const { onFieldFocus: origOnFieldFocus, onFieldBlur, onFieldClick, onSubmit: trackSubmit } = useUXTracker(scanId)

  // Wrap onFieldFocus to track last field
  const onFieldFocus = useCallback((label: string) => {
    lastFieldRef.current = label
    origOnFieldFocus(label)
  }, [origOnFieldFocus])

  // ── sendBeacon: abandono do formulário ──
  useEffect(() => {
    function handleBeforeUnload() {
      if (submittedRef.current) return

      // Monta respostas parciais com labels
      const partialAnswers: Record<string, string> = {}
      let hasPhone = false

      for (const q of questions) {
        const raw = answers[q.id]
        const value = Array.isArray(raw) ? raw.join(', ') : (raw ?? '')
        if (value.trim()) {
          partialAnswers[q.label] = value
          if (q.type === 'phone' || q.label.toLowerCase().includes('telefone') || q.label.toLowerCase().includes('whatsapp')) {
            hasPhone = true
          }
        }
      }

      // Só envia se tiver telefone preenchido
      if (!hasPhone) return

      const timeOnPage = Math.round((Date.now() - startTime.current) / 1000)

      const payload = JSON.stringify({
        partial_answers: partialAnswers,
        last_field: lastFieldRef.current || 'unknown',
        time_on_page_seconds: timeOnPage,
      })

      navigator.sendBeacon(`/api/abandon/${slug}`, new Blob([payload], { type: 'application/json' }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [answers, questions, slug])

  function setAnswer(questionId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    // Limpa erro ao digitar
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  function handlePhoneChange(questionId: string, rawValue: string) {
    const formatted = formatPhone(rawValue)
    setAnswer(questionId, formatted)
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

  function validate(): boolean {
    const errors: Record<string, string> = {}

    for (const q of questions) {
      const raw = answers[q.id]
      const value = Array.isArray(raw) ? raw.join('') : (raw ?? '')

      if (q.required && !value.trim()) {
        errors[q.id] = 'Campo obrigatório'
        continue
      }

      if (value.trim()) {
        if (q.type === 'email' && !isValidEmail(value)) {
          errors[q.id] = 'E-mail inválido. Inclua o @'
        }
        if (q.type === 'phone' && !isValidPhone(value)) {
          errors[q.id] = 'Número inválido. Use (00) 00000-0000'
        }
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!validate()) return

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
      submittedRef.current = true
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
            <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-5">
              {questions.length === 0 ? (
                <p className="text-gray-400 text-center py-4 text-sm">
                  Este formulário não possui perguntas ainda.
                </p>
              ) : (
                questions.map((q) => {
                  const fieldError = fieldErrors[q.id]
                  const errorClasses = fieldError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'

                  return (
                    <div key={q.id}>
                      <label className="block text-sm font-medium text-gray-800 mb-1.5">
                        {q.label}
                        {q.required && <span className="text-red-500 ml-1">*</span>}
                      </label>

                      {/* text / email / number */}
                      {['text', 'email', 'number'].includes(q.type) && (
                        <input
                          type={q.type}
                          value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          onFocus={() => onFieldFocus(q.label)}
                          onBlur={() => onFieldBlur(q.label)}
                          onClick={() => onFieldClick(q.label)}
                          placeholder={q.placeholder ?? ''}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${errorClasses}`}
                        />
                      )}

                      {/* phone — com formatação automática */}
                      {q.type === 'phone' && (
                        <input
                          type="tel"
                          inputMode="numeric"
                          value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => handlePhoneChange(q.id, e.target.value)}
                          onFocus={() => onFieldFocus(q.label)}
                          onBlur={() => onFieldBlur(q.label)}
                          onClick={() => onFieldClick(q.label)}
                          placeholder={q.placeholder ?? '(00) 00000-0000'}
                          maxLength={16}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors ${errorClasses}`}
                        />
                      )}

                      {/* textarea */}
                      {q.type === 'textarea' && (
                        <textarea
                          value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          onFocus={() => onFieldFocus(q.label)}
                          onBlur={() => onFieldBlur(q.label)}
                          placeholder={q.placeholder ?? ''}
                          rows={3}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 transition-colors resize-none ${errorClasses}`}
                        />
                      )}

                      {/* select */}
                      {q.type === 'select' && (
                        <select
                          value={(answers[q.id] as string) ?? ''}
                          onChange={(e) => setAnswer(q.id, e.target.value)}
                          onFocus={() => onFieldFocus(q.label)}
                          onBlur={() => onFieldBlur(q.label)}
                          className={`w-full px-3.5 py-2.5 border rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-1 transition-colors bg-white ${errorClasses}`}
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

                      {/* Mensagem de erro por campo */}
                      {fieldError && (
                        <p className="mt-1 text-xs text-red-500">{fieldError}</p>
                      )}
                    </div>
                  )
                })
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
