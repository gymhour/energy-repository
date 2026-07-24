import express from 'express';
import { claseMethods } from '../controllers/clase.Controller.js';
import { authenticateToken, isAdminOrRecepcion, isStaff } from '../services/auth.service.js';
import upload from '../services/multer.service.js';

const claseRouter = express.Router();

claseRouter.get('/horario/', claseMethods.getAllClasesAndHorarioClases)
claseRouter.post("/:idClase/entrenador/:idEntrenador", authenticateToken, isAdminOrRecepcion,claseMethods.asignarEntrenadorAClase);
claseRouter.post('/horario/', authenticateToken, isAdminOrRecepcion,upload.single('image'), claseMethods.createClaseWithHorarios)
claseRouter.get('/horario/:id/turnos-activos', authenticateToken, isStaff, claseMethods.getTurnosActivosByHorario);
claseRouter.get('/horario/:id/cupos', claseMethods.getHorarioCupos);
claseRouter.get('/horario/:id', claseMethods.getClaseById)
claseRouter.post('/horario/:id/modify', authenticateToken, isStaff, claseMethods.modifyHorarioSingle);
claseRouter.put('/clase/:id', authenticateToken, isStaff, upload.single('image'), claseMethods.updateClaseFields);
claseRouter.delete('/horario/:id', authenticateToken, isAdminOrRecepcion,claseMethods.deleteClaseWithHorarios)
claseRouter.delete("/:idClase/entrenador/:idEntrenador", authenticateToken, isAdminOrRecepcion,claseMethods.removeEntrenadorFromClase);
claseRouter.post('/:idClase/horarioClase', authenticateToken, isStaff, claseMethods.createHorarioSingle);
claseRouter.delete('/horarioClase/:id', authenticateToken, isStaff, claseMethods.deleteHorarioSingle);

export default claseRouter;