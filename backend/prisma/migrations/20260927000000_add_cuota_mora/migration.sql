ALTER TABLE `Cuota`
  ADD COLUMN `moraTasaDiariaBase` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN `moraTasaDiariaOverride` DOUBLE NULL,
  ADD COLUMN `moraFechaInicio` DATETIME(3) NULL,
  ADD COLUMN `interesMoraPagado` DOUBLE NULL,
  ADD COLUMN `totalPagado` DOUBLE NULL,
  ADD COLUMN `diasMoraAlPagar` INTEGER NULL,
  ADD COLUMN `tasaMoraAplicadaPago` DOUBLE NULL;

CREATE TABLE `MoraConfiguracion` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `tasaDiaria` DOUBLE NOT NULL DEFAULT 0,
  `vigenteDesde` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `updatedBy` INTEGER NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MoraHistorial` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `ID_Cuota` INTEGER NULL,
  `tipo` VARCHAR(191) NOT NULL,
  `alcance` VARCHAR(191) NULL,
  `tasaAnterior` DOUBLE NULL,
  `tasaNueva` DOUBLE NULL,
  `actorId` INTEGER NULL,
  `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `MoraHistorial_ID_Cuota_fecha_idx` (`ID_Cuota`, `fecha`),
  INDEX `MoraHistorial_fecha_idx` (`fecha`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MoraHistorial_ID_Cuota_fkey` FOREIGN KEY (`ID_Cuota`) REFERENCES `Cuota`(`ID_Cuota`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `MoraConfiguracion` (`id`, `tasaDiaria`, `vigenteDesde`, `updatedAt`)
VALUES (1, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

UPDATE `Cuota`
SET
  `interesMoraPagado` = 0,
  `totalPagado` = `importe`,
  `diasMoraAlPagar` = 0,
  `tasaMoraAplicadaPago` = 0
WHERE `pagada` = true;
