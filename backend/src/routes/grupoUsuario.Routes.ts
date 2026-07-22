import express from "express";
import { grupoUsuarioMethods } from "../controllers/grupoUsuario.Controller.js";
import { authenticateToken, isAdminOrEntrenador } from "../services/auth.service.js";

const grupoUsuarioRouter = express.Router();

grupoUsuarioRouter.use(authenticateToken, isAdminOrEntrenador);

grupoUsuarioRouter.get("/", grupoUsuarioMethods.getGruposUsuarios);
grupoUsuarioRouter.post("/", grupoUsuarioMethods.createGrupoUsuario);
grupoUsuarioRouter.get("/:id", grupoUsuarioMethods.getGrupoUsuarioById);
grupoUsuarioRouter.put("/:id", grupoUsuarioMethods.updateGrupoUsuario);
grupoUsuarioRouter.delete("/:id", grupoUsuarioMethods.deleteGrupoUsuario);
grupoUsuarioRouter.post("/:id/miembros", grupoUsuarioMethods.addMiembrosGrupoUsuario);
grupoUsuarioRouter.delete("/:id/miembros/:idUsuario", grupoUsuarioMethods.removeMiembroGrupoUsuario);

export default grupoUsuarioRouter;
