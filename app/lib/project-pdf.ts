import { jsPDF } from 'jspdf'
import { projectSections } from '#shared/types/projects'
import type { ProjectDetail } from '#shared/types/projects'

export interface PdfFonts {
  regular: string
  bold: string
}

function cleanText(value: string) {
  return value.replace(/\r\n?/g, '\n').replace(/\p{Cc}/gu, character => character === '\n' ? '\n' : character === '\t' ? '    ' : '')
}

export function projectPdfFilename(name: string) {
  const slug = name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `cahier-des-charges-${Array.from(slug || 'projet').slice(0, 80).join('')}.pdf`
}

export function renderProjectPdf(doc: jsPDF, detail: ProjectDetail, fonts: PdfFonts) {
  doc.addFileToVFS('PublicSans-Regular.ttf', fonts.regular)
  doc.addFileToVFS('PublicSans-Bold.ttf', fonts.bold)
  doc.addFont('PublicSans-Regular.ttf', 'PublicSans', 'normal')
  doc.addFont('PublicSans-Bold.ttf', 'PublicSans', 'bold')
  doc.setLanguage('fr-FR')
  doc.setProperties({ title: `Cahier des charges - ${cleanText(detail.project.name)}`, subject: `Client : ${cleanText(detail.client.name)}`, creator: 'Abby Projects' })

  const margin = 20
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const textWidth = width - margin * 2
  const bottom = height - 25
  let y = 25

  function font(size: number, bold = false) {
    doc.setFont('PublicSans', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
  }

  function nextPage() {
    doc.addPage()
    font(9)
    doc.setTextColor(100)
    doc.text('Cahier des charges', margin, 15)
    y = 28
  }

  function ensureSpace(space: number) {
    if (y + space > bottom) nextPage()
  }

  function write(value: string, size = 11, bold = false, color = 45) {
    font(size, bold)
    const lines = doc.splitTextToSize(cleanText(value), textWidth) as string[]
    const lineHeight = size * 0.352778 * 1.45
    for (const line of lines) {
      ensureSpace(lineHeight)
      // A new page changes the header font, so restore the current text style.
      font(size, bold)
      doc.setTextColor(color)
      doc.text(line, margin, y)
      y += lineHeight
    }
  }

  write('Cahier des charges', 22, true, 24)
  y += 3
  write(detail.project.name, 16, true, 24)
  y += 4
  write(`Client : ${detail.client.name}`)
  write(detail.client.kind === 'organization' ? 'Entreprise' : 'Particulier', 10, false, 100)
  const updated = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(detail.project.updatedAt))
  write(`Mis à jour le ${updated}`, 10, false, 100)

  for (const [index, section] of projectSections.entries()) {
    y += 7
    font(12, true)
    const heading = `${index + 1}. ${section.label}`
    const headingLines = doc.splitTextToSize(heading, textWidth) as string[]
    ensureSpace(headingLines.length * 12 * 0.352778 * 1.45 + 2 + 11 * 0.352778 * 1.45)
    write(heading, 12, true, 24)
    y += 2
    write(detail.project.specification[section.key] || 'Non renseigné (optionnel).')
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(210)
    doc.setLineWidth(0.2)
    doc.line(margin, height - 20, width - margin, height - 20)
    font(9)
    doc.setTextColor(100)
    doc.text(`Page ${page} / ${pages}`, width - margin, height - 12, { align: 'right' })
  }
  return doc
}

async function loadFont(url: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Police PDF indisponible')
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

export async function downloadProjectPdf(detail: ProjectDetail, baseUrl = '/') {
  const fontPath = `${baseUrl.replace(/\/?$/, '/')}fonts/pdf/`
  const [regular, bold] = await Promise.all([
    loadFont(`${fontPath}PublicSans-Regular.ttf`), loadFont(`${fontPath}PublicSans-Bold.ttf`)
  ])
  const doc = renderProjectPdf(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), detail, { regular, bold })
  await doc.save(projectPdfFilename(detail.project.name), { returnPromise: true })
}
