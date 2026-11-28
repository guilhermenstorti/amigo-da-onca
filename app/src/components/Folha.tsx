import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { Icone } from './Icone';

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  /** Ocupa a altura toda (Hall da Fama). */
  cheia?: boolean;
  children: ComponentChildren;
}

/**
 * Folha que sobe do rodapé (<dialog> modal). A tela de baixo continua montada, com o mesmo estado:
 * o admin abre, faz a ação e volta exatamente para onde estava.
 */
export function Folha({ aberta, aoFechar, titulo, cheia, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberta && !d.open) d.showModal();
    if (!aberta && d.open) d.close();
    document.documentElement.classList.toggle('travado', aberta);
    return () => document.documentElement.classList.remove('travado');
  }, [aberta]);

  return (
    <dialog
      ref={ref}
      class={`folha${cheia ? ' folha--cheia' : ''}`}
      aria-labelledby={id}
      onClose={aoFechar}
      onClick={(e) => e.target === ref.current && aoFechar()}
    >
      <div class="folha__caixa">
        <header class="folha__topo">
          <h2 id={id}>{titulo}</h2>
          <button type="button" class="botao botao--icone" aria-label="Fechar" onClick={aoFechar}>
            <Icone nome="fechar" />
          </button>
        </header>
        <div class="folha__conteudo">{aberta && children}</div>
      </div>
    </dialog>
  );
}
