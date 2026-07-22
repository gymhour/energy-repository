import { Request, Response } from 'express';
import prisma from '../models/Prisma.js';
import { deleteImage, getImageUrl, uploadImageBuffer } from '../services/cloudinary.service.js';

// CREATE
export const createEjercicio = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            nombre,
            descripcion,
            youtubeUrl: rawYoutubeUrl,
            instrucciones,
            musculos,
            equipamiento,
        } = req.body as {
            nombre: string;
            descripcion?: string;
            youtubeUrl?: string;
            instrucciones?: string;
            musculos?: string;
            equipamiento?: string;
        };

        if (!nombre.trim()) {
            res.status(400).json({ message: "El campo 'nombre' es obligatorio" });
            return;
        }

        const youtubeUrl = rawYoutubeUrl?.trim() || null;

        // 1) Crear sin media
        const ejercicio = await prisma.ejercicio.create({
            data: {
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                youtubeUrl,
                instrucciones: instrucciones?.trim() || null,
                musculos: musculos?.trim() || null,
                equipamiento: equipamiento?.trim() || null,
            },
        });

        // 2) Si viene archivo, subo y actualizo mediaUrl
        if (req.file) {
            const result = await uploadImageBuffer(
                req.file.buffer as Buffer,
                `ejercicio_${ejercicio.ID_Ejercicio}`,
                'ejercicios'
            );
            await prisma.ejercicio.update({
                where: { ID_Ejercicio: ejercicio.ID_Ejercicio },
                data: { mediaUrl: result.public_id },
            });
            ejercicio.mediaUrl = result.public_id;
        }

        res.status(201).json({ message: "Ejercicio creado", ejercicio });
        return;
    } catch (error: any) {
        console.error("Error creando ejercicio:", error);
        res.status(500).json({ message: "Error al crear ejercicio", error: error.message });
        return;
    }
};

// READ ALL
export const getAllEjercicios = async (_req: Request, res: Response): Promise<void> => {
    try {
        const ejercicios = await prisma.ejercicio.findMany({
            where: { esGenerico: false },
            orderBy: { nombre: 'asc' },
            select: {
                ID_Ejercicio: true,
                nombre: true,
                descripcion: true,
                mediaUrl: true,
                youtubeUrl: true,
                instrucciones: true,
                musculos: true,
                equipamiento: true
            }
        });

        const resultado = ejercicios.map(e => ({
            ID_Ejercicio: e.ID_Ejercicio,
            nombre: e.nombre,
            descripcion: e.descripcion,
            mediaUrl: e.mediaUrl ? getImageUrl(e.mediaUrl, { secure: true }) : null,
            youtubeUrl: e.youtubeUrl,
            instrucciones: e.instrucciones,
            musculos: e.musculos,
            equipamiento: e.equipamiento
        }));

        res.status(200).json(resultado);
        return;
    } catch (error: any) {
        console.error("Error obteniendo ejercicios:", error);
        res.status(500).json({ message: "Error al obtener ejercicios", error: error.message });
        return;
    }
};

// READ ONE
export const getEjercicioById = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ message: "El 'ID_Ejercicio' debe ser un número válido" });
            return;
        }

        const e = await prisma.ejercicio.findUnique({
            where: { ID_Ejercicio: id },
            select: {
                ID_Ejercicio: true,
                nombre: true,
                descripcion: true,
                mediaUrl: true,
                youtubeUrl: true,
                instrucciones: true,
                musculos: true,
                equipamiento: true
            }
        });
        if (!e) {
            res.status(404).json({ message: `Ejercicio con ID ${id} no encontrado` });
            return;
        }

        res.status(200).json({
            ID_Ejercicio: e.ID_Ejercicio,
            nombre: e.nombre,
            descripcion: e.descripcion,
            mediaUrl: e.mediaUrl ? getImageUrl(e.mediaUrl, { secure: true }) : null,
            youtubeUrl: e.youtubeUrl,
            instrucciones: e.instrucciones,
            musculos: e.musculos,
            equipamiento: e.equipamiento
        });
        return;
    } catch (error: any) {
        console.error("Error obteniendo ejercicio:", error);
        res.status(500).json({ message: "Error al obtener ejercicio", error: error.message });
        return;
    }
};

// UPDATE
export const updateEjercicio = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ message: "El 'ID_Ejercicio' debe ser un número válido" });
            return;
        }

        const {
            nombre,
            descripcion,
            youtubeUrl: rawYoutubeUrl,
            instrucciones,
            musculos,
            equipamiento
        } = req.body as {
            nombre?: string;
            descripcion?: string;
            youtubeUrl?: string;
            instrucciones?: string;
            musculos?: string;
            equipamiento?: string;
        };

        if (
            nombre === undefined &&
            descripcion === undefined &&
            rawYoutubeUrl === undefined &&
            instrucciones === undefined &&
            musculos === undefined &&
            equipamiento === undefined &&
            !req.file
        ) {
            res.status(400).json({ message: "Nada para actualizar" });
            return;
        }

        const data: any = {};
        if (nombre !== undefined) data.nombre = nombre.trim();
        if (descripcion !== undefined) data.descripcion = descripcion.trim() || null;
        if (instrucciones !== undefined) data.instrucciones = instrucciones.trim() || null;
        if (musculos !== undefined) data.musculos = musculos.trim() || null;
        if (equipamiento !== undefined) data.equipamiento = equipamiento.trim() || null;
        if (rawYoutubeUrl !== undefined) data.youtubeUrl = rawYoutubeUrl.trim() || null;

        if (req.file) {
            const uploadRes = await uploadImageBuffer(
                req.file.buffer as Buffer,
                `ejercicio_${id}_${Date.now()}`,
                'ejercicios'
            );
            data.mediaUrl = uploadRes.public_id;
        }

        const updated = await prisma.ejercicio.update({
            where: { ID_Ejercicio: id },
            data
        });

        res.status(200).json({ message: "Ejercicio actualizado", ejercicio: updated });
        return;
    } catch (error: any) {
        console.error("Error actualizando ejercicio:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: "Ejercicio no encontrado" });
        } else {
            res.status(500).json({ message: "Error al actualizar ejercicio", error: error.message });
        }
        return;
    }
};

// Eliminar un ejercicio del catálogo
export const deleteEjercicio = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ message: "El 'ID_Ejercicio' debe ser un número válido" });
            return;
        }

        const ejercicio = await prisma.ejercicio.findUnique({
            where: { ID_Ejercicio: id },
            select: { mediaUrl: true },
        });
        if (!ejercicio) {
            res.status(404).json({ message: "Ejercicio no encontrado" });
            return;
        }

        // Borrar media en Cloudinary si existe
        if (ejercicio.mediaUrl) {
            await deleteImage(ejercicio.mediaUrl);
        }

        await prisma.ejercicio.delete({ where: { ID_Ejercicio: id } });
        res.status(200).json({ message: `Ejercicio ${id} eliminado` });
    } catch (error: any) {
        console.error("Error eliminando ejercicio:", error);
        res.status(500).json({ message: "Error al eliminar ejercicio", error: error.message });
    }
};


export const ejercicioMethods = {
    createEjercicio,
    getAllEjercicios,
    getEjercicioById,
    updateEjercicio,
    deleteEjercicio
}