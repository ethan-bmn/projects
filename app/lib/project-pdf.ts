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
  doc.setProperties({ title: `Cahier des charges - ${cleanText(detail.project.name)}`, subject: `Client : ${cleanText(detail.client.name)}`, author: 'Ethan BAUMANN EI', creator: 'Abby Projects' })

  const margin = 20
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const textWidth = width - margin * 2
  const bottom = height - 25
  const headerBlue = [43, 111, 174] as const
  let y = 25

  function font(size: number, bold = false) {
    doc.setFont('PublicSans', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
  }

  function nextPage() {
    doc.addPage()
    doc.setFillColor(...headerBlue)
    doc.rect(margin, 8, textWidth, 12, 'F')
    font(9)
    doc.setTextColor(255)
    doc.text('Cahier des charges', margin + 4, 15)
    const name = doc.splitTextToSize(cleanText(detail.project.name), textWidth / 2 - 8) as string[]
    doc.text(name[0] ?? '', width - margin - 4, 15, { align: 'right' })
    y = 28
  }

  function ensureSpace(space: number) {
    if (y + space > bottom) nextPage()
  }

  function write(value: string, size = 11, bold = false, color = 45, inset = 0) {
    font(size, bold)
    const lines = doc.splitTextToSize(cleanText(value), textWidth - inset * 2) as string[]
    const lineHeight = size * 0.352778 * 1.45
    for (const line of lines) {
      ensureSpace(lineHeight)
      // A new page changes the header font, so restore the current text style.
      font(size, bold)
      doc.setTextColor(color)
      doc.text(line, margin + inset, y)
      y += lineHeight
    }
  }

  doc.setFillColor(...headerBlue)
  doc.rect(margin, 15, textWidth, 30, 'F')
  font(20, true)
  doc.setTextColor(255)
  doc.text('Cahier des charges', margin + 4, 32)
  font(10, true)
  doc.text('Ethan BAUMANN EI', width - margin - 4, 24, { align: 'right' })
  font(9)
  for (const [index, line] of ['SIREN : 130584659', '+33667739428', 'contact@ethanbaumann.fr'].entries()) {
    doc.text(line, width - margin - 4, 29 + index * 5, { align: 'right' })
  }
  y = 56
  write(detail.project.name, 16, true, 24)
  y += 4
  write(`Client : ${detail.client.name}`)
  write(detail.client.kind === 'organization' ? 'Entreprise' : 'Particulier', 10, false, 100)
  const updated = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date(detail.project.updatedAt))
  write(`Mis à jour le ${updated}`, 10, false, 100)
  y += 2
  doc.setDrawColor(...headerBlue)
  doc.setLineWidth(0.4)
  doc.line(margin, y, width - margin, y)
  y += 4

  for (const [index, section] of projectSections.entries()) {
    y += 4
    font(11.5, true)
    const heading = `${index + 1}. ${section.label}`
    const headingLines = doc.splitTextToSize(heading, textWidth - 6) as string[]
    const headingHeight = headingLines.length * 11.5 * 0.352778 * 1.45
    const content = detail.project.specification[section.key]
    const body = content || 'Non renseigné (optionnel).'
    const bodySize = content ? 11 : 10
    font(bodySize)
    const bodyLines = doc.splitTextToSize(cleanText(body), textWidth) as string[]
    const bodyHeight = bodyLines.length * bodySize * 0.352778 * 1.45
    // Keep short sections together and leave several content lines below longer headings.
    ensureSpace(headingHeight + 2 + Math.min(bodyHeight, 22))
    doc.setFillColor(239, 245, 250)
    doc.rect(margin, y - 4.5, textWidth, headingHeight + 1.8, 'F')
    doc.setFillColor(...headerBlue)
    doc.rect(margin, y - 4.5, 0.8, headingHeight + 1.8, 'F')
    write(heading, 11.5, true, 24, 3)
    y += 2
    write(body, bodySize, false, content ? 45 : 110)
  }

  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(210)
    doc.setLineWidth(0.2)
    doc.line(margin, height - 20, width - margin, height - 20)
    font(9)
    doc.setTextColor(100)
    doc.text('Ethan BAUMANN EI', margin, height - 12)
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
