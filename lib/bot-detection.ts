/**
 * Detecção básica de bots por User-Agent.
 * Não bloqueia — apenas marca o registro para filtragem no dashboard.
 */

const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baidu/i,
  /duckduckbot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /applebot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /rogerbot/i,
  /exabot/i,
  /python-requests/i,
  /go-http-client/i,
  /curl/i,
  /wget/i,
  /axios/i,
  /node-fetch/i,
  /httpx/i,
  /java\//i,
  /libwww/i,
  /scrapy/i,
  /HeadlessChrome/i,
  /PhantomJS/i,
  /Puppeteer/i,
  /Playwright/i,
]

export function isBot(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim() === '') return true
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent))
}
