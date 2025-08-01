
declare module 'colorthief' {
  export function getColor(source: Buffer | string | HTMLImageElement | HTMLCanvasElement, quality?: number): Promise<[number, number, number]>;
  export function getPalette(source: Buffer | string | HTMLImageElement | HTMLCanvasElement, colorCount?: number, quality?: number): Promise<[number, number, number][]>;
}
