'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
  BarChart, Bar
} from 'recharts'

interface AnalyticsData {
  totalScans: number
  totalSubmissions: number
  conversionRate: number
  devices: Array<{ device_type: string; count: number }>
  cities: Array<{ city: string; country: string; count: number }>
  daily: Array<{ scan_date: string; scan_count: number }>
  abandonByField: Record<string, number>
}

const DEVICE_COLORS: Record<string, string> = {
  mobile: '#3b82f6',
  desktop: '#10b981',
  tablet: '#f59e0b',
  unknown: '#6b7280',
}

export default function AnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/qrcodes/${id}/analytics`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-gray-800 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const deviceData = data.devices.map((d) => ({
    name: d.device_type,
    value: Number(d.count),
  }))

  const dailyData = data.daily.map((d) => ({
    date: new Date(d.scan_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    scans: Number(d.scan_count),
  }))

  const abandonData = Object.entries(data.abandonByField)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)

  const maxCity = Math.max(...data.cities.map((c) => Number(c.count)), 1)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/qrcodes/${id}`}
          className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-white">Analytics</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Total Scans</p>
          <p className="text-2xl font-bold text-white mt-1">{data.totalScans.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Questionários</p>
          <p className="text-2xl font-bold text-white mt-1">{data.totalSubmissions.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Conversão</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{data.conversionRate}%</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Linha - scans por dia */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Scans por dia (30 dias)</h2>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: 12 }} />
                <Line type="monotone" dataKey="scans" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Nenhum scan ainda</div>
          )}
        </div>

        {/* Pizza - dispositivos */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Dispositivos</h2>
          {deviceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  {deviceData.map((entry) => (
                    <Cell key={entry.name} fill={DEVICE_COLORS[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: 12 }} />
                <Legend formatter={(v) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">Sem dados</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cidades */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Top cidades</h2>
          {data.cities.length > 0 ? (
            <div className="space-y-2">
              {data.cities.map((c) => (
                <div key={`${c.city}-${c.country}`}>
                  <div className="flex items-center justify-between text-sm mb-0.5">
                    <span className="text-gray-300 truncate">{c.city}</span>
                    <span className="text-gray-500 text-xs ml-2 flex-shrink-0">{c.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(Number(c.count) / maxCity) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-600 text-sm">Sem dados de geolocalização</div>
          )}
        </div>

        {/* Funil de abandono */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-medium text-gray-300 mb-4">Abandono por campo</h2>
          {abandonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={abandonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="field" stroke="#6b7280" tick={{ fontSize: 11 }} width={80} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f9fafb', fontSize: 12 }} />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
              Sem dados de abandono
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
