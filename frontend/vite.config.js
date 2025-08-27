import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
plugins: [react()],
optimizeDeps: {
include: ['cropperjs']
},
esbuild: {
// Production build me console/debugger drop
drop: mode === 'production' ? ['console', 'debugger'] : []
}
}));