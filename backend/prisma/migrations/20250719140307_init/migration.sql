-- CreateTable
CREATE TABLE `User` (
    `ID_Usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `apellido` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `profesion` VARCHAR(191) NULL,
    `direc` VARCHAR(191) NULL,
    `tel` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `fechaRegistro` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaBaja` DATETIME(3) NULL,
    `fechaCumple` DATETIME(3) NULL,
    `estado` BOOLEAN NULL,
    `resetToken` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,
    `imagenUsuario` VARCHAR(191) NULL,
    `ID_Plan` INTEGER NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`ID_Usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `ID_Plan` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `desc` VARCHAR(191) NULL,
    `precio` DOUBLE NOT NULL,

    UNIQUE INDEX `Plan_nombre_key`(`nombre`),
    PRIMARY KEY (`ID_Plan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cuota` (
    `ID_Cuota` INTEGER NOT NULL AUTO_INCREMENT,
    `mes` VARCHAR(191) NOT NULL,
    `importe` DOUBLE NOT NULL,
    `vence` DATETIME(3) NOT NULL,
    `pagada` BOOLEAN NOT NULL DEFAULT false,
    `formaPago` VARCHAR(191) NULL,
    `fechaPago` DATETIME(3) NULL,
    `vencida` BOOLEAN NOT NULL DEFAULT false,
    `ID_Usuario` INTEGER NOT NULL,

    PRIMARY KEY (`ID_Cuota`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Turno` (
    `id_turno` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATETIME(3) NOT NULL,
    `estado` VARCHAR(191) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL,
    `ID_HorarioClase` INTEGER NOT NULL,
    `ID_Usuario` INTEGER NOT NULL,

    PRIMARY KEY (`id_turno`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HorarioClase` (
    `ID_HorarioClase` INTEGER NOT NULL AUTO_INCREMENT,
    `diaSemana` VARCHAR(191) NOT NULL,
    `horaIni` DATETIME(3) NOT NULL,
    `horaFin` DATETIME(3) NOT NULL,
    `cupos` INTEGER NOT NULL,
    `ID_Clase` INTEGER NOT NULL,

    PRIMARY KEY (`ID_HorarioClase`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Clase` (
    `ID_Clase` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `imagenClase` VARCHAR(191) NULL,

    PRIMARY KEY (`ID_Clase`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Rutina` (
    `ID_Rutina` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Usuario` INTEGER NOT NULL,
    `ID_Entrenador` INTEGER NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `desc` VARCHAR(191) NULL,
    `claseRutina` VARCHAR(191) NULL,
    `grupoMuscularRutina` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`ID_Rutina`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RutinaDia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dia` VARCHAR(191) NOT NULL,
    `rutinaId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bloque` (
    `ID_Bloque` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('SETS_REPS', 'ROUNDS', 'EMOM', 'TABATA', 'AMRAP', 'LADDER') NOT NULL,
    `ID_Rutina` INTEGER NOT NULL,
    `setsReps` VARCHAR(191) NULL,
    `nombreEj` VARCHAR(191) NULL,
    `weight` VARCHAR(191) NULL,
    `descansoRonda` INTEGER NULL,
    `cantRondas` INTEGER NULL,
    `durationMin` INTEGER NULL,
    `tipoEscalera` VARCHAR(191) NULL,

    PRIMARY KEY (`ID_Bloque`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ejercicio` (
    `ID_Ejercicio` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `mediaUrl` VARCHAR(191) NULL,
    `youtubeUrl` VARCHAR(191) NULL,
    `instrucciones` TEXT NULL,
    `esGenerico` BOOLEAN NOT NULL DEFAULT false,
    `musculos` VARCHAR(191) NULL,
    `equipamiento` VARCHAR(191) NULL,

    INDEX `Ejercicio_esGenerico_idx`(`esGenerico`),
    PRIMARY KEY (`ID_Ejercicio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BloqueEjercicio` (
    `ID_Bloque` INTEGER NOT NULL,
    `ID_Ejercicio` INTEGER NOT NULL,
    `reps` VARCHAR(191) NULL,
    `setRepWeight` VARCHAR(191) NULL,

    PRIMARY KEY (`ID_Bloque`, `ID_Ejercicio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EjercicioMedicion` (
    `ID_EjercicioMedicion` INTEGER NOT NULL AUTO_INCREMENT,
    `ID_Usuario` INTEGER NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `tipoMedicion` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`ID_EjercicioMedicion`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HistoricoEjercicio` (
    `ID_HistoricoEjercicio` INTEGER NOT NULL AUTO_INCREMENT,
    `Fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `Cantidad` INTEGER NOT NULL,
    `ID_EjercicioMedicion` INTEGER NOT NULL,

    PRIMARY KEY (`ID_HistoricoEjercicio`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_EntrenadoresClases` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_EntrenadoresClases_AB_unique`(`A`, `B`),
    INDEX `_EntrenadoresClases_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_ID_Plan_fkey` FOREIGN KEY (`ID_Plan`) REFERENCES `Plan`(`ID_Plan`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cuota` ADD CONSTRAINT `Cuota_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_ID_HorarioClase_fkey` FOREIGN KEY (`ID_HorarioClase`) REFERENCES `HorarioClase`(`ID_HorarioClase`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HorarioClase` ADD CONSTRAINT `HorarioClase_ID_Clase_fkey` FOREIGN KEY (`ID_Clase`) REFERENCES `Clase`(`ID_Clase`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rutina` ADD CONSTRAINT `Rutina_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Rutina` ADD CONSTRAINT `Rutina_ID_Entrenador_fkey` FOREIGN KEY (`ID_Entrenador`) REFERENCES `User`(`ID_Usuario`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RutinaDia` ADD CONSTRAINT `RutinaDia_rutinaId_fkey` FOREIGN KEY (`rutinaId`) REFERENCES `Rutina`(`ID_Rutina`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bloque` ADD CONSTRAINT `Bloque_ID_Rutina_fkey` FOREIGN KEY (`ID_Rutina`) REFERENCES `Rutina`(`ID_Rutina`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloqueEjercicio` ADD CONSTRAINT `BloqueEjercicio_ID_Bloque_fkey` FOREIGN KEY (`ID_Bloque`) REFERENCES `Bloque`(`ID_Bloque`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BloqueEjercicio` ADD CONSTRAINT `BloqueEjercicio_ID_Ejercicio_fkey` FOREIGN KEY (`ID_Ejercicio`) REFERENCES `Ejercicio`(`ID_Ejercicio`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EjercicioMedicion` ADD CONSTRAINT `EjercicioMedicion_ID_Usuario_fkey` FOREIGN KEY (`ID_Usuario`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HistoricoEjercicio` ADD CONSTRAINT `HistoricoEjercicio_ID_EjercicioMedicion_fkey` FOREIGN KEY (`ID_EjercicioMedicion`) REFERENCES `EjercicioMedicion`(`ID_EjercicioMedicion`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EntrenadoresClases` ADD CONSTRAINT `_EntrenadoresClases_A_fkey` FOREIGN KEY (`A`) REFERENCES `Clase`(`ID_Clase`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_EntrenadoresClases` ADD CONSTRAINT `_EntrenadoresClases_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`ID_Usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
