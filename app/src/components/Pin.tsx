import { useId } from 'preact/hooks';

/**
 * Pins da sala de troféus: um broche esmaltado por categoria, desenhado em SVG.
 * Cada categoria tem formato e símbolo próprios, então até a sombra (pin ainda não entregue) dá para reconhecer.
 * Formatos em uma grade de 100×100; símbolos em 24×24, no mesmo traço dos ícones do app.
 */

type Forma = 'circulo' | 'hexagono' | 'roseta' | 'losango' | 'caixa' | 'brasao';

/** Selo ondulado de 12 pontas (a "revelação"). */
function roseta(pontas = 12, vale = 40, crista = 51): string {
  const ponto = (r: number, a: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  const passo = (2 * Math.PI) / pontas;
  let d = `M${ponto(vale, -Math.PI / 2)}`;
  for (let i = 0; i < pontas; i++) {
    const a = -Math.PI / 2 + i * passo;
    d += `Q${ponto(crista, a + passo / 2)} ${ponto(vale, a + passo)}`;
  }
  return `${d}Z`;
}

const FORMAS: Record<Forma, string> = {
  circulo: 'M50 7a43 43 0 1 1 0 86a43 43 0 1 1 0-86Z',
  hexagono: 'M50 6 88.1 28v44L50 94 11.9 72V28Z',
  roseta: roseta(),
  losango: 'M50 5 95 50 50 95 5 50Z',
  caixa: 'M21 9h58a12 12 0 0 1 12 12v58a12 12 0 0 1-12 12H21A12 12 0 0 1 9 79V21A12 12 0 0 1 21 9Z',
  brasao: 'M50 5 88 16v29c0 24-15 40-38 50C27 85 12 69 12 45V16Z',
};

const SIMBOLOS = {
  /** Chave de boca: o presente que vai ser usado de verdade. */
  chave: 'M5.2 18.8l7.1-7.1M16.67 4.15L16.1 6.28 17.72 7.91 19.85 7.34A4.5 4.5 0 1 1 16.67 4.15Z',
  /** Interrogação: ninguém sabe pra que serve. */
  interrogacao: 'M9 9.25a3 3 0 1 1 4.25 2.7c-.8.38-1.25 1.08-1.25 1.95V15M12 18.6h.01',
  /** Brilhos: surpreendeu. */
  brilho:
    'M11.5 2.5c.6 4.3 2.1 6.4 6.5 8-4.4 1.6-5.9 3.7-6.5 8-.6-4.3-2.1-6.4-6.5-8 4.4-1.6 5.9-3.7 6.5-8ZM18.5 15.5c.2 1.5.75 2.3 2.5 3-1.75.7-2.3 1.5-2.5 3-.2-1.5-.75-2.3-2.5-3 1.75-.7 2.3-1.5 2.5-3Z',
  /** Lâmpada: a ideia que ninguém mais teria. */
  lampada: 'M9.3 15.2c0-1.6-.9-2.6-1.8-3.6a5.5 5.5 0 1 1 9 0c-.9 1-1.8 2-1.8 3.6ZM9.5 18h5M10.5 21h3',
  /** Caixa com laço: o pacote que roubou a cena. */
  presente:
    'M4.5 11.5h15v9h-15ZM3.5 8h17v3.5h-17ZM12 8v12.5M12 8C10.6 4.6 6.8 4.2 6.8 6.3 6.8 7.6 9.3 8 12 8ZM12 8c1.4-3.4 5.2-3.8 5.2-1.7 0 1.3-2.5 1.7-5.2 1.7Z',
  /** Coroa: o grande vencedor da noite. */
  coroa: 'M5 17.5 3.5 8l5 4.2L12 5l3.5 7.2 5-4.2-1.5 9.5ZM5.5 20.5h13',
  /** Estrela: categorias novas, que ainda não têm desenho próprio. */
  estrela: 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9Z',
};

interface Desenho {
  forma: Forma;
  simbolo: keyof typeof SIMBOLOS;
  /** Tamanho do símbolo (2 = 48% do pin). */
  escala?: number;
  /** Centro vertical do símbolo (o brasão é mais pesado em cima). */
  cy?: number;
  /** Pin todo dourado: o prêmio principal. */
  ouro?: boolean;
}

const PINS: Record<string, Desenho> = {
  'mais-util': { forma: 'hexagono', simbolo: 'chave' },
  'mais-inutil': { forma: 'circulo', simbolo: 'interrogacao' },
  revelacao: { forma: 'roseta', simbolo: 'brilho', escala: 1.9 },
  'mais-criativo': { forma: 'losango', simbolo: 'lampada', escala: 1.65 },
  'melhor-embalagem': { forma: 'caixa', simbolo: 'presente' },
  'presente-do-ano': { forma: 'brasao', simbolo: 'coroa', escala: 1.9, cy: 47, ouro: true },
};
const GENERICO: Desenho = { forma: 'circulo', simbolo: 'estrela' };

interface Props {
  /** id da categoria. */
  categoria: string;
  tamanho?: number;
  /** Só a silhueta: pin ainda não entregue. */
  sombra?: boolean;
}

export function Pin({ categoria, tamanho = 80, sombra = false }: Props) {
  const id = `pin${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const d = PINS[categoria] ?? GENERICO;
  const forma = FORMAS[d.forma];
  const simbolo = `translate(50 ${d.cy ?? 50}) scale(${d.escala ?? 2}) translate(-12 -12)`;
  const ouro = `url(#${id}-ouro)`;

  if (sombra) {
    return (
      <svg class="pin pin--sombra" width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <path d={forma} fill="rgba(0,0,0,.34)" stroke="rgba(255,255,255,.08)" stroke-width="5" stroke-linejoin="round" />
        <path
          d={SIMBOLOS[d.simbolo]}
          transform={simbolo}
          fill="none"
          stroke="rgba(255,255,255,.1)"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg class={`pin${d.ouro ? ' pin--ouro' : ''}`} width={tamanho} height={tamanho} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-ouro`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f7e1a6" />
          <stop offset=".38" stop-color="#dcaa55" />
          <stop offset=".68" stop-color="#a46f2b" />
          <stop offset="1" stop-color="#ecc77d" />
        </linearGradient>
        <linearGradient id={`${id}-aro`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#c99442" />
          <stop offset=".5" stop-color="#7a4c1c" />
          <stop offset="1" stop-color="#b9843a" />
        </linearGradient>
        <radialGradient id={`${id}-esmalte`} cx=".5" cy=".36" r=".75">
          <stop offset="0" stop-color="#342c24" />
          <stop offset="1" stop-color="#15120e" />
        </radialGradient>
        <linearGradient id={`${id}-brilho`} x1=".15" y1="0" x2=".6" y2=".75">
          <stop offset="0" stop-color="#fff" stop-opacity=".22" />
          <stop offset=".5" stop-color="#fff" stop-opacity=".04" />
          <stop offset=".51" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>
      {/* Aro de metal + esmalte */}
      <path
        d={forma}
        fill={d.ouro ? ouro : `url(#${id}-esmalte)`}
        stroke={d.ouro ? `url(#${id}-aro)` : ouro}
        stroke-width="6"
        stroke-linejoin="round"
      />
      {/* Filete interno do metal */}
      <path
        d={forma}
        transform="translate(50 50) scale(.84) translate(-50 -50)"
        fill="none"
        stroke={d.ouro ? '#7a4c1c' : ouro}
        stroke-width="1.2"
        opacity={d.ouro ? '.35' : '.5'}
      />
      {/* Símbolo em relevo */}
      <path
        d={SIMBOLOS[d.simbolo]}
        transform={simbolo}
        fill="none"
        stroke={d.ouro ? '#2a1c0e' : ouro}
        stroke-width={d.ouro ? '1.9' : '1.7'}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      {/* Reflexo do esmalte */}
      <path d={forma} fill={`url(#${id}-brilho)`} />
    </svg>
  );
}
