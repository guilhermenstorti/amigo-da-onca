import { useEffect, useState } from 'preact/hooks';
import type { AnoHall, Gestao as DadosGestao } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao, Confirmar } from '../components/Botao';
import { Icone } from '../components/Icone';
import { api, mensagemDe } from '../lib/api';
import { atualizar, estado, pessoa } from '../lib/estado';
import { mostrarToast } from '../lib/ui';

type Aba = 'edicao' | 'pessoas' | 'categorias' | 'hall';

async function salvarComAviso(fn: () => Promise<unknown>, sucesso: string) {
  try {
    await fn();
    await atualizar();
    mostrarToast(sucesso, 'sucesso');
    return true;
  } catch (e) {
    mostrarToast(mensagemDe(e), 'alerta');
    return false;
  }
}

export function Gestao({ aba }: { aba: Aba }) {
  const [dados, setDados] = useState<DadosGestao | null>(null);
  const recarregar = () =>
    api<DadosGestao>('GET', '/admin/gestao')
      .then(setDados)
      .catch((e) => mostrarToast(mensagemDe(e), 'alerta'));
  useEffect(() => void recarregar(), []);
  if (!dados) return <p class="legenda">Carregando…</p>;
  if (aba === 'edicao') return <AbaEdicao dados={dados} recarregar={recarregar} />;
  if (aba === 'pessoas') return <AbaPessoas dados={dados} recarregar={recarregar} />;
  if (aba === 'categorias') return <AbaCategorias dados={dados} recarregar={recarregar} />;
  return <AbaHall dados={dados} />;
}

interface PropsAba {
  dados: DadosGestao;
  recarregar: () => Promise<void>;
}

// ---------- Edição ----------

function AbaEdicao({ dados, recarregar }: PropsAba) {
  const atual = dados.edicoes.find((e) => e.atual);
  const [data, setData] = useState(atual?.data ?? '');
  const [local, setLocal] = useState(atual?.local ?? '');
  const [quem, setQuem] = useState<string[]>(atual?.participantes ?? []);
  const [novoAno, setNovoAno] = useState(String((atual?.ano ?? new Date().getFullYear()) + 1));
  const ativos = dados.participantes.filter((p) => p.ativo);
  const podeMudarQuem = atual && (atual.fase === 'preparacao' || atual.fase === 'lobby');

  return (
    <div class="gestao">
      {atual && (
        <form class="formulario" onSubmit={(ev) => ev.preventDefault()}>
          <h3>Edição {atual.ano}</h3>
          <label class="rotulo" for="ed-data">
            Data da festa
          </label>
          <input id="ed-data" class="campo" type="date" value={data} onInput={(ev) => setData(ev.currentTarget.value)} />
          <label class="rotulo" for="ed-local">
            Local
          </label>
          <input id="ed-local" class="campo" type="text" maxLength={80} value={local} placeholder="Ex.: Casa da Maju" onInput={(ev) => setLocal(ev.currentTarget.value)} />
          <fieldset class="escolha">
            <legend class="rotulo">Quem participa{podeMudarQuem ? '' : ' (só muda antes do sorteio)'}</legend>
            <div class="chips-pessoas">
              {ativos.map((p) => {
                const marcado = quem.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    class={`chip-pessoa${marcado ? ' chip-pessoa--marcado' : ''}`}
                    aria-pressed={marcado}
                    onClick={() => podeMudarQuem && setQuem(marcado ? quem.filter((x) => x !== p.id) : [...quem, p.id])}
                  >
                    <Avatar pessoa={pessoa(p.id) ?? { nome: p.nome, foto: null }} tamanho={32} />
                    <span>{p.nome}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Botao
            onClick={() =>
              salvarComAviso(
                () => api('PUT', '/admin/edicao', { ano: atual.ano, data, local, ...(podeMudarQuem ? { participantes: quem } : {}) }),
                'Edição salva.',
              ).then(recarregar)
            }
          >
            Salvar edição
          </Botao>
        </form>
      )}

      <form class="formulario separado" onSubmit={(ev) => ev.preventDefault()}>
        <h3>Nova edição</h3>
        <p class="legenda">Quando a edição atual estiver encerrada, crie a do ano seguinte. Ela começa com todos os participantes ativos.</p>
        <label class="rotulo" for="ed-ano">
          Ano
        </label>
        <input id="ed-ano" class="campo" type="number" inputMode="numeric" value={novoAno} onInput={(ev) => setNovoAno(ev.currentTarget.value)} />
        <Confirmar
          rotulo={`Criar edição ${novoAno}`}
          pergunta={`Criar ${novoAno} e torná-la a edição atual?`}
          confirmar={() => salvarComAviso(() => api('PUT', '/admin/edicao', { ano: Number(novoAno) }), `Edição ${novoAno} criada!`).then(recarregar)}
        />
      </form>
    </div>
  );
}

// ---------- Pessoas ----------

/** Recorta em quadrado/círculo e reduz no próprio celular antes de enviar. */
async function redimensionar(arquivo: File, lado: number): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d')!;
  const s = Math.min(bmp.width, bmp.height);
  g.fillStyle = '#1c1915';
  g.fillRect(0, 0, lado, lado);
  g.save();
  g.beginPath();
  g.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
  g.clip();
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, lado, lado);
  g.restore();
  const em = (tipo: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, tipo, q));
  const webp = await em('image/webp', 0.82);
  // O Safari não gera WebP pelo canvas: cai para JPEG.
  return webp?.type === 'image/webp' ? webp : (await em('image/jpeg', 0.85))!;
}

