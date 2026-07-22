ALTER TABLE `RutinaDia` 
    ADD COLUMN `descripcion` VARCHAR(191) NULL,
    ADD COLUMN `nombre` VARCHAR(191) NULL;

ALTER TABLE `Bloque`
    ADD COLUMN `rutinaDiaId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `Bloque` 
ADD CONSTRAINT `Bloque_rutinaDiaId_fkey` 
FOREIGN KEY (`rutinaDiaId`) REFERENCES `RutinaDia`(`id`) 
ON DELETE CASCADE ON UPDATE CASCADE;

