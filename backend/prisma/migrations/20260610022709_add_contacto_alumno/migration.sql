-- CreateTable
CREATE TABLE `ContactoAlumno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Usuario` INTEGER NULL,
    `asunto` VARCHAR(191) NOT NULL,
    `plantilla` VARCHAR(191) NULL,
    `enviadoPor` INTEGER NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ContactoAlumno_ID_Usuario_fecha_idx`(`ID_Usuario`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContactoAlumno` ADD CONSTRAINT `ContactoAlumno_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE SET NULL ON UPDATE CASCADE;
