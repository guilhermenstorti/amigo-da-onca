-- Amigo da Onça: schema inicial + dados da turma

CREATE TABLE participantes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  admin INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE fotos (
  participante_id TEXT NOT NULL REFERENCES participantes(id) ON DELETE CASCADE,
  tamanho INTEGER NOT NULL CHECK (tamanho IN (256, 512)),
  mime TEXT NOT NULL DEFAULT 'image/webp',
  bytes BLOB NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (participante_id, tamanho)
);

CREATE TABLE edicoes (
  ano INTEGER PRIMARY KEY,
  data TEXT,
  local TEXT,
  fase TEXT NOT NULL DEFAULT 'preparacao'
    CHECK (fase IN ('preparacao', 'lobby', 'troca', 'votacao', 'revelacao', 'encerrada')),
  categorias_reveladas INTEGER NOT NULL DEFAULT 0,
  atual INTEGER NOT NULL DEFAULT 0,
  versao INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE edicao_participantes (
  ano INTEGER NOT NULL REFERENCES edicoes(ano) ON DELETE CASCADE,
  participante_id TEXT NOT NULL REFERENCES participantes(id),
  PRIMARY KEY (ano, participante_id)
);

-- Quem entrou no lobby, e de qual aparelho. Um perfil por aparelho e um aparelho por perfil, por edição.
CREATE TABLE lobby (
  ano INTEGER NOT NULL REFERENCES edicoes(ano) ON DELETE CASCADE,
  participante_id TEXT NOT NULL REFERENCES participantes(id),
  aparelho_id TEXT NOT NULL,
  entrou_em INTEGER NOT NULL,
  PRIMARY KEY (ano, participante_id),
  UNIQUE (ano, aparelho_id)
);

-- 1:1 garantido pelo banco: cada um dá uma vez, cada um recebe uma vez, ninguém tira a si mesmo.
CREATE TABLE sorteio (
  ano INTEGER NOT NULL REFERENCES edicoes(ano) ON DELETE CASCADE,
  doador_id TEXT NOT NULL REFERENCES participantes(id),
  recebedor_id TEXT NOT NULL REFERENCES participantes(id),
  PRIMARY KEY (ano, doador_id),
  UNIQUE (ano, recebedor_id),
  CHECK (doador_id <> recebedor_id)
);

CREATE TABLE categorias (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  ativa INTEGER NOT NULL DEFAULT 1
);

-- Retrato das categorias de cada edição (o nome fica congelado no histórico mesmo se a categoria mudar).
CREATE TABLE edicao_categorias (
  ano INTEGER NOT NULL REFERENCES edicoes(ano) ON DELETE CASCADE,
  categoria_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL,
  PRIMARY KEY (ano, categoria_id)
);

-- Só registra quem já enviou, nunca em quem votou.
CREATE TABLE cedulas (
  ano INTEGER NOT NULL REFERENCES edicoes(ano) ON DELETE CASCADE,
  eleitor_id TEXT NOT NULL REFERENCES participantes(id),
  enviada_em INTEGER NOT NULL,
  PRIMARY KEY (ano, eleitor_id)
);

-- Votos individuais: existem só enquanto a votação está aberta. Apagados na apuração.
CREATE TABLE votos (
  ano INTEGER NOT NULL,
  categoria_id TEXT NOT NULL,
  eleitor_id TEXT NOT NULL REFERENCES participantes(id),
  indicado_id TEXT NOT NULL REFERENCES participantes(id),
  justificativa TEXT CHECK (justificativa IS NULL OR length(justificativa) <= 140),
  PRIMARY KEY (ano, categoria_id, eleitor_id),
  FOREIGN KEY (ano, categoria_id) REFERENCES edicao_categorias(ano, categoria_id) ON DELETE CASCADE
);

CREATE TABLE resultados (
  ano INTEGER NOT NULL,
  categoria_id TEXT NOT NULL,
  vencedor_id TEXT NOT NULL REFERENCES participantes(id),
  origem TEXT NOT NULL DEFAULT 'app' CHECK (origem IN ('app', 'manual')),
  PRIMARY KEY (ano, categoria_id, vencedor_id),
  FOREIGN KEY (ano, categoria_id) REFERENCES edicao_categorias(ano, categoria_id) ON DELETE CASCADE
);

-- Justificativas sem autoria, já embaralhadas (posicao).
CREATE TABLE justificativas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ano INTEGER NOT NULL,
  categoria_id TEXT NOT NULL,
  indicado_id TEXT NOT NULL,
  texto TEXT NOT NULL,
  posicao INTEGER NOT NULL,
  FOREIGN KEY (ano, categoria_id) REFERENCES edicao_categorias(ano, categoria_id) ON DELETE CASCADE
);

CREATE TABLE tentativas (
  chave TEXT PRIMARY KEY,
  contagem INTEGER NOT NULL,
  janela INTEGER NOT NULL
);

INSERT INTO participantes (id, nome, admin, ordem) VALUES
  ('gui', 'Gui', 1, 1),
  ('maria', 'Maria', 0, 2),
  ('maju', 'Maju', 0, 3),
  ('ju', 'Ju', 0, 4),
  ('isa', 'Isa', 0, 5),
  ('gomi', 'Gomi', 0, 6),
  ('hugo', 'Hugo', 0, 7),
  ('tavinho', 'Tavinho', 0, 8),
  ('sola', 'Sola', 0, 9);

INSERT INTO categorias (id, nome, descricao, ordem) VALUES
  ('mais-util', 'Presente mais útil', 'Aquele que vai ser usado de verdade.', 1),
  ('mais-inutil', 'Presente mais inútil', 'Ninguém sabe pra que serve. Nem quem deu.', 2),
  ('revelacao', 'Presente revelação', 'Ninguém botava fé, e surpreendeu.', 3),
  ('mais-criativo', 'Presente mais criativo', 'A ideia que ninguém mais teria.', 4),
  ('melhor-embalagem', 'Melhor embalagem', 'O pacote que roubou a cena.', 5),
  ('presente-do-ano', 'Presente do ano', 'O grande vencedor da noite.', 6);

INSERT INTO edicoes (ano, atual) VALUES (2026, 1);
INSERT INTO edicao_participantes (ano, participante_id) SELECT 2026, id FROM participantes;
