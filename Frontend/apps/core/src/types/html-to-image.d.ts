declare module "html-to-image" {
  export interface ToPngOptions {
    backgroundColor?: string
    width?: number
    height?: number
    pixelRatio?: number
    style?: Record<string, string | number>
  }

  export function toPng(node: HTMLElement, options?: ToPngOptions): Promise<string>
}
