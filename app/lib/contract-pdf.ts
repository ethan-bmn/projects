import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import type { ProjectDetail } from '#shared/types/projects'
import { contractMissingFields, filledContractSections, validateContract } from '#shared/utils/contracts'
import { loadFont, projectPdfFilename } from './project-pdf'
import type { PdfFonts } from './project-pdf'

export function renderContractPdf(doc: jsPDF, detail: ProjectDetail, fonts: PdfFonts) {
  const contract = validateContract(detail.project.contract)
  if (!contract || contractMissingFields(contract).length || !contract.quote) throw new Error('Complétez tous les champs du contrat et joignez le devis avant l’export.')
  doc.addFileToVFS('PublicSans-Regular.ttf', fonts.regular)
  doc.addFileToVFS('PublicSans-Bold.ttf', fonts.bold)
  doc.addFont('PublicSans-Regular.ttf', 'PublicSans', 'normal')
  doc.addFont('PublicSans-Bold.ttf', 'PublicSans', 'bold')
  doc.setLanguage('fr-FR')
  doc.setProperties({ title: `Contrat - ${detail.project.name}`, author: 'Ethan BAUMANN EI', creator: 'Abby Projects' })
  const width = doc.internal.pageSize.getWidth()
  const height = doc.internal.pageSize.getHeight()
  const margin = 20
  const textWidth = width - margin * 2
  const accent = [104, 103, 246] as const
  let y = 56
  function style(size = 11, bold = false) {
    doc.setFont('PublicSans', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(45)
  }
  function ensureSpace(space: number) {
    if (y + space <= height - 25) return
    doc.addPage()
    doc.setFillColor(...accent)
    doc.rect(margin, 8, textWidth, 12, 'F')
    style(9)
    doc.setTextColor(255)
    doc.text('Contrat de prestation', margin + 4, 15)
    y = 28
  }
  function write(text: string, size = 11, bold = false, inset = 0) {
    style(size, bold)
    const clean = text.replace(/\r\n?/g, '\n').replace(/\p{Cc}/gu, character => character === '\n' ? '\n' : character === '\t' ? '    ' : '')
    const lines = doc.splitTextToSize(clean, textWidth - inset * 2) as string[]
    const lineHeight = size * 0.352778 * 1.45
    for (const line of lines) {
      ensureSpace(lineHeight)
      style(size, bold)
      doc.text(line, margin + inset, y)
      y += lineHeight
    }
  }
  doc.setFillColor(...accent)
  doc.rect(margin, 15, textWidth, 30, 'F')
  style(20, true)
  doc.setTextColor(255)
  doc.text('Contrat de prestation', margin + 4, 32)
  style(10, true)
  doc.setTextColor(255)
  doc.text('Ethan BAUMANN EI', width - margin - 4, 24, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('PublicSans', 'normal')
  for (const [index, line] of ['SIREN : 130584659', '+33667739428', 'contact@ethanbaumann.fr'].entries()) {
    doc.text(line, width - margin - 4, 29 + index * 5, { align: 'right' })
  }
  write(detail.project.name, 16, true)
  y += 3
  write('Réalisation et hébergement d’application web', 11, true)
  y += 5
  for (const section of filledContractSections(contract)) {
    style(11.5, true)
    const lines = doc.splitTextToSize(section.title, textWidth - 6) as string[]
    const headingHeight = lines.length * 11.5 * 0.352778 * 1.45
    ensureSpace(headingHeight + 20)
    doc.setFillColor(245, 245, 255)
    doc.rect(margin, y - 4.5, textWidth, headingHeight + 1.8, 'F')
    doc.setFillColor(...accent)
    doc.rect(margin, y - 4.5, 0.8, headingHeight + 1.8, 'F')
    write(section.title, 11.5, true, 3)
    y += 3
    if (section.body) write(section.body)
    y += 6
    if (section.title.startsWith('Article 15')) y += 20
  }
  const pages = doc.getNumberOfPages()
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page)
    doc.setDrawColor(210)
    doc.setLineWidth(0.2)
    doc.line(margin, height - 20, width - margin, height - 20)
    style(9)
    doc.setTextColor(100)
    doc.text('Ethan BAUMANN EI', margin, height - 12)
    doc.text(`Page ${page} / ${pages} · Devis joint en annexe`, width - margin, height - 12, { align: 'right' })
  }
  return doc
}

export async function buildContractPdf(detail: ProjectDetail, fonts: PdfFonts) {
  const doc = renderContractPdf(new jsPDF({ unit: 'mm', format: 'a4', compress: true }), detail, fonts)
  const result = await PDFDocument.load(doc.output('arraybuffer'))
  const quote = detail.project.contract!.quote!
  const attachment = await PDFDocument.load(Uint8Array.from(atob(quote.data), character => character.charCodeAt(0)))
  if (!attachment.getPageCount()) throw new Error('Le devis PDF est vide.')
  for (const page of await result.copyPages(attachment, attachment.getPageIndices())) result.addPage(page)
  return result.save()
}

export async function downloadContractPdf(detail: ProjectDetail, baseUrl = '/') {
  const path = `${baseUrl.replace(/\/?$/, '/')}fonts/pdf/`
  const [regular, bold] = await Promise.all([loadFont(`${path}PublicSans-Regular.ttf`), loadFont(`${path}PublicSans-Bold.ttf`)])
  const bytes = await buildContractPdf(detail, { regular, bold })
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = projectPdfFilename(detail.project.name).replace('cahier-des-charges-', 'contrat-')
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
