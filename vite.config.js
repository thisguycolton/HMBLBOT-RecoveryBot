// filepath: /home/colton/Projects/acid-test/acid-test/vite.config.js
import { defineConfig } from 'vite';
import RubyPlugin from 'vite-plugin-ruby';

export default defineConfig({
  plugins: [
    RubyPlugin(),
  ],
  build: {
    outDir: 'public/assets',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'app/javascript/index.js',
      },
    },
  },
});