// vite.config.mts
import { defineConfig } from 'vite'
import ViteRails from 'vite-plugin-rails'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Icons picked by name (LucideIcon) load one small file per icon, on demand. A file's name
// carries a hash of its content AND of the files it imports, so if those imports point into an
// app chunk, every deploy renames all ~1,600 icon files and a page opened before the deploy
// can't load its icons any more (they just don't show). Keeping React and Lucide's own helpers
// in vendor chunks that only change when those packages do keeps the icon file names stable.
// bin/check-icon-chunks (run by bin/deploy) stops the deploy if that ever stops being true.
function vendorChunk(id) {
  if (!id.includes('node_modules') && !id.includes('commonjsHelpers')) return undefined
  if (id.includes('commonjsHelpers') || /node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react'
  if (/node_modules\/lucide-react\/dist\/esm\/(Icon|createLucideIcon|defaultAttributes|utils|shared\/)/.test(id)) return 'vendor-lucide'
  return undefined
}

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

  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },

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