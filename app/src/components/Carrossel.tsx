import { useEffect, useState } from 'preact/hooks';
import { reduzirMovimento } from '../lib/ui';
import { Icone } from './Icone';

/** Quanto tempo cada frase fica: dá para ler com calma, e as compridas ficam mais. */
const tempoDe = (frase: string) => 6000 + frase.length * 50;

/**
 * Uma frase por vez, trocando sozinha. A borda do botão de pausa é o relógio: esvazia até a próxima frase.
 * Tem pausa (WCAG 2.2.2) e começa parado com movimento reduzido.
 */
export function Carrossel({ frases }: { frases: string[] }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * frases.length));
  // Cada troca reinicia o relógio, mesmo que só exista uma frase.
  const [rodada, setRodada] = useState(0);
  const [pausado, setPausado] = useState(reduzirMovimento.value);
  const [oculto, setOculto] = useState(document.hidden);
  const proxima = () => {
    setI((x) => (x + 1) % frases.length);
    setRodada((r) => r + 1);
  };

  // Com o app em segundo plano, o relógio espera.
  useEffect(() => {
    const ver = () => setOculto(document.hidden);
    document.addEventListener('visibilitychange', ver);
    return () => document.removeEventListener('visibilitychange', ver);
  }, []);

  return (
    <section class="vidro carrossel" aria-roledescription="carrossel" aria-label="Frases da onça">
      <button type="button" class="carrossel__frase" onClick={proxima} aria-label={`${frases[i]} Toque para a próxima frase.`}>
        <span key={i} class="carrossel__texto">
          {frases[i]}
        </span>
      </button>
      <button
        type="button"
        class={`carrossel__pausa${pausado ? ' carrossel__pausa--parado' : ''}`}
        onClick={() => setPausado((p) => !p)}
        aria-label={pausado ? 'Continuar trocando as frases' : 'Pausar as frases'}
      >
        <svg class="carrossel__anel" viewBox="0 0 44 44" aria-hidden="true">
          <circle class="carrossel__trilho" cx="22" cy="22" r="20.5" />
          {/* A frase troca quando o anel termina de esvaziar: pausa, volta e relógio andam sempre juntos. */}
          <circle
            key={rodada}
            class="carrossel__tempo"
            cx="22"
            cy="22"
            r="20.5"
            style={{ '--tempo': `${tempoDe(frases[i])}ms`, animationPlayState: pausado || oculto ? 'paused' : 'running' }}
            onAnimationEnd={proxima}
          />
        </svg>
        <Icone nome={pausado ? 'play' : 'pausa'} tamanho={16} />
      </button>
    </section>
  );
}
