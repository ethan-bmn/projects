import { jsPDF } from 'jspdf'
import { projectSections } from '#shared/types/projects'
import type { ProjectDetail } from '#shared/types/projects'
import { databaseDrawing, parseChartDb, wbsRows } from '#shared/utils/diagrams'
import type { DiagramDrawing, WbsItem } from '#shared/types/diagrams'

export interface PdfFonts {
  regular: string
  bold: string
}

export interface PdfDatabaseImage {
  data: string
  width: number
  height: number
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

export function renderProjectPdf(doc: jsPDF, detail: ProjectDetail, fonts: PdfFonts, databaseImage?: PdfDatabaseImage) {
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
    const dimensions = databaseImage ?? drawing
    const scale = Math.min(textWidth / dimensions.width, 170 / dimensions.height)
    const diagramHeight = dimensions.height * scale
    const previousPage = doc.getNumberOfPages()
    ensureSpace(diagramHeight + 8)
    if (doc.getNumberOfPages() !== previousPage) {
      write('Architecture DB — diagramme', 11, true)
      y += 2
    }
    const originY = y
    if (databaseImage) {
      const diagramWidth = dimensions.width * scale
      doc.addImage(databaseImage.data, 'PNG', margin + (textWidth - diagramWidth) / 2, originY, diagramWidth, diagramHeight)
    } else {
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
    }
    y += diagramHeight + 6
    // Large schemas also get readable details instead of relying on tiny overview labels.
    if (Math.min(textWidth / drawing.width, 170 / drawing.height) < 0.19) {
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
    function layout(row: ReturnType<typeof wbsRows>[number], continued = false) {
      font(10)
      const lines = doc.splitTextToSize(cleanText(`${row.number}. ${row.item.label}${continued ? ' (suite)' : ''}`), textWidth - row.depth * 8 - 8) as string[]
      return { ...row, lines, boxHeight: lines.length * 5 + 5 }
    }
    const rows = wbsRows(items).map(row => layout(row))
    const byId = new Map(rows.map(row => [row.item.id, row]))
    const subtreeHeights = new Map(rows.map(row => [row.item.id, row.boxHeight + 4]))
    for (const row of rows.toReversed()) {
      if (row.item.parentId) {
        subtreeHeights.set(row.item.parentId, subtreeHeights.get(row.item.parentId)! + subtreeHeights.get(row.item.id)!)
      }
    }

    function drawRow({ item, depth, lines, boxHeight }: typeof rows[number]) {
      const x = margin + depth * 8
      const boxWidth = textWidth - depth * 8
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

    for (const [index, row] of rows.entries()) {
      const ancestors: typeof rows = []
      let parentId = row.item.parentId
      while (parentId) {
        const parent = byId.get(parentId)!
        ancestors.unshift(layout(parent, true))
        parentId = parent.item.parentId
      }
      const contextHeight = ancestors.reduce((total, parent) => total + parent.boxHeight + 4, 0)
      const subtreeHeight = subtreeHeights.get(row.item.id)!
      const child = rows[index + 1]
      const firstRowsHeight = row.boxHeight + 4 + (child?.item.parentId === row.item.id ? child.boxHeight + 4 : 0)
      // Move a complete task group when it fits; otherwise keep the first child with its parent.
      const space = subtreeHeight + contextHeight <= bottom - 28 ? subtreeHeight : firstRowsHeight
      if (y + space > bottom) {
        nextPage()
        // Repeat the ancestor chain so every subtask still has a visible connection.
        for (const parent of ancestors) drawRow(parent)
      }
      drawRow(row)
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
    const planningRows = wbsRows(wbs)
    const taskHeights = planningRows.map(({ item, depth, number }) => {
      font(10)
      const lines = doc.splitTextToSize(cleanText(`${number}. ${item.label}`), textWidth - depth * 8 - 8) as string[]
      return lines.length * 5 + 9
    })
    const wbsHeight = taskHeights.reduce((total, height) => total + height, 0)
    const nextRoot = planningRows.findIndex((row, index) => index > 0 && row.depth === 0)
    const firstGroupHeight = taskHeights.slice(0, nextRoot < 0 ? taskHeights.length : nextRoot).reduce((total, height) => total + height, 0)
    const wbsStartHeight = firstGroupHeight + headingHeight + 2 <= bottom - 28
      ? firstGroupHeight
      : (taskHeights[0] ?? 0) + (planningRows[1]?.depth === 1 ? taskHeights[1]! : 0)
    const database = section.key === 'databaseArchitecture' ? detail.project.diagrams?.database : null
    const architecture = database && !body.trim() ? databaseDrawing(database) : null
    const architectureDimensions = architecture ? databaseImage ?? architecture : null
    const architectureHeight = architectureDimensions ? Math.min(textWidth / architectureDimensions.width, 170 / architectureDimensions.height) * architectureDimensions.height + 8 : 0
    // Keep short sections together and leave several content lines below longer headings.
    const contentSpace = wbsHeight > 0 && wbsHeight <= 90 && bodyHeight <= 30
      ? bodyHeight + wbsHeight
      : Math.max(Math.min(bodyHeight, 22), wbs.length ? wbsStartHeight + Math.min(bodyHeight, 30) : 0, architectureHeight)
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
  const basePath = baseUrl.replace(/\/?$/, '/')
  const fontPath = `${basePath}fonts/pdf/`
  const [regular, bold, databaseImage] = await Promise.all([
    loadFont(`${fontPath}PublicSans-Regular.ttf`), loadFont(`${fontPath}PublicSans-Bold.ttf`),
    detail.project.diagrams?.database ? loadDatabaseImage(detail, basePath) : undefined
  ])
  const doc = renderProjectPdf(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), detail, { regular, bold }, databaseImage)
  await doc.save(projectPdfFilename(detail.project.name), { returnPromise: true })
}

async function loadDatabaseImage(detail: ProjectDetail, basePath: string): Promise<PdfDatabaseImage> {
  const response = await fetch(`${basePath}api/clients/${encodeURIComponent(detail.client.id)}/projects/${encodeURIComponent(detail.project.id)}/database.svg`, { method: 'POST' })
  if (!response.ok) throw new Error('Diagramme SVG indisponible. Vérifiez que les services Docker ChartDB sont démarrés.')
  const svg = await response.text()
  const image = new Image()
  // A data URL keeps ChartDB's embedded HTML labels usable on a canvas.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await image.decode()
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Dimensions du diagramme SVG invalides')
  // Preserve detail at print resolution while bounding memory for large schemas.
  const scale = Math.min(2, 4096 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Impossible de dessiner le diagramme SVG')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  // ChartDB exports the surrounding workspace too; trim its blank padding for print.
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  let left = canvas.width
  let top = canvas.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const offset = (y * canvas.width + x) * 4
      if (pixels[offset]! < 250 || pixels[offset + 1]! < 250 || pixels[offset + 2]! < 250) {
        left = Math.min(left, x)
        top = Math.min(top, y)
        right = Math.max(right, x)
        bottom = Math.max(bottom, y)
      }
    }
  }
  if (right < left) throw new Error('Le diagramme SVG est vide')
  const padding = Math.ceil(12 * scale)
  left = Math.max(0, left - padding)
  top = Math.max(0, top - padding)
  right = Math.min(canvas.width - 1, right + padding)
  bottom = Math.min(canvas.height - 1, bottom + padding)
  const cropped = document.createElement('canvas')
  cropped.width = right - left + 1
  cropped.height = bottom - top + 1
  const croppedContext = cropped.getContext('2d')
  if (!croppedContext) throw new Error('Impossible de dessiner le diagramme SVG')
  croppedContext.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
  return { data: cropped.toDataURL('image/png'), width: cropped.width, height: cropped.height }
}
