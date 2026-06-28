import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { LIMITS, asUuid, clampString } from '@/lib/validation'

const VALID_EVENT_TYPES = new Set([
  'focus', 'blur', 'field_time', 'rage_click', 'abandon', 'submit',
])

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

    const events = (Array.isArray(body) ? body : [body]).slice(0, LIMITS.MAX_EVENTS)
    const supabase = createServiceClient()

    const rows = events
      .filter(
        (e): e is Record<string, unknown> =>
          typeof e === 'object' && e !== null && 'event_type' in e &&
          VALID_EVENT_TYPES.has((e as Record<string, unknown>).event_type as string)
      )
      .map((e) => ({
        scan_id: asUuid(e.scan_id),
        event_type: e.event_type as string,
        field_name: e.field_name ? clampString(e.field_name, LIMITS.MAX_FIELD_NAME_LEN) : null,
        metadata:
          e.metadata && typeof e.metadata === 'object' ? (e.metadata as object) : null,
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
