export interface VotoApurado {
  categoria: string;
  indicado: string;
  justificativa: string | null;
}

export interface ResultadoCategoria {
  categoria: string;
  /** Mais de um em caso de empate: dividem o troféu. Vazio se ninguém votou. */
  vencedores: string[];
  votos: number;
  /** Justificativas escritas para os vencedores, por vencedor. */
  justificativas: { indicado: string; texto: string }[];
}

export function apurar(categorias: readonly string[], votos: readonly VotoApurado[]): ResultadoCategoria[] {
  return categorias.map((categoria) => {
    const daCategoria = votos.filter((v) => v.categoria === categoria);
    const contagem = new Map<string, number>();
    for (const v of daCategoria) contagem.set(v.indicado, (contagem.get(v.indicado) ?? 0) + 1);
    const max = Math.max(0, ...contagem.values());
    const vencedores = max === 0 ? [] : [...contagem].filter(([, n]) => n === max).map(([id]) => id).sort();
    const justificativas = daCategoria
      .filter((v) => vencedores.includes(v.indicado) && v.justificativa?.trim())
      .map((v) => ({ indicado: v.indicado, texto: v.justificativa!.trim() }));
    return { categoria, vencedores, votos: max, justificativas };
  });
}
