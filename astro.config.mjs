// @ts-check
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * Aceita "/", "renportal" ou "/renportal/" e devolve o base do Astro
 * com barras nas pontas. GitHub Pages de repositório usa /nome-do-repo/.
 * @param {string | undefined} input
 */
function normalizeBase(input) {
  // Ausente: GitHub Pages do repositório renportal.
  // "/" explícito: site na raiz (preview local sem subpath).
  if (input === undefined || input === '') return '/renportal/'
  if (input === '/' || input === '.') return '/'
  const trimmed = input.trim().replace(/^\.?\/*/, '').replace(/\/+$/, '')
  if (!trimmed) return '/'
  return `/${trimmed}/`
}

const site = process.env.PUBLIC_SITE_URL?.trim() || 'https://rodrigomiquilino.github.io'

export default defineConfig({
  output: 'static',
  site,
  base: normalizeBase(process.env.PUBLIC_BASE_PATH),
  trailingSlash: 'always',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(root, 'src'),
      },
    },
  },
})
