import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Clean config for GitHub Pages (Figma-only plugins removed).
export default defineConfig({
  base: './', // relative paths, works at username.github.io/ANY-REPO-NAME/
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
