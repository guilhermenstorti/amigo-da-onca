import { signal } from '@preact/signals';
import urlSomDaOnca from '../../../assets/audio/serjao-onca.mp3';
import { gravar, ler } from './local';

// O iOS só toca som depois de um gesto do usuário: o primeiro toque destrava o AudioContext.
let ctx: AudioContext | null = null;
let bytes: Promise<ArrayBuffer | null> | null = null;
let decodificado: Promise<AudioBuffer | null> | null = null;
let tocando: AudioBufferSourceNode | null = null;

export const mudo = signal(ler('onca:mudo') === '1');

export function alternarMudo() {
  mudo.value = !mudo.value;
  gravar('onca:mudo', mudo.value ? '1' : null);
  if (!mudo.value) destravarSom();
}

export function destravarSom() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    const vazio = ctx.createBufferSource();
    vazio.buffer = ctx.createBuffer(1, 1, 22050);
    vazio.connect(ctx.destination);
    vazio.start(0);
    if (bytes) void decodificar();
  } catch {
    /* sem áudio: a animação é o feedback principal */
  }
}

/** Baixa o som da onça (24 KB) só quando o lobby abre, para não pesar o carregamento do app. */
export function prepararSom() {
  bytes ??= fetch(urlSomDaOnca)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);
  if (ctx) void decodificar();
}

function decodificar(): Promise<AudioBuffer | null> {
  if (decodificado) return decodificado;
  const c = ctx;
  if (!c || !bytes) return Promise.resolve(null);
  decodificado = bytes
    .then((b) => (b ? new Promise<AudioBuffer>((ok, falha) => c.decodeAudioData(b.slice(0), ok, falha)) : null))
    .catch(() => null);
  return decodificado;
}

/** Toca o som de chegada no lobby. Uma chegada nova corta a anterior em vez de sobrepor. */
export async function tocarSomDaOnca() {
  if (mudo.value || !ctx || ctx.state !== 'running') return;
  prepararSom();
  const buffer = await decodificar();
  if (!buffer || mudo.value || !ctx) return;
  try {
    tocando?.stop();
  } catch {
    /* já tinha terminado */
  }
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(ctx.destination);
  fonte.onended = () => {
    if (tocando === fonte) tocando = null;
  };
  fonte.start();
  tocando = fonte;
}
