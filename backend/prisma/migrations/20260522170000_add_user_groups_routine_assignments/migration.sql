-- CreateTable
CREATE TABLE `GrupoUsuario` (
    `ID_GrupoUsuario` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `estado` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`ID_GrupoUsuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GrupoUsuarioMiembro` (
    `ID_GrupoUsuarioMiembro` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_GrupoUsuario` INTEGER NOT NULL,
    `ID_Usuario` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GrupoUsuarioMiembro_ID_GrupoUsuario_ID_Usuario_key`(`ID_GrupoUsuario`, `ID_Usuario`),
    INDEX `GrupoUsuarioMiembro_ID_Usuario_idx`(`ID_Usuario`),
    PRIMARY KEY (`ID_GrupoUsuarioMiembro`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RutinaAsignacionUsuario` (
    `ID_RutinaAsignacionUsuario` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Rutina` INTEGER NOT NULL,
    `ID_Usuario` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RutinaAsignacionUsuario_ID_Rutina_ID_Usuario_key`(`ID_Rutina`, `ID_Usuario`),
    INDEX `RutinaAsignacionUsuario_ID_Usuario_idx`(`ID_Usuario`),
    PRIMARY KEY (`ID_RutinaAsignacionUsuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RutinaAsignacionGrupo` (
    `ID_RutinaAsignacionGrupo` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Rutina` INTEGER NOT NULL,
    `ID_GrupoUsuario` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RutinaAsignacionGrupo_ID_Rutina_ID_GrupoUsuario_key`(`ID_Rutina`, `ID_GrupoUsuario`),
    INDEX `RutinaAsignacionGrupo_ID_GrupoUsuario_idx`(`ID_GrupoUsuario`),
    PRIMARY KEY (`ID_RutinaAsignacionGrupo`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- DataMigration
INSERT IGNORE INTO `RutinaAsignacionUsuario` (`ID_Rutina`, `ID_Usuario`, `createdAt`)
SELECT `ID_Rutina`, `ID_Usuario`, CURRENT_TIMESTAMP(3)
FROM `Rutina`
WHERE `ID_Usuario` IS NOT NULL;

-- AddForeignKey
ALTER TABLE `GrupoUsuarioMiembro` ADD CONSTRAINT `GrupoUsuarioMiembro_ID_GrupoUsuario_fkey` FOREIGN KEY (`ID_GrupoUsuario`) REFERENCES `GrupoUsuario`(`ID_GrupoUsuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GrupoUsuarioMiembro` ADD CONSTRAINT `GrupoUsuarioMiembro_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaAsignacionUsuario` ADD CONSTRAINT `RutinaAsignacionUsuario_ID_Rutina_fkey` FOREIGN KEY (`ID_Rutina`) REFERENCES `Rutina`(`ID_Rutina`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaAsignacionUsuario` ADD CONSTRAINT `RutinaAsignacionUsuario_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaAsignacionGrupo` ADD CONSTRAINT `RutinaAsignacionGrupo_ID_Rutina_fkey` FOREIGN KEY (`ID_Rutina`) REFERENCES `Rutina`(`ID_Rutina`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaAsignacionGrupo` ADD CONSTRAINT `RutinaAsignacionGrupo_ID_GrupoUsuario_fkey` FOREIGN KEY (`ID_GrupoUsuario`) REFERENCES `GrupoUsuario`(`ID_GrupoUsuario`) ON DELETE CASCADE ON UPDATE CASCADE;
