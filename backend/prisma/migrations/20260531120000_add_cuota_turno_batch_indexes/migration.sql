CREATE INDEX `Cuota_mes_idx` ON `Cuota`(`mes`);

CREATE INDEX `Cuota_ID_Usuario_mes_idx` ON `Cuota`(`ID_Usuario`, `mes`);

CREATE INDEX `Turno_ID_Cuota_idx` ON `Turno`(`ID_Cuota`);

CREATE INDEX `Turno_ID_HorarioClase_fecha_idx` ON `Turno`(`ID_HorarioClase`, `fecha`);

CREATE INDEX `Turno_ID_Usuario_ID_HorarioClase_fecha_idx` ON `Turno`(`ID_Usuario`, `ID_HorarioClase`, `fecha`);
