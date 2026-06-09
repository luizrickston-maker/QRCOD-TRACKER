import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/qrcodes/[id]/analytics
export async function GET(_: NextRequest, { params }: Params) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const [scansResult, submissionsResult, devicesResult, citiesResult, dailyResult, uxResult] =
    await Promise.allSettled([
      supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('qr_code_id', id)
        .eq('is_bot', false),

      supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('qr_code_id', id),

      supabase
        .from('v_device_stats')
        .select('*')
        .eq('qr_code_id', id),

      supabase
        .from('v_city_stats')
        .select('*')
        .eq('qr_code_id', id)
        .limit(10),

      supabase
        .from('v_daily_scans')
        .select('*')
        .eq('qr_code_id', id),

      supabase
        .from('ux_events')
        .select('event_type, field_name, metadata')
        .in('scan_id',
          supabase
            .from('scans')
            .select('id')
            .eq('qr_code_id', id)
        )
        .eq('event_type', 'abandon'),
    ])

  const totalScans =
    scansResult.status === 'fulfilled' ? (scansResult.value.count ?? 0) : 0
  const totalSubmissions =
    submissionsResult.status === 'fulfilled'
      ? (submissionsResult.value.count ?? 0)
      : 0
  const devices =
    devicesResult.status === 'fulfilled' ? (devicesResult.value.data ?? []) : []
  const cities =
    citiesResult.status === 'fulfilled' ? (citiesResult.value.data ?? []) : []
  const daily =
    dailyResult.status === 'fulfilled' ? (dailyResult.value.data ?? []) : []
  const abandons =
    uxResult.status === 'fulfilled' ? (uxResult.value.data ?? []) : []

  // Agrupa abandons por último campo
  const abandonByField: Record<string, number> = {}
  for (const ev of abandons) {
    const field =
      (ev.metadata as Record<string, unknown>)?.last_field as string ?? ev.field_name ?? 'unknown'
    abandonByField[field] = (abandonByField[field] ?? 0) + 1
  }

  return NextResponse.json({
    totalScans,
    totalSubmissions,
    conversionRate:
      totalScans > 0
        ? parseFloat(((totalSubmissions / totalScans) * 100).toFixed(1))
        : 0,
    devices,
    cities,
    daily,
    abandonByField,
  })
}
