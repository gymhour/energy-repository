-- AlterTable
ALTER TABLE `Cuota` ADD COLUMN `planSesionesTotalesSnapshot` INTEGER NULL;

-- AlterTable
ALTER TABLE `Plan` ADD COLUMN `sesionesTotales` INTEGER NOT NULL DEFAULT 0;
