// vite.config.mts
import { defineConfig } from 'vite'
import ViteRails from 'vite-plugin-rails'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    ViteRails({
      sourceCodeDir: 'app/javascript',
      entrypointsDir: 'app/javascript/entrypoints',
      fullReload: {
        additionalPaths: ['config/routes.rb', 'app/views/**/*'],
        delay: 300,
      },
      envVars: { RAILS_ENV: 'production' },
      envOptions: { defineOn: 'import.meta.env' },
    }),
    tailwindcss(),
    react({ fastRefresh: false }),
  ],

  server: {
    host: '127.0.0.1',
    port: 3036,

    hmr: {
      host: '127.0.0.1',
      port: 3036,
      protocol: 'ws',
    },
  },
})