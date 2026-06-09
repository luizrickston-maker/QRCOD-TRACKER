import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/events
// Recebe eventos UX do questionário via fetch/sendBeacon
// Funciona com Content-Type: application/json e text/plain (sendBeacon)

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? ''
    let body: unknown

    if (contentType.includes('application/json')) {
      body = await request.json()
    } else {
      // sendBeacon envia como text/plain
      const text = await request.text()
      body = JSON.parse(text)
    }

    const events = Array.isArray(body) ? body : [body]
    const supabase = createServiceClient()

    const rows = events
      .filter(
        (e): e is Record<string, unknown> =>
          typeof e === 'object' && e !== null && 'event_type' in e
      )
      .map((e) => ({
        scan_id: (e.scan_id as string) ?? null,
        event_type: e.event_type as string,
        field_name: (e.field_name as string) ?? null,
        metadata: (e.metadata as object) ?? null,
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('ux_events').insert(rows)
      if (error) console.error('[events-api]', error.message)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[events-api] parse error:', error)
    return NextResponse.json({ ok: false }, { status: 200 }) // 200 mesmo em erro para não bloquear sendBeacon
  }
}
