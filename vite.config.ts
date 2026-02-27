import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readFileSync } from 'fs'

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'serve-audience-page',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/audience/' || req.url === '/audience') {
            const htmlPath = resolve(__dirname, 'pages/audience/index.html')
            let html = readFileSync(htmlPath, 'utf-8')
            html = await server.transformIndexHtml(req.url, html)
            res.setHeader('Content-Type', 'text/html')
            res.end(html)
            return
          }
          next()
        })
      },
    },
  ],
})
