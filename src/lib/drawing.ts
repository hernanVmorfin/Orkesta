/** Venue drawings: images are read directly, PDFs go through lib/pdfImport (loaded on demand). */
export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

/** An image file as a data URL with its width ÷ height. */
export function readImageFile(f: File): Promise<{ src: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onerror = () => reject(r.error)
    r.onload = () => {
      const src = r.result as string
      const img = new Image()
      img.onload = () => resolve({ src, aspect: img.width / img.height })
      img.onerror = () => reject(new Error('Not an image'))
      img.src = src
    }
    r.readAsDataURL(f)
  })
}
