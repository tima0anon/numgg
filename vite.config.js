import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  base: process.env.NUMDROP_BASE || (command === 'build' ? '/numgg/' : '/'),
  server: { port: 5173, strictPort: true },
}));
