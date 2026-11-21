import { describe, expect, it } from 'vitest';
import { apurar } from '../src/apuracao';
import { normalizarPalavra } from '../src/cripto';
import { sortearPares } from '../src/sorteio';

const turma = ['gui', 'maria', 'maju', 'ju', 'isa', 'gomi', 'hugo', 'tavinho', 'sola'];

describe('sorteio', () => {
  it('em 10 mil sorteios: ninguém tira a si mesmo, todos dão e recebem exatamente uma vez', () => {
    const frequencia = new Map<string, number>();
    for (let i = 0; i < 10_000; i++) {
      const pares = sortearPares(turma);
      expect(pares).toHaveLength(turma.length);
      expect(new Set(pares.map(([d]) => d)).size).toBe(turma.length);
      expect(new Set(pares.map(([, r]) => r)).size).toBe(turma.length);
      for (const [d, r] of pares) {
        expect(d).not.toBe(r);
        expect(turma).toContain(r);
        frequencia.set(`${d}>${r}`, (frequencia.get(`${d}>${r}`) ?? 0) + 1);
      }
    }
    // Distribuição: cada par possível (9×8 = 72) aparece perto de 10000/8 = 1250 vezes.
    expect(frequencia.size).toBe(72);
    for (const n of frequencia.values()) expect(n).toBeGreaterThan(1000);
  });

  it('recusa lista curta ou com repetidos', () => {
    expect(() => sortearPares(['gui'])).toThrow();
    expect(() => sortearPares(['gui', 'gui', 'ju'])).toThrow();
  });

  it('funciona com 2 pessoas (troca entre si)', () => {
    expect(sortearPares(['a', 'b'])).toEqual([
      ['a', 'b'],
      ['b', 'a'],
    ]);
  });
});

describe('apuração', () => {
  it('mais votado vence, empate divide o troféu e voto em si mesmo vale', () => {
    const r = apurar(
      ['util', 'inutil', 'vazia'],
      [
        { categoria: 'util', indicado: 'ju', justificativa: 'usa todo dia' },
        { categoria: 'util', indicado: 'ju', justificativa: null },
        { categoria: 'util', indicado: 'gui', justificativa: 'votei em mim' },
        { categoria: 'inutil', indicado: 'hugo', justificativa: '  ninguém entendeu  ' },
        { categoria: 'inutil', indicado: 'sola', justificativa: 'kkk' },
      ],
    );
    expect(r[0]).toMatchObject({ vencedores: ['ju'], votos: 2, justificativas: [{ indicado: 'ju', texto: 'usa todo dia' }] });
    expect(r[1].vencedores).toEqual(['hugo', 'sola']);
    expect(r[1].justificativas.map((j) => j.texto).sort()).toEqual(['kkk', 'ninguém entendeu']);
    expect(r[2]).toMatchObject({ vencedores: [], votos: 0, justificativas: [] });
  });
});

describe('palavra-chave', () => {
  it('ignora maiúscula, acento e espaços nas pontas', () => {
    expect(normalizarPalavra('  Onça ')).toBe(normalizarPalavra('onca'));
  });
});
