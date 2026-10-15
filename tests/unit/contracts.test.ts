import { readFile } from 'node:fs/promises'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { contractExportIssues, contractMissingFields, contractSections, createContract, filledContractSections, upgradeContract, validateContract } from '../../shared/utils/contracts'
import { activeContractVariables } from '../../shared/utils/contract-configuration'
import { validateProjectInput } from '../../server/services/projects'
import { buildContractPdf, renderContractPdf } from '../../app/lib/contract-pdf'
import type { ProjectDetail } from '../../shared/types/projects'
import type { ProjectContract } from '../../shared/types/contracts'
import { projectInput } from '../helpers/projects'
import { auditContract, completeContract, contractClient as client, fullContract } from '../helpers/contracts'

const fonts = {
  regular: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Regular.ttf', import.meta.url))).toString('base64'),
  bold: (await readFile(new URL('../../public/fonts/pdf/PublicSans-Bold.ttf', import.meta.url))).toString('base64')
}

function projectDetail(contract: ProjectContract): ProjectDetail {
  return { client, project: { ...projectInput(), id: 'project', clientId: client.id, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', contract } }
}

async function detail(contract = fullContract()): Promise<ProjectDetail> {
  const quote = await PDFDocument.create()
  quote.addPage([300, 400])
  quote.addPage([400, 300])
  contract.quote = { name: 'devis.pdf', data: Buffer.from(await quote.save()).toString('base64') }
  return projectDetail(contract)
}

const written = (contract: ProjectContract) => filledContractSections(contract).map(section => `${section.title}\n${section.body}`).join('\n')

describe('configured project contracts', () => {
  it('prefills client data and starts with unqualified data processing and no SLA promise', () => {
    const contract = createContract({ ...client, billingAddress: { address: '12 rue du Test', complement: 'Étage 2', city: 'Lyon', zipCode: '69003', state: null, country: 'FR' } })
    expect(contract.version).toBe(2)
    expect(contract.fields['client.adresse']).toBe('12 rue du Test\nÉtage 2\n69003 Lyon\nFR')
    expect(contract.fields['client.nom']).toBe(client.name)
    expect(contract.configuration!.choices['rgpd.sous_traitance']).toBe('A_QUALIFIER')
    expect(contract.configuration!.choices['sla.mode']).toBe('AUCUN_ENGAGEMENT_CHIFFRE')
    expect(contractExportIssues(contract)).toContain('Qualifiez le traitement des données personnelles avant l’export.')
  })

  it('omits operational branches, inactive variables, and annex references for a simple audit', () => {
    const contract = auditContract()
    contract.fields['backups.retentions'] = 'INACTIVE BACKUP COMMITMENT'
    contract.fields['hebergeur.nom'] = 'INACTIVE HOSTING PROVIDER'
    const text = written(contract)
    expect(contractExportIssues(contract)).toEqual([])
    for (const excluded of ['Sauvegardes automatiques', 'Hébergement et infrastructure', 'Sécurité et maintenance', 'Noms de domaine et services tiers', 'Annexe A', 'annexe A', 'INACTIVE', '99.9', '99,9', 'MODE GÉNÉRATEUR', '{{', '[SI']) expect(text).not.toContain(excluded)
    const headings = filledContractSections(contract).filter(section => section.title.startsWith('Article '))
    expect(headings.map(section => Number(section.title.match(/^Article (\d+)/)![1]))).toEqual(headings.map((_, index) => index + 1))
    expect(headings.at(-1)!.title).toContain('Acceptation')
  })

  it('emits selected measures, full backup parameters, and correctly named annexes', () => {
    const contract = fullContract()
    const text = written(contract)
    expect(contractExportIssues(contract)).toEqual([])
    for (const expected of ['15 - Acceptation', 'Pare-feu, MFA administrateur', 'RPO : Non garanti', 'RTO : Non garanti', 'Accusé de réception', 'P1 (service indisponible)', 'Annexe A', 'Annexe B', 'Contrôles', 'Sous-traitants ultérieurs']) expect(text).toContain(expected)
    expect(text).not.toContain('Chiffrement au repos')
    expect(text).not.toContain('RPO : {{')
    expect(text).not.toContain('MODE GÉNÉRATEUR')
    expect(text).not.toMatch(/\{\{[^}]+\}\}|\[[^\]]+\]/)
  })

  it('keeps consumer protections and excludes B2B penalties', () => {
    const contract = auditContract()
    contract.configuration!.choices['client.type'] = 'CONSOMMATEUR'
    contract.configuration!.choices['client.vente'] = 'VENTE_A_DISTANCE'
    completeContract(contract)
    const text = written(contract)
    expect(contractExportIssues(contract)).toEqual([])
    expect(text).toContain('Médiateur de la consommation')
    expect(text).toContain('Vente à distance')
    expect(text).not.toContain('40 €')
    expect(text).not.toContain('pénalités de retard')
    expect(text).not.toContain('SIREN : 123456789')
    contract.configuration!.confirmations.consommateur = false
    expect(contractExportIssues(contract).some(issue => issue.includes('consommateur'))).toBe(true)
  })

  it('requires actual DPA details and relabels the data annex without a technical annex', () => {
    const contract = auditContract()
    contract.configuration!.choices['rgpd.sous_traitance'] = 'OUI'
    completeContract(contract)
    expect(written(contract)).toContain('Annexe A — Accord de traitement')
    expect(written(contract)).toContain('annexe A pour les traitements')
    expect(written(contract)).not.toContain('annexe B')
    contract.fields['rgpd.sous_traitants'] = ''
    expect(contractMissingFields(contract).some(field => field.key === 'rgpd.sous_traitants')).toBe(true)
    expect(validateContract(contract)!.includeDataProcessing).toBe(true)
  })

  it('requires reviewed cession details and blocks undefined rights', () => {
    const contract = fullContract()
    contract.configuration!.choices['droits.mode'] = 'A_DEFINIR'
    expect(contractExportIssues(contract).some(issue => issue.includes('Définissez la licence'))).toBe(true)
    contract.configuration!.choices['droits.mode'] = 'CESSION_SPECIFIQUE'
    completeContract(contract)
    expect(written(contract)).toContain('Annexe C — Cession spécifique')
    expect(written(contract)).toContain('l’annexe C')
    contract.configuration!.confirmations.cession = false
    expect(contractExportIssues(contract).some(issue => issue.includes('validation juridique'))).toBe(true)
  })

  it('requires conditional fields, a defined free-hosting term, and explicit guaranteed RPO/RTO', () => {
    const contract = fullContract()
    const config = contract.configuration!
    config.choices['hebergement.mode'] = 'OFFERT_DUREE_DEFINIE'
    config.choices['backups.rpo.mode'] = 'GARANTI'
    config.choices['backups.rto.mode'] = 'GARANTI'
    const active = activeContractVariables(config).map(field => field.key)
    expect(active).toContain('hebergement.fin')
    expect(active).toContain('backups.rpo')
    expect(active).toContain('backups.rto')
    completeContract(contract)
    expect(contractExportIssues(contract)).toEqual([])
    contract.fields['hebergement.prix'] = '5'
    expect(contractExportIssues(contract)).toContain('Le prix d’un hébergement offert doit être 0.')
    contract.fields['sla.pourcentage'] = '101'
    expect(contractExportIssues(contract).some(issue => issue.includes('disponibilité garantie'))).toBe(true)
  })

  it('blocks contradictory services and unresolved variables before PDF export', () => {
    const contract = fullContract()
    contract.configuration!.choices['hebergement.mode'] = 'NON_INCLUS'
    contract.configuration!.choices['backups.mode'] = 'ABSENTES'
    contract.configuration!.choices['support.mode'] = 'SANS_SUPPORT'
    contract.fields.perimetre = '{{unfinished}}'
    const issues = contractExportIssues(contract)
    for (const text of ['Non inclus', 'Absentes', 'Sans support', 'non résolu']) expect(issues.some(issue => issue.includes(text))).toBe(true)
    expect(() => renderContractPdf(new jsPDF(), projectDetail(contract), fonts)).toThrow('Complétez')
  })

  it('preserves every legacy value and attachment without assuming new choices were reviewed', () => {
    const legacy: ProjectContract = { version: 1, fields: Object.fromEntries(contractSections.flatMap(section => section.fields.map(field => [field.key, `Ancienne valeur ${field.key}`]))), includeDataProcessing: true, quote: { name: 'devis.pdf', data: 'JVBERi0xLjQ=' } }
    const original = structuredClone(legacy)
    const upgraded = upgradeContract(legacy, client)
    expect(upgraded.version).toBe(2)
    expect(upgraded.fields['client.nom']).toBe(legacy.fields['0.0'])
    expect(upgraded.fields['devis.reference']).toBe(legacy.fields['1.0'])
    for (const [key, value] of Object.entries(legacy.fields)) expect(upgraded.fields[key]).toBe(value)
    expect(upgraded.quote).toEqual(legacy.quote)
    expect(upgraded.configuration!.confirmations.coherence).toBe(false)
    expect(contractExportIssues(legacy)).toHaveLength(1)
    expect(validateContract(upgraded)!.fields).toEqual(upgraded.fields)
    expect(legacy).toEqual(original)
  })

  it('saves drafts and validates enum choices and attachments at the API boundary', async () => {
    expect(validateContract(createContract(client))).toEqual(createContract(client))
    expect(validateContract(null)).toBeNull()
    const input = await detail()
    expect(validateProjectInput({ ...projectInput(), contract: input.project.contract }).contract).toEqual(input.project.contract)
    const invalid = structuredClone(input.project.contract!)
    invalid.configuration!.choices['client.type'] = 'UNKNOWN'
    expect(() => validateContract(invalid)).toThrow('Choix invalide')
    invalid.configuration!.choices['client.type'] = 'PRO_ENTREPRISE'
    invalid.configuration!.selections.services = ['UNKNOWN']
    expect(() => validateContract(invalid)).toThrow('Choix invalide')
    for (const quote of [{ name: 'bad.pdf', data: 'not a PDF' }, { name: 'large.pdf', data: `JVBERi0${'a'.repeat(7_000_000)}` }]) expect(() => validateContract({ ...input.project.contract, quote })).toThrow('devis')
  })

  it('renders the snapshot with embedded fonts and appends every quote page unchanged', async () => {
    const input = await detail()
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    renderContractPdf(doc, input, fonts)
    expect(doc.output()).toContain('/FontFile2')
    const output = text.mock.calls.map(call => String(call[0])).join('\n')
    expect(output).toContain('C-2026-001')
    expect(output).not.toContain('MODE GÉNÉRATEUR')
    expect(output).not.toMatch(/\{\{[^}]+\}\}|\[[^\]]+\]/)
    const result = await PDFDocument.load(await buildContractPdf(input, fonts))
    expect(result.getPageCount()).toBe(doc.getNumberOfPages() + 2)
    expect(result.getPages().at(-2)!.getSize()).toEqual({ width: 300, height: 400 })
    expect(result.getPages().at(-1)!.getSize()).toEqual({ width: 400, height: 300 })
  })

  it('paginates long terms without losing final clauses or overflowing margins', async () => {
    const contract = fullContract()
    contract.fields.perimetre = Array.from({ length: 200 }, (_, i) => `Ligne ${i}`).join('\n')
    const input = await detail(contract)
    const doc = new jsPDF()
    const text = vi.spyOn(doc, 'text')
    renderContractPdf(doc, input, fonts)
    const output = text.mock.calls.map(call => String(call[0])).join('\n')
    expect(output).toContain('Ligne 199')
    expect(output).toContain('15 - Acceptation')
    for (const [, x, y] of text.mock.calls) {
      expect(x).toBeGreaterThanOrEqual(20)
      expect(y).toBeLessThanOrEqual(doc.internal.pageSize.getHeight() - 12)
    }
  })
})
