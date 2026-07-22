/*
  Warnings:

  - The primary key for the `BloqueEjercicio` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[dni]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `ID` to the `BloqueEjercicio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Bloque` ADD COLUMN `cantSeries` INTEGER NULL,
    ADD COLUMN `descTabata` VARCHAR(191) NULL,
    ADD COLUMN `tiempoTrabajoDescansoTabata` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BloqueEjercicio` DROP FOREIGN KEY `BloqueEjercicio_ID_Bloque_fkey`;

-- AlterTable
ALTER TABLE `BloqueEjercicio` DROP FOREIGN KEY `BloqueEjercicio_ID_Ejercicio_fkey`;

-- AlterTable
ALTER TABLE `BloqueEjercicio` DROP PRIMARY KEY,
    ADD COLUMN `ID` INTEGER NOT NULL AUTO_INCREMENT FIRST,
    ADD COLUMN `orden` INTEGER NULL,
    ADD PRIMARY KEY (`ID`);

-- CreateIndex
CREATE INDEX `BloqueEjercicio_ID_Bloque_idx` ON `BloqueEjercicio`(`ID_Bloque`);

-- CreateIndex
CREATE INDEX `BloqueEjercicio_ID_Ejercicio_idx` ON `BloqueEjercicio`(`ID_Ejercicio`);

-- AlterTable
ALTER TABLE `HorarioClase` ADD COLUMN `activo` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `RutinaDia` ADD COLUMN `rutinaSemanaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `dni` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Semana` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NULL,
    `numero` INTEGER NULL,
    `rutinaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Asistencia` (
    `ID_Asistencia` INTEGER NOT NULL AUTO_INCREMENT,
    `fechaIngreso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metodo` VARCHAR(191) NOT NULL,
    `permitido` BOOLEAN NOT NULL,
    `resultado` VARCHAR(191) NOT NULL,
    `motivo` VARCHAR(191) NULL,
    `ID_Usuario` INTEGER NULL,

    PRIMARY KEY (`ID_Asistencia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_dni_key` ON `User`(`dni`);

-- AddForeignKey
ALTER TABLE `BloqueEjercicio` ADD CONSTRAINT `BloqueEjercicio_ID_Bloque_fkey` FOREIGN KEY (`ID_Bloque`) REFERENCES `Bloque`(`ID_Bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloqueEjercicio` ADD CONSTRAINT `BloqueEjercicio_ID_Ejercicio_fkey` FOREIGN KEY (`ID_Ejercicio`) REFERENCES `Ejercicio`(`ID_Ejercicio`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaDia` ADD CONSTRAINT `RutinaDia_rutinaSemanaId_fkey` FOREIGN KEY (`rutinaSemanaId`) REFERENCES `Semana`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Semana` ADD CONSTRAINT `Semana_rutinaId_fkey` FOREIGN KEY (`rutinaId`) REFERENCES `Rutina`(`ID_Rutina`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Asistencia` ADD CONSTRAINT `Asistencia_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
