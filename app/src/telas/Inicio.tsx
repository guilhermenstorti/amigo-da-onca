import type { Estado } from '../../../api/src/contrato';
import { Botao, Confirmar } from '../components/Botao';
import { Carrossel } from '../components/Carrossel';
import { Icone } from '../components/Icone';
import { Tela } from '../components/Tela';
import { frases } from '../conteudo/frases';
import { acaoAdmin } from '../lib/acoes';
import { estado } from '../lib/estado';
import { abrirHall, ir } from '../lib/rota';
import { dataCurta } from '../lib/ui';
import { TelaCarregando } from './Entrada';
import { ChamadaHall } from './Hall';

interface Opcao {
  titulo: string;
  status: string;
  acao?: () => void;
  bloqueado?: string;
  destaque?: boolean;
}

function opcaoSorteio(e: Estado): Opcao {
  const titulo = 'Lobby do sorteio';
  const vinculo = e.eu?.vinculo;
  if (vinculo === 'outro') {
    return { titulo, status: 'Seu perfil está em outro celular', bloqueado: 'Seu perfil está em uso em outro celular. Peça pro admin liberar.' };
  }
  switch (e.edicao.fase) {
    case 'preparacao':
      return { titulo, status: 'Abre no dia da festa', bloqueado: 'O lobby do sorteio abre no dia da festa.' };
    case 'lobby':
      return {
        titulo,
        status: vinculo === 'este' ? `Você está no lobby · ${e.lobby.presentes.length} de ${e.lobby.total}` : 'O sorteio está aberto',
        acao: () => ir('lobby'),
        destaque: true,
      };
    default:
      return vinculo === 'este' && e.eu?.tirouAlguem
        ? { titulo: 'Quem eu tirei', status: 'O nome fica escondido até você pedir', acao: () => ir('sorteio') }
        : { titulo, status: 'O sorteio já aconteceu', acao: () => ir('lobby') };
  }
}

function opcaoVotacao(e: Estado): Opcao {
  const titulo = 'Votação';
  switch (e.edicao.fase) {
    case 'preparacao':
    case 'lobby':
      return { titulo, status: 'Depois do sorteio', bloqueado: 'A votação abre depois do sorteio.' };
    case 'troca':
      return { titulo, status: 'Depois da troca de presentes', bloqueado: 'A votação abre depois da troca de presentes.' };
    case 'votacao':
      if (e.eu?.vinculo === 'outro') return { titulo, status: 'Seu perfil está em outro celular', bloqueado: 'Seu perfil está em uso em outro celular. Peça pro admin liberar.' };
      if (e.eu?.vinculo !== 'este') return { titulo, status: 'Entre no lobby por este celular para votar', acao: () => ir('lobby') };
      return {
        titulo,
        status: e.eu.votosEnviados ? 'Votos enviados · dá pra revisar até fechar' : 'Votação aberta!',
        acao: () => ir('votacao'),
        destaque: true,
      };
    case 'revelacao':
      return { titulo: 'Resultados', status: 'Hora da revelação!', acao: () => ir('revelacao'), destaque: true };
    case 'encerrada':
      return { titulo: 'Resultados', status: 'Ver os vencedores deste ano', acao: () => ir('revelacao') };
  }
}

function CartaoOpcao({ o }: { o: Opcao }) {
  return (
    <Botao
      variante="texto"
      class={`opcao${o.destaque ? ' opcao--destaque' : ''}${o.bloqueado ? ' opcao--bloqueada' : ''}`}
      bloqueado={o.bloqueado}
      onClick={o.acao}
    >
      <span class="opcao__placa">
        <span class="opcao__titulo">{o.titulo}</span>
        <span class="opcao__status">{o.status}</span>
      </span>
      <span class="opcao__icone">
        <Icone nome={o.bloqueado ? 'cadeado' : 'seta'} />
      </span>
    </Botao>
  );
}

/** Ação da vez do admin, ali no Início (ele também é participante e não troca de tela). */
function AcaoDoAdmin({ e }: { e: Estado }) {
  const f = e.edicao.fase;
  let conteudo = null;
  if (f === 'preparacao') {
    conteudo = (
      <>
        <p>Quando a turma chegar, abra o lobby. O sorteio acontece lá.</p>
        <Botao onClick={() => acaoAdmin('lobby/abrir', 'Lobby aberto!')}>Abrir lobby do sorteio</Botao>
      </>
    );
  } else if (f === 'troca') {
    conteudo = (
      <>
        <p>Quando as dicas, a troca e os roubos acabarem, abra a votação.</p>
        <Botao onClick={() => acaoAdmin('votacao/abrir', 'Votação aberta!')}>Abrir votação</Botao>
      </>
    );
  } else if (f === 'votacao') {
    const faltam = e.votacao.total - e.votacao.enviaram;
    conteudo = (
      <>
        <p>
          {e.votacao.enviaram} de {e.votacao.total} já enviaram.{faltam > 0 ? ' Quem não enviar fica de fora.' : ' Todo mundo votou!'}
        </p>
        <Confirmar
          rotulo="Fechar votação e apurar"
          pergunta={faltam > 0 ? `Ainda faltam ${faltam}. Fechar mesmo assim?` : 'Fechar a votação e apurar?'}
          variante="primario"
          confirmar={() => acaoAdmin('votacao/fechar', 'Votos apurados. Bora revelar!')}
        />
      </>
    );
  } else if (f === 'revelacao') {
    conteudo = (
      <>
        <p>A revelação é feita na tela de resultados, categoria por categoria.</p>
        <Botao onClick={() => ir('revelacao')}>Ir para a revelação</Botao>
      </>
    );
  }
  if (!conteudo) return null;
  return (
    <section class="cartao cartao--admin" aria-label="Próximo passo do admin">
      <span class="micro">Só você vê isso</span>
      {conteudo}
    </section>
  );
}

export function TelaInicio() {
  const e = estado.value;
  if (!e) return <TelaCarregando />;
  const quando = [dataCurta(e.edicao.data), e.edicao.local].filter(Boolean).join(' · ');
  // Antes do sorteio é hora de esperar: o Hall da Fama ganha destaque.
  const esperando = e.edicao.fase === 'preparacao' || e.edicao.fase === 'lobby';

  return (
    <Tela titulo={`Amigo da Onça ${e.edicao.ano}`} subtitulo={quando || 'Data e local a definir'}>
      <Carrossel frases={frases} />
      <div class="opcoes">
        <CartaoOpcao o={opcaoSorteio(e)} />
        <CartaoOpcao o={opcaoVotacao(e)} />
      </div>
      {e.eu?.admin && <AcaoDoAdmin e={e} />}
      {esperando ? (
        <ChamadaHall />
      ) : (
        <div class="links">
          <button type="button" class="botao botao--texto" onClick={abrirHall}>
            <Icone nome="trofeu" /> Hall da Fama
          </button>
        </div>
      )}
    </Tela>
  );
}
