import { useRef, useState } from 'preact/hooks';
import type { Pessoa } from '../../../api/src/contrato';
import { Avatar } from '../components/Avatar';
import { Botao } from '../components/Botao';
import { Folha } from '../components/Folha';
import { Tela } from '../components/Tela';
import { api, ErroApi, mensagemDe } from '../lib/api';
import { estado, semConexao, atualizar } from '../lib/estado';
import { definirAparelho, definirSessao, tokenAparelho } from '../lib/sessao';
import { destravarSom } from '../lib/som';
import { mostrarToast } from '../lib/ui';

/** Primeiro acesso do aparelho: a palavra-chave libera fotos, nomes e tudo mais. */
export function TelaPalavraChave() {
  const [palavra, setPalavra] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  const entrar = async () => {
    if (!palavra.trim()) {
      setErro('Digite a palavra-chave.');
      campo.current?.focus();
      return;
    }
    setErro(null);
    try {
      const { token } = await api<{ token: string }>('POST', '/acesso', { palavra }, { token: tokenAparelho.value });
      definirAparelho(token);
    } catch (e) {
      setErro(mensagemDe(e));
      campo.current?.focus();
    }
  };

  return (
    <Tela titulo="Amigo da Onça do Bolsa" subtitulo="O app do Bolsa para o sorteio e votação dos presentes premiados." semPerfil rodape={<Botao onClick={entrar}>Entrar</Botao>}>
      <form
        class="vidro cartao formulario"
        onSubmit={(e) => {
          e.preventDefault();
          void entrar();
        }}
      >
        <label for="palavra" class="rotulo">
          Palavra-chave do grupo
        </label>
        <input
          id="palavra"
          ref={campo}
          class={`campo${erro ? ' campo--erro' : ''}`}
          type="text"
          value={palavra}
          onInput={(e) => setPalavra(e.currentTarget.value)}
          autocomplete="off"
          autocapitalize="none"
          autocorrect="off"
          spellcheck={false}
          enterkeyhint="go"
          aria-invalid={erro ? 'true' : undefined}
          aria-describedby="palavra-ajuda"
        />
        <p id="palavra-ajuda" class={erro ? 'erro' : 'legenda'} role={erro ? 'alert' : undefined}>
          {erro ?? 'Tá no grupo do WhatsApp. Só precisa digitar uma vez neste celular.'}
        </p>
      </form>
    </Tela>
  );
}

/** "Quem é você?": grade com foto + nome. Só o perfil do admin pede senha. */
export function TelaIdentificacao() {
  const e = estado.value;
  const [carregando, setCarregando] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Pessoa | null>(null);
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState<string | null>(null);

  if (!e) return <TelaCarregando />;
  const daEdicao = e.pessoas.filter((p) => p.naEdicao);
  const pessoas = daEdicao.length ? daEdicao : e.pessoas;

  const escolher = async (p: Pessoa, comSenha?: string) => {
    destravarSom();
    if (p.admin && comSenha === undefined) {
      setAdmin(p);
      return;
    }
    setCarregando(p.id);
    try {
      const { token } = await api<{ token: string }>('POST', '/sessao', { participante: p.id, senha: comSenha }, { token: tokenAparelho.value });
      definirSessao(token);
      setAdmin(null);
      mostrarToast(`Oi, ${p.nome}!`, 'ouro');
    } catch (err) {
      if (err instanceof ErroApi && err.codigo === 'senha') setErroSenha(err.message);
      else mostrarToast(mensagemDe(err), 'alerta');
    } finally {
      setCarregando(null);
    }
  };

  return (
    <Tela titulo="Quem é você?" subtitulo="Toque na sua foto." semPerfil>
      <ul class="grade-pessoas" aria-label="Participantes">
        {pessoas.map((p) => (
          <li key={p.id}>
            <button type="button" class="pessoa-botao" onClick={() => escolher(p)} aria-busy={carregando === p.id ? 'true' : undefined}>
              <Avatar pessoa={p} tamanho={84} />
              <span class="pessoa-botao__nome">{p.nome}</span>
            </button>
          </li>
        ))}
      </ul>

      <Folha aberta={!!admin} aoFechar={() => (setAdmin(null), setSenha(''), setErroSenha(null))} titulo={`Oi, ${admin?.nome ?? ''}`}>
        <form
          class="formulario"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (admin) void escolher(admin, senha);
          }}
        >
          <label for="senha-admin" class="rotulo">
            Senha de admin
          </label>
          <input
            id="senha-admin"
            class={`campo${erroSenha ? ' campo--erro' : ''}`}
            type="password"
            value={senha}
            onInput={(ev) => setSenha(ev.currentTarget.value)}
            autocomplete="current-password"
            enterkeyhint="go"
            aria-invalid={erroSenha ? 'true' : undefined}
            aria-describedby="senha-ajuda"
          />
          <p id="senha-ajuda" class={erroSenha ? 'erro' : 'legenda'} role={erroSenha ? 'alert' : undefined}>
            {erroSenha ?? 'Só uma vez neste celular. Depois o controle da noite fica na sua tela.'}
          </p>
          <Botao onClick={() => admin && escolher(admin, senha)}>Entrar como admin</Botao>
        </form>
      </Folha>
    </Tela>
  );
}

export function TelaCarregando() {
  return (
    <div class="tela tela--carregando">
      <div class="tela__fundo" aria-hidden="true" />
      <div class="tela__veu" aria-hidden="true" />
      <div class="carregando" role="status">
        <span class="giro giro--grande" aria-hidden="true" />
        <p>{semConexao.value ? 'Sem conexão. Tentando de novo…' : 'Carregando a toca…'}</p>
        {semConexao.value && (
          <Botao variante="secundario" onClick={() => atualizar()}>
            Tentar agora
          </Botao>
        )}
      </div>
    </div>
  );
}
