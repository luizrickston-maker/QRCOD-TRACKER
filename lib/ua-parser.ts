import { UAParser } from 'ua-parser-js'

export interface ParsedUA {
  browser: string
  browserVersion: string
  os: string
  osVersion: string
  deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown'
}

export function parseUserAgent(userAgent: string | null): ParsedUA {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      deviceType: 'unknown',
    }
  }

  const parser = new UAParser(userAgent)
  const result = parser.getResult()

  let deviceType: ParsedUA['deviceType'] = 'desktop'
  const deviceKind = result.device.type
  if (deviceKind === 'mobile') deviceType = 'mobile'
  else if (deviceKind === 'tablet') deviceType = 'tablet'
  else if (!deviceKind) deviceType = 'desktop'
  else deviceType = 'unknown'

  return {
    browser: result.browser.name ?? 'Unknown',
    browserVersion: result.browser.version ?? '',
    os: result.os.name ?? 'Unknown',
    osVersion: result.os.version ?? '',
    deviceType,
  }
}
