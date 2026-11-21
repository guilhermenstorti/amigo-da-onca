import { useEffect, useState } from 'preact/hooks';
import type { AnoHall, CategoriaRevelacao, Revelacao } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao, Confirmar } from '../components/Botao';
import { Tela } from '../components/Tela';
import { acaoAdmin } from '../lib/acoes';
import { api, mensagemDe } from '../lib/api';
import { estado, pessoa, usarModoRapido } from '../lib/estado';
import { ir } from '../lib/rota';
import { dataCurta, listaNomes, mostrarToast } from '../lib/ui';
import { TelaCarregando } from './Entrada';

function useRevelacao() {
  const e = estado.value;
  const [rev, setRev] = useState<Revelacao | null>(null);
  useEffect(usarModoRapido, []);
  useEffect(() => {
    api<Revelacao>('GET', '/revelacao')
      .then(setRev)
      .catch((err) => mostrarToast(mensagemDe(err), 'alerta'));
  }, [e?.edicao.fase, e?.revelacao.reveladas]);
  return rev;
}

const nomesVencedores = (c: CategoriaRevelacao) => listaNomes((c.vencedores ?? []).map((v) => v.nome)) || 'Ninguém votou';

function Vencedor({ c, grande }: { c: CategoriaRevelacao; grande?: boolean }) {
  const vencedores = c.vencedores ?? [];
  return (
    <div class={`vencedor${grande ? ' vencedor--grande' : ''}`}>
      <div class="vencedor__fotos">
        {vencedores.map((v) => (
          <Avatar key={v.id} pessoa={pessoa(v.id)} tamanho={grande ? (vencedores.length > 1 ? 112 : 148) : 44} />
        ))}
      </div>
      <p class="vencedor__nome">{nomesVencedores(c)}</p>
      {vencedores.length > 1 && <p class="legenda">Empate: dividem o troféu!</p>}
    </div>
  );
}

export function TelaRevelacao() {
  const e = estado.value;
  const rev = useRevelacao();
  const [anuncio, setAnuncio] = useState('');
  const reveladas = rev?.reveladas ?? 0;
  const nova = rev && reveladas > 0 ? rev.categorias[reveladas - 1] : null;

  useEffect(() => {
    if (nova?.revelada) setAnuncio(`${nova.nome}: ${nomesVencedores(nova)}.`);
  }, [nova?.id]);

  if (!e || !rev) return <TelaCarregando />;
  if (!rev.disponivel) {
    return (
      <Tela titulo="Resultados" voltar>
        <section class="vidro cartao">
          <p>Os resultados aparecem aqui depois que a votação fechar.</p>
        </section>
      </Tela>
    );
  }

  const proxima = rev.categorias[reveladas];
  let rodape = null;
  if (e.eu?.admin && e.edicao.fase === 'revelacao') {
    rodape = proxima ? (
      <Botao onClick={() => acaoAdmin('revelar')}>Revelar: {proxima.nome}</Botao>
    ) : (
      <Confirmar
        rotulo="Encerrar edição"
        pergunta="Encerrar e mandar para o Hall da Fama?"
        variante="primario"
        confirmar={async () => {
          if (await acaoAdmin('encerrar', 'Edição encerrada. Até o ano que vem!')) ir('hall');
        }}
      />
    );
  }

  return (
    <Tela titulo="E o troféu vai para…" subtitulo={`${reveladas} de ${rev.total} categorias reveladas`} voltar rodape={rodape}>
      {nova && (
        <section key={nova.id} class="destaque-vencedor" aria-label={`Última revelada: ${nova.nome}`}>
          <div class="placa">
            <span class="micro">{nova.nome}</span>
            <Vencedor c={nova} grande />
            {!!nova.justificativas?.length && (
              <ul class="justificativas" aria-label="O que disseram, sem autoria">
                {nova.justificativas.map((j, i) => (
                  <li key={i}>“{j}”</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <ol class="lista-categorias">
        {rev.categorias.map((c, i) =>
          i === reveladas - 1 ? null : (
            <li key={c.id} class={`vidro lista-categorias__item${c.revelada ? '' : ' lista-categorias__item--oculta'}`}>
              <span class="micro">{c.nome}</span>
              {c.revelada ? <Vencedor c={c} /> : <p class="legenda">{e.eu?.admin && i === reveladas ? 'Próxima a revelar' : 'Ainda em segredo'}</p>}
            </li>
          ),
        )}
      </ol>
      <p class="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </Tela>
  );
}

/** Para a TV da festa: só a categoria mais recente, bem grande. Não precisa escolher perfil. */
export function TelaTelao() {
  const e = estado.value;
  const rev = useRevelacao();
  if (!e) return <TelaCarregando />;
  const reveladas = rev?.reveladas ?? 0;
  const nova = rev && reveladas > 0 ? rev.categorias[reveladas - 1] : null;
  return (
    <div class="tela telao">
      <div class="tela__fundo" aria-hidden="true" />
      <div class="tela__veu" aria-hidden="true" />
      <main class="telao__palco">
        <h1 class="telao__titulo">Amigo da Onça {e.edicao.ano}</h1>
        {nova ? (
          <section key={nova.id} class="destaque-vencedor destaque-vencedor--telao" aria-live="polite">
            <div class="placa">
              <span class="telao__categoria">{nova.nome}</span>
              <Vencedor c={nova} grande />
              {!!nova.justificativas?.length && (
                <ul class="justificativas">
                  {nova.justificativas.map((j, i) => (
                    <li key={i}>“{j}”</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : (
          <p class="telao__espera">{rev?.disponivel ? 'Já já começa a revelação…' : 'A revelação começa depois da votação.'}</p>
        )}
        {rev?.disponivel && (
          <p class="telao__progresso">
            {reveladas} de {rev.total} categorias
          </p>
        )}
      </main>
    </div>
  );
}

export function TelaHall() {
  const [anos, setAnos] = useState<AnoHall[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    api<AnoHall[]>('GET', '/hall')
      .then(setAnos)
      .catch((err) => setErro(mensagemDe(err)));
  }, []);

  return (
    <Tela titulo="Hall da Fama" subtitulo="Os vencedores de cada ano." voltar>
      {erro && <p class="erro">{erro}</p>}
      {!anos && !erro && <p class="legenda centro">Carregando…</p>}
      {anos?.length === 0 && (
        <section class="vidro cartao">
          <p>Ainda ninguém no Hall. A primeira edição encerrada aparece aqui.</p>
        </section>
      )}
      {anos?.map((a) => (
        <section key={a.ano} class="vidro cartao hall-ano" aria-labelledby={`ano-${a.ano}`}>
          <header>
            <h2 id={`ano-${a.ano}`}>{a.ano}</h2>
            {(a.data || a.local) && <p class="legenda">{[dataCurta(a.data), a.local].filter(Boolean).join(' · ')}</p>}
          </header>
          <ul>
            {a.categorias.map((c) => (
              <li key={c.id} class="hall-ano__linha">
                <span class="hall-ano__categoria">{c.nome}</span>
                <span class="hall-ano__vencedores">
                  {c.vencedores.length ? (
                    c.vencedores.map((v) => (
                      <span key={v.id} class="hall-ano__vencedor">
                        <Avatar pessoa={pessoa(v.id) ?? { nome: v.nome, foto: null }} tamanho={28} />
                        {v.nome}
                      </span>
                    ))
                  ) : (
                    <span class="legenda">—</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Tela>
  );
}
