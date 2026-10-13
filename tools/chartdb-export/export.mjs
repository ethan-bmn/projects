import { readFile } from 'node:fs/promises'
import { parseChartDb } from '../../shared/utils/diagrams.ts'

export async function exportChartDbSvg(browser, source, chartdbUrl) {
  const diagram = parseChartDb(source)
  const context = await browser.newContext({
    locale: 'en-US', colorScheme: 'light', viewport: { width: 1920, height: 1200 }, acceptDownloads: true
  })
  try {
    const origin = new URL(chartdbUrl).origin
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url())
      return url.origin === origin || ['data:', 'blob:'].includes(url.protocol) ? route.continue() : route.abort()
    })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    await page.goto(chartdbUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Import from File', exact: true }).click()
    const imported = JSON.parse(source)
    const expanded = { ...imported, tables: imported.tables.map(table => ({ ...table, expanded: true })) }
    await page.locator('input[type="file"]').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(expanded)) })
    await page.getByRole('dialog').last().getByRole('button', { name: 'Import', exact: true }).click()
    await page.locator('.react-flow__node').nth(diagram.tables.length - 1).waitFor()
    // Native SVG snapshots otherwise retain tight text widths measured on Linux,
    // which can clip labels when the downloaded image uses a different system font.
    await page.locator('.react-flow__node *').evaluateAll((elements) => {
      for (const element of elements) {
        if (!(element instanceof HTMLElement)) continue
        const style = getComputedStyle(element)
        if (style.overflow === 'hidden') element.style.overflow = 'visible'
        if (style.textOverflow === 'ellipsis') element.style.textOverflow = 'clip'
      }
    })
    await page.locator('button').filter({ hasText: /^Actions$/ }).click()
    await page.getByRole('menuitem', { name: 'Export as', exact: true }).hover()
    const download = page.waitForEvent('download', { timeout: 45000 })
    await page.getByRole('menuitem', { name: 'SVG', exact: true }).click()
    const file = await download
    if (await file.failure()) throw new Error('ChartDB SVG download failed')
    const svg = await readFile(await file.path(), 'utf8')
    if (Buffer.byteLength(svg) > 20000000 || !/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(svg) || !svg.includes('</svg>')) {
      throw new Error('ChartDB did not produce a valid SVG image')
    }
    return svg
  } finally {
    await context.close()
  }
}
