// Contrato entre a API e o app. O app importa só os tipos (import type), nada de código.

export type Fase = 'preparacao' | 'lobby' | 'troca' | 'votacao' | 'revelacao' | 'encerrada';

export interface Pessoa {
  id: string;
  nome: string;
  admin: boolean;
  /** URLs assinadas da foto (p = 256px, g = 512px). null quando ainda não tem foto. */
  foto: { p: string; g: string } | null;
  /** Participa da edição atual. */
  naEdicao: boolean;
}

export interface CategoriaVotacao {
  id: string;
  nome: string;
  descricao: string;
}

export interface Estado {
  versao: number;
  edicao: { ano: number; data: string | null; local: string | null; fase: Fase };
  pessoas: Pessoa[];
  /** null quando o aparelho ainda não escolheu um perfil. */
  eu: null | {
    id: string;
    admin: boolean;
    /** 'este' = perfil preso a este aparelho; 'outro' = preso a outro aparelho; null = fora do lobby. */
    vinculo: 'este' | 'outro' | null;
    tirouAlguem: boolean;
    votosEnviados: boolean;
  };
  lobby: { presentes: string[]; total: number; completo: boolean };
  votacao: { categorias: CategoriaVotacao[]; enviaram: number; total: number };
  revelacao: { reveladas: number; total: number };
  /** Só para o admin. */
  admin?: { faltamNoLobby: string[]; faltamVotar: string[] };
}

export interface MeuSorteio {
  recebedor: { id: string; nome: string };
  /** Os outros participantes (sem você), para a roleta. */
  outros: string[];
  /** Quando este sorteio aconteceu (ms). Muda a cada sorteio novo, mesmo que o par se repita. */
  sorteadoEm: number;
}

export interface MeusVotos {
  votos: Record<string, { indicado: string; justificativa: string | null }>;
  enviada: boolean;
}

export interface CategoriaRevelacao {
  id: string;
  nome: string;
  descricao: string;
  revelada: boolean;
  vencedores?: { id: string; nome: string }[];
  justificativas?: string[];
}

export interface Revelacao {
  disponivel: boolean;
  reveladas: number;
  total: number;
  categorias: CategoriaRevelacao[];
}

export interface VencedorHall {
  id: string;
  nome: string;
  /** URLs assinadas da foto (vem junto porque o vencedor pode nem estar mais ativo). */
  foto: { p: string; g: string } | null;
}

export interface PinHall {
  /** id da categoria (escolhe o desenho do pin). */
  id: string;
  nome: string;
  /** null = só a sombra do pin (ano sem premiação ou categoria ainda em segredo). [] = ninguém levou. */
  vencedores: VencedorHall[] | null;
}

/**
 * 'sem': o ano não teve premiação (antes do app).
 * 'em-breve': edição atual, a premiação ainda não começou.
 * 'revelando': edição atual, os pins aparecem conforme cada categoria é revelada.
 * 'completa': todos os pins entregues.
 */
export type PremiacaoHall = 'sem' | 'em-breve' | 'revelando' | 'completa';

export interface AnoHall {
  ano: number;
  data: string | null;
  local: string | null;
  atual: boolean;
  premiacao: PremiacaoHall;
  /** A sala de troféus: um pin por categoria, na ordem da edição. */
  pins: PinHall[];
  /** Link da pasta de fotos do ano (Highlights). */
  fotosUrl: string | null;
}

export interface Gestao {
  participantes: { id: string; nome: string; admin: boolean; ativo: boolean; temFoto: boolean }[];
  categorias: { id: string; nome: string; descricao: string; ordem: number; ativa: boolean }[];
  edicoes: {
    ano: number;
    data: string | null;
    local: string | null;
    fotosUrl: string | null;
    fase: Fase;
    atual: boolean;
    participantes: string[];
  }[];
}

export interface ErroApi {
  erro: string;
  mensagem: string;
}
