'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UXEvent {
  scan_id?: string
  event_type: 'focus' | 'blur' | 'field_time' | 'rage_click' | 'abandon' | 'submit'
  field_name?: string
  metadata?: Record<string, unknown>
}

const RAGE_CLICK_THRESHOLD = 3
const RAGE_CLICK_WINDOW_MS = 500

export function useUXTracker(scanId: string | null) {
  const eventsQueue = useRef<UXEvent[]>([])
  const fieldFocusTime = useRef<Record<string, number>>({})
  const fieldClickCount = useRef<Record<string, { count: number; lastTime: number }>>({})
  const lastActiveField = useRef<string | null>(null)
  const startTime = useRef(Date.now())

  const flush = useCallback(
    (sync = false) => {
      const events = eventsQueue.current
      if (!events.length) return
      eventsQueue.current = []

      const payload = JSON.stringify(events)

      if (sync && navigator.sendBeacon) {
        navigator.sendBeacon('/api/events', payload)
      } else {
        fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    },
    []
  )

  const track = useCallback(
    (event: UXEvent) => {
      eventsQueue.current.push({ ...event, scan_id: scanId ?? undefined })
      if (eventsQueue.current.length >= 5) flush()
    },
    [scanId, flush]
  )

  // Flush periódico
  useEffect(() => {
    const interval = setInterval(() => flush(), 10_000)
    return () => clearInterval(interval)
  }, [flush])

  // Abandon + beforeunload
  useEffect(() => {
    function handleBeforeUnload() {
      if (lastActiveField.current) {
        track({
          event_type: 'abandon',
          field_name: lastActiveField.current,
          metadata: {
            last_field: lastActiveField.current,
            time_on_page_ms: Date.now() - startTime.current,
          },
        })
      }
      flush(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [track, flush])

  function onFieldFocus(fieldName: string) {
    lastActiveField.current = fieldName
    fieldFocusTime.current[fieldName] = Date.now()
    track({ event_type: 'focus', field_name: fieldName })
  }

  function onFieldBlur(fieldName: string) {
    const focusedAt = fieldFocusTime.current[fieldName]
    if (focusedAt) {
      const duration = Date.now() - focusedAt
      track({
        event_type: 'field_time',
        field_name: fieldName,
        metadata: { duration_ms: duration },
      })
      delete fieldFocusTime.current[fieldName]
    }
    track({ event_type: 'blur', field_name: fieldName })
  }

  function onFieldClick(fieldName: string) {
    const now = Date.now()
    const prev = fieldClickCount.current[fieldName]

    if (prev && now - prev.lastTime < RAGE_CLICK_WINDOW_MS) {
      const count = prev.count + 1
      fieldClickCount.current[fieldName] = { count, lastTime: now }
      if (count >= RAGE_CLICK_THRESHOLD) {
        track({
          event_type: 'rage_click',
          field_name: fieldName,
          metadata: { click_count: count },
        })
      }
    } else {
      fieldClickCount.current[fieldName] = { count: 1, lastTime: now }
    }
  }

  function onSubmit() {
    track({
      event_type: 'submit',
      metadata: { time_to_complete_ms: Date.now() - startTime.current },
    })
    flush()
  }

  return { onFieldFocus, onFieldBlur, onFieldClick, onSubmit }
}
