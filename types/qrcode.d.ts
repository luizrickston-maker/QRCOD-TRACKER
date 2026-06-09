declare module 'qrcode' {
  export function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    options?: {
      width?: number
      margin?: number
      color?: { dark?: string; light?: string }
    }
  ): Promise<void>

  export function toDataURL(
    text: string,
    options?: {
      width?: number
      margin?: number
      type?: string
    }
  ): Promise<string>
}
