-- Marca de quando o sorteio aconteceu: cada sorteio novo (refeito ou depois de recomeçar a edição)
-- tem a sua, e o app usa isso para mostrar a roleta de novo.
ALTER TABLE edicoes ADD COLUMN sorteado_em INTEGER;
