-- Título opcional del bloque (ej: "RONDA FULL BODY WARM UP").
-- Los bloques existentes quedan en NULL: la UI cae al label por tipo cuando no hay título.
ALTER TABLE `Bloque` ADD COLUMN `titulo` VARCHAR(191) NULL;
