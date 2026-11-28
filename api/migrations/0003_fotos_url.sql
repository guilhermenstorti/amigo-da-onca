-- Link da pasta de fotos de cada ano (ex.: Google Drive), mostrado nos Highlights do Hall da Fama.
-- Fica só no banco e só sai para quem tem a palavra-chave: o repositório é público.
ALTER TABLE edicoes ADD COLUMN fotos_url TEXT;
