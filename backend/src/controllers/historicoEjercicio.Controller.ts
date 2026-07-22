import { Request, Response } from "express";
import prisma from "../models/Prisma.js";

const createHistoricoEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ID_EjercicioMedicion, Cantidad, Fecha } = req.body;

    // Validar que se envíen los datos obligatorios
    if (!ID_EjercicioMedicion || !Cantidad) {
      res.status(400).json({ message: "El ID_EjercicioMedicion y la Cantidad son obligatorios" });
      return;
    }

    // Crear el registro de histórico; si Fecha no se envía, se usará el valor por defecto (now) según el modelo
    const nuevoHistorico = await prisma.historicoEjercicio.create({
      data: {
        ID_EjercicioMedicion: Number(ID_EjercicioMedicion),
        Cantidad: Number(Cantidad), // Convierte a número
        Fecha: Fecha ? new Date(Fecha) : undefined,
      },
      include: {
        EjercicioMedicion: true,
      },
    });


    res.status(201).json({ message: "Histórico de ejercicio creado exitosamente", historicoEjercicio: nuevoHistorico });
  } catch (error: any) {
    console.error("Error al crear histórico de ejercicio:", error);
    res.status(500).json({ message: "Error al crear el histórico de ejercicio", error: error.message });
  }
};

// GET ONE by ID
const getHistoricoEjercicioById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID_HistoricoEjercicio no válido" });
      return;
    }
    const historico = await prisma.historicoEjercicio.findUnique({
      where: { ID_HistoricoEjercicio: id },
      include: { EjercicioMedicion: true }
    });
    if (!historico) {
      res.status(404).json({ message: "Histórico de ejercicio no encontrado" });
      return;
    }
    res.status(200).json(historico);
  } catch (error: any) {
    console.error("Error al obtener histórico de ejercicio:", error);
    res.status(500).json({ message: "Error al obtener histórico de ejercicio", error: error.message });
  }
};

// UPDATE
const updateHistoricoEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { Cantidad, Fecha } = req.body as {
      Cantidad?: number;
      Fecha?: string;
    };

    if (isNaN(id)) {
      res.status(400).json({ message: "ID_HistoricoEjercicio no válido" });
      return;
    }
    if (Cantidad === undefined && Fecha === undefined) {
      res.status(400).json({ message: "Nada para actualizar" });
      return;
    }

    const data: any = {};
    if (Cantidad !== undefined) data.Cantidad = Number(Cantidad);
    if (Fecha !== undefined) data.Fecha = Fecha ? new Date(Fecha) : undefined;

    const updated = await prisma.historicoEjercicio.update({
      where: { ID_HistoricoEjercicio: id },
      data,
      include: { EjercicioMedicion: true }
    });

    res.status(200).json({
      message: "Histórico de ejercicio actualizado",
      historicoEjercicio: updated
    });
  } catch (error: any) {
    console.error("Error al actualizar histórico de ejercicio:", error);
    if (error.code === "P2025") {
      res.status(404).json({ message: "Histórico de ejercicio no encontrado" });
    } else {
      res.status(500).json({ message: "Error al actualizar histórico de ejercicio", error: error.message });
    }
  }
};

// DELETE
const deleteHistoricoEjercicio = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID_HistoricoEjercicio no válido" });
      return;
    }
    await prisma.historicoEjercicio.delete({
      where: { ID_HistoricoEjercicio: id }
    });
    res.status(200).json({ message: "Histórico de ejercicio eliminado" });
  } catch (error: any) {
    console.error("Error al eliminar histórico de ejercicio:", error);
    if (error.code === "P2025") {
      res.status(404).json({ message: "Histórico de ejercicio no encontrado" });
    } else {
      res.status(500).json({ message: "Error al eliminar histórico de ejercicio", error: error.message });
    }
  }
};

export const historicoEjercicioMethods = {
  createHistoricoEjercicio,
  getHistoricoEjercicioById,
  updateHistoricoEjercicio,
  deleteHistoricoEjercicio
};