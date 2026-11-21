const caminhos = {
  voltar: 'M15 5l-7 7 7 7',
  seta: 'M5 12h14M13 6l6 6-6 6',
  fechar: 'M6 6l12 12M18 6L6 18',
  cadeado: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  som: 'M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  mudo: 'M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6',
  pausa: 'M8 5v14M16 5v14',
  play: 'M7 5l12 7-12 7z',
  check: 'M5 12.5l4.5 4.5L19 7',
  olho: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  controle: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  trofeu: 'M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  mais: 'M12 5v14M5 12h14',
  subir: 'M12 19V5M6 11l6-6 6 6',
  descer: 'M12 5v14M6 13l6 6 6-6',
} as const;

export type NomeIcone = keyof typeof caminhos;

export function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={caminhos[nome]} />
    </svg>
  );
}
