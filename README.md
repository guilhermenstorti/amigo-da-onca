# Amigo da Onça

O app da turma para a tradição anual do **amigo da onça**: identificação, lobby e sorteio no dia da festa, votação dos presentes no fim da noite e o Hall da Fama. Feito para iPhone/Safari, aberto pelo link do GitHub Pages.

- **App** (`app/`): Vite + Preact + TypeScript + `@preact/signals`, publicado no GitHub Pages.
- **API** (`api/`): Cloudflare Worker + D1 (SQLite). Guarda o estado compartilhado e os segredos.
- **Design** (`design/`): [Styleguide](design/Styleguide.md), Design System e Padrões de Interface (abra os `.dc.html` no navegador).

## Rodar localmente

```powershell
npm run setup
```

```powershell
copy api\.dev.vars.example api\.dev.vars
```

```powershell
npm run fotos
```

Depois suba a API e o app, cada um num terminal:

```powershell
npm run dev:api
```

```powershell
npm run dev:app
```

Abra http://localhost:5173 e use a palavra-chave e a senha de admin que estão em `api/.dev.vars`.

Para ensaiar sem 9 celulares, o script `scripts/simular.mjs` faz os outros participantes entrarem no lobby (`node scripts/simular.mjs lobby`) ou votarem (`node scripts/simular.mjs votar`).

### Testes

```powershell
npm test
```

Inclui 10 mil sorteios (sem ninguém tirar a si mesmo, sempre 1:1) e uma simulação da noite inteira contra o Worker local: palavra-chave, perfil preso ao aparelho, sorteio, votação anônima, apuração, revelação e Hall.

## Fotos

Os PNGs originais ficam em `assets/img/profile/` (nome do arquivo = id da pessoa) e **não vão para o git**: o repositório é público (a pasta `assets/img/` inteira está no `.gitignore`). `npm run fotos` converte para WebP (256 e 512 px) e grava no banco local; `npm run fotos -- --remote` grava no banco de produção (com `$env:DATABASE_ID_CLOUDFLARE` definido). Depois disso, fotos novas podem ser enviadas pelo Controle → Pessoas.

## Hall da Fama

Cada ano tem a sua **sala de troféus** (um pin por categoria, com o vencedor e a foto) e os **Highlights** (link para a pasta de fotos da festa).

- **Pins:** desenhados em SVG em `app/src/components/Pin.tsx`, um formato e um símbolo por categoria. Categoria nova sem desenho usa a estrela.
- **Edição atual:** cada categoria revelada entra na sala de troféus na hora. As que ainda não foram reveladas aparecem só como sombra, e o servidor não entrega o vencedor antes da hora.
- **Anos sem premiação** (antes de 2026): a sala aparece vazia, com a sombra de cada pin e o aviso "Ano sem premiação". Cadastre em Controle → Hall → "Cadastrar um ano", com a chave "Teve premiação" desligada.
- **Link das fotos:** em Controle → Hall (anos passados) ou Controle → Edição (ano atual). O link fica **só no banco** e só sai para quem tem a palavra-chave. Nunca coloque esses links no código: o repositório é público.
- **Apagar:** "Apagar este ano" (Controle → Hall) e "Recomeçar edição" apagam também a sala de troféus do ano.
- **No lobby e no Início**, enquanto a turma espera, um cartão chama para o Hall. Ele abre por cima da tela: no lobby a pessoa continua lá, com a presença atualizando, e vai sozinha para a roleta quando o sorteio acontece.

## Publicar (uma vez só)

1. **Cloudflare:** crie uma conta grátis e registre um subdomínio workers.dev (Workers & Pages). Rode `npx wrangler login` dentro de `api/` e depois `npx wrangler d1 create amigo-da-onca`. Guarde o `database_id` numa secret do GitHub (passo 3), **não** no `api/wrangler.toml`: o deploy troca o valor provisório de lá pela secret.
2. **Token da Cloudflare:** My Profile → API Tokens → Create Token → modelo "Edit Cloudflare Workers". Na política do tipo **Account**, acrescente a permissão **D1 → Edit**.
3. **Secrets do GitHub** (Settings → Secrets and variables → Actions → Secrets):
   - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` e `DATABASE_ID_CLOUDFLARE`
   - `PALAVRA_CHAVE`: a palavra do grupo
   - `ADMIN_PASSWORD`: a senha do Gui
   - `TOKEN_SECRET`: um texto aleatório longo
4. **Variável do GitHub** (mesma tela, aba Variables): `API_URL` = `https://amigo-da-onca-api.<subdominio>.workers.dev`.
5. **GitHub Pages:** Settings → Pages → Source: **GitHub Actions**.
6. Commit e push na `main`: os workflows **Publicar API** e **Publicar app** rodam sozinhos.
7. Fotos para produção (PowerShell, na raiz): `$env:DATABASE_ID_CLOUDFLARE = "<id>"` e depois `npm run fotos -- --remote`.

Comandos do wrangler contra a produção usam o mesmo esquema: com `$env:DATABASE_ID_CLOUDFLARE` definido, rode `npm run producao -- <comando>` (ex.: `npm run producao -- d1 export DB --remote --output ../backup-2026.sql`).

Trocar a palavra-chave ou a senha: atualize a secret e rode **Publicar API** de novo. Quem já tinha entrado digita a palavra nova.

## Na noite da festa

1. Gui abre o lobby (card no Início ou Controle → Ao vivo).
2. Cada um abre o link, digita a palavra-chave (só na primeira vez), toca na própria foto e entra no lobby.
3. Com 9 de 9, o Gui toca em **Sortear**: cada celular mostra a roleta e só o próprio resultado.
4. Dicas, palpites, troca e roubos acontecem ao vivo.
5. Gui abre a votação; todo mundo vota nas 6 categorias e envia.
6. Gui fecha a votação e revela categoria por categoria (dá para espelhar em uma TV com "Abrir modo telão" no perfil).
7. Gui encerra a edição: os vencedores vão para o Hall da Fama.

Se alguém trocar de celular no meio da noite, o Gui libera o perfil em Controle → Ao vivo → Liberar.

**Recomeçar uma edição** (depois de um ensaio, por exemplo): Controle → Ao vivo → "Recomeçar edição", no fim da tela. Apaga sorteio, votos e resultados daquele ano (inclusive do Hall) e volta para a preparação; data, local, participantes e categorias continuam. Só o admin vê e consegue fazer isso.
