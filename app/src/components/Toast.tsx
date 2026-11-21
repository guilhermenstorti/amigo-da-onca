import { toast } from '../lib/ui';

/** Região única de avisos, 16px acima da ação principal. Lida pelo leitor de tela. */
export function Toast() {
  const t = toast.value;
  return (
    <div class="toast-area" role="status" aria-live="polite">
      {t && (
        <div key={t.id} class={`toast toast--${t.tom}`}>
          <span class="toast__ponto" aria-hidden="true" />
          <span>{t.texto}</span>
        </div>
      )}
    </div>
  );
}
