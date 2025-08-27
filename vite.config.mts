// vite.config.mts
import { defineConfig } from 'vite'
import ViteRails from 'vite-plugin-rails'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    ViteRails({
      // If supported by your plugin version; otherwise prefer moving files.
      sourceCodeDir: 'app/javascript',
      entrypointsDir: 'app/javascript/entrypoints',
      fullReload: { additionalPaths: ['config/routes.rb', 'app/views/**/*'], delay: 300 },
      envVars: { RAILS_ENV: 'production' },
      envOptions: { defineOn: 'import.meta.env' },
    }),
    tailwindcss(),
    [react({ fastRefresh: false })],
  ],
})