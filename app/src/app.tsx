import { Avatar } from './components/Avatar';
import { Botao } from './components/Botao';
import { Folha } from './components/Folha';
import { Toast } from './components/Toast';
import { Controle } from './controle/Controle';
import { estado, pessoa, souAdmin } from './lib/estado';
import { perfilAberto } from './lib/paineis';
import { ir, rota } from './lib/rota';
import { sairDoPerfil, tokenAparelho, tokenSessao } from './lib/sessao';
import { alternarMudo, mudo } from './lib/som';
import { TelaCarregando, TelaIdentificacao, TelaPalavraChave } from './telas/Entrada';
import { TelaInicio } from './telas/Inicio';
import { TelaLobby } from './telas/Lobby';
import { TelaHall, TelaRevelacao, TelaTelao } from './telas/Revelacao';
import { TelaSorteio } from './telas/Sorteio';
import { TelaVotacao } from './telas/Votacao';

const telas = {
  inicio: TelaInicio,
  lobby: TelaLobby,
  sorteio: TelaSorteio,
  votacao: TelaVotacao,
  revelacao: TelaRevelacao,
  hall: TelaHall,
  telao: TelaTelao,
};

export function App() {
  let conteudo;
  if (!tokenAparelho.value) conteudo = <TelaPalavraChave />;
  else if (!estado.value) conteudo = <TelaCarregando />;
  else if (rota.value === 'telao') conteudo = <TelaTelao />;
  else if (!tokenSessao.value || !estado.value.eu) conteudo = <TelaIdentificacao />;
  else {
    const Atual = telas[rota.value];
    conteudo = (
      <>
        <Atual />
        <FolhaPerfil />
        {souAdmin.value && <Controle />}
      </>
    );
  }
  return (
    <>
      {conteudo}
      <Toast />
    </>
  );
}

function FolhaPerfil() {
  const eu = estado.value?.eu;
  const p = pessoa(eu?.id);
  const fechar = () => (perfilAberto.value = false);
  return (
    <Folha aberta={perfilAberto.value} aoFechar={fechar} titulo="Seu perfil">
      <div class="perfil">
        <Avatar pessoa={p} tamanho={72} />
        <p class="perfil__nome">{p?.nome}</p>
        {eu?.vinculo === 'este' && <p class="legenda centro">Seu perfil está preso a este celular nesta edição.</p>}
      </div>
      <div class="pilha">
        <label class="interruptor interruptor--linha">
          <span>Som das chegadas no lobby</span>
          <input type="checkbox" role="switch" checked={!mudo.value} onChange={alternarMudo} />
        </label>
        <Botao
          variante="secundario"
          onClick={() => {
            fechar();
            ir('hall');
          }}
        >
          Hall da Fama
        </Botao>
        <Botao
          variante="secundario"
          onClick={() => {
            fechar();
            ir('telao');
          }}
        >
          Abrir modo telão (para a TV)
        </Botao>
        <Botao
          variante="texto"
          onClick={() => {
            fechar();
            sairDoPerfil();
            ir('inicio');
          }}
        >
          Não sou {p?.nome ?? 'eu'}: trocar de perfil
        </Botao>
      </div>
    </Folha>
  );
}
