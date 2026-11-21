import '@fontsource-variable/sora/wght.css';
import '@fontsource-variable/instrument-sans/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/componentes.css';
import './styles/telas.css';

import { render } from 'preact';
import { App } from './app';
import { destravarSom } from './lib/som';

// No iOS, :active só funciona se houver um listener de toque.
document.addEventListener('touchstart', () => {}, { passive: true });
// O primeiro toque destrava o áudio (o iOS exige um gesto).
for (const evento of ['touchend', 'click'] as const) {
  document.addEventListener(evento, destravarSom, { once: true, capture: true });
}

render(<App />, document.getElementById('app')!);
