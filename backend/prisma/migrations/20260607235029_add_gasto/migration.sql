-- CreateTable
CREATE TABLE `Gasto` (
    `ID_Gasto` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATETIME(3) NOT NULL,
    `mes` VARCHAR(191) NOT NULL,
    `categoria` VARCHAR(191) NOT NULL,
    `monto` DOUBLE NOT NULL,
    `descripcion` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Gasto_mes_idx`(`mes`),
    INDEX `Gasto_categoria_idx`(`categoria`),
    INDEX `Gasto_fecha_idx`(`fecha`),
    PRIMARY KEY (`ID_Gasto`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
