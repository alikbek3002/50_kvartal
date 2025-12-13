import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const port = Number(process.env.PORT || 3000)
const distDir = path.join(__dirname, 'dist')

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

function safeJoin(base, targetPath) {
  const target = targetPath.replaceAll('\\', '/')
  const resolved = path.normalize(path.join(base, target))
  if (!resolved.startsWith(base)) return null
  return resolved
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = decodeURIComponent(url.pathname)

    // Serve static assets from dist.
    // SPA fallback: if not found, serve index.html
    const requestPath = pathname === '/' ? '/index.html' : pathname
    const filePath = safeJoin(distDir, requestPath)

    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Bad Request')
      return
    }

    try {
      const ext = path.extname(filePath).toLowerCase()
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      const data = await readFile(filePath)
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(data)
      return
    } catch {
      // If it's not an asset file request, fall back to SPA index.html
      const ext = path.extname(requestPath)
      if (ext) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Not Found')
        return
      }

      const indexHtml = await readFile(path.join(distDir, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(indexHtml)
    }
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Server Error')
    console.error(error)
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Admin app serving ${distDir} on port ${port}`)
})
