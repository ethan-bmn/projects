import { readFile } from 'node:fs/promises'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { contractMissingFields, contractSections, createContract, fillContractSection, filledContractSections, validateContract } from '../../shared/utils/contracts'
import { validateProjectInput } from '../../server/services/projects'
import { buildContractPdf, renderContractPdf } from '../../app/lib/contract-pdf'
import type { ProjectDetail } from '../../shared/types/projects'
import { projectInput } from '../helpers/projects'

const fonts = {
  regular: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Regular.ttf', import.meta.url))).toString('base64'),
  bold: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Bold.ttf', import.meta.url))).toString('base64')
}
const client = { id: 'client', abbyId: 'abby', kind: 'organization' as const, name: 'Atelier Éloïse', emails: ['client@example.test'], commercialName: null, billingAddress: null, active: true }

async function detail(): Promise<ProjectDetail> {
  const contract = createContract(client)
  for (const field of contractSections.flatMap(section => section.fields)) contract.fields[field.key] ||= `Valeur ${field.key}`
  const quote = await PDFDocument.create()
  quote.addPage([300, 400])
  quote.addPage([400, 300])
  contract.quote = { name: 'devis.pdf', data: Buffer.from(await quote.save()).toString('base64') }
  return {
    client,
    project: { ...projectInput(), id: 'project', clientId: client.id, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', contract }
  }
}

describe('project contracts', () => {
  it('prefills the complete billing address including complement, postal code, and country', () => {
    const contract = createContract({ ...client, billingAddress: { address: '12 rue du Test', complement: 'Étage 2', city: 'Lyon', zipCode: '69003', state: null, country: 'FR' } })
    expect(filledContractSections(contract)[0]!.body).toContain('12 rue du Test\nÉtage 2\n69003 Lyon\nFR')
  })

  it('keeps repeated placeholders independent for the client, infrastructure provider, and signatures', () => {
    const contract = createContract(client)
    const section = contractSections.find(section => section.title.startsWith('A.1'))!
    const names = section.fields.filter(field => field.token === '[NOM]')
    expect(names).toHaveLength(2)
    contract.fields[names[0]!.key] = 'Client distinct'
    contract.fields[names[1]!.key] = 'Infrastructure distincte'
    const filled = fillContractSection(section, contract)
    expect(filled).toContain('Client : Client distinct')
    expect(filled).toContain('Fournisseur d’infrastructure : Infrastructure distincte')
  })

  it('prefills client data and preserves all template articles and service sections', () => {
    const contract = createContract(client)
    const sections = filledContractSections(contract)
    expect(sections[0]!.body).toContain(client.name)
    expect(sections[0]!.body).toContain(client.emails[0])
    expect(sections.filter(section => section.title.startsWith('Article '))).toHaveLength(15)
    expect(sections.filter(section => /^A\.\d/.test(section.title))).toHaveLength(8)
    expect(sections.some(section => section.title.startsWith('Préambule'))).toBe(true)
    expect(sections.some(section => section.title.startsWith('ANNEXE B'))).toBe(false)
    contract.includeDataProcessing = true
    expect(filledContractSections(contract).at(-1)!.title).toContain('ANNEXE B')
  })

  it('saves incomplete drafts, rejects malformed attachments, and supports explicit removal', async () => {
    expect(validateContract(createContract(client))).toEqual(createContract(client))
    expect(contractMissingFields(createContract(client)).length).toBeGreaterThan(0)
    expect(validateContract(null)).toBeNull()
    const input = await detail()
    expect(validateProjectInput({ ...projectInput(), contract: input.project.contract }).contract).toEqual(input.project.contract)
    expect(validateProjectInput({ ...projectInput(), contract: null }).contract).toBeNull()
    for (const quote of [{ name: 'bad.pdf', data: 'not a PDF' }, { name: 'large.pdf', data: `JVBERi0${'a'.repeat(7_000_000)}` }]) {
      expect(() => validateContract({ ...input.project.contract, quote })).toThrow('devis')
    }
    expect(() => renderContractPdf(new jsPDF(), { ...input, project: { ...input.project, contract: createContract(client) } }, fonts)).toThrow('Complétez')
  })

  it('appends every quote page with its original dimensions after the jsPDF contract', async () => {
    const input = await detail()
    const base = renderContractPdf(new jsPDF(), input, fonts)
    const result = await PDFDocument.load(await buildContractPdf(input, fonts))
    expect(result.getPageCount()).toBe(base.getNumberOfPages() + 2)
    expect(result.getPages().at(-2)!.getSize()).toEqual({ width: 300, height: 400 })
    expect(result.getPages().at(-1)!.getSize()).toEqual({ width: 400, height: 300 })
  })

  it('paginates long filled values and retains the final clauses within page margins', async () => {
    const input = await detail()
    const field = contractSections.find(section => section.title.startsWith('Article 2'))!.fields[0]!
    input.project.contract!.fields[field.key] = Array.from({ length: 200 }, (_, i) => `Ligne ${i}`).join('\n')
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    renderContractPdf(doc, input, fonts)
    const written = text.mock.calls.map(call => String(call[0])).join('\n')
    expect(written).toContain('Ligne 199')
    expect(written).toContain('Article 15 - Acceptation')
    expect(written).not.toMatch(/\[[^\]]+\]/)
    expect(doc.output()).toContain('/FontFile2')
    for (const [, x, y] of text.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(20)
      expect(y).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 12)
    }
  })
})
