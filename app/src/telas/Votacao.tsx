import { useEffect, useRef, useState } from 'preact/hooks';
import type { Estado, MeusVotos } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao } from '../components/Botao';
import { Tela } from '../components/Tela';
import { api, mensagemDe } from '../lib/api';
import { atualizar, estado, pessoa } from '../lib/estado';
import { ir } from '../lib/rota';
import { mostrarToast } from '../lib/ui';
import { TelaCarregando } from './Entrada';

export function TelaVotacao() {
  const e = estado.value;
  if (!e?.eu) return <TelaCarregando />;
  if (e.edicao.fase !== 'votacao') {
    return (
      <Tela titulo="Votação" voltar>
        <section class="vidro cartao">
          <p>{['revelacao', 'encerrada'].includes(e.edicao.fase) ? 'A votação já fechou. Bora ver quem ganhou!' : 'A votação ainda não abriu.'}</p>
          {['revelacao', 'encerrada'].includes(e.edicao.fase) && <Botao onClick={() => ir('revelacao')}>Ver resultados</Botao>}
        </section>
      </Tela>
    );
  }
  return <Votacao e={e} />;
}

function Votacao({ e }: { e: Estado }) {
  const categorias = e.votacao.categorias;
  const candidatos = e.pessoas.filter((p) => p.naEdicao);
  const [meus, setMeus] = useState<MeusVotos | null>(null);
  const [passo, setPasso] = useState(0);
  const [texto, setTexto] = useState('');
  const salvoTexto = useRef('');

  useEffect(() => {
    api<MeusVotos>('GET', '/votos')
      .then((m) => {
        setMeus(m);
        const primeiraVazia = categorias.findIndex((c) => !m.votos[c.id]);
        setPasso(m.enviada || primeiraVazia === -1 ? categorias.length : primeiraVazia);
      })
      .catch((err) => mostrarToast(mensagemDe(err), 'alerta'));
  }, []);

  const cat = categorias[passo];
  const voto = cat ? meus?.votos[cat.id] : undefined;

  // Ao trocar de categoria, carrega a justificativa já salva.
  useEffect(() => {
    const j = (cat && meus?.votos[cat.id]?.justificativa) ?? '';
    setTexto(j);
    salvoTexto.current = j;
  }, [passo, !!meus]);

  if (!meus) return <TelaCarregando />;

  const salvar = async (indicado: string, justificativa: string) => {
    if (!cat) return;
    const anterior = meus.votos[cat.id];
    setMeus({ ...meus, votos: { ...meus.votos, [cat.id]: { indicado, justificativa: justificativa || null } } });
    try {
      await api('PUT', `/votos/${cat.id}`, { indicado, justificativa });
      salvoTexto.current = justificativa;
    } catch (err) {
      setMeus((m) => m && { ...m, votos: { ...m.votos, [cat.id]: anterior } });
      mostrarToast(mensagemDe(err), 'alerta');
    }
  };

  const salvarTextoSeMudou = async () => {
    if (voto && texto.trim() !== salvoTexto.current.trim()) await salvar(voto.indicado, texto.trim());
  };

  const avancar = async () => {
    await salvarTextoSeMudou();
    setPasso((p) => p + 1);
    window.scrollTo(0, 0);
  };

  const enviar = async () => {
    try {
      await api('POST', '/votos/enviar');
      await atualizar();
      mostrarToast('Votos enviados. RaWrRrRRrRR!', 'ouro');
      ir('inicio');
    } catch (err) {
      mostrarToast(mensagemDe(err), 'alerta');
    }
  };

  // ---------- Revisão ----------
  if (!cat) {
    return (
      <Tela
        titulo="Revisão"
        subtitulo={meus.enviada ? 'Votos enviados. Dá para mudar até a votação fechar.' : 'Confere e envia. Ninguém vai saber em quem você votou.'}
        voltar
        rodape={
          meus.enviada ? (
            <Botao variante="secundario" onClick={() => ir('inicio')}>
              Voltar ao início
            </Botao>
          ) : (
            <Botao onClick={enviar}>Enviar votos</Botao>
          )
        }
      >
        <ul class="revisao">
          {categorias.map((c, i) => {
            const v = meus.votos[c.id];
            const p = pessoa(v?.indicado);
            return (
              <li key={c.id} class="vidro revisao__item">
                {p ? <Avatar pessoa={p} tamanho={44} /> : <span class="avatar-vazio" aria-hidden="true" />}
                <div class="revisao__texto">
                  <span class="micro">{c.nome}</span>
                  <span class="revisao__nome">{p ? (p.id === e.eu?.id ? `${p.nome} (você)` : p.nome) : 'Sem voto'}</span>
                  {v?.justificativa && <span class="revisao__frase">“{v.justificativa}”</span>}
                </div>
                <button type="button" class="botao botao--texto" onClick={() => setPasso(i)} aria-label={`Trocar voto em ${c.nome}`}>
                  Trocar
                </button>
              </li>
            );
          })}
        </ul>
      </Tela>
    );
  }

  // ---------- Uma categoria por tela ----------
  const ultima = passo === categorias.length - 1;
  return (
    <Tela
      titulo={cat.nome}
      subtitulo={cat.descricao}
      voltar
      rodape={
        <>
          {passo > 0 && (
            <Botao variante="secundario" class="botao--estreito" onClick={() => salvarTextoSeMudou().then(() => setPasso((p) => p - 1))}>
              Voltar
            </Botao>
          )}
          <Botao bloqueado={!voto && 'Escolha alguém primeiro.'} onClick={avancar}>
            {ultima ? 'Revisar votos' : 'Próxima'}
          </Botao>
        </>
      }
    >
      <p class="progresso" aria-label={`Categoria ${passo + 1} de ${categorias.length}`}>
        {categorias.map((_, i) => (
          <span key={i} class={i === passo ? 'atual' : i < passo || meus.votos[categorias[i].id] ? 'feito' : ''} />
        ))}
        <span class="micro">
          {passo + 1} de {categorias.length}
        </span>
      </p>

      <fieldset class="escolha">
        <legend class="sr-only">Quem leva {cat.nome}?</legend>
        <div class="chips-pessoas">
          {candidatos.map((p) => {
            const marcado = voto?.indicado === p.id;
            return (
              <button
                key={p.id}
                type="button"
                class={`chip-pessoa${marcado ? ' chip-pessoa--marcado' : ''}`}
                aria-pressed={marcado}
                onClick={() => salvar(p.id, texto.trim())}
              >
                <Avatar pessoa={p} tamanho={40} />
                <span>{p.id === e.eu?.id ? `${p.nome} (você)` : p.nome}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div class="formulario">
        <label for="justificativa" class="rotulo">
          Por quê? <span class="legenda">(opcional e anônimo)</span>
        </label>
        <textarea
          id="justificativa"
          class="campo campo--area"
          rows={2}
          maxLength={140}
          value={texto}
          placeholder="Lido em voz alta na revelação, sem dizer quem escreveu."
          onInput={(ev) => setTexto(ev.currentTarget.value)}
          onBlur={() => void salvarTextoSeMudou()}
          enterkeyhint="done"
        />
        <span class="legenda direita" aria-live="polite">
          {texto.length > 120 ? `${140 - texto.length} caracteres restantes` : ''}
        </span>
      </div>
    </Tela>
  );
}
