import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { AnoHall, PinHall } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Folha } from '../components/Folha';
import { Icone } from '../components/Icone';
import { Pin } from '../components/Pin';
import { Tela } from '../components/Tela';
import { api, mensagemDe } from '../lib/api';
import { estado, usarModoRapido } from '../lib/estado';
import { abrirHall, fecharHall, hallAberto, rota } from '../lib/rota';
import { dataCurta, listaNomes } from '../lib/ui';

// O Hall fica guardado entre aberturas: abre na hora e se atualiza por trás.
const anos = signal<AnoHall[] | null>(null);
const erro = signal<string | null>(null);
/** Ano que a pessoa escolheu nas abas (null = o padrão). */
const anoEscolhido = signal<number | null>(null);

function carregar() {
  return api<AnoHall[]>('GET', '/hall')
    .then((a) => {
      anos.value = a;
      erro.value = null;
    })
    .catch((e) => {
      if (!anos.value) erro.value = mensagemDe(e);
    });
}

/** Abre no ano mais recente que tem algo para ver (pins entregues ou fotos). */
function anoPadrao(lista: AnoHall[]) {
  return lista.find((a) => a.pins.some((p) => p.vencedores?.length) || a.fotosUrl) ?? lista[0];
}

/** Conteúdo do Hall: abas por ano, sala de troféus e highlights. */
export function HallDaFama() {
  const e = estado.value;
  const fase = e?.edicao.fase;
  // Durante a revelação, cada pin entregue aparece aqui na hora.
  useEffect(() => void carregar(), [fase, e?.revelacao.reveladas]);
  useEffect(() => (fase === 'revelacao' ? usarModoRapido() : undefined), [fase]);

  const lista = anos.value;
  if (!lista) return erro.value ? <p class="erro">{erro.value}</p> : <p class="legenda centro">Carregando…</p>;
  if (!lista.length) {
    return (
      <section class="vidro cartao">
        <p>O Hall ainda está vazio.</p>
      </section>
    );
  }
  const ano = lista.find((a) => a.ano === anoEscolhido.value) ?? anoPadrao(lista);

  return (
    <div class="hall">
      {lista.length > 1 && (
        <div class="abas-rolagem" role="tablist" aria-label="Anos do Hall da Fama">
          {lista.map((a) => (
            <button
              key={a.ano}
              type="button"
              role="tab"
              id={`aba-hall-${a.ano}`}
              aria-selected={a.ano === ano.ano}
              aria-controls="painel-hall"
              class={`aba${a.ano === ano.ano ? ' aba--ativa' : ''}`}
              onClick={() => (anoEscolhido.value = a.ano)}
            >
              {a.ano}
            </button>
          ))}
        </div>
      )}
      <AnoDoHall key={ano.ano} a={ano} />
    </div>
  );
}

function avisoDaSala(a: AnoHall): string | null {
  switch (a.premiacao) {
    case 'sem':
      return 'Ano sem premiação';
    case 'em-breve':
      return 'Os pins são entregues na revelação, no fim da festa';
    case 'revelando': {
      const entregues = a.pins.filter((p) => p.vencedores !== null).length;
      return `Revelação ao vivo · ${entregues} de ${a.pins.length} pins entregues`;
    }
    case 'completa':
      return null;
  }
}

function AnoDoHall({ a }: { a: AnoHall }) {
  const quando = [dataCurta(a.data), a.local].filter(Boolean).join(' · ');
  const aviso = avisoDaSala(a);
  return (
    <div class="hall-ano" id="painel-hall" role="tabpanel" aria-labelledby={`aba-hall-${a.ano}`}>
      <header class="hall-ano__topo">
        <h3>Amigo da Onça {a.ano}</h3>
        {quando && <p class="legenda">{quando}</p>}
      </header>

      <section class="vidro sala" aria-labelledby={`sala-${a.ano}`}>
        <h4 id={`sala-${a.ano}`} class="micro">
          Sala de troféus
        </h4>
        {aviso && (
          <p class={`sala__aviso${a.premiacao === 'revelando' ? ' sala__aviso--ao-vivo' : ''}`} role={a.premiacao === 'revelando' ? 'status' : undefined}>
            {aviso}
          </p>
        )}
        <ul class="sala__estante">
          {a.pins.map((p) => (
            <Trofeu key={p.id} p={p} emSegredo={a.premiacao === 'revelando'} />
          ))}
        </ul>
      </section>

      <Highlights a={a} />
    </div>
  );
}

