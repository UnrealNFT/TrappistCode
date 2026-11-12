import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function wavespeedProxyPlugin(): Plugin {
  return {
    name: 'wavespeed-proxy',
    configureServer(server) {
      server.middlewares.use(
        '/api/wavespeed/chat/completions',
        async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.statusCode = 204
            res.end()
            return
          }

          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }

          try {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(Buffer.from(chunk))
            }
            const body = Buffer.concat(chunks).toString('utf8')
            const auth = req.headers.authorization || ''

            const upstream = await fetch(
              'https://llm.wavespeed.ai/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: auth,
                },
                body,
              }
            )

            const text = await upstream.text()
            res.statusCode = upstream.status
            res.setHeader(
              'Content-Type',
              upstream.headers.get('content-type') || 'application/json'
            )
            res.end(text)
          } catch (err: any) {
            console.error('[wavespeed-proxy]', err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify({ error: err?.message || 'proxy failed' })
            )
          }
        }
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), wavespeedProxyPlugin()],
  server: {
    // ancien proxy gardé en fallback (optionnel)
    proxy: {
      '/wavespeed': {
        target: 'https://llm.wavespeed.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wavespeed/, ''),
        timeout: 300_000,
        proxyTimeout: 300_000,
        headers: {
          Origin: 'https://llm.wavespeed.ai',
        },
      },
    },
  },
})