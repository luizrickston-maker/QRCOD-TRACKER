'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend
} from 'recharts'

interface DashboardStats {
  totalScans: number
  totalSubmissions: number
  conversionRate: number
  qrcodes: Array<{
    id: string
    name: string
    slug: string
    total_scans: number
    total_submissions: number
    conversion_rate: number
    is_locked: boolean
    is_active: boolean
  }>
  daily: Array<{ scan_date: string; scan_count: number }>
  devices: Array<{ device_type: string; count: number }>
}

const DEVICE_COLORS: Record<string, string> = {
  mobile: '#3b82f6',
  desktop: '#10b981',
  tablet: '#f59e0b',
  unknown: '#6b7280',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard')
        if (res.ok) setStats(await res.json())
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <p className="text-gray-400">Erro ao carregar dados.</p>
      </div>
    )
  }

  const deviceData = stats.devices.map((d) => ({
    name: d.device_type,
    value: Number(d.count),
  }))

  const dailyData = stats.daily.map((d) => ({
    date: new Date(d.scan_date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    }),
    scans: Number(d.scan_count),
  }))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <span className="text-xs text-gray-500">
          Últimos 30 dias
        </span>
      </div>

      {/* Métricas globais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total de Scans" value={stats.totalScans.toLocaleString('pt-BR')} />
        <StatCard label="Questionários Enviados" value={stats.totalSubmissions.toLocaleString('pt-BR')} />
        <StatCard
          label="Taxa de Conversão"
          value={`${stats.conversionRate}%`}
          accent={stats.conversionRate >= 50}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Scans por dia */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Scans por dia</h2>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="scans"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              Nenhum scan ainda
            </div>
          )}
        </div>

        {/* Dispositivos */}
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Dispositivos</h2>
          {deviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={deviceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                >
                  {deviceData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={DEVICE_COLORS[entry.name] ?? '#6b7280'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#f9fafb',
                    fontSize: 12,
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              Sem dados
            </div>
          )}
        </div>
      </div>

      {/* Tabela de QR Codes */}
      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-sm font-medium text-gray-300">QR Codes</h2>
          <Link
            href="/admin/qrcodes"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-800">
                <th className="text-left px-4 py-3 font-medium">Nome</th>
                <th className="text-left px-4 py-3 font-medium">Slug</th>
                <th className="text-right px-4 py-3 font-medium">Scans</th>
                <th className="text-right px-4 py-3 font-medium">Envios</th>
                <th className="text-right px-4 py-3 font-medium">Conversão</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {stats.qrcodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-600">
                    Nenhum QR code criado ainda.{' '}
                    <Link href="/admin/qrcodes/new" className="text-blue-400 hover:text-blue-300">
                      Criar agora
                    </Link>
                  </td>
                </tr>
              ) : (
                stats.qrcodes.map((qr) => (
                  <tr key={qr.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{qr.name}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      /q/{qr.slug}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {Number(qr.total_scans || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {Number(qr.total_submissions || 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">
                      {qr.conversion_rate || 0}%
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {qr.is_locked && (
                          <span title="Bloqueado" className="text-amber-400">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            qr.is_active ? 'bg-emerald-400' : 'bg-gray-600'
                          }`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p
        className={`text-2xl font-bold mt-1 ${
          accent ? 'text-emerald-400' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
