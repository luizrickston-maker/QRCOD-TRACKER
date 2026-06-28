import { NextResponse } from 'next/server'
import { createServiceClient, getAdminUser } from '@/lib/supabase/server'

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServiceClient()

  const [qrResult, scansResult, subsResult, devicesResult, dailyResult] =
    await Promise.allSettled([
      supabase.from('v_qr_conversion').select('*'),
      supabase.from('scans').select('id', { count: 'exact', head: true }).eq('is_bot', false),
      supabase.from('submissions').select('id', { count: 'exact', head: true }),
      supabase.from('v_device_stats').select('device_type, count:count.sum()').is('qr_code_id', null).select('device_type').select('*'),
      supabase.from('v_daily_scans').select('scan_date, scan_count:scan_count.sum()').select('*'),
    ])

  const qrcodes = qrResult.status === 'fulfilled' ? (qrResult.value.data ?? []) : []
  const totalScans = scansResult.status === 'fulfilled' ? (scansResult.value.count ?? 0) : 0
  const totalSubmissions = subsResult.status === 'fulfilled' ? (subsResult.value.count ?? 0) : 0

  // Aggregate devices across all QR codes
  const { data: allDevices } = await supabase
    .from('scans')
    .select('device_type')
    .eq('is_bot', false)
  
  const deviceMap: Record<string, number> = {}
  for (const row of allDevices ?? []) {
    const key = row.device_type ?? 'unknown'
    deviceMap[key] = (deviceMap[key] ?? 0) + 1
  }
  const devices = Object.entries(deviceMap).map(([device_type, count]) => ({
    device_type,
    count,
  }))

  // Aggregate daily scans
  const { data: allDaily } = await supabase
    .from('v_daily_scans')
    .select('scan_date, scan_count')

  // Sum by date across all QR codes
  const dailyMap: Record<string, number> = {}
  for (const row of allDaily ?? []) {
    const key = row.scan_date
    dailyMap[key] = (dailyMap[key] ?? 0) + Number(row.scan_count)
  }
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([scan_date, scan_count]) => ({ scan_date, scan_count }))

  return NextResponse.json({
    totalScans,
    totalSubmissions,
    conversionRate:
      totalScans > 0
        ? parseFloat(((totalSubmissions / totalScans) * 100).toFixed(1))
        : 0,
    qrcodes,
    devices,
    daily,
  })
}
