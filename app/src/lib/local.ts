// localStorage pode falhar (modo privado antigo, armazenamento cheio): nunca deixa o app quebrar.

export function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravar(chave: string, valor: string | null) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: segue só em memória */
  }
}
