import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Estado, Fase } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao, Confirmar } from '../components/Botao';
import { Folha } from '../components/Folha';
import { acaoAdmin } from '../lib/acoes';
import { estado } from '../lib/estado';
import { controleAberto } from '../lib/paineis';
import { listaNomes } from '../lib/ui';

const FASES: { id: Fase; nome: string }[] = [
  { id: 'preparacao', nome: 'Preparação' },
  { id: 'lobby', nome: 'Sorteio aberto' },
  { id: 'troca', nome: 'Troca de presentes' },
  { id: 'votacao', nome: 'Votação aberta' },
  { id: 'revelacao', nome: 'Revelação' },
  { id: 'encerrada', nome: 'Encerrada' },
];

type Aba = 'ao-vivo' | 'edicao' | 'pessoas' | 'categorias' | 'hall';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'ao-vivo', nome: 'Ao vivo' },
  { id: 'edicao', nome: 'Edição' },
  { id: 'pessoas', nome: 'Pessoas' },
  { id: 'categorias', nome: 'Categorias' },
  { id: 'hall', nome: 'Hall' },
];

/** Painel do admin: abre por cima da tela atual (que continua lá embaixo, do mesmo jeito). */
export function Controle() {
  const [aba, setAba] = useState<Aba>('ao-vivo');
  const [Gestao, setGestao] = useState<ComponentType<{ aba: Exclude<Aba, 'ao-vivo'> }> | null>(null);

  // As abas de gestão só carregam quando alguém abre (não pesam no carregamento do app).
  useEffect(() => {
    if (aba !== 'ao-vivo' && !Gestao) void import('./Gestao').then((m) => setGestao(() => m.Gestao));
  }, [aba]);

  return (
    <Folha aberta={controleAberto.value} aoFechar={() => (controleAberto.value = false)} titulo="Controle">
      <div class="abas-rolagem" role="tablist" aria-label="Seções do controle">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            class={`aba${aba === a.id ? ' aba--ativa' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <div role="tabpanel" class="controle__painel">
        {aba === 'ao-vivo' ? (
          estado.value && <AoVivo e={estado.value} />
        ) : Gestao ? (
          <Gestao aba={aba} />
        ) : (
          <p class="legenda">Carregando…</p>
        )}
      </div>
    </Folha>
  );
}

function AoVivo({ e }: { e: Estado }) {
  const f = e.edicao.fase;
  const daEdicao = e.pessoas.filter((p) => p.naEdicao);
  const faltamLobby = e.admin?.faltamNoLobby ?? [];
  const faltamVotar = e.admin?.faltamVotar ?? [];
  const nome = (id: string) => e.pessoas.find((p) => p.id === id)?.nome ?? id;

  let acoes = null;
  switch (f) {
    case 'preparacao':
      acoes = <Botao onClick={() => acaoAdmin('lobby/abrir', 'Lobby aberto!')}>Abrir lobby do sorteio</Botao>;
      break;
    case 'lobby':
      acoes = (
        <>
          <Botao
            bloqueado={!e.lobby.completo && `Ainda falta${faltamLobby.length > 1 ? 'm' : ''} ${listaNomes(faltamLobby.map(nome))}.`}
            onClick={() => acaoAdmin('sortear')}
          >
            Sortear
          </Botao>
          <Confirmar rotulo="Fechar lobby" pergunta="Fechar o lobby? Todo mundo sai e precisa entrar de novo." confirmar={() => acaoAdmin('lobby/fechar', 'Lobby fechado.')} />
        </>
      );
      break;
    case 'troca':
      acoes = (
        <>
          <Botao onClick={() => acaoAdmin('votacao/abrir', 'Votação aberta!')}>Abrir votação</Botao>
          <Confirmar
            rotulo="Refazer sorteio"
            pergunta="Refazer o sorteio? Todo mundo volta para o lobby e tira de novo."
            variante="perigo"
            confirmar={() => acaoAdmin('sorteio/refazer', 'Sorteio desfeito. Sorteie de novo no lobby.')}
          />
        </>
      );
      break;
    case 'votacao':
      acoes = (
        <Confirmar
          rotulo="Fechar votação e apurar"
          pergunta={faltamVotar.length ? `Ainda falta${faltamVotar.length > 1 ? 'm' : ''} ${listaNomes(faltamVotar.map(nome))}. Fechar mesmo assim?` : 'Fechar a votação e apurar?'}
          variante="primario"
          confirmar={() => acaoAdmin('votacao/fechar', 'Votos apurados. Bora revelar!')}
        />
      );
      break;
    case 'revelacao':
      acoes =
        e.revelacao.reveladas < e.revelacao.total ? (
          <Botao onClick={() => acaoAdmin('revelar')}>
            Revelar próxima ({e.revelacao.reveladas + 1} de {e.revelacao.total})
          </Botao>
        ) : (
          <Confirmar rotulo="Encerrar edição" pergunta="Encerrar e mandar para o Hall da Fama?" variante="primario" confirmar={() => acaoAdmin('encerrar', 'Edição encerrada!')} />
        );
      break;
    case 'encerrada':
      acoes = (
        <p class="legenda">
          Edição encerrada. Para o ano que vem, crie a próxima na aba Edição. Para fazer esta de novo, use "Recomeçar edição" no fim desta tela.
        </p>
      );
  }

  const mostraVotos = f === 'votacao';
  return (
    <div class="ao-vivo">
      <ol class="fases" aria-label="Fases da edição">
        {FASES.map((x) => (
          <li key={x.id} class={x.id === f ? 'fases__atual' : ''} aria-current={x.id === f ? 'step' : undefined}>
            {x.nome}
          </li>
        ))}
      </ol>

      <div class="ao-vivo__acoes">{acoes}</div>

      <h3 class="ao-vivo__titulo">{mostraVotos ? `Votos: ${e.votacao.enviaram} de ${e.votacao.total} enviaram` : `Lobby: ${e.lobby.presentes.length} de ${e.lobby.total}`}</h3>
      <ul class="presenca">
        {daEdicao.map((p) => {
          const noLobby = e.lobby.presentes.includes(p.id);
          const status = mostraVotos ? (faltamVotar.includes(p.id) ? 'Falta votar' : 'Enviou') : noLobby ? 'No lobby' : 'Fora do lobby';
          return (
            <li key={p.id} class="presenca__linha">
              <Avatar pessoa={p} tamanho={36} ausente={!noLobby} />
              <span class="presenca__nome">{p.nome}</span>
              <span class={`selo${status === 'Enviou' || status === 'No lobby' ? ' selo--ok' : ''}`}>{status}</span>
              {noLobby && f !== 'preparacao' && !p.admin && <Liberar id={p.id} nome={p.nome} />}
            </li>
          );
        })}
      </ul>
      <p class="legenda">"Liberar" solta o perfil do celular (para quem trocou de aparelho). A pessoa entra de novo pelo lobby.</p>

      {f !== 'preparacao' && (
        <section class="zona-perigo" aria-labelledby="titulo-recomecar">
          <h3 id="titulo-recomecar">Recomeçar a edição {e.edicao.ano}</h3>
          <p class="legenda">
            Apaga o sorteio, os votos e os resultados deste ano (inclusive do Hall da Fama) e volta para a preparação. Data, local, participantes e
            categorias continuam. Todo mundo entra no lobby de novo. Não dá para desfazer.
          </p>
          <Confirmar
            rotulo={`Recomeçar edição ${e.edicao.ano}`}
            pergunta={`Apagar sorteio, votos e resultados de ${e.edicao.ano} e começar do zero?`}
            variante="perigo"
            confirmar={() => acaoAdmin('edicao/recomecar', `Edição ${e.edicao.ano} recomeçada do zero.`, { ano: e.edicao.ano })}
          />
        </section>
      )}
    </div>
  );
}

function Liberar({ id, nome }: { id: string; nome: string }) {
  const [certeza, setCerteza] = useState(false);
  useEffect(() => {
    if (!certeza) return;
    const t = setTimeout(() => setCerteza(false), 4000);
    return () => clearTimeout(t);
  }, [certeza]);
  return (
    <button
      type="button"
      class={`botao botao--texto botao--mini${certeza ? ' botao--alerta' : ''}`}
      aria-label={certeza ? `Confirmar: liberar o perfil de ${nome}` : `Liberar o perfil de ${nome}`}
      onClick={() => (certeza ? void acaoAdmin('liberar', `${nome} liberado.`, { participante: id }).then(() => setCerteza(false)) : setCerteza(true))}
    >
      {certeza ? 'Liberar?' : 'Liberar'}
    </button>
  );
}
