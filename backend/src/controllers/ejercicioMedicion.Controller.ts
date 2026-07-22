import { Request, Response } from "express";
import prisma from "../models/Prisma.js";

// Crear un EjercicioMedicion
const createEjercicioMedicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ID_Usuario, nombre, tipoMedicion } = req.body;

    // Validar datos obligatorios
    if (!ID_Usuario || !nombre || !tipoMedicion) {
      res.status(400).json({ message: "Faltan datos obligatorios" });
      return;
    }

    const ejercicio = await prisma.ejercicioMedicion.create({
      data: {
        ID_Usuario: Number(ID_Usuario),
        nombre,
        tipoMedicion,
      },
      include: {
        HistoricoEjercicios: true,
      },
    });

    res.status(201).json(ejercicio);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el ejercicio de medición", error: error.message });
  }
};

// Obtener todos los EjerciciosMedicion (incluyendo su histórico)
const getAllEjerciciosMedicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const ejercicios = await prisma.ejercicioMedicion.findMany({
      include: {
        HistoricoEjercicios: true,
      },
    });
    res.status(200).json(ejercicios);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener ejercicios de medición", error: error.message });
  }
};

// Obtener un EjercicioMedicion por ID (incluyendo su histórico)
const getEjercicioMedicionById = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  try {
    const ejercicio = await prisma.ejercicioMedicion.findUnique({
      where: { ID_EjercicioMedicion: id },
      include: { HistoricoEjercicios: true },
    });

    if (!ejercicio) {
      res.status(404).json({ message: "Ejercicio de medición no encontrado" });
      return;
    }

    res.status(200).json(ejercicio);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el ejercicio de medición", error: error.message });
  }
};

// Actualizar un EjercicioMedicion
const updateEjercicioMedicion = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  const { nombre, tipoMedicion } = req.body;

  try {
    if (!nombre && !tipoMedicion) {
      res.status(400).json({ message: "No hay datos para actualizar" });
      return;
    }

    const updatedEjercicio = await prisma.ejercicioMedicion.update({
      where: { ID_EjercicioMedicion: id },
      data: {
        ...(nombre && { nombre }),
        ...(tipoMedicion && { tipoMedicion }),
      },
      include: { HistoricoEjercicios: true },
    });

    res.status(200).json(updatedEjercicio);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el ejercicio de medición", error: error.message });
  }
};

// Eliminar un EjercicioMedicion
const deleteEjercicioMedicion = async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);

  try {
    await prisma.ejercicioMedicion.delete({
      where: { ID_EjercicioMedicion: id },
    });

    res.status(200).json({ message: `Ejercicio de medición ${id} eliminado` });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el ejercicio de medición", error: error.message });
  }
};

const getMaxCantidadByEjercicioMedicion = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID de EjercicioMedicion inválido" });
      return;
    }

    // Usar la función aggregate para obtener el máximo valor de 'Cantidad'
    const result = await prisma.historicoEjercicio.aggregate({
      where: {
        ID_EjercicioMedicion: id,
      },
      _max: {
        Cantidad: true,
      },
    });

    // result._max.Cantidad contendrá el valor máximo o null si no hay registros
    res.status(200).json({ maxCantidad: result._max.Cantidad });
  } catch (error: any) {
    console.error("Error obteniendo la mayor cantidad:", error);
    res.status(500).json({ message: "Error al obtener la mayor cantidad", error: error.message });
  }
};

const getEjerciciosMedicionByUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.idUsuario);
    if (isNaN(userId)) {
      res.status(400).json({ message: "El ID de usuario es obligatorio y debe ser un número" });
      return;
    }

    const ejercicios = await prisma.ejercicioMedicion.findMany({
      where: { ID_Usuario: userId },
      include: { HistoricoEjercicios: true }
    });

    res.status(200).json({ ejercicios });
  } catch (error: any) {
    console.error("Error al obtener ejercicios de medición por usuario:", error);
    res.status(500).json({ message: "Error al obtener los ejercicios de medición", error: error.message });
  }
};


export const ejercicioMedicionMethods = {
  createEjercicioMedicion,
  getAllEjerciciosMedicion,
  getEjercicioMedicionById,
  updateEjercicioMedicion,
  deleteEjercicioMedicion,
  getMaxCantidadByEjercicioMedicion,
  getEjerciciosMedicionByUsuario
};
