import express from 'express';
import { cuotaMethods } from '../controllers/cuota.Controller.js';
import { authenticateToken, isAdminOrRecepcion } from '../services/auth.service.js';

const cuotaRouter = express.Router();


cuotaRouter.get("/", authenticateToken, isAdminOrRecepcion, cuotaMethods.getAllCuotas);
cuotaRouter.get("/usuario/:idUsuario/cuotas", authenticateToken, cuotaMethods.getAllCuotasByUsuario);
cuotaRouter.get("/usuario/:idUsuario/preview", authenticateToken, isAdminOrRecepcion, cuotaMethods.getCuotaManualPreview);
cuotaRouter.get("/reminder/:idUsuario", authenticateToken, cuotaMethods.getCuotasVencenPronto);
cuotaRouter.post("/usuario/:idUsuario", authenticateToken, isAdminOrRecepcion, cuotaMethods.createCuota);
cuotaRouter.post("/usuario/:idUsuario/preparar-lotes", authenticateToken, isAdminOrRecepcion, cuotaMethods.prepararCuotaUsuarioLotes);
cuotaRouter.post("/usuario/:idUsuario/turnos-fijos/lote", authenticateToken, isAdminOrRecepcion, cuotaMethods.generarTurnosCuotaUsuarioLote);
cuotaRouter.post("/usuario/:idUsuario/regenerate-turnos-fijos", authenticateToken, isAdminOrRecepcion, cuotaMethods.regenerateTurnosFijosByUsuario);
cuotaRouter.post("/generate-cuotas", authenticateToken, isAdminOrRecepcion, cuotaMethods.generateMonthlyCuotas);
cuotaRouter.post("/generate-cuotas/preparar", authenticateToken, isAdminOrRecepcion, cuotaMethods.prepararCuotasMasivas);
cuotaRouter.post("/generate-cuotas/lote", authenticateToken, isAdminOrRecepcion, cuotaMethods.generarCuotasLote);
cuotaRouter.post("/delete-cuotas/preparar", authenticateToken, isAdminOrRecepcion, cuotaMethods.prepararEliminacionCuotasByMes);
cuotaRouter.post("/delete-cuotas/lote", authenticateToken, isAdminOrRecepcion, cuotaMethods.eliminarCuotasByMesLote);
cuotaRouter.put("/:id", authenticateToken, isAdminOrRecepcion, cuotaMethods.updateCuota);
cuotaRouter.put("/:id/pay", authenticateToken, isAdminOrRecepcion, cuotaMethods.payCuota);
cuotaRouter.delete("/:id", authenticateToken, isAdminOrRecepcion, cuotaMethods.deleteCuota);

export default cuotaRouter;
