import express from 'express';
import { cuotaMethods } from '../controllers/cuota.Controller.js';
import { authenticateToken, isAdminOrRecepcion, isSelfOrStaff } from '../services/auth.service.js';

const cuotaRouter = express.Router();


cuotaRouter.get("/", authenticateToken, isAdminOrRecepcion, cuotaMethods.getAllCuotas);
cuotaRouter.get("/mora/configuracion", authenticateToken, isAdminOrRecepcion, cuotaMethods.getMoraConfiguracion);
cuotaRouter.put("/mora/configuracion", authenticateToken, isAdminOrRecepcion, cuotaMethods.updateMoraConfiguracion);
cuotaRouter.get("/mora/historial", authenticateToken, isAdminOrRecepcion, cuotaMethods.getMoraHistorial);
cuotaRouter.get("/usuario/:idUsuario/cuotas", authenticateToken, isSelfOrStaff, cuotaMethods.getAllCuotasByUsuario);
cuotaRouter.get("/usuario/:idUsuario/preview", authenticateToken, isAdminOrRecepcion, cuotaMethods.getCuotaManualPreview);
cuotaRouter.get("/reminder/:idUsuario", authenticateToken, isSelfOrStaff, cuotaMethods.getCuotasVencenPronto);
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
cuotaRouter.put("/:id/mora", authenticateToken, isAdminOrRecepcion, cuotaMethods.updateCuotaMora);
cuotaRouter.delete("/:id", authenticateToken, isAdminOrRecepcion, cuotaMethods.deleteCuota);

export default cuotaRouter;
