-- Origen de la cuota: "MANUAL" (alta individual, proporcional al mes) o "MASIVA"
-- (generación del mes, período completo del plan).
-- Sin DEFAULT a propósito: las cuotas anteriores quedan en NULL porque su origen no
-- se registró y no es inferible (un plan mensual creado a mano es idéntico a uno masivo).
ALTER TABLE `Cuota` ADD COLUMN `origen` VARCHAR(191) NULL;
