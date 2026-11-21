# Amigo da Onça — Styleguide

Ferramenta web, **mobile primeiro**, para a tradição anual do **amigo da onça** da turma: sorteio no dia da festa e, no fim da noite, a votação dos presentes.
Referências vivas: `Design System.dc.html` (tokens) e `Padroes de Interface.dc.html` (componentes). Textura: `onca-texture.js`.

---

## 1. Princípios

1. **A onça é protagonista, o texto é rei.** A pelagem aparece com força, mas nunca embaixo de texto sem uma superfície lisa ou de vidro.
2. **Leve aos olhos.** Fundo escuro quente, poucos acentos, muito respiro. Uma peça dourada de destaque por tela.
3. **Movimento orgânico.** Tudo desacelera suave ou assenta com mola. Nada pisca, nada quica demais.
4. **Feito para o polegar.** Alvos de toque ≥ 44px (padrão 48–56px), ação principal fixa no rodapé.
5. **Segredo e surpresa.** Revelar quem você tirou é o momento-chave e tem o efeito mais caprichado.

---

## 2. Cor

Tema único: escuro quente. Todas as cores de texto passam de 4.5:1 sobre `noite-900`.

| Token | Valor | Uso |
|---|---|---|
| `noite-950` | `#0F0D0B` | Fundo da página (desktop, ao redor do app) |
| `noite-900` | `#15120E` | Fundo de tela |
| `noite-800` | `#1C1915` | Superfície sólida (cards, listas) |
| `noite-700` | `#221E19` | Campos, chips, trilha de abas |
| `noite-600` | `#2C2721` | Estado pressionado, botão de ícone |
| `noite-500` | `#3A342D` | Trilha do toggle desligado |
| `areia-50` | `#F2EEE8` | Texto principal |
| `areia-300` | `#C9BFB3` | Texto secundário, rótulos |
| `areia-500` | `#A89E92` | Legendas, metadados |
| `ouro-400` | `oklch(0.8 0.12 80)` | Acento: seleção, foco, indicador de aba |
| `ouro-300` | `oklch(0.86 0.12 80)` | Texto de acento (nome revelado, links, iniciais) |
| `ouro-botao` | `#E0B260` + véu `rgba(228,182,100,.86)` | Fundo do botão primário (sobre a pelagem) |
| `sucesso` | `oklch(0.8 0.12 150)` | Confirmado, salvo |
| `alerta` | `oklch(0.74 0.13 30)` | Erro, ação destrutiva |

**Vidro:** `rgba(21,18,14,.8)` + `backdrop-filter: blur(12px)`; variante de lista `rgba(30,26,22,.88)`.
**Bordas:** `rgba(255,255,255,.06)` (repouso), `oklch(0.8 0.12 80 / .45)` (destaque).

Texto sobre ouro é sempre `#161412`.

---

## 3. Pelagem (textura)

Gerada em código (`OncaTexture.generate(preset, seed)`), tile de 512px sem emenda, exibido entre 220–256px.

**Anatomia:** rosetas grossas e angulosas em tamanhos variados e bem juntas. O anel é quebrado em 1–3 pontos e tem espessura irregular. O miolo é mais escuro que a base e tem 1–3 pintas internas. Entre as rosetas há manchas sólidas soltas e grão de pelo. As bordas têm um desfoque leve de 0.6px.

| Preset | Base | Miolo | Roseta | Onde |
|---|---|---|---|---|
| `dourada` | `#C98A3A` | `#A8652A` | `#1C120A` | Card de revelação, anel de avatar, toggle ligado, botão primário (sob véu) |
| `noturna` | `#15120E` | `#251C13` | `#55412A` | Fundo de tela, faixa de cabeçalho |

