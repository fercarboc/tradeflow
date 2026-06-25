import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
            if (id.includes('@supabase/')) return 'vendor-supabase';
            if (id.includes('/docx/') || id.includes('/file-saver/') || id.includes('/pizzip/') || id.includes('/jszip/')) return 'vendor-docx';
            if (id.includes('/lucide-react/')) return 'vendor-lucide';
            if (id.includes('@stripe/')) return 'vendor-stripe';
            if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('/victory')) return 'vendor-charts';
            if (id.includes('/motion/') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('/xlsx/') || id.includes('sheetjs')) return 'vendor-xlsx';
            return 'vendor';
          },
        },
      },
    },
  };
});
