import { defineConfig } from 'vite';
import { randomUUID } from 'node:crypto';
import react from '@vitejs/plugin-react';
const version = { id: randomUUID(), builtAt: Date.now() };
export default defineConfig({ define: { __BUILD_VERSION__: JSON.stringify(version) }, plugins: [react(), { name: 'build-version', generateBundle() { this.emitFile({ type: 'asset', fileName: 'build-version.json', source: JSON.stringify(version) }); } }], server: { proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true } } }, build: { outDir: 'dist' } });
