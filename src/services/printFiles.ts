/** PNG physical resolution chunk: 300 DPI is stored as pixels/metre for print software. */
export async function withPrintDpi(blob: Blob, dpi = 300): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const type = new TextEncoder().encode('pHYs'); const payload = new Uint8Array(13); payload.set(type)
  const view = new DataView(payload.buffer); const ppm = Math.round(dpi / 0.0254)
  view.setUint32(4, ppm); view.setUint32(8, ppm); payload[12] = 1
  let crc = 0xffffffff
  for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0) }
  const chunk = new Uint8Array(21); new DataView(chunk.buffer).setUint32(0, 9); chunk.set(payload, 4); new DataView(chunk.buffer).setUint32(17, (crc ^ 0xffffffff) >>> 0)
  const chunks: BlobPart[] = [bytes.slice(0, 33), chunk]
  const originalView = new DataView(bytes.buffer); let position = 33
  while (position < bytes.length) { const length = originalView.getUint32(position); const end = position + 12 + length; const name = new TextDecoder().decode(bytes.slice(position + 4, position + 8)); if (name !== 'pHYs') chunks.push(bytes.slice(position, end)); position = end }
  return new Blob(chunks, {type:'image/png'})
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
}
export function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value)) }
