import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { mostrarToast, reduzirMovimento } from '../lib/ui';

type Variante = 'primario' | 'secundario' | 'texto' | 'icone' | 'perigo';

interface Props extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'onClick'> {
  variante?: Variante;
  /** Motivo do bloqueio. O botão continua tocável e explica por que não dá. */
  bloqueado?: string | false | null;
  carregando?: boolean;
  /** Se devolver uma Promise, o botão mostra o giro até ela terminar. */
  onClick?: () => unknown;
  children?: ComponentChildren;
}

/** Botões bloqueados nunca usam `disabled`: ficam focáveis e explicam o motivo num toast. */
export function Botao({ variante = 'primario', bloqueado, carregando, onClick, children, class: classe, ...resto }: Props) {
  const [tremer, setTremer] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const girando = carregando || ocupado;

  const clicar = () => {
    if (bloqueado) {
      mostrarToast(bloqueado, 'neutro');
      if (!reduzirMovimento.value) {
        setTremer(false);
        requestAnimationFrame(() => setTremer(true));
      }
      return;
    }
    if (girando) return;
    const r = onClick?.();
    if (r instanceof Promise) {
      setOcupado(true);
      void r.finally(() => setOcupado(false));
    }
  };

  return (
    <button
      type="button"
      {...resto}
      class={['botao', `botao--${variante}`, tremer && 'tremer', classe].filter(Boolean).join(' ')}
      aria-disabled={bloqueado || girando ? 'true' : undefined}
      aria-busy={girando ? 'true' : undefined}
      onClick={clicar}
      onAnimationEnd={() => setTremer(false)}
    >
      {girando && <span class="giro" aria-hidden="true" />}
      {children}
    </button>
  );
}

interface ConfirmarProps {
  rotulo: string;
  pergunta: string;
  confirmar: () => Promise<unknown>;
  variante?: Variante;
}

/** Ação delicada: pede confirmação ali mesmo, sem abrir outra tela. */
export function Confirmar({ rotulo, pergunta, confirmar, variante = 'secundario' }: ConfirmarProps) {
  const [perguntando, setPerguntando] = useState(false);
  if (!perguntando) {
    return (
      <Botao variante={variante} onClick={() => setPerguntando(true)}>
        {rotulo}
      </Botao>
    );
  }
  return (
    <div class="confirmar" role="group" aria-label={pergunta}>
      <p>{pergunta}</p>
      <div class="linha">
        <Botao variante="secundario" onClick={() => setPerguntando(false)}>
          Cancelar
        </Botao>
        <Botao variante={variante === 'perigo' ? 'perigo' : 'primario'} onClick={() => confirmar().finally(() => setPerguntando(false))}>
          Confirmar
        </Botao>
      </div>
    </div>
  );
}
