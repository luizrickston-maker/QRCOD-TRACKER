import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isBot } from '@/lib/bot-detection'
import { parseUserAgent } from '@/lib/ua-parser'

// ============================================================
// ROTA CRÍTICA — REDIRECT FAIL-SAFE
// GET /q/[slug]
//
// GARANTIA: O redirect SEMPRE ocorre, mesmo que qualquer
// operação (DB, geolocalização) falhe. Nunca mostra erro ao usuário.
// Target de latência: < 200ms
// ============================================================

interface GeoData {
  city?: string
  region?: string
  country?: string
  countryCode?: string
  lat?: number
  lon?: number
}

function getVercelGeo(headers: Headers): GeoData {
  // Vercel injeta headers de geolocalização automaticamente nas edge functions.
  // São muito mais precisos que ip-api.com porque usam o IP real do cliente.
  const city = headers.get('x-vercel-ip-city') ?? undefined
  const region = headers.get('x-vercel-ip-country-region') ?? undefined
  const country = headers.get('x-vercel-ip-country') ?? undefined
  const lat = headers.get('x-vercel-ip-latitude')
  const lon = headers.get('x-vercel-ip-longitude')

  return {
    city: city ? decodeURIComponent(city) : undefined,
    region: region ? decodeURIComponent(region) : undefined,
    country: undefined, // Vercel dá o código, não o nome completo
    countryCode: country ?? undefined,
    lat: lat ? parseFloat(lat) : undefined,
    lon: lon ? parseFloat(lon) : undefined,
  }
}

async function getGeoDataFallback(ip: string): Promise<GeoData> {
  // Fallback: ip-api.com para dev local ou quando headers Vercel não estão presentes
  const cleanIp = ip.replace('::ffff:', '').split(',')[0].trim()

  // IPs locais não têm geolocalização
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp === 'unknown'
  ) {
    return {}
  }

  const res = await fetch(
    `http://ip-api.com/json/${cleanIp}?fields=status,city,regionName,country,countryCode,lat,lon`,
    { signal: AbortSignal.timeout(1500) }
  )
  const data = await res.json()
  if (data.status !== 'success') return {}

  return {
    city: data.city,
    region: data.regionName,
    country: data.country,
    countryCode: data.countryCode,
    lat: data.lat,
    lon: data.lon,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  // URL de destino — sempre redirecionamos para cá, aconteça o que acontecer
  const destinationUrl = new URL(
    `/questionario/${slug}`,
    process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  )

  // --------------------------------------------------------
  // BLOCO FAIL-SAFE: qualquer erro aqui é silenciado
  // --------------------------------------------------------
  try {
    const headers = request.headers
    const userAgent = headers.get('user-agent') ?? ''
    const referrer = headers.get('referer') ?? headers.get('referrer') ?? ''

    // Captura do IP real (considera proxies/CDN)
    const ip =
      headers.get('x-forwarded-for') ??
      headers.get('x-real-ip') ??
      headers.get('cf-connecting-ip') ?? // Cloudflare
      'unknown'

    const botDetected = isBot(userAgent)
    const parsedUA = parseUserAgent(userAgent)

    // Busca o qr_code_id pelo slug
    const supabase = createServiceClient()

    // Geolocalização: usa headers Vercel (mais precisos) com fallback para ip-api.com
    const vercelGeo = getVercelGeo(headers)
    const hasVercelGeo = !!(vercelGeo.city || vercelGeo.countryCode)

    const [qrResult, geoResult] = await Promise.allSettled([
      supabase
        .from('qr_codes')
        .select('id, is_active')
        .eq('slug', slug)
        .single(),
      botDetected || hasVercelGeo
        ? Promise.resolve(vercelGeo)
        : getGeoDataFallback(ip),
    ])

    const qrCode =
      qrResult.status === 'fulfilled' ? qrResult.value.data : null
    const geo: GeoData =
      geoResult.status === 'fulfilled'
        ? (geoResult.value as GeoData)
        : hasVercelGeo
          ? vercelGeo
          : {}

    if (qrCode) {
      // Insere o scan de forma não-bloqueante (fire-and-forget)
      // Se falhar, o redirect ainda ocorre abaixo
      supabase
        .from('scans')
        .insert({
          qr_code_id: qrCode.id,
          ip: ip.split(',')[0].trim(),
          user_agent: userAgent,
          referrer,
          city: geo.city ?? null,
          region: geo.region ?? null,
          country: geo.country ?? null,
          country_code: geo.countryCode ?? null,
          latitude: geo.lat ?? null,
          longitude: geo.lon ?? null,
          device_type: parsedUA.deviceType,
          browser: parsedUA.browser,
          browser_version: parsedUA.browserVersion,
          os: parsedUA.os,
          os_version: parsedUA.osVersion,
          is_bot: botDetected,
        })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('[scan-insert]', error.message)
        })
    }
  } catch (error) {
    // Log silencioso — nunca propaga para o usuário
    console.error('[redirect-route] Non-fatal error:', error)
  }

  // ============================================================
  // REDIRECT GARANTIDO — executa SEMPRE, independente de qualquer erro acima
  // ============================================================
  return NextResponse.redirect(destinationUrl.toString(), {
    status: 302,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