function Trofeu({ p, emSegredo }: { p: PinHall; emSegredo: boolean }) {
  const vencedores = p.vencedores ?? [];
  const entregue = vencedores.length > 0;
  let legenda: string | null = null;
  if (p.vencedores === null && emSegredo) legenda = 'Em segredo';
  else if (p.vencedores && !entregue) legenda = 'Ninguém levou';
  return (
    <li class={`trofeu${entregue ? '' : ' trofeu--sombra'}`}>
      <span class="trofeu__pin">
        <Pin categoria={p.id} sombra={!entregue} tamanho={76} />
      </span>
      <span class="trofeu__categoria">{p.nome}</span>
      {entregue ? (
        <span class="trofeu__vencedores">
          <span class="trofeu__fotos">
            {vencedores.map((v) => (
              <Avatar key={v.id} pessoa={v} tamanho={vencedores.length > 1 ? 30 : 36} />
            ))}
          </span>
          <span class="trofeu__nome">{listaNomes(vencedores.map((v) => v.nome))}</span>
        </span>
      ) : (
        legenda && <span class="trofeu__legenda">{legenda}</span>
      )}
    </li>
  );
}

function ehDrive(url: string) {
  try {
    return /(^|\.)drive\.google\.com$/.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function Highlights({ a }: { a: AnoHall }) {
  const noLobby = rota.value === 'lobby' && estado.value?.edicao.fase === 'lobby';
  return (
    <section class="vidro cartao highlights" aria-labelledby={`highlights-${a.ano}`}>
      <h4 id={`highlights-${a.ano}`} class="micro">
        Highlights
      </h4>
      {a.fotosUrl ? (
        <>
          <p>As fotos da festa de {a.ano}, em qualidade original.</p>
          <a class="botao botao--secundario" href={a.fotosUrl} target="_blank" rel="noopener noreferrer">
            <Icone nome="fotos" />
            {ehDrive(a.fotosUrl) ? 'Ver no Google Drive' : 'Ver as fotos'}
            <Icone nome="externo" tamanho={16} />
          </a>
          <p class="legenda">Abre em outra aba{noLobby ? ': você continua no lobby' : ''}.</p>
        </>
      ) : (
        <p class="legenda">{a.atual && a.premiacao !== 'completa' ? 'As fotos desta festa aparecem aqui depois dela.' : `As fotos de ${a.ano} ainda não chegaram.`}</p>
      )}
    </section>
  );
}

/** Rota #/hall (ex.: depois de encerrar a edição). */
export function TelaHall() {
  return (
    <Tela titulo="Hall da Fama" subtitulo="Os pins de cada ano e as fotos das festas." voltar>
      <HallDaFama />
    </Tela>
  );
}

/** O Hall por cima da tela atual. No lobby, a pessoa continua lá: presença, roleta e som seguem funcionando embaixo. */
export function FolhaHall() {
  return (
    <Folha cheia aberta={hallAberto.value} aoFechar={fecharHall} titulo="Hall da Fama">
      <FaixaLobby />
      <HallDaFama />
    </Folha>
  );
}

/** Lembrete fixo no topo do Hall: você não saiu do lobby. */
function FaixaLobby() {
  const e = estado.value;
  if (!e?.eu || rota.value !== 'lobby' || e.edicao.fase !== 'lobby' || e.eu.vinculo !== 'este') return null;
  const { presentes, total, completo } = e.lobby;
  const admin = e.pessoas.find((p) => p.admin);
  let texto = `Você continua no lobby · ${presentes.length} de ${total} na toca`;
  if (completo) texto = e.eu.admin ? 'Todo mundo na toca!' : `Todo mundo na toca. Já já ${admin?.nome ?? 'o admin'} sorteia.`;
  return (
    <div class="faixa-lobby">
      <div class={`faixa-lobby__pilula${completo ? ' faixa-lobby__pilula--completo' : ''}`} role="status">
        <span key={presentes.length} class="faixa-lobby__ponto" aria-hidden="true" />
        <span class="faixa-lobby__texto">{texto}</span>
        <button type="button" class="botao botao--texto botao--mini" onClick={fecharHall}>
          {completo && e.eu.admin ? 'Sortear' : 'Voltar'}
        </button>
      </div>
    </div>
  );
}

/** "Enquanto espera…": chama para o Hall nos momentos de espera (lobby e Início). */
export function ChamadaHall() {
  return (
    <button type="button" class="chamada-hall" onClick={abrirHall}>
      <span class="chamada-hall__pin" aria-hidden="true">
        <Pin categoria="presente-do-ano" tamanho={52} />
      </span>
      <span class="chamada-hall__texto">
        <span class="chamada-hall__titulo">Enquanto espera, que tal conhecer o nosso Hall da Fama?</span>
        <span class="legenda">Os pins de cada ano e as fotos das festas.</span>
      </span>
      <span class="chamada-hall__seta" aria-hidden="true">
        <Icone nome="seta" />
      </span>
    </button>
  );
}
