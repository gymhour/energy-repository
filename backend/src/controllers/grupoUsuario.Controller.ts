import { Request, Response } from "express";
import prisma from "../models/Prisma.js";

const parseIds = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0)
    ));
};

const includeGrupo = {
    miembros: {
        include: {
            usuario: {
                select: {
                    ID_Usuario: true,
                    nombre: true,
                    apellido: true,
                    dni: true,
                    email: true,
                    tipo: true,
                    estado: true
                }
            }
        }
    },
    rutinas: {
        include: {
            rutina: {
                select: {
                    ID_Rutina: true,
                    nombre: true,
                    claseRutina: true,
                    grupoMuscularRutina: true
                }
            }
        }
    }
};

export const getGruposUsuarios = async (_req: Request, res: Response): Promise<void> => {
    try {
        const grupos = await prisma.grupoUsuario.findMany({
            include: includeGrupo,
            orderBy: { createdAt: "desc" }
        });

        res.status(200).json({ grupos });
    } catch (error: any) {
        console.error("Error obteniendo grupos de usuarios:", error);
        res.status(500).json({ message: "Error obteniendo grupos de usuarios", error: error.message });
    }
};

export const getGrupoUsuarioById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: "ID de grupo inválido" });
        return;
    }

    try {
        const grupo = await prisma.grupoUsuario.findUnique({
            where: { ID_GrupoUsuario: id },
            include: includeGrupo
        });

        if (!grupo) {
            res.status(404).json({ message: "Grupo no encontrado" });
            return;
        }

        res.status(200).json({ grupo });
    } catch (error: any) {
        console.error("Error obteniendo grupo de usuarios:", error);
        res.status(500).json({ message: "Error obteniendo grupo de usuarios", error: error.message });
    }
};

export const createGrupoUsuario = async (req: Request, res: Response): Promise<void> => {
    const { nombre, descripcion, estado = true, miembrosIds = [] } = req.body;

    if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ message: "El nombre del grupo es obligatorio" });
        return;
    }

    const ids = parseIds(miembrosIds);

    try {
        const grupo = await prisma.grupoUsuario.create({
            data: {
                nombre: nombre.trim(),
                descripcion: typeof descripcion === "string" && descripcion.trim() ? descripcion.trim() : null,
                estado: Boolean(estado),
                miembros: ids.length
                    ? { create: ids.map(ID_Usuario => ({ ID_Usuario })) }
                    : undefined
            },
            include: includeGrupo
        });

        res.status(201).json({ message: "Grupo creado exitosamente", grupo });
    } catch (error: any) {
        console.error("Error creando grupo de usuarios:", error);
        res.status(500).json({ message: "Error creando grupo de usuarios", error: error.message });
    }
};

export const updateGrupoUsuario = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: "ID de grupo inválido" });
        return;
    }

    const { nombre, descripcion, estado, miembrosIds } = req.body;

    try {
        const grupo = await prisma.$transaction(async tx => {
            const data: any = {};
            if (typeof nombre === "string") data.nombre = nombre.trim();
            if (typeof descripcion === "string") data.descripcion = descripcion.trim() || null;
            if (typeof estado !== "undefined") data.estado = Boolean(estado);

            if (Object.keys(data).length) {
                await tx.grupoUsuario.update({ where: { ID_GrupoUsuario: id }, data });
            }

            if (Array.isArray(miembrosIds)) {
                const ids = parseIds(miembrosIds);
                await tx.grupoUsuarioMiembro.deleteMany({ where: { ID_GrupoUsuario: id } });
                if (ids.length) {
                    await tx.grupoUsuarioMiembro.createMany({
                        data: ids.map(ID_Usuario => ({ ID_GrupoUsuario: id, ID_Usuario })),
                        skipDuplicates: true
                    });
                }
            }

            return tx.grupoUsuario.findUnique({
                where: { ID_GrupoUsuario: id },
                include: includeGrupo
            });
        });

        if (!grupo) {
            res.status(404).json({ message: "Grupo no encontrado" });
            return;
        }

        res.status(200).json({ message: "Grupo actualizado exitosamente", grupo });
    } catch (error: any) {
        console.error("Error actualizando grupo de usuarios:", error);
        res.status(500).json({ message: "Error actualizando grupo de usuarios", error: error.message });
    }
};

export const deleteGrupoUsuario = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: "ID de grupo inválido" });
        return;
    }

    try {
        await prisma.grupoUsuario.delete({ where: { ID_GrupoUsuario: id } });
        res.status(200).json({ message: "Grupo eliminado exitosamente" });
    } catch (error: any) {
        console.error("Error eliminando grupo de usuarios:", error);
        res.status(500).json({ message: "Error eliminando grupo de usuarios", error: error.message });
    }
};

export const addMiembrosGrupoUsuario = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const ids = parseIds(req.body?.miembrosIds ?? req.body?.usuariosIds ?? []);

    if (!Number.isInteger(id) || id < 1 || ids.length === 0) {
        res.status(400).json({ message: "ID de grupo o miembros inválidos" });
        return;
    }

    try {
        await prisma.grupoUsuarioMiembro.createMany({
            data: ids.map(ID_Usuario => ({ ID_GrupoUsuario: id, ID_Usuario })),
            skipDuplicates: true
        });

        const grupo = await prisma.grupoUsuario.findUnique({ where: { ID_GrupoUsuario: id }, include: includeGrupo });
        res.status(200).json({ message: "Miembros agregados exitosamente", grupo });
    } catch (error: any) {
        console.error("Error agregando miembros al grupo:", error);
        res.status(500).json({ message: "Error agregando miembros al grupo", error: error.message });
    }
};

export const removeMiembroGrupoUsuario = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const idUsuario = Number(req.params.idUsuario);

    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(idUsuario) || idUsuario < 1) {
        res.status(400).json({ message: "ID de grupo o usuario inválido" });
        return;
    }

    try {
        await prisma.grupoUsuarioMiembro.deleteMany({
            where: { ID_GrupoUsuario: id, ID_Usuario: idUsuario }
        });

        const grupo = await prisma.grupoUsuario.findUnique({ where: { ID_GrupoUsuario: id }, include: includeGrupo });
        res.status(200).json({ message: "Miembro removido exitosamente", grupo });
    } catch (error: any) {
        console.error("Error removiendo miembro del grupo:", error);
        res.status(500).json({ message: "Error removiendo miembro del grupo", error: error.message });
    }
};

export const grupoUsuarioMethods = {
    getGruposUsuarios,
    getGrupoUsuarioById,
    createGrupoUsuario,
    updateGrupoUsuario,
    deleteGrupoUsuario,
    addMiembrosGrupoUsuario,
    removeMiembroGrupoUsuario
};
