import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Subpath base for GitHub Pages (/route-distance-calculator/); root in dev.
  base: process.env.NODE_ENV === 'production' ? '/route-distance-calculator/' : '/',
  plugins: [react()],
})