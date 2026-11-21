import { useEffect, useRef, useState } from 'preact/hooks';
import type { MeuSorteio } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao } from '../components/Botao';
import { Icone } from '../components/Icone';
import { Tela } from '../components/Tela';
import { api, mensagemDe } from '../lib/api';
import { estado, pessoa } from '../lib/estado';
import { gravar, ler } from '../lib/local';
import { ir } from '../lib/rota';
import { reduzirMovimento } from '../lib/ui';

type Etapa = 'carregando' | 'roleta' | 'girando' | 'pronto';

/**
 * O "tecido" de pelagem que esconde quem você tirou:
 * aberto = sem tecido (primeira revelação) · fechado = coberto, parado (ao abrir a tela)
 * cobrindo = sendo jogado por cima · puxando = sendo puxado para longe.
 */
type Tecido = 'aberto' | 'fechado' | 'cobrindo' | 'puxando';

const VISIVEL_MS = 1500;
/** Foto e nome entram ~300 ms depois do giro e levam ~1 s para assentar; o 1,5 s conta a partir daí. */
const ENTRADA_MS = 1300;

/** Passa pelos outros nomes, desacelerando, e para no sorteado. */
function sequenciaRoleta(outros: string[], alvo: string) {
  const base = [...outros].sort(() => Math.random() - 0.5);
  const seq = [...base, ...base].filter((n, i, a) => n !== a[i - 1]);
  while (seq.length && seq[seq.length - 1] === alvo) seq.pop();
  return [...seq.slice(-15), alvo];
}

export function TelaSorteio() {
  const e = estado.value;
  const [dados, setDados] = useState<MeuSorteio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [nomeRoleta, setNomeRoleta] = useState('…');
  const [tecido, setTecido] = useState<Tecido>('fechado');
  const [anuncio, setAnuncio] = useState('');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const timerProtecao = useRef<ReturnType<typeof setTimeout>>();
  const fase = e?.edicao.fase;
  const visivel = tecido === 'aberto' || tecido === 'puxando';

  const depois = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const esconder = () => {
    clearTimeout(timerProtecao.current);
    setTecido((t) => (t === 'fechado' || t === 'cobrindo' ? t : 'cobrindo'));
  };

  const mostrar = (ms = VISIVEL_MS) => {
    if (!dados) return;
    setTecido((t) => (t === 'aberto' ? t : 'puxando'));
    const texto = `Você tirou ${dados.recebedor.nome}.`;
    setAnuncio('');
    requestAnimationFrame(() => setAnuncio(texto));
    clearTimeout(timerProtecao.current);
    timerProtecao.current = setTimeout(esconder, ms);
  };

  // Sorteio refeito pelo admin: volta para o lobby.
  useEffect(() => {
    if (fase === 'lobby' || fase === 'preparacao') ir('lobby');
  }, [fase]);

  useEffect(() => {
    api<MeuSorteio>('GET', '/sorteio/meu')
      .then(setDados)
      .catch((err) => setErro(mensagemDe(err)));
  }, []);

  // Ao sair do app (ou bloquear a tela), o tecido já fica por cima, sem animação.
  useEffect(() => {
    const aoOcultar = () => {
      if (!document.hidden) return;
      clearTimeout(timerProtecao.current);
      setTecido('fechado');
    };
    document.addEventListener('visibilitychange', aoOcultar);
    return () => {
      document.removeEventListener('visibilitychange', aoOcultar);
      timers.current.forEach(clearTimeout);
      clearTimeout(timerProtecao.current);
    };
  }, []);

  useEffect(() => {
    if (!dados || !e) return;
    // Cada sorteio (refeito ou depois de recomeçar a edição) tem sua marca: a roleta toca de novo.
    const chave = `onca:visto:${e.edicao.ano}`;
    const marca = `${dados.recebedor.id}:${dados.sorteadoEm}`;
    const jaViu = ler(chave) === marca;
    gravar(chave, marca);
    if (jaViu) {
      setEtapa('pronto');
      return;
    }
    if (reduzirMovimento.value) {
      setTecido('aberto');
      setEtapa('pronto');
      mostrar();
      return;
    }
    setEtapa('roleta');
    const seq = sequenciaRoleta(dados.outros, dados.recebedor.nome);
    let t = 0;
    seq.forEach((nome, i) => {
      depois(t, () => setNomeRoleta(nome));
      t += 60 + 260 * (i / seq.length) ** 2;
    });
    depois(t + 600, () => {
      // O verso gira sem tecido; foto e nome esperam o giro terminar para entrar.
      setTecido('aberto');
      setEtapa('girando');
    });
    depois(t + 600 + 1000, () => {
      setEtapa('pronto');
      mostrar(ENTRADA_MS + VISIVEL_MS);
    });
  }, [dados]);

  const virado = etapa === 'girando' || etapa === 'pronto';
  const classeConteudo =
    etapa === 'girando' ? ' protecao__conteudo--espera' : etapa === 'pronto' && tecido === 'aberto' ? ' protecao__conteudo--entra' : '';

  return (
    <Tela titulo="Seu amigo da onça" subtitulo="Só você vê quem tirou. Shhh." voltar>
      {erro ? (
        <section class="vidro cartao">
          <p>{erro}</p>
          <Botao variante="secundario" onClick={() => ir('lobby')}>
            Ir para o lobby
          </Botao>
        </section>
      ) : (
        <>
          <div class={`revelacao-card${virado ? ' revelacao-card--virado' : ''}`}>
            <div class="revelacao-card__giro">
              <div class="revelacao-card__frente" aria-hidden={virado}>
                <div class="placa">
                  <span class="legenda">Seu amigo da onça é…</span>
                  <span class="roleta" aria-hidden="true">
                    {etapa === 'carregando' ? '…' : nomeRoleta}
                  </span>
                </div>
              </div>
              <div class="revelacao-card__verso" aria-hidden={!virado}>
                <span class="legenda">Você tirou</span>
                <div class={`protecao protecao--${tecido}`}>
                  <div class={`protecao__conteudo${classeConteudo}`} aria-hidden={!visivel || etapa !== 'pronto'}>
                    <Avatar pessoa={pessoa(dados?.recebedor.id)} tamanho={96} />
                    <span class="protecao__nome">{dados?.recebedor.nome}</span>
                  </div>
                  <span class="protecao__tecido" aria-hidden="true" />
                  {!visivel && <span class="sr-only">Nome e foto escondidos</span>}
                </div>
              </div>
            </div>
          </div>

          {etapa === 'pronto' && (
            <Botao variante="secundario" onClick={() => (visivel ? esconder() : mostrar())}>
              <Icone nome="olho" /> {visivel ? 'Esconder agora' : 'Mostrar de novo'}
            </Botao>
          )}
          <p class="legenda centro">A onça cobre o nome sozinha para ninguém espiar pelo seu ombro.</p>
          <p class="sr-only" aria-live="assertive">
            {anuncio}
          </p>
        </>
      )}
    </Tela>
  );
}
