import { jsPDF } from 'jspdf'
import { projectSections } from '#shared/types/projects'
import type { ProjectDetail } from '#shared/types/projects'
import { databaseDrawing, parseChartDb, wbsRows } from '#shared/utils/diagrams'
import type { DiagramDrawing, WbsItem } from '#shared/types/diagrams'

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
  const accentColor = [104, 103, 246] as const
  let y = 25

  function font(size: number, bold = false) {
    doc.setFont('PublicSans', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
  }

  function nextPage() {
    doc.addPage()
    doc.setFillColor(...accentColor)
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

  function drawDatabase(drawing: DiagramDrawing, source: string) {
    const scale = Math.min(textWidth / drawing.width, 170 / drawing.height)
    const diagramHeight = drawing.height * scale
    const previousPage = doc.getNumberOfPages()
    ensureSpace(diagramHeight + 8)
    if (doc.getNumberOfPages() !== previousPage) {
      write('Architecture DB — diagramme', 11, true)
      y += 2
    }
    const originY = y
    doc.setDrawColor(...accentColor)
    doc.setLineWidth(0.3)
    for (const edge of drawing.edges) {
      const from = drawing.boxes.find(box => box.id === edge.from)!
      const to = drawing.boxes.find(box => box.id === edge.to)!
      const x1 = margin + (from.x + from.width) * scale
      const x2 = margin + to.x * scale
      const y1 = originY + (from.y + from.height / 2) * scale
      const y2 = originY + (to.y + to.height / 2) * scale
      const middle = (x1 + x2) / 2
      doc.line(x1, y1, middle, y1)
      doc.line(middle, y1, middle, y2)
      doc.line(middle, y2, x2, y2)
    }
    for (const box of drawing.boxes) {
      const x = margin + box.x * scale
      const top = originY + box.y * scale
      doc.setFillColor(245, 245, 255)
      doc.rect(x, top, box.width * scale, box.height * scale, 'FD')
      box.lines.forEach((line, index) => {
        font(13 * scale / 0.352778, index === 0)
        doc.setTextColor(45)
        doc.text(cleanText(line), x + 12 * scale, top + (24 + index * 20) * scale)
      })
    }
    y += diagramHeight + 6
    // Large schemas also get readable details instead of relying on tiny overview labels.
    if (scale < 0.19) {
      const diagram = parseChartDb(source)
      for (const table of diagram.tables) {
        ensureSpace(16)
        write(table.name, 11, true)
        for (const field of table.fields) write(`${field.primaryKey ? 'PK ' : ''}${field.name} : ${field.type}`, 10)
        y += 3
      }
      for (const edge of diagram.relationships) {
        write(`${diagram.tables.find(table => table.id === edge.from)!.name} → ${diagram.tables.find(table => table.id === edge.to)!.name}`, 10)
      }
    }
  }

  function drawWbs(items: WbsItem[]) {
    const parents = new Map<string, { x: number, bottom: number, page: number }>()
    for (const { item, depth, number } of wbsRows(items)) {
      const x = margin + depth * 8
      const boxWidth = textWidth - depth * 8
      font(10)
      const lines = doc.splitTextToSize(cleanText(`${number}. ${item.label}`), boxWidth - 8) as string[]
      const boxHeight = lines.length * 5 + 5
      ensureSpace(boxHeight + 4)
      doc.setDrawColor(...accentColor)
      doc.setLineWidth(0.3)
      const parent = item.parentId ? parents.get(item.parentId) : undefined
      if (parent?.page === doc.getNumberOfPages()) {
        doc.line(parent.x + 2, parent.bottom, parent.x + 2, y + boxHeight / 2)
        doc.line(parent.x + 2, y + boxHeight / 2, x, y + boxHeight / 2)
      }
      doc.setFillColor(245, 245, 255)
      doc.rect(x, y, boxWidth, boxHeight, 'FD')
      font(10)
      doc.setTextColor(45)
      lines.forEach((line, index) => doc.text(line, x + 4, y + 5 + index * 5))
      parents.set(item.id, { x, bottom: y + boxHeight, page: doc.getNumberOfPages() })
      y += boxHeight + 4
    }
  }

  doc.setFillColor(...accentColor)
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
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.4)
  doc.line(margin, y, width - margin, y)
  y += 4

  const filledSections = projectSections.flatMap((section) => {
    const content = cleanText(detail.project.specification[section.key] ?? '')
    const hasDiagram = section.key === 'databaseArchitecture'
      ? !!detail.project.diagrams?.database
      : section.key === 'schedule' && !!detail.project.diagrams?.wbs.length
    return content.trim() || hasDiagram ? [{ ...section, content }] : []
  })
  for (const [index, section] of filledSections.entries()) {
    y += 4
    font(11.5, true)
    const heading = `${index + 1}. ${section.label}`
    const headingLines = doc.splitTextToSize(heading, textWidth - 6) as string[]
    const headingHeight = headingLines.length * 11.5 * 0.352778 * 1.45
    const body = section.content
    const bodySize = 11
    font(bodySize)
    const bodyLines = doc.splitTextToSize(cleanText(body), textWidth) as string[]
    const bodyHeight = bodyLines.length * bodySize * 0.352778 * 1.45
    const wbs = section.key === 'schedule' ? detail.project.diagrams?.wbs ?? [] : []
    const wbsHeight = wbsRows(wbs).reduce((height, { item, depth, number }) => {
      font(10)
      const lines = doc.splitTextToSize(cleanText(`${number}. ${item.label}`), textWidth - depth * 8 - 8) as string[]
      return height + lines.length * 5 + 9
    }, 0)
    const database = section.key === 'databaseArchitecture' ? detail.project.diagrams?.database : null
    const architecture = database && !body.trim() ? databaseDrawing(database) : null
    const architectureHeight = architecture ? Math.min(textWidth / architecture.width, 170 / architecture.height) * architecture.height + 8 : 0
    // Keep short sections together and leave several content lines below longer headings.
    const contentSpace = wbsHeight > 0 && wbsHeight <= 90 && bodyHeight <= 30
      ? bodyHeight + wbsHeight
      : Math.max(Math.min(bodyHeight, 22), wbs.length ? 14 : 0, architectureHeight)
    ensureSpace(headingHeight + 2 + contentSpace)
    doc.setFillColor(245, 245, 255)
    doc.rect(margin, y - 4.5, textWidth, headingHeight + 1.8, 'F')
    doc.setFillColor(...accentColor)
    doc.rect(margin, y - 4.5, 0.8, headingHeight + 1.8, 'F')
    write(heading, 11.5, true, 24, 3)
    y += 2
    if (body.trim()) write(body, bodySize)
    if (section.key === 'databaseArchitecture' && detail.project.diagrams?.database) {
      drawDatabase(databaseDrawing(detail.project.diagrams.database), detail.project.diagrams.database)
    }
    if (section.key === 'schedule' && detail.project.diagrams?.wbs.length) drawWbs(detail.project.diagrams.wbs)
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
