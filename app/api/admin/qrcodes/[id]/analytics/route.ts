import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'

type Params = { params: Promise<{ id: string }> }

// GET /api/admin/qrcodes/[id]/analytics
export async function GET(_: NextRequest, { params }: Params) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  // Get scan IDs for this QR code (needed for ux_events query)
  const { data: scanRows } = await supabase
    .from('scans')
    .select('id')
    .eq('qr_code_id', id)
  const scanIds = (scanRows ?? []).map((r: { id: string }) => r.id)

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

      scanIds.length > 0
        ? supabase
            .from('ux_events')
            .select('event_type, field_name, metadata')
            .in('scan_id', scanIds)
            .eq('event_type', 'abandon')
        : Promise.resolve({ data: [] }),
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

  // Group abandons by last field
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
