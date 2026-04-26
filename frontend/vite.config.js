import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'charts';
          }

          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'maps';
          }

          if (id.includes('three') || id.includes('@react-three')) {
            return 'three';
          }

          if (id.includes('gsap') || id.includes('motion')) {
            return 'animations';
          }
        },
      },
    },
  },
})
