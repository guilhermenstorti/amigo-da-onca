// Roda o wrangler contra o banco de PRODUÇÃO sem pôr o database_id no git.
// O id vem da variável de ambiente DATABASE_ID_CLOUDFLARE (o mesmo valor da secret do GitHub).
//
// No PowerShell:
//   $env:DATABASE_ID_CLOUDFLARE = "<id do D1>"
//   npm run producao -- d1 export DB --remote --output ../backup-2026.sql
import { execSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROVISORIO = '00000000-0000-0000-0000-000000000000';
const pastaApi = fileURLToPath(new URL('../api/', import.meta.url));
const configTemporaria = 'wrangler.producao.toml'; // fica em api/ e está no .gitignore

/** Roda `npx wrangler <args>` em api/, com uma cópia temporária do wrangler.toml que tem o id real. */
export function wranglerProducao(args) {
  const id = process.env.DATABASE_ID_CLOUDFLARE?.trim();
  if (!id) {
    throw new Error('Defina o id do banco antes. No PowerShell: $env:DATABASE_ID_CLOUDFLARE = "<id do D1>"');
  }
  const original = readFileSync(new URL('wrangler.toml', pathToFileURL(pastaApi)), 'utf8');
  writeFileSync(new URL(configTemporaria, pathToFileURL(pastaApi)), original.replace(PROVISORIO, id));
  try {
    execSync(`npx wrangler ${args} -c ${configTemporaria}`, { cwd: pastaApi, stdio: 'inherit' });
  } finally {
    rmSync(new URL(configTemporaria, pathToFileURL(pastaApi)), { force: true });
  }
}

// Chamado direto (npm run producao -- ...): repassa os argumentos para o wrangler.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).map((a) => (/\s/.test(a) ? `"${a}"` : a));
  if (!args.length) {
    console.log('Uso: npm run producao -- <comando do wrangler>   (ex.: d1 export DB --remote --output ../backup.sql)');
    process.exit(1);
  }
  try {
    wranglerProducao(args.join(' '));
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
