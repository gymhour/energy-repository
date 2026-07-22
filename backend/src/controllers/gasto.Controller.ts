import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../models/Prisma.js';

const GASTO_CATEGORIAS = ['Alquiler', 'Sueldos', 'Insumos', 'Servicios', 'Marketing', 'Impuestos', 'Otros'] as const;
type GastoCategoria = typeof GASTO_CATEGORIAS[number];

const PAGE_SIZE = 15;

const isValidCategoria = (value: unknown): value is GastoCategoria =>
  typeof value === 'string' && (GASTO_CATEGORIAS as readonly string[]).includes(value);

// Deriva "YYYY-MM" desde los componentes UTC de la fecha (consistente con el almacenamiento wall-clock).
const deriveMes = (fecha: Date): string => {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth() + 1;
  return `${y}-${m < 10 ? '0' + m : m}`;
};

const parseFecha = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
};

const parseMonto = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// 1. Crear gasto
const createGasto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fecha, categoria, monto, descripcion } = req.body;

    const fechaDate = parseFecha(fecha);
    if (!fechaDate) {
      res.status(400).json({ message: "La 'fecha' es obligatoria y debe ser una fecha válida" });
      return;
    }
    if (!isValidCategoria(categoria)) {
      res.status(400).json({ message: `'categoria' inválida. Opciones: ${GASTO_CATEGORIAS.join(', ')}` });
      return;
    }
    const montoNum = parseMonto(monto);
    if (montoNum === null) {
      res.status(400).json({ message: "El 'monto' debe ser un número mayor a 0" });
      return;
    }

    const gasto = await prisma.gasto.create({
      data: {
        fecha: fechaDate,
        mes: deriveMes(fechaDate),
        categoria,
        monto: montoNum,
        descripcion: typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null,
      },
    });

    res.status(201).json({ message: 'Gasto creado correctamente', data: gasto });
  } catch (error: any) {
    console.error('Error al crear gasto:', error);
    res.status(500).json({ message: 'Error al crear el gasto', error: error.message });
  }
};

// 2. Listar gastos paginados con filtros + total del período
const getAllGastos = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', categoria, mes, fechaDesde, fechaHasta } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const take = PAGE_SIZE;
    const skip = (pageNumber - 1) * take;

    const where: Prisma.GastoWhereInput = {};

    if (typeof categoria === 'string' && isValidCategoria(categoria.trim())) {
      where.categoria = categoria.trim();
    }
    if (typeof mes === 'string' && mes.trim()) {
      where.mes = { contains: mes.trim() };
    }

    const fechaFilter: Prisma.DateTimeFilter = {};
    const desde = parseFecha(fechaDesde);
    const hasta = parseFecha(fechaHasta);
    if (desde) fechaFilter.gte = desde;
    if (hasta) fechaFilter.lte = hasta;
    if (Object.keys(fechaFilter).length > 0) where.fecha = fechaFilter;

    const [totalItems, sumResult, gastos] = await prisma.$transaction([
      prisma.gasto.count({ where }),
      prisma.gasto.aggregate({ where, _sum: { monto: true } }),
      prisma.gasto.findMany({ where, skip, take, orderBy: { fecha: 'desc' } }),
    ]);

    const totalPages = Math.ceil(totalItems / take);

    res.status(200).json({
      meta: {
        totalItems,
        take,
        page: pageNumber,
        totalPages,
        totalMonto: sumResult._sum.monto ?? 0,
      },
      data: gastos,
    });
  } catch (error: any) {
    console.error('Error al obtener gastos:', error);
    res.status(500).json({ message: 'Error al obtener los gastos', error: error.message });
  }
};

// 3. Actualizar gasto
const updateGasto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID de gasto inválido' });
      return;
    }

    const { fecha, categoria, monto, descripcion } = req.body;
    const data: Prisma.GastoUpdateInput = {};

    if (fecha !== undefined) {
      const fechaDate = parseFecha(fecha);
      if (!fechaDate) {
        res.status(400).json({ message: "La 'fecha' debe ser una fecha válida" });
        return;
      }
      data.fecha = fechaDate;
      data.mes = deriveMes(fechaDate); // re-deriva el mes ante cambio de fecha
    }
    if (categoria !== undefined) {
      if (!isValidCategoria(categoria)) {
        res.status(400).json({ message: `'categoria' inválida. Opciones: ${GASTO_CATEGORIAS.join(', ')}` });
        return;
      }
      data.categoria = categoria;
    }
    if (monto !== undefined) {
      const montoNum = parseMonto(monto);
      if (montoNum === null) {
        res.status(400).json({ message: "El 'monto' debe ser un número mayor a 0" });
        return;
      }
      data.monto = montoNum;
    }
    if (descripcion !== undefined) {
      data.descripcion = typeof descripcion === 'string' && descripcion.trim() ? descripcion.trim() : null;
    }

    const gasto = await prisma.gasto.update({ where: { ID_Gasto: id }, data });
    res.status(200).json({ message: 'Gasto actualizado correctamente', data: gasto });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ message: 'Gasto no encontrado' });
      return;
    }
    console.error('Error al actualizar gasto:', error);
    res.status(500).json({ message: 'Error al actualizar el gasto', error: error.message });
  }
};

// 4. Eliminar gasto
const deleteGasto = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID de gasto inválido' });
      return;
    }

    await prisma.gasto.delete({ where: { ID_Gasto: id } });
    res.status(200).json({ message: 'Gasto eliminado correctamente' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ message: 'Gasto no encontrado' });
      return;
    }
    console.error('Error al eliminar gasto:', error);
    res.status(500).json({ message: 'Error al eliminar el gasto', error: error.message });
  }
};

export const gastoMethods = { createGasto, getAllGastos, updateGasto, deleteGasto };
