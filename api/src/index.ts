import type { Ctx, Handler } from './contexto';
import { lerToken } from './cripto';
import { cabecalhosCors, ErroHttp, erro, json, type Env } from './http';
import * as admin from './rotas/admin';
import * as participante from './rotas/participante';
import * as publico from './rotas/publico';

type Nivel = 'livre' | 'aparelho' | 'participante' | 'admin';
type Rota = [metodo: string, caminho: RegExp, handler: Handler, nivel: Nivel];

const ID = '([a-z0-9-]{1,40})';

const rotas: Rota[] = [
  ['POST', /^\/acesso$/, publico.acesso, 'livre'],
  ['GET', new RegExp(`^/fotos/${ID}/(256|512)$`), publico.foto, 'livre'],
  ['POST', /^\/sessao$/, publico.criarSessao, 'aparelho'],
  ['GET', /^\/estado$/, publico.estado, 'aparelho'],
  ['GET', /^\/revelacao$/, publico.revelacao, 'aparelho'],
  ['GET', /^\/hall$/, publico.hall, 'aparelho'],

  ['POST', /^\/lobby\/entrar$/, participante.entrarLobby, 'participante'],
  ['GET', /^\/sorteio\/meu$/, participante.meuSorteio, 'participante'],
  ['GET', /^\/votos$/, participante.meusVotos, 'participante'],
  ['POST', /^\/votos\/enviar$/, participante.enviarVotos, 'participante'],
  ['PUT', new RegExp(`^/votos/${ID}$`), participante.votar, 'participante'],

  ['POST', /^\/admin\/lobby\/abrir$/, admin.abrirLobby, 'admin'],
  ['POST', /^\/admin\/lobby\/fechar$/, admin.fecharLobby, 'admin'],
  ['POST', /^\/admin\/sortear$/, admin.sortear, 'admin'],
  ['POST', /^\/admin\/sorteio\/refazer$/, admin.refazerSorteio, 'admin'],
  ['POST', /^\/admin\/votacao\/abrir$/, admin.abrirVotacao, 'admin'],
  ['POST', /^\/admin\/votacao\/fechar$/, admin.fecharVotacao, 'admin'],
  ['POST', /^\/admin\/revelar$/, admin.revelarProxima, 'admin'],
  ['POST', /^\/admin\/encerrar$/, admin.encerrar, 'admin'],
  ['POST', /^\/admin\/liberar$/, admin.liberar, 'admin'],
  ['GET', /^\/admin\/gestao$/, admin.gestao, 'admin'],
  ['PUT', /^\/admin\/edicao$/, admin.salvarEdicao, 'admin'],
  ['POST', /^\/admin\/edicao\/recomecar$/, admin.recomecarEdicao, 'admin'],
  ['PUT', /^\/admin\/categorias$/, admin.salvarCategorias, 'admin'],
  ['PUT', new RegExp(`^/admin/participantes/${ID}$`), admin.salvarParticipante, 'admin'],
  ['PUT', new RegExp(`^/admin/fotos/${ID}/(256|512)$`), admin.salvarFoto, 'admin'],
  ['PUT', /^\/admin\/hall\/(\d{4})$/, admin.salvarHall, 'admin'],
  ['DELETE', /^\/admin\/hall\/(\d{4})$/, admin.apagarHall, 'admin'],
];

async function rotear(req: Request, env: Env, url: URL): Promise<Response> {
  for (const [metodo, caminho, handler, nivel] of rotas) {
    const m = caminho.exec(url.pathname);
    if (!m || metodo !== req.method) continue;
    const ctx: Ctx = { req, env, url, params: m.slice(1), sessao: null, base: url.origin };
    if (nivel !== 'livre') {
      ctx.sessao = await lerToken(env, req);
      if (!ctx.sessao) throw erro(401, 'sem-acesso', 'Digite a palavra-chave do grupo.');
      if (nivel === 'participante' && !ctx.sessao.p) throw erro(401, 'sem-perfil', 'Escolha quem você é primeiro.');
      if (nivel === 'admin') {
        const ehAdmin =
          ctx.sessao.adm &&
          ctx.sessao.p &&
          (await env.DB.prepare('SELECT 1 FROM participantes WHERE id = ? AND admin = 1 AND ativo = 1').bind(ctx.sessao.p).first());
        if (!ehAdmin) throw erro(403, 'sem-admin', 'Só o admin pode fazer isso.');
      }
    }
    return handler(ctx);
  }
  throw erro(404, 'nao-encontrado', 'Rota não encontrada.');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const cors = cabecalhosCors(req, env);
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-max-age': '600',
        },
      });
    }
    let resposta: Response;
    try {
      resposta = await rotear(req, env, url);
    } catch (e) {
      if (e instanceof ErroHttp) resposta = json({ erro: e.codigo, mensagem: e.message }, e.status);
      else {
        console.error(e);
        resposta = json({ erro: 'interno', mensagem: 'Deu ruim aqui do nosso lado. Tenta de novo?' }, 500);
      }
    }
    const final = new Response(resposta.body, resposta);
    for (const [k, v] of Object.entries(cors)) final.headers.set(k, v);
    return final;
  },
} satisfies ExportedHandler<Env>;
