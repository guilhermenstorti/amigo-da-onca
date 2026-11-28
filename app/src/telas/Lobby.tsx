import { useEffect, useRef, useState } from 'preact/hooks';
import type { Estado } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao } from '../components/Botao';
import { Icone } from '../components/Icone';
import { Tela } from '../components/Tela';
import { acaoAdmin, entrarNoLobby } from '../lib/acoes';
import { estado, pessoa, usarModoRapido } from '../lib/estado';
import { descartarHall, ir } from '../lib/rota';
import { alternarMudo, destravarSom, mudo, prepararSom, tocarSomDaOnca } from '../lib/som';
import { listaNomes, reduzirMovimento, useTelaAcesa } from '../lib/ui';
import { TelaCarregando } from './Entrada';
import { ChamadaHall } from './Hall';

const DEPOIS_DO_SORTEIO = ['troca', 'votacao', 'revelacao', 'encerrada'];

export function TelaLobby() {
  const e = estado.value;
  if (!e?.eu) return <TelaCarregando />;
  return <Lobby e={e} />;
}

function Lobby({ e }: { e: Estado }) {
  const eu = e.eu!;
  const fase = e.edicao.fase;
  const dentro = eu.vinculo === 'este';
  const presentes = e.lobby.presentes;
  const daEdicao = e.pessoas.filter((p) => p.naEdicao);
  const admin = e.pessoas.find((p) => p.admin);

  useEffect(usarModoRapido, []);
  useEffect(prepararSom, []);
  useTelaAcesa(dentro && fase === 'lobby');

  // O sorteio aconteceu: cada celular do lobby vai sozinho para a roleta (mesmo com o Hall da Fama aberto por cima).
  useEffect(() => {
    if (dentro && DEPOIS_DO_SORTEIO.includes(fase)) {
      descartarHall();
      ir('sorteio');
    }
  }, [dentro, fase]);

  // Chegadas: compara a lista de presentes com a anterior e enfileira as animações.
  const anteriores = useRef<string[] | null>(null);
  const [fila, setFila] = useState<string[][]>([]);
  const [anuncio, setAnuncio] = useState('');
  useEffect(() => {
    if (anteriores.current === null) {
      anteriores.current = presentes;
      return;
    }
    const novos = presentes.filter((id) => !anteriores.current!.includes(id));
    anteriores.current = presentes;
    if (!novos.length) return;
    const nomes = novos.map((id) => (id === eu.id ? 'Você' : pessoa(id)?.nome ?? ''));
    setAnuncio(`${listaNomes(nomes)} ${novos.length > 1 ? 'entraram' : 'entrou'} no lobby. ${presentes.length} de ${e.lobby.total}.`);
    // Várias chegadas de uma vez (ou fila grande) viram uma animação só.
    setFila((f) => (f.length >= 2 ? [[...f.flat(), ...novos]] : [...f, novos]));
  }, [presentes.join(',')]);

  const faltam = daEdicao.filter((p) => !presentes.includes(p.id));
  const completo = e.lobby.completo;

  let rodape = null;
  if (fase === 'preparacao') {
    rodape = eu.admin ? (
      <Botao onClick={() => acaoAdmin('lobby/abrir', 'Lobby aberto!')}>Abrir lobby do sorteio</Botao>
    ) : (
      <p class="vidro aviso">O lobby abre no dia da festa.</p>
    );
  } else if (eu.vinculo === 'outro') {
    rodape = <p class="vidro aviso">Seu perfil está em uso em outro celular. Peça pro {admin?.nome ?? 'admin'} liberar.</p>;
  } else if (!dentro) {
    rodape = (
      <Botao
        onClick={() => {
          destravarSom();
          return entrarNoLobby();
        }}
      >
        {fase === 'lobby' ? 'Entrar no lobby' : 'Entrar de novo neste celular'}
      </Botao>
    );
  } else if (fase === 'lobby') {
    rodape = eu.admin ? (
      <Botao
        bloqueado={!completo && `Ainda falta${faltam.length > 1 ? 'm' : ''} ${listaNomes(faltam.map((p) => p.nome))}.`}
        onClick={() => acaoAdmin('sortear')}
      >
        Sortear
      </Botao>
    ) : (
      <p class="vidro aviso" role="status">
        {completo ? `Todo mundo na toca. Esperando ${admin?.nome ?? 'o admin'} sortear…` : 'Esperando a turma chegar…'}
      </p>
    );
  }

  return (
    <Tela titulo="Lobby do sorteio" subtitulo="Quando todo mundo entrar, o sorteio é liberado." voltar rodape={rodape}>
      <section class="vidro cartao contador" aria-label="Presença">
        <p class="contador__numero">
          {presentes.length} <span>de {e.lobby.total}</span>
        </p>
        <p class="contador__rotulo">{completo ? 'Todo mundo na toca!' : 'na toca'}</p>
        <button
          type="button"
          class="botao botao--icone contador__som"
          aria-pressed={!mudo.value}
          aria-label="Som das chegadas"
          onClick={alternarMudo}
        >
          <Icone nome={mudo.value ? 'mudo' : 'som'} />
        </button>
      </section>

      <ul class="grade-lobby" aria-label="Quem já chegou">
        {daEdicao.map((p) => {
          const aqui = presentes.includes(p.id);
          return (
            <li key={p.id} class={aqui ? 'presente' : 'ausente'}>
              <Avatar pessoa={p} tamanho={64} ausente={!aqui} />
              <span class="grade-lobby__nome">{p.id === eu.id ? 'Você' : p.nome}</span>
              <span class="sr-only">{aqui ? ', no lobby' : ', ainda não chegou'}</span>
            </li>
          );
        })}
      </ul>

      {((fase === 'lobby' && dentro) || fase === 'preparacao') && <ChamadaHall />}

      <p class="sr-only" aria-live="polite">
        {anuncio}
      </p>
      {fila.length > 0 && <Chegada key={fila[0].join()} ids={fila[0]} eu={eu.id} aoTerminar={() => setFila((f) => f.slice(1))} />}
    </Tela>
  );
}

function Chegada({ ids, eu, aoTerminar }: { ids: string[]; eu: string; aoTerminar: () => void }) {
  useEffect(() => {
    void tocarSomDaOnca();
    const t = setTimeout(aoTerminar, reduzirMovimento.value ? 1400 : 2000);
    return () => clearTimeout(t);
  }, []);
  const pessoas = ids.map((id) => pessoa(id));
  const nomes = ids.map((id) => (id === eu ? 'Você' : pessoa(id)?.nome ?? ''));
  const texto = ids.length === 1 ? (ids[0] === eu ? 'Você chegou!' : `${nomes[0]} chegou!`) : `${listaNomes(nomes)} chegaram!`;
  return (
    <div class="chegada" aria-hidden="true">
      <div class={`chegada__fotos${ids.length > 1 ? ' chegada__fotos--grupo' : ''}`}>
        {pessoas.slice(0, 5).map((p, i) => (
          <Avatar key={i} pessoa={p} tamanho={ids.length === 1 ? 160 : 88} />
        ))}
      </div>
      <p class="chegada__texto">{texto}</p>
    </div>
  );
}
