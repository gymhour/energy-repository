-- AlterTable
ALTER TABLE `rutina` ADD COLUMN `urlPlanificacion` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `MovimientoSocio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Usuario` INTEGER NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `esReactivacion` BOOLEAN NOT NULL DEFAULT false,
    `motivoBaja` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MovimientoSocio_fecha_idx`(`fecha`),
    INDEX `MovimientoSocio_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MovimientoSocio` ADD CONSTRAINT `MovimientoSocio_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
