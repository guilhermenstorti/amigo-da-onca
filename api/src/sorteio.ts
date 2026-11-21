/** Inteiro aleatório em [0, max). */
export type Aleatorio = (max: number) => number;

/** Aleatório criptográfico, sem viés de módulo. */
export const aleatorioSeguro: Aleatorio = (max) => {
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limite);
  return buf[0] % max;
};

/** Fisher-Yates. */
export function embaralhar<T>(lista: readonly T[], rnd: Aleatorio = aleatorioSeguro): T[] {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteia os pares [doador, recebedor]: uma permutação sem pontos fixos (ninguém tira a si mesmo,
 * cada um dá e recebe exatamente uma vez). Embaralha até não sobrar ponto fixo, o que dá distribuição
 * uniforme entre todos os sorteios válidos (~3 tentativas em média).
 */
export function sortearPares(ids: readonly string[], rnd: Aleatorio = aleatorioSeguro): [string, string][] {
  if (ids.length < 2) throw new Error('O sorteio precisa de pelo menos 2 participantes.');
  if (new Set(ids).size !== ids.length) throw new Error('Participante repetido no sorteio.');
  for (let tentativa = 0; tentativa < 10_000; tentativa++) {
    const recebedores = embaralhar(ids, rnd);
    if (recebedores.every((r, i) => r !== ids[i])) return ids.map((d, i) => [d, recebedores[i]]);
  }
  throw new Error('Não foi possível sortear.');
}
