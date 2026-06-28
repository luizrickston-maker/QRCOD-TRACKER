'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface QRCode {
  id: string
  name: string
  slug: string
  brand_name: string
  is_locked: boolean
  is_active: boolean
  total_scans?: number
  total_submissions?: number
  conversion_rate?: number
}

export default function QRCodesPage() {
  const [qrcodes, setQrcodes] = useState<QRCode[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const res = await fetch('/api/admin/qrcodes')
    if (res.ok) setQrcodes(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleDelete(qr: QRCode) {
    if (qr.is_locked) return
    if (!confirm(`Excluir "${qr.name}"? Esta ação não pode ser desfeita.`)) return

    setDeleting(qr.id)
    const res = await fetch(`/api/admin/qrcodes/${qr.id}`, { method: 'DELETE' })
    if (res.ok) {
      setQrcodes((prev) => prev.filter((q) => q.id !== qr.id))
    } else {
      const data = await res.json()
      alert(data.error ?? 'Erro ao excluir.')
    }
    setDeleting(null)
  }

  async function handleToggleLock(qr: QRCode) {
    if (!qr.is_locked) {
      if (!confirm(`Bloquear "${qr.name}"? Isso impedirá edições e exclusão até ser desbloqueado.`)) return
    } else {
      const input = prompt('Digite CONFIRMO para desbloquear:')
      if (input?.trim().toUpperCase() !== 'CONFIRMO') {
        alert('Confirmação incorreta. Nenhuma alteração feita.')
        return
      }
    }

    const res = await fetch(`/api/admin/qrcodes/${qr.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: qr.is_locked ? 'unlock' : 'lock' }),
    })

    if (res.ok) {
      setQrcodes((prev) =>
        prev.map((q) => (q.id === qr.id ? { ...q, is_locked: !qr.is_locked } : q))
      )
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">QR Codes</h1>
        <Link
          href="/admin/qrcodes/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo QR Code
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : qrcodes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <p className="text-gray-400 mb-4">Nenhum QR code criado ainda.</p>
          <Link
            href="/admin/qrcodes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Criar primeiro QR Code
          </Link>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <th className="text-left px-4 py-3 font-medium">Nome / Slug</th>
                <th className="text-right px-4 py-3 font-medium">Scans</th>
                <th className="text-right px-4 py-3 font-medium">Formulários</th>
                <th className="text-right px-4 py-3 font-medium">Conversão</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {qrcodes.map((qr) => (
                <tr key={qr.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {qr.is_locked && (
                        <span title="Bloqueado — edição desativada">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                      <div>
                        <p className="text-white font-medium">{qr.name}</p>
                        <p className="text-gray-500 text-xs font-mono">/q/{qr.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {Number(qr.total_scans ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {Number(qr.total_submissions ?? 0).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {qr.conversion_rate ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        qr.is_active
                          ? 'bg-emerald-950 text-emerald-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${qr.is_active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                      {qr.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Analytics */}
                      <Link
                        href={`/admin/qrcodes/${qr.id}/analytics`}
                        title="Analytics"
                        className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </Link>

                      {/* Respostas */}
                      <Link
                        href={`/admin/qrcodes/${qr.id}/submissions`}
                        title="Respostas"
                        className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </Link>

                      {/* Editar */}
                      {qr.is_locked ? (
                        <span
                          title="Bloqueado — não pode editar"
                          className="p-1.5 text-gray-700 cursor-not-allowed rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </span>
                      ) : (
                        <Link
                          href={`/admin/qrcodes/${qr.id}`}
                          title="Editar"
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </Link>
                      )}

                      {/* Lock/Unlock */}
                      <button
                        onClick={() => handleToggleLock(qr)}
                        title={qr.is_locked ? 'Desbloquear' : 'Bloquear'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          qr.is_locked
                            ? 'text-amber-400 hover:text-amber-300 hover:bg-gray-800'
                            : 'text-gray-500 hover:text-amber-400 hover:bg-gray-800'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          {qr.is_locked ? (
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          ) : (
                            <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                          )}
                        </svg>
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => handleDelete(qr)}
                        disabled={qr.is_locked || deleting === qr.id}
                        title={qr.is_locked ? 'Bloqueado — não pode excluir' : 'Excluir'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          qr.is_locked
                            ? 'text-gray-700 cursor-not-allowed'
                            : 'text-gray-500 hover:text-red-400 hover:bg-gray-800'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
