import type { Pessoa } from '../../../api/src/contrato';
import { iniciais } from '../lib/ui';

interface Props {
  pessoa: Pick<Pessoa, 'nome' | 'foto'> | null;
  tamanho?: number;
  ausente?: boolean;
}

/** Foto dentro do anel de pelagem dourada (as fotos já vêm recortadas em círculo). */
export function Avatar({ pessoa, tamanho = 44, ausente = false }: Props) {
  const src = pessoa?.foto ? (tamanho > 96 ? pessoa.foto.g : pessoa.foto.p) : null;
  return (
    <span class={`avatar${ausente ? ' avatar--ausente' : ''}`} style={{ '--t': `${tamanho}px` }} aria-hidden="true">
      <span class="avatar__miolo">
        {src ? <img src={src} alt="" width={tamanho} height={tamanho} decoding="async" draggable={false} /> : iniciais(pessoa?.nome ?? '?')}
      </span>
    </span>
  );
}
