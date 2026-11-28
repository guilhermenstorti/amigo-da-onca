// Converte as fotos de assets/img/profile/*.png (fora do git) em WebP 256/512 e grava no D1.
// Uso:  npm run fotos             → banco local (wrangler dev)
//       npm run fotos -- --remote → banco de produção (precisa do login do wrangler
//                                   e de $env:DATABASE_ID_CLOUDFLARE com o id do D1)
import sharp from 'sharp';
import { execSync } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { wranglerProducao } from './wrangler-producao.mjs';

const raiz = new URL('..', import.meta.url);
const origem = new URL('assets/img/profile/', raiz);
const saida = new URL('scripts/saida/', raiz);
const remoto = process.argv.includes('--remote');
// O D1 aceita statements de até 100 KB; em hex cada byte vira 2 caracteres.
const LIMITE_BYTES = 45_000;

await mkdir(new URL('fotos/', saida), { recursive: true });
const arquivos = (await readdir(origem)).filter((f) => f.toLowerCase().endsWith('.png'));
if (!arquivos.length) throw new Error('Nenhum PNG em assets/img/profile/');

const linhas = [];
let total = 0;
for (const arquivo of arquivos.sort()) {
  const id = arquivo.replace(/\.png$/i, '').toLowerCase();
  for (const tamanho of [256, 512]) {
    let webp;
    for (let q = 82; q >= 40; q -= 6) {
      webp = await sharp(fileURLToPath(new URL(arquivo, origem)))
        .resize(tamanho, tamanho, { fit: 'cover' })
        .webp({ quality: q, alphaQuality: 90, effort: 6 })
        .toBuffer();
      if (webp.length <= LIMITE_BYTES) break;
    }
    if (webp.length > LIMITE_BYTES) throw new Error(`${arquivo} @${tamanho}px continua grande demais`);
    total += webp.length;
    await writeFile(new URL(`fotos/${id}-${tamanho}.webp`, saida), webp);
    linhas.push(
      `INSERT INTO fotos (participante_id, tamanho, mime, bytes, versao) VALUES ('${id}', ${tamanho}, 'image/webp', X'${webp.toString('hex')}', 1) ` +
        `ON CONFLICT (participante_id, tamanho) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes, versao = fotos.versao + 1;`,
    );
    console.log(`${id.padEnd(8)} ${tamanho}px  ${(webp.length / 1024).toFixed(1)} KB`);
  }
}
const sql = new URL('fotos.sql', saida);
await writeFile(sql, linhas.join('\n') + '\n');
console.log(`Total: ${(total / 1024).toFixed(0)} KB (os PNGs originais tinham ~4,4 MB)`);

if (remoto) {
  // Produção: o database_id vem de $env:DATABASE_ID_CLOUDFLARE, nunca do git.
  wranglerProducao(`d1 execute DB --remote --file "${fileURLToPath(sql)}"`);
  console.log('Fotos enviadas para o D1 de produção.');
} else {
  execSync(`npx wrangler d1 execute DB --local --file "${fileURLToPath(sql)}"`, {
    cwd: fileURLToPath(new URL('api/', raiz)),
    stdio: 'inherit',
  });
  console.log('Fotos gravadas no D1 local.');
}
