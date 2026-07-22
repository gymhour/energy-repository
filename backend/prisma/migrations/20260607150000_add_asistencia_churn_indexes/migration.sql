-- Indexes used by the churn-risk predictor attendance lookups.
CREATE INDEX `Asistencia_ID_Usuario_fechaIngreso_idx` ON `Asistencia`(`ID_Usuario`, `fechaIngreso`);
CREATE INDEX `Asistencia_permitido_fechaIngreso_idx` ON `Asistencia`(`permitido`, `fechaIngreso`);
