import { readFile } from 'node:fs/promises'
import { jsPDF } from 'jspdf'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadProjectPdf, projectPdfFilename, renderProjectPdf } from '../../app/lib/project-pdf'
import type { ProjectDetail } from '../../shared/types/projects'
import { projectInput } from '../helpers/projects'
import { projectDiagrams } from '../helpers/diagrams'

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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([[1400, 1100], [600, 4000]])('fits the native database image within the page for dimensions %i × %i', (width, height) => {
    const doc = new jsPDF()
    const images = vi.spyOn(doc, 'addImage').mockImplementation(() => doc)
    const rectangles = vi.spyOn(doc, 'rect')
    const input = detail()
    input.project.diagrams = projectDiagrams()
    input.project.specification.databaseArchitecture = 'Schéma relationnel.'
    renderProjectPdf(doc, input, fonts, { data: 'native-chartdb-image', width, height })
    expect(images).toHaveBeenCalledOnce()
    const [data, format, x, y, drawnWidth, drawnHeight] = images.mock.calls[0] as unknown as [string, string, number, number, number, number]
    expect([data, format]).toEqual(['native-chartdb-image', 'PNG'])
    expect(drawnWidth / drawnHeight).toBeCloseTo(width / height)
    expect(x).toBeGreaterThanOrEqual(20)
    expect(x + drawnWidth).toBeLessThanOrEqual(doc.internal.pageSize.getWidth() - 20)
    expect(y + drawnHeight).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 25)
    // Only the WBS boxes remain: the database is no longer redrawn.
    expect(rectangles.mock.calls.filter(call => call[4] === 'FD')).toHaveLength(3)
  })

  it('requests the saved native SVG under the app base URL and stops if ChartDB is unavailable', async () => {
    const input = detail()
    input.project.diagrams = projectDiagrams()
    const fetcher = vi.fn(async (url: string) => url.endsWith('.svg')
      ? new Response('Unavailable', { status: 503 })
      : new Response(new Uint8Array([1, 2, 3])))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadProjectPdf(input, '/projects/')).rejects.toThrow('Diagramme SVG indisponible')
    expect(fetcher).toHaveBeenCalledWith('/projects/api/clients/customer/projects/project/database.svg', { method: 'POST' })
  })

  it('does not request ChartDB for projects without a database diagram', async () => {
    const fetcher = vi.fn(async () => new Response('Unavailable', { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(downloadProjectPdf(detail())).rejects.toThrow('Police PDF indisponible')
    expect(fetcher.mock.calls).toHaveLength(2)
  })

  it('keeps complete WBS task groups on a single page and breaks between groups', () => {
    const doc = new jsPDF()
    const pages = new Map<string, number>()
    const original = doc.text.bind(doc)
    vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
      pages.set(String(args[0]), doc.getCurrentPageInfo().pageNumber)
      return original(...args)
    })
    const input = detail()
    input.project.diagrams = { database: null, wbs: Array.from({ length: 4 }, (_, group) => [
      { id: `phase-${group}`, parentId: null, label: `Phase ${group}` },
      ...Array.from({ length: 7 }, (_, task) => ({ id: `${group}-${task}`, parentId: `phase-${group}`, label: `Tâche ${group}-${task}` }))
    ]).flat() }
    renderProjectPdf(doc, input, fonts)
    for (let group = 0; group < 4; group++) {
      for (let task = 0; task < 7; task++) {
        expect(pages.get(`${group + 1}.${task + 1}. Tâche ${group}-${task}`)).toBe(pages.get(`${group + 1}. Phase ${group}`))
      }
    }
    expect(pages.get('1. Phase 0')).not.toBe(pages.get('4. Phase 3'))
  })

  it('repeats nested parents and draws connections on every page of a split WBS group', () => {
    const doc = new jsPDF()
    const labels: { text: string, page: number }[] = []
    const connections: { x1: number, x2: number, page: number }[] = []
    const originalText = doc.text.bind(doc)
    const originalLine = doc.line.bind(doc)
    vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
      labels.push({ text: String(args[0]), page: doc.getCurrentPageInfo().pageNumber })
      return originalText(...args)
    })
    vi.spyOn(doc, 'line').mockImplementation((...args: Parameters<typeof doc.line>) => {
      connections.push({ x1: args[0], x2: args[2], page: doc.getCurrentPageInfo().pageNumber })
      return originalLine(...args)
    })
    const input = detail()
    input.project.diagrams = { database: null, wbs: [
      { id: 'phase', parentId: null, label: 'Phase' },
      { id: 'task', parentId: 'phase', label: 'Travail' },
      ...Array.from({ length: 50 }, (_, index) => ({ id: String(index), parentId: 'task', label: `Sous-tâche ${index}` }))
    ] }
    renderProjectPdf(doc, input, fonts)
    const subtasks = labels.filter(label => /^1\.1\.\d+\. /.test(label.text))
    expect(subtasks).toHaveLength(50)
    const pages = [...new Set(subtasks.map(label => label.page))]
    expect(pages.length).toBeGreaterThan(2)
    for (const page of pages.slice(1)) {
      expect(labels).toContainEqual({ text: '1. Phase (suite)', page })
      expect(labels).toContainEqual({ text: '1.1. Travail (suite)', page })
    }
    for (const page of pages) {
      const taskCount = subtasks.filter(label => label.page === page).length
      expect(connections.filter(line => line.page === page && line.x1 === 30 && line.x2 === 36)).toHaveLength(taskCount)
    }
  })

  it('exports diagram-only sections as vector drawings with readable French labels', () => {
    const doc = new jsPDF()
    const pages = new Map<string, number>()
    const original = doc.text.bind(doc)
    const text = vi.spyOn(doc, 'text').mockImplementation((...args: Parameters<typeof doc.text>) => {
      pages.set(String(args[0]), doc.getCurrentPageInfo().pageNumber)
      return original(...args)
    })
    const rectangles = vi.spyOn(doc, 'rect')
    const input = detail()
    input.project.diagrams = projectDiagrams()
    input.project.specification.databaseArchitecture = null
    input.project.specification.schedule = null
    renderProjectPdf(doc, input, fonts)
    const written = text.mock.calls.map(call => String(call[0])).join('\n')
    for (const label of ['Architecture DB', 'Planning', 'client_id : uuid', '1. Conception', '1.1. Rédiger le cahier des charges', '2. Livraison']) expect(written).toContain(label)
    expect(written).not.toContain('Non renseigné')
    expect(rectangles.mock.calls.filter(call => call[4] === 'FD')).toHaveLength(5)
    expect(pages.get('2. Livraison')).toBe(pages.get('1. Conception'))
  })

  it('paginates large WBS diagrams without losing tasks or drawing text below the footer', () => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    const input = detail()
    input.project.diagrams = { database: null, wbs: Array.from({ length: 100 }, (_, index) => ({ id: String(index), parentId: null, label: `Tâche ${index}` })) }
    renderProjectPdf(doc, input, fonts)
    expect(doc.getNumberOfPages()).toBeGreaterThan(5)
    expect(text.mock.calls.map(call => String(call[0]))).toContain('100. Tâche 99')
    for (const [, , y] of text.mock.calls) expect(y).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 12)
  })

  it('generates a real PDF with every filled section and embedded French glyphs', () => {
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
    for (const heading of ['Contexte métier', 'Contexte technique', 'Objectifs', 'Enjeux', 'Contraintes métiers', 'Contraintes techniques', 'Architecture logicielle', 'Outils et frameworks', 'Planning']) {
      expect(written).toContain(heading)
    }
    expect(written).not.toContain('Non renseigné')
    expect(written).not.toContain('Architecture DB')
    for (const heading of ['Périmètre du projet', 'Parties prenantes', 'Besoins fonctionnels', 'Besoins non fonctionnels', 'Gestion des données', 'Livrables attendus', 'Critères de recette', 'Exploitation et maintenance', 'Nom de domaine(s) ciblé(s)']) {
      expect(written).toContain(heading)
    }
    expect(written).toContain('boutique.example.test')
    expect(input.project.specification.databaseArchitecture).toBeNull()
  })

  it.each([undefined, null, '', ' \n\t ', '\u0000'])('omits empty sections and renumbers headings without changing saved data: %j', (content) => {
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    const input = detail()
    Object.assign(input.project.specification, { businessContext: content })
    const original = structuredClone(input)
    renderProjectPdf(doc, input, fonts)
    const written = text.mock.calls.map(call => String(call[0]))
    expect(written).not.toContain('1. Contexte métier')
    expect(written).toContain('1. Contexte technique')
    expect(written).toContain('2. Objectifs')
    const headings = written.filter(line => /^\d+\. /.test(line))
    expect(headings.map(line => Number.parseInt(line))).toEqual(Array.from({ length: headings.length }, (_, index) => index + 1))
    expect(input).toEqual(original)
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