function AbaPessoas({ dados, recarregar }: PropsAba) {
  const [novo, setNovo] = useState('');
  return (
    <div class="gestao">
      <ul class="lista-gestao">
        {dados.participantes.map((p) => (
          <LinhaPessoa key={p.id} p={p} recarregar={recarregar} />
        ))}
      </ul>
      <form class="formulario separado" onSubmit={(ev) => ev.preventDefault()}>
        <h3>Adicionar pessoa</h3>
        <label class="rotulo" for="nova-pessoa">
          Nome
        </label>
        <input id="nova-pessoa" class="campo" maxLength={30} value={novo} onInput={(ev) => setNovo(ev.currentTarget.value)} />
        <Botao
          bloqueado={!novo.trim() && 'Digite o nome.'}
          onClick={() => {
            const id = novo
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 24);
            return salvarComAviso(() => api('PUT', `/admin/participantes/${id}`, { nome: novo.trim(), ativo: true }), `${novo.trim()} entrou na turma!`)
              .then(() => setNovo(''))
              .then(recarregar);
          }}
        >
          Adicionar
        </Botao>
      </form>
    </div>
  );
}

function LinhaPessoa({ p, recarregar }: { p: DadosGestao['participantes'][number]; recarregar: () => Promise<void> }) {
  const [nome, setNome] = useState(p.nome);
  const [ativo, setAtivo] = useState(p.ativo);
  const [enviando, setEnviando] = useState(false);
  const mudou = nome.trim() !== p.nome || ativo !== p.ativo;

  const enviarFoto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setEnviando(true);
    await salvarComAviso(async () => {
      for (const lado of [256, 512]) await api('PUT', `/admin/fotos/${p.id}/${lado}`, undefined, { bruto: await redimensionar(arquivo, lado) });
    }, `Foto de ${p.nome} atualizada.`);
    setEnviando(false);
    await recarregar();
  };

  return (
    <li class="lista-gestao__linha">
      <Avatar pessoa={pessoa(p.id) ?? { nome: p.nome, foto: null }} tamanho={48} ausente={!ativo} />
      <div class="lista-gestao__campos">
        <input class="campo" aria-label={`Nome de ${p.nome}`} maxLength={30} value={nome} onInput={(ev) => setNome(ev.currentTarget.value)} />
        <div class="linha">
          <label class="arquivo">
            <input type="file" accept="image/*" class="sr-only" onChange={(ev) => void enviarFoto(ev.currentTarget.files?.[0])} />
            <span class="botao botao--texto botao--mini">{enviando ? 'Enviando…' : p.temFoto ? 'Trocar foto' : 'Pôr foto'}</span>
          </label>
          {!p.admin && (
            <label class="interruptor">
              <input type="checkbox" role="switch" checked={ativo} onChange={(ev) => setAtivo(ev.currentTarget.checked)} />
              <span>Ativo</span>
            </label>
          )}
          {mudou && (
            <Botao variante="texto" class="botao--mini" onClick={() => salvarComAviso(() => api('PUT', `/admin/participantes/${p.id}`, { nome, ativo }), 'Salvo.').then(recarregar)}>
              Salvar
            </Botao>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------- Categorias ----------

function AbaCategorias({ dados, recarregar }: PropsAba) {
  const [lista, setLista] = useState(dados.categorias.map((c) => ({ ...c })));
  const mudar = (i: number, campo: 'nome' | 'descricao' | 'ativa', valor: string | boolean) =>
    setLista(lista.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));
  const mover = (i: number, d: -1 | 1) => {
    const nova = [...lista];
    [nova[i], nova[i + d]] = [nova[i + d], nova[i]];
    setLista(nova);
  };

  return (
    <div class="gestao">
      <p class="legenda">Valem para a próxima votação que abrir. O histórico guarda os nomes de cada ano.</p>
      <ul class="lista-gestao">
        {lista.map((c, i) => (
          <li key={c.id || i} class="lista-gestao__linha lista-gestao__linha--coluna">
            <input class="campo" aria-label="Nome da categoria" maxLength={50} value={c.nome} onInput={(ev) => mudar(i, 'nome', ev.currentTarget.value)} />
            <input class="campo" aria-label="Descrição" maxLength={120} value={c.descricao} placeholder="Descrição curta" onInput={(ev) => mudar(i, 'descricao', ev.currentTarget.value)} />
            <div class="linha">
              <label class="interruptor">
                <input type="checkbox" role="switch" checked={c.ativa} onChange={(ev) => mudar(i, 'ativa', ev.currentTarget.checked)} />
                <span>Ativa</span>
              </label>
              <button type="button" class="botao botao--icone botao--mini" aria-label={`Subir ${c.nome}`} onClick={() => i > 0 && mover(i, -1)}>
                <Icone nome="subir" tamanho={18} />
              </button>
              <button type="button" class="botao botao--icone botao--mini" aria-label={`Descer ${c.nome}`} onClick={() => i < lista.length - 1 && mover(i, 1)}>
                <Icone nome="descer" tamanho={18} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Botao variante="secundario" onClick={() => setLista([...lista, { id: '', nome: 'Nova categoria', descricao: '', ordem: lista.length + 1, ativa: true }])}>
        <Icone nome="mais" /> Nova categoria
      </Botao>
      <Botao onClick={() => salvarComAviso(() => api('PUT', '/admin/categorias', { categorias: lista }), 'Categorias salvas.').then(recarregar)}>
        Salvar categorias
      </Botao>
    </div>
  );
}

// ---------- Hall da Fama ----------

interface Rascunho {
  ano: string;
  data: string;
  local: string;
  categorias: { nome: string; vencedores: string[] }[];
}

const rascunhoDe = (a: AnoHall): Rascunho => ({
  ano: String(a.ano),
  data: a.data ?? '',
  local: a.local ?? '',
  categorias: a.categorias.map((c) => ({ nome: c.nome, vencedores: c.vencedores.map((v) => v.id) })),
});

function AbaHall({ dados }: { dados: DadosGestao }) {
  const [anos, setAnos] = useState<AnoHall[] | null>(null);
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const carregar = () =>
    api<AnoHall[]>('GET', '/hall')
      .then(setAnos)
      .catch((e) => mostrarToast(mensagemDe(e), 'alerta'));
  useEffect(() => void carregar(), []);
  const anoAtual = estado.value?.edicao.ano;

  if (editando) {
    return (
      <EditorAno
        r={editando}
        pessoas={dados.participantes}
        aoFechar={() => {
          setEditando(null);
          void carregar();
        }}
      />
    );
  }

  return (
    <div class="gestao">
      <p class="legenda">Cadastre os anos de antes do app ou corrija algum resultado.</p>
      <ul class="lista-gestao">
        {anos?.map((a) => (
          <li key={a.ano} class="lista-gestao__linha">
            <span class="lista-gestao__ano">{a.ano}</span>
            <span class="legenda">{a.categorias.length} categorias</span>
            <Botao variante="texto" class="botao--mini" onClick={() => setEditando(rascunhoDe(a))}>
              Editar
            </Botao>
          </li>
        ))}
      </ul>
      <Botao
        variante="secundario"
        onClick={() =>
          setEditando({
            ano: String(Math.min(...(anos ?? []).map((a) => a.ano), anoAtual ?? new Date().getFullYear()) - 1),
            data: '',
            local: '',
            categorias: dados.categorias.filter((c) => c.ativa).map((c) => ({ nome: c.nome, vencedores: [] })),
          })
        }
      >
        <Icone nome="mais" /> Cadastrar um ano
      </Botao>
    </div>
  );
}

function EditorAno({ r, pessoas, aoFechar }: { r: Rascunho; pessoas: DadosGestao['participantes']; aoFechar: () => void }) {
  const [d, setD] = useState(r);
  const mudarCategoria = (i: number, c: Rascunho['categorias'][number]) => setD({ ...d, categorias: d.categorias.map((x, j) => (j === i ? c : x)) });
  return (
    <form class="gestao formulario" onSubmit={(ev) => ev.preventDefault()}>
      <label class="rotulo" for="hall-ano">
        Ano
      </label>
      <input id="hall-ano" class="campo" type="number" inputMode="numeric" value={d.ano} onInput={(ev) => setD({ ...d, ano: ev.currentTarget.value })} />
      <label class="rotulo" for="hall-data">
        Data (opcional)
      </label>
      <input id="hall-data" class="campo" type="date" value={d.data} onInput={(ev) => setD({ ...d, data: ev.currentTarget.value })} />
      <label class="rotulo" for="hall-local">
        Local (opcional)
      </label>
      <input id="hall-local" class="campo" maxLength={80} value={d.local} onInput={(ev) => setD({ ...d, local: ev.currentTarget.value })} />

      {d.categorias.map((c, i) => (
        <fieldset key={i} class="escolha separado">
          <legend class="sr-only">Categoria {i + 1}</legend>
          <div class="linha">
            <input class="campo" aria-label="Nome da categoria" maxLength={50} value={c.nome} onInput={(ev) => mudarCategoria(i, { ...c, nome: ev.currentTarget.value })} />
            <button type="button" class="botao botao--icone botao--mini" aria-label={`Remover ${c.nome}`} onClick={() => setD({ ...d, categorias: d.categorias.filter((_, j) => j !== i) })}>
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>
          <div class="chips-pessoas">
            {pessoas.map((p) => {
              const marcado = c.vencedores.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  class={`chip-pessoa chip-pessoa--mini${marcado ? ' chip-pessoa--marcado' : ''}`}
                  aria-pressed={marcado}
                  onClick={() => mudarCategoria(i, { ...c, vencedores: marcado ? c.vencedores.filter((v) => v !== p.id) : [...c.vencedores, p.id] })}
                >
                  {p.nome}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      <Botao variante="secundario" onClick={() => setD({ ...d, categorias: [...d.categorias, { nome: 'Nova categoria', vencedores: [] }] })}>
        <Icone nome="mais" /> Categoria
      </Botao>
      <Botao onClick={() => salvarComAviso(() => api('PUT', `/admin/hall/${d.ano}`, { data: d.data, local: d.local, categorias: d.categorias }), `Hall de ${d.ano} salvo.`).then((ok) => ok && aoFechar())}>
        Salvar {d.ano}
      </Botao>
      <div class="linha">
        <Botao variante="texto" onClick={aoFechar}>
          Voltar
        </Botao>
        <Confirmar rotulo="Apagar este ano" pergunta={`Apagar ${d.ano} do Hall?`} variante="perigo" confirmar={() => salvarComAviso(() => api('DELETE', `/admin/hall/${d.ano}`), `${d.ano} apagado.`).then(aoFechar)} />
      </div>
    </form>
  );
}
