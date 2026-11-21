import preact from '@preact/preset-vite';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

/** Pré-carrega as fontes latinas (Sora e Instrument Sans) para o texto não piscar. */
function preloadFontes(): Plugin {
  return {
    name: 'preload-fontes',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const fontes = Object.keys(ctx.bundle).filter((f) => /(sora|instrument-sans)-latin-wght-normal.*\.woff2$/.test(f));
        return {
          html,
          tags: fontes.map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `./${f}`, crossorigin: '' },
            injectTo: 'head' as const,
          })),
        };
      },
    },
  };
}

export default defineConfig({
  // Caminhos relativos: funciona em <user>.github.io/amigo-da-onca/ e em qualquer outro lugar.
  base: './',
  plugins: [preact(), preloadFontes()],
  build: { target: ['safari15', 'es2020'], cssTarget: ['safari15'] },
  server: {
    port: 5173,
    strictPort: true,
    // O som da onça mora em assets/audio, fora da pasta do app.
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
  },
});
