import { Request, Response } from 'express';
import prisma from '../models/Prisma.js';
import { getMaxSessionsForDuration, normalizePlanDuration } from '../services/accessRules.service.js';

// Crear un nuevo plan
export const createPlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, precio, desc, duracion, sesionesPorSemana, sesionesTotales, sesionesGracia, requiereTurno } = req.body;
        const precioNumber = Number(precio);
        if (!nombre || !Number.isFinite(precioNumber)) {
            res.status(400).json({ message: "Faltan 'nombre' o 'precio' válidos" });
            return;
        }
        const dur = normalizePlanDuration(duracion);
        const totales = Number(sesionesTotales || 0);
        const maxSesiones = getMaxSessionsForDuration(dur);
        if (totales > maxSesiones) {
            res.status(400).json({ message: `Las sesiones totales (${totales}) no pueden superar ${maxSesiones} para un plan ${dur.toLowerCase()}.` });
            return;
        }
        const plan = await prisma.plan.create({
            data: {
                nombre,
                precio: precioNumber,
                desc,
                duracion: dur,
                sesionesPorSemana: Number(sesionesPorSemana || 0),
                sesionesTotales: totales,
                sesionesGracia: Number(sesionesGracia || 0),
                requiereTurno: requiereTurno !== false,
            }
        });
        res.status(201).json({ message: 'Plan creado', plan });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error creando plan', error: error.message });
    }
};

// Listar todos los planes
export const getAllPlans = async (req: Request, res: Response): Promise<void> => {
    try {
        const plans = await prisma.plan.findMany();
        res.status(200).json(plans);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo planes', error: error.message });
    }
};

// Obtener un plan por ID
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
    try {
        const ID_Plan = Number(req.params.id);
        const plan = await prisma.plan.findUnique({ where: { ID_Plan } });
        if (!plan) {
            res.status(404).json({ message: 'Plan no encontrado' });
            return;
        }
        res.status(200).json(plan);
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error obteniendo plan', error: error.message });
    }
};

// Actualizar un plan
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const ID_Plan = Number(req.params.id);
        const { nombre, precio, desc, duracion, sesionesPorSemana, sesionesTotales, sesionesGracia, requiereTurno } = req.body;
        if (!nombre && precio === undefined && desc === undefined && duracion === undefined && sesionesPorSemana === undefined && sesionesTotales === undefined && sesionesGracia === undefined && requiereTurno === undefined) {
            res.status(400).json({ message: 'Nada para actualizar' });
            return;
        }
        if (sesionesTotales !== undefined) {
            const dur = duracion !== undefined
                ? normalizePlanDuration(duracion)
                : normalizePlanDuration((await prisma.plan.findUnique({ where: { ID_Plan }, select: { duracion: true } }))?.duracion);
            const totales = Number(sesionesTotales);
            const maxSesiones = getMaxSessionsForDuration(dur);
            if (totales > maxSesiones) {
                res.status(400).json({ message: `Las sesiones totales (${totales}) no pueden superar ${maxSesiones} para un plan ${dur.toLowerCase()}.` });
                return;
            }
        }
        const updated = await prisma.plan.update({
            where: { ID_Plan },
            data: {
                ...(nombre && { nombre }),
                ...(precio !== undefined && { precio: Number(precio) }),
                ...(desc !== undefined && { desc }),
                ...(duracion !== undefined && { duracion: normalizePlanDuration(duracion) }),
                ...(sesionesPorSemana !== undefined && { sesionesPorSemana: Number(sesionesPorSemana) }),
                ...(sesionesTotales !== undefined && { sesionesTotales: Number(sesionesTotales) }),
                ...(sesionesGracia !== undefined && { sesionesGracia: Number(sesionesGracia) }),
                ...(requiereTurno !== undefined && { requiereTurno: Boolean(requiereTurno) }),
            }
        });
        res.status(200).json({ message: 'Plan actualizado', plan: updated });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error actualizando plan', error: error.message });
    }
};

// Borrar un plan
export const deletePlan = async (req: Request, res: Response): Promise<void> => {
    try {
        const ID_Plan = Number(req.params.id);
        await prisma.plan.delete({ where: { ID_Plan } });
        res.status(200).json({ message: 'Plan eliminado' });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando plan', error: error.message });
    }
};


export const planMethods = {
    createPlan,
    deletePlan,
    getPlanById,
    getAllPlans,
    updatePlan,
}
