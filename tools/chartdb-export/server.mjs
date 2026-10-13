import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { exportChartDbSvg } from './export.mjs'

const browser = await chromium.launch({ args: ['--disable-dev-shm-usage'] })
let busy = false
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  if (request.method === 'GET' && request.url === '/health') {
    response.end('ok')
    return
  }
  if (request.method !== 'POST' || request.url !== '/export') {
    response.writeHead(404).end()
    return
  }
  if (busy) {
    response.writeHead(429).end('Export already in progress')
    return
  }
  busy = true
  try {
    let bytes = 0
    const chunks = []
    for await (const chunk of request) {
      bytes += chunk.length
      if (bytes > 2000000) {
        response.writeHead(413).end('Diagram too large')
        return
      }
      chunks.push(chunk)
    }
    const { source } = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (typeof source !== 'string') {
      response.writeHead(400).end('Invalid diagram')
      return
    }
    const svg = await exportChartDbSvg(browser, source, process.env.CHARTDB_URL || 'http://chartdb')
    response.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' }).end(svg)
  } catch (error) {
    console.error('ChartDB SVG export failed:', error instanceof Error ? error.message : 'Unknown error')
    response.writeHead(503).end('ChartDB SVG export failed')
  } finally {
    busy = false
  }
})
server.requestTimeout = 90000
server.listen(8081, '0.0.0.0')
async function close() {
  server.close()
  await browser.close()
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
