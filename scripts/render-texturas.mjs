// Pré-renderiza a pelagem (design/onca-texture.js) em WebP, para o celular não gerar nada no canvas.
// Uso: npm run texturas   (precisa de: npx playwright install chromium)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const raiz = new URL('..', import.meta.url);
const gerador = await readFile(new URL('design/onca-texture.js', raiz), 'utf8');
const saida = new URL('app/src/assets/tex/', raiz);
await mkdir(saida, { recursive: true });

// Mesmas sementes usadas em "Padroes de Interface.dc.html".
const presets = [['dourada', 3], ['noturna', 9]];

const navegador = await chromium.launch();
try {
  const pagina = await navegador.newPage();
  await pagina.setContent('<!doctype html><html><body></body></html>');
  await pagina.addScriptTag({ content: gerador });
  for (const [preset, semente] of presets) {
    const base64 = await pagina.evaluate(async ([preset, semente]) => {
      const url = window.OncaTexture.generate(preset, semente);
      const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(bin);
    }, [preset, semente]);
    const webp = await sharp(Buffer.from(base64, 'base64')).webp({ quality: 78, effort: 6 }).toBuffer();
    await writeFile(new URL(`${preset}.webp`, saida), webp);
    console.log(`${preset}.webp  ${(webp.length / 1024).toFixed(1)} KB`);
  }
} finally {
  await navegador.close();
}
