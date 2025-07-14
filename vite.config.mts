import { defineConfig } from 'vite';
import ViteRails from "vite-plugin-rails";
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";


export default defineConfig({
  plugins: [
    ViteRails({
      envVars: { RAILS_ENV: "production" },
      envOptions: { defineOn: "import.meta.env" },
      fullReload: {
        additionalPaths: ["config/routes.rb", "app/views/**/*"],
        delay: 300,
      },
    }),
    tailwindcss(),
    react(),
  ],
  build: {
    outDir: 'public/vite',
    emptyOutDir: true,
  },
});