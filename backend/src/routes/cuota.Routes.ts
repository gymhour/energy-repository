import express from 'express';
import { cuotaMethods } from '../controllers/cuota.Controller.js';
import { authenticateToken, isAdmin } from '../services/auth.service.js';

const cuotaRouter = express.Router();


cuotaRouter.get("/", authenticateToken, isAdmin, cuotaMethods.getAllCuotas);
cuotaRouter.get("/usuario/:idUsuario/cuotas", authenticateToken, cuotaMethods.getAllCuotasByUsuario);
cuotaRouter.get("/usuario/:idUsuario/preview", authenticateToken, isAdmin, cuotaMethods.getCuotaManualPreview);
cuotaRouter.get("/reminder/:idUsuario", authenticateToken, cuotaMethods.getCuotasVencenPronto);
cuotaRouter.post("/usuario/:idUsuario", authenticateToken, isAdmin, cuotaMethods.createCuota);
cuotaRouter.post("/usuario/:idUsuario/preparar-lotes", authenticateToken, isAdmin, cuotaMethods.prepararCuotaUsuarioLotes);
cuotaRouter.post("/usuario/:idUsuario/turnos-fijos/lote", authenticateToken, isAdmin, cuotaMethods.generarTurnosCuotaUsuarioLote);
cuotaRouter.post("/usuario/:idUsuario/regenerate-turnos-fijos", authenticateToken, isAdmin, cuotaMethods.regenerateTurnosFijosByUsuario);
cuotaRouter.post("/generate-cuotas", authenticateToken, isAdmin, cuotaMethods.generateMonthlyCuotas);
cuotaRouter.post("/generate-cuotas/preparar", authenticateToken, isAdmin, cuotaMethods.prepararCuotasMasivas);
cuotaRouter.post("/generate-cuotas/lote", authenticateToken, isAdmin, cuotaMethods.generarCuotasLote);
cuotaRouter.post("/delete-cuotas/preparar", authenticateToken, isAdmin, cuotaMethods.prepararEliminacionCuotasByMes);
cuotaRouter.post("/delete-cuotas/lote", authenticateToken, isAdmin, cuotaMethods.eliminarCuotasByMesLote);
cuotaRouter.put("/:id", authenticateToken, isAdmin, cuotaMethods.updateCuota);
cuotaRouter.put("/:id/pay", authenticateToken, isAdmin, cuotaMethods.payCuota);
cuotaRouter.delete("/:id", authenticateToken, isAdmin, cuotaMethods.deleteCuota);

export default cuotaRouter;
