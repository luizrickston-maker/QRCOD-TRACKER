'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

interface Answer {
  question_label: string
  answer: string
}

interface Submission {
  id: string
  created_at: string
  time_to_complete_seconds: number | null
  submission_answers: Answer[]
}

interface SubmissionResponse {
  submissions: Submission[]
  total: number
  page: number
  limit: number
}

export default function SubmissionsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<SubmissionResponse | null>(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Submission | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/qrcodes/${id}/submissions?page=${page}&limit=20`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [id, page])

  function handleExportCSV() {
    if (!data?.submissions.length) return

    // Coleta todos os labels únicos
    const allLabels = Array.from(
      new Set(
        data.submissions.flatMap((s) =>
          s.submission_answers.map((a) => a.question_label)
        )
      )
    )

    const header = ['ID', 'Data/Hora', 'Tempo (s)', ...allLabels].join(',')
    const rows = data.submissions.map((s) => {
      const answersMap = Object.fromEntries(
        s.submission_answers.map((a) => [a.question_label, a.answer])
      )
      return [
        s.id,
        formatDate(s.created_at),
        s.time_to_complete_seconds ?? '',
        ...allLabels.map((l) => `"${(answersMap[l] ?? '').replace(/"/g, '""')}"`),
      ].join(',')
    })

    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respostas-${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = data ? Math.ceil(data.total / 20) : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/qrcodes/${id}`}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Respostas</h1>
            {data && (
              <p className="text-xs text-gray-500">{data.total} total</p>
            )}
          </div>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={!data?.submissions.length}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data?.submissions.length ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-500">Nenhuma resposta recebida ainda.</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-left px-4 py-3 font-medium">Primeira resposta</th>
                  <th className="text-right px-4 py-3 font-medium">Campos</th>
                  <th className="text-right px-4 py-3 font-medium">Tempo</th>
                  <th className="text-right px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.submissions.map((s) => {
                  const firstAnswer = s.submission_answers[0]
                  return (
                    <tr key={s.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-4 py-3 text-white truncate max-w-xs">
                        {firstAnswer
                          ? `${firstAnswer.question_label}: ${firstAnswer.answer}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        {s.submission_answers.length}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">
                        {s.time_to_complete_seconds
                          ? `${s.time_to_complete_seconds}s`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelected(s)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-sm text-gray-500">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhe */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-white">Detalhe da resposta</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">{formatDate(selected.created_at)}</p>
              {selected.submission_answers.map((a, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{a.question_label}</p>
                  <p className="text-sm text-white">{a.answer || '—'}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
