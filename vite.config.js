import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/numgg/' : '/',
  server: { port: 5173, strictPort: true },
}));
