import { useEffect, useState } from 'preact/hooks';
import { reduzirMovimento } from '../lib/ui';
import { Icone } from './Icone';

/** Uma frase por vez, trocando sozinha. Tem pausa (WCAG 2.2.2) e fica parado com movimento reduzido. */
export function Carrossel({ frases }: { frases: string[] }) {
  const [i, setI] = useState(() => Math.floor(Math.random() * frases.length));
  const [pausado, setPausado] = useState(reduzirMovimento.value);
  const proxima = () => setI((x) => (x + 1) % frases.length);

  useEffect(() => {
    if (pausado) return;
    const t = setInterval(() => !document.hidden && proxima(), 4500);
    return () => clearInterval(t);
  }, [pausado]);

  return (
    <section class="vidro carrossel" aria-roledescription="carrossel" aria-label="Frases da onça">
      <button type="button" class="carrossel__frase" onClick={proxima} aria-label={`${frases[i]} Toque para a próxima frase.`}>
        <span key={i} class="carrossel__texto">
          {frases[i]}
        </span>
      </button>
      <button
        type="button"
        class="carrossel__pausa"
        onClick={() => setPausado((p) => !p)}
        aria-label={pausado ? 'Continuar trocando as frases' : 'Pausar as frases'}
      >
        <Icone nome={pausado ? 'play' : 'pausa'} tamanho={16} />
      </button>
    </section>
  );
}
