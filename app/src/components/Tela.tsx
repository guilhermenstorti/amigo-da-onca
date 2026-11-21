import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { estado, pessoa, semConexao, souAdmin } from '../lib/estado';
import { controleAberto, perfilAberto } from '../lib/paineis';
import { ir } from '../lib/rota';
import { Avatar } from './Avatar';
import { Icone } from './Icone';

interface Props {
  titulo: string;
  subtitulo?: ComponentChildren;
  /** Mostra "Início" no topo. */
  voltar?: boolean;
  /** Ação principal, fixa no rodapé (ao alcance do polegar). */
  rodape?: ComponentChildren;
  /** Esconde avatar e Controle (telas antes de escolher o perfil). */
  semPerfil?: boolean;
  children?: ComponentChildren;
}

/** Anatomia de tela do guia: fundo de pelagem noturna em deriva + véu, cabeçalho de vidro, conteúdo, ação fixa. */
export function Tela({ titulo, subtitulo, voltar, rodape, semPerfil, children }: Props) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => h1.current?.focus({ preventScroll: true }), [titulo]);
  const eu = estado.value?.eu;
  const minhaPessoa = pessoa(eu?.id);

  return (
    <div class="tela">
      <div class="tela__fundo" aria-hidden="true" />
      <div class="tela__veu" aria-hidden="true" />
      <div class="tela__coluna">
        <div class="barra-topo">
          {voltar ? (
            <button type="button" class="pilula pilula--botao" onClick={() => ir('inicio')}>
              <Icone nome="voltar" tamanho={18} /> Início
            </button>
          ) : (
            <span class="pilula">Amigo da Onça{estado.value ? ` ${estado.value.edicao.ano}` : ''}</span>
          )}
          {!semPerfil && eu && (
            <div class="barra-topo__direita">
              {souAdmin.value && (
                <button type="button" class="pilula pilula--botao pilula--ouro" onClick={() => (controleAberto.value = true)}>
                  <Icone nome="controle" tamanho={18} /> Controle
                </button>
              )}
              <button type="button" class="botao-avatar" aria-label={`Você é ${minhaPessoa?.nome ?? ''}. Abrir perfil`} onClick={() => (perfilAberto.value = true)}>
                <Avatar pessoa={minhaPessoa} tamanho={44} />
              </button>
            </div>
          )}
        </div>

        {semConexao.value && (
          <p class="aviso-rede" role="status">
            Sem conexão. Tentando de novo…
          </p>
        )}

        <header class="vidro cabecalho">
          <h1 ref={h1} tabIndex={-1}>
            {titulo}
          </h1>
          {subtitulo && <p>{subtitulo}</p>}
        </header>

        <main class="tela__conteudo">{children}</main>
        {rodape && <div class="tela__rodape">{rodape}</div>}
      </div>
    </div>
  );
}
