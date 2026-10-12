import { readFile } from 'node:fs/promises'
import { jsPDF } from 'jspdf'
import { describe, expect, it, vi } from 'vitest'
import { projectPdfFilename, renderProjectPdf } from '../../app/lib/project-pdf'
import type { ProjectDetail } from '../../shared/types/projects'
import { projectInput } from '../helpers/projects'

const fonts = {
  regular: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Regular.ttf', import.meta.url))).toString('base64'),
  bold: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Bold.ttf', import.meta.url))).toString('base64')
}

function detail(): ProjectDetail {
  return {
    client: { id: 'customer', abbyId: 'abby-person', kind: 'individual', name: 'Éloïse Cœur', emails: [], commercialName: null, active: true },
    project: { ...projectInput('Création d’une œuvre'), id: 'project', clientId: 'customer', createdAt: '2026-10-12T08:00:00Z', updatedAt: '2026-10-12T08:00:00Z' }
  }
}

describe('project PDF export', () => {
  it('generates a real PDF with every section and embedded French glyphs', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    const input = detail()
    renderProjectPdf(doc, input, fonts)
    const output = doc.output()
    const written = text.mock.calls.map(call => String(call[0])).join('\n')
    expect(output).toMatch(/^%PDF-/)
    expect(output).toContain('/FontFile2')
    expect(output).toContain('/ToUnicode')
    for (const businessDetail of ['Ethan BAUMANN EI', 'SIREN : 130584659', '+33667739428', 'contact@ethanbaumann.fr']) {
      expect(written).toContain(businessDetail)
    }
    expect(written).toContain('Éloïse Cœur')
    expect(written).toContain('Création d’une œuvre')
    for (const heading of ['Contexte métier', 'Contexte technique', 'Objectifs', 'Enjeux', 'Contraintes métiers', 'Contraintes techniques', 'Architecture logicielle', 'Architecture DB', 'Outils et frameworks', 'Planning']) {
      expect(written).toContain(heading)
    }
    expect(written).toContain('Non renseigné (optionnel).')
    expect(input.project.specification.databaseArchitecture).toBeNull()
  })

  it('paginates long specifications without dropping text or drawing beyond page margins', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    const input = detail()
    input.project.specification.objectives = Array.from({ length: 300 }, (_, index) => `Objectif ${index} : préserver la qualité de l’expérience.`).join('\n')
    input.project.specification.schedule = 'Dernière étape : livraison définitive.'
    renderProjectPdf(doc, input, fonts)
    expect(doc.getNumberOfPages()).toBeGreaterThan(5)
    const written = text.mock.calls.map(call => String(call[0])).join('\n')
    expect(written).toContain('Objectif 0 :')
    expect(written).toContain('Objectif 299 :')
    expect(written).toContain('Dernière étape : livraison définitive.')
    expect(written).toContain(`Page ${doc.getNumberOfPages()} / ${doc.getNumberOfPages()}`)
    for (const [, x, y] of text.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(20)
      expect(x).toBeLessThanOrEqual(doc.internal.pageSize.getWidth() - 20)
      expect(y).toBeGreaterThanOrEqual(12)
      expect(y).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 12)
    }
  })

  it('wraps long unbroken names and keeps section headings with their first content line', () => {
    const doc = new jsPDF()
    const calls: { text: string, page: number }[] = []
    const original = doc.text.bind(doc)
    vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
      calls.push({ text: String(args[0]), page: doc.getCurrentPageInfo().pageNumber })
      return original(...args)
    })
    const input = detail()
    input.project.name = 'LongName'.repeat(25)
    input.project.specification.businessContext = 'Contexte\n'.repeat(40)
    renderProjectPdf(doc, input, fonts)
    const headingIndex = calls.findIndex(item => item.text === '2. Contexte technique')
    expect(headingIndex).toBeGreaterThan(0)
    expect(calls[headingIndex]!.page).toBe(calls[headingIndex + 1]!.page)
  })

  it('creates safe readable filenames', () => {
    expect(projectPdfFilename('../Été : œuvre / devis?')).toBe('cahier-des-charges-ete-oeuvre-devis.pdf')
    expect(projectPdfFilename(' / : ? ')).toBe('cahier-des-charges-projet.pdf')
    expect(projectPdfFilename('a'.repeat(200))).toBe(`cahier-des-charges-${'a'.repeat(80)}.pdf`)
  })
})