**Regras**
- ✅ Fundo noturno sempre com véu: `linear-gradient(180deg, transparent 0%, rgba(21,18,14,.5) 40%, rgba(21,18,14,.94) 75%)`.
- ✅ Texto sobre pelagem só dentro de superfície sólida ou vidro com opacidade de pelo menos 0.8.
- ✅ No máximo **uma** área dourada grande por tela. Anéis, toggles e botões contam como acento.
- ✅ A pelagem pode se mover devagar (`background-position`, 60–110s por ciclo, linear).
- ❌ Nunca colocar texto direto na pelagem, nem pelagem dourada atrás de parágrafos.
- ❌ Nunca usar a estampa como borda fina (< 2px) nem em ícones.
- ❌ Nunca girar, distorcer ou recolorir fora dos presets.

---

## 4. Tipografia

- **Sora** (títulos, botões, números, nome revelado): 600/700
- **Instrument Sans** (corpo, rótulos, campos): 400/500/600
- JetBrains Mono: apenas na documentação, nunca no produto.

| Token | Fonte | Tamanho / altura | Peso |
|---|---|---|---|
| `display` | Sora | 44 / 1.08 | 700 |
| `titulo-1` | Sora | 28 / 1.1 | 700 |
| `titulo-2` | Sora | 22 / 1.15 | 700 |
| `titulo-3` | Sora | 17 / 1.25 | 600 |
| `botao` | Sora | 15 / 1 | 600 |
| `corpo` | Instrument Sans | 15 / 1.5 | 500 |
| `corpo-s` | Instrument Sans | 14 / 1.55 | 400 |
| `legenda` | Instrument Sans | 12 / 1.4 | 500 |
| `micro` | Instrument Sans | 11 / 1.3 | 600 |

Corpo mínimo no celular: 14px. Use `text-wrap: pretty` em parágrafos.
**Campos de texto usam 16px** (`corpo` em 16): abaixo disso o Safari do iPhone dá zoom ao focar.

---

## 5. Espaço, forma e elevação

**Espaçamento (4pt):** 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48
- Margem lateral da tela: 20 · Gap entre blocos: 16 · Gap em listas: 6 · Topo (área segura): 58 · Rodapé: 24

**Raios**
| Token | Valor | Uso |
|---|---|---|
| `r-sm` | 8 | Pequenos marcadores |
| `r-md` | 16 | Campos, itens de lista, tiles, toast |
| `r-lg` | 18 | Botões |
| `r-xl` | 20 | Cards e cabeçalho de vidro |
| `r-hero` | 26 | Card de revelação |
| `r-pill` | 999 | Chips, abas, toggles, avatares |

**Elevação**
- `sombra-tela`: `0 40px 80px -40px rgba(0,0,0,.9)`
- `sombra-toast`: `0 20px 40px -20px rgba(0,0,0,.8)`
- `brilho-ouro`: `0 12px 30px -12px oklch(0.8 0.12 80 / .6)` (CTA, card dourado)
- `anel-foco`: `0 0 0 4px oklch(0.8 0.12 80 / .15), 0 0 30px -8px oklch(0.8 0.12 80 / .5)`

---

## 6. Movimento

| Token | Curva | Uso |
|---|---|---|
| `suave` | `cubic-bezier(.2,.8,.2,1)` | Entradas, giros, cores, foco |
| `mola` | `cubic-bezier(.34,1.56,.64,1)` | Toque, toggle, chips, nome revelado |
| `mola-leve` | `cubic-bezier(.34,1.3,.64,1)` | Indicador de abas, toast |

| Duração | ms | Uso |
|---|---|---|
| `instante` | 200 | Cor ao toque |
| `toque` | 350 | Escala ao pressionar |
| `estado` | 450–600 | Toggle, chip, aba, toast |
| `entrada` | 750 (+90 entre itens) | Listas em cascata (sobe 16px, desfoca 4px → 0) |
| `revelacao` | 1000 | Giro 3D do card. O nome entra 300ms depois com escala .6→1 e desfoque 8px→0 |
| `deriva` | 60–110s | Movimento da pelagem |

**Toque (sem hover no mobile):** escala ao pressionar: botão 0.96, item de lista 0.98, chip / botão de ícone 0.92.
**Toast:** sobe 24px, aparece, fica 2.4s e some. Fica 16px acima do CTA fixo.
**Redução de movimento** (`prefers-reduced-motion`): sem deriva, sem cascata, giro vira crossfade de 200ms, molas viram `suave`.

---

## 7. Voz e texto

Português informal, da turma, com humor leve e sem exageros. Frases curtas.
- Botões começam com verbo: "Sortear agora", "Salvar lista", "Ver lista da Marina".
- Momentos de vitória têm uma pitada de piada: "Lista salva. Sua onça agradece!"
- Erros explicam e orientam: "Esse link expirou. Pede um novo pro organizador."
- Datas curtas ("20 dez"), valores "R$ 100", sem casas decimais quando redondo.

---

## 8. Acessibilidade

- Contraste de texto ≥ 4.5:1 (títulos ≥ 3:1). Nunca reduzir contraste com opacidade sobre a pelagem.
- Foco visível em todos os controles (`anel-foco`).
- Toggles e chips com `role`/`aria-pressed`/`aria-checked`. O card de revelação é um `button` com `aria-live` no nome.
- Alvos de toque ≥ 44×44px.
- Respeitar `prefers-reduced-motion` (seção 6).

---

## 9. Padrões do app

Implementados em `app/src/components`. Seguem as regras acima; aqui só o que é novo.

- **Botão bloqueado:** nunca usa `disabled`. Usa `aria-disabled="true"`, continua focável e, ao toque, mostra um toast com o motivo ("A votação abre depois do sorteio") e um tremor curto de 6px (sem tremor em movimento reduzido). Visual: `noite-600` + texto `areia-500`.
- **Destaque da tela:** o card da ação da vez no Início (lobby ou votação) é a única área dourada grande. O texto fica numa placa sólida `noite-900` por cima da pelagem.
- **Lobby:** grade 3×3 de avatares. Presente = anel de pelagem; ausente = anel tracejado `areia-500` e foto em 35% de opacidade. Cada chegada: foto de 160px entra em `mola` (escala .6→1, 600ms), fica 1.2s e sai; toca o som da onça (`assets/audio/serjao-onca.mp3`, baixado só quando o lobby abre). Uma chegada nova corta o som da anterior. Várias chegadas juntas viram uma só animação agrupada.
- **Roleta:** dentro da placa do card de revelação, os outros nomes passam com intervalos que desaceleram (60→320ms, ~2.4s). Depois, giro do card (`revelacao`).
- **Proteção do nome (tecido):** o verso do card mostra a foto do sorteado (96px, anel de pelagem) e o nome. 1.5s depois de assentarem, um tecido de pelagem dourada com dobras de luz e sombra é *jogado* por cima: surge num fade caindo de cima (rotateX 62°→0), ondula e assenta em 850ms `suave`; por baixo, foto e nome desfocam 14px. "Mostrar de novo" *puxa* o tecido: um tranco curto e ele sai voando para o lado, sumindo (700ms), e volta a cobrir 1.5s depois. Ao abrir a tela ou sair do app, o tecido já está por cima, sem animação. Coberto, o conteúdo fica `aria-hidden`; revelado, o nome é anunciado por `aria-live`. Movimento reduzido: o tecido só aparece e some em 200ms.
- **Carrossel de frases:** vidro, uma frase por vez, troca a cada 4.5s em `suave` (sobe 8px + fade). Tem botão de pausa; com movimento reduzido fica parado e troca só por toque.
- **Folha de Controle (admin):** `<dialog>` que sobe do rodapé (r-xl no topo, `noite-800`, `sombra-tela`), por cima da tela atual, que continua montada. Abas segmentadas no topo. Ações destrutivas pedem confirmação dentro da própria folha.
