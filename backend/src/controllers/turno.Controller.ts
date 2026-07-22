import { Request, Response } from "express";
import prismaHC from "../models/HorarioClase.js";
import prisma from "../models/Prisma.js";
import prismaUsu from "../models/User.js";
import {
  ACTIVE_TURNO_STATES,
  findActiveCuota,
  getArgentinaDate,
  hasTurnoSameDay,
  validateHorarioCupoAvailability,
  validatePeriodAvailability
} from "../services/accessRules.service.js";
import { isRetryableTransactionError, runSerializableTransaction } from "../services/transaction.service.js";

const parseWallClockDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(value);
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return new Date(value);
  return new Date(Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    match[6] ? Number(match[6]) : 0,
    0
  ));
};

const parseTurnoDateQuery = (value: unknown): { date?: Date; isDateOnly: boolean; invalid: boolean } => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { isDateOnly: false, invalid: false };
  }

  if (typeof rawValue !== "string") {
    return { isDateOnly: false, invalid: true };
  }

  const trimmed = rawValue.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const date = new Date(Date.UTC(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
      0,
      0,
      0,
      0
    ));
    return { date, isDateOnly: true, invalid: Number.isNaN(date.getTime()) };
  }

  const date = new Date(trimmed);
  return { date, isDateOnly: false, invalid: Number.isNaN(date.getTime()) };
};

const addUtcDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getAllTurnos = async (req: Request, res: Response): Promise<void> => {
  try {
    const fechaDesde = parseTurnoDateQuery(req.query.fechaDesde);
    const fechaHasta = parseTurnoDateQuery(req.query.fechaHasta);

    if (fechaDesde.invalid || fechaHasta.invalid) {
      res.status(400).json({ message: "Los filtros fechaDesde y fechaHasta deben ser fechas válidas" });
      return;
    }

    const fechaFilter: { gte?: Date; lt?: Date; lte?: Date } = {};
    if (fechaDesde.date) {
      fechaFilter.gte = fechaDesde.date;
    }
    if (fechaHasta.date) {
      if (fechaHasta.isDateOnly) {
        fechaFilter.lt = addUtcDays(fechaHasta.date, 1);
      } else {
        fechaFilter.lte = fechaHasta.date;
      }
    }

    if (fechaFilter.gte && (fechaFilter.lt || fechaFilter.lte)) {
      const hasta = fechaFilter.lt || fechaFilter.lte;
      if (hasta && fechaFilter.gte.getTime() >= hasta.getTime()) {
        res.status(400).json({ message: "fechaDesde debe ser anterior a fechaHasta" });
        return;
      }
    }

    const turnos = await prisma.turno.findMany({
      ...(Object.keys(fechaFilter).length > 0 ? { where: { fecha: fechaFilter } } : {}),
      include: {
        User: {
          select: {
            ID_Usuario: true,
            email: true,
            nombre: true,
            apellido: true,
          }
        }, // Información del usuario relacionado
        HorarioClase: {
          include: {
            Clase: true, // Información de la clase relacionada
          },
        },
      },
      orderBy: [
        { fecha: "asc" },
        { ID_HorarioClase: "asc" },
      ],
    });

    res.status(200).json(turnos);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los turnos", error: error.message });
  }
};

const createTurno = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ID_HorarioClase, fecha } = req.body;
    // Ownership: un cliente sólo puede crear turnos para sí mismo.
    // Admin/entrenador pueden crear turnos para otros indicando ID_Usuario.
    const userTipo = String(req.user?.tipo || '').toLowerCase();
    const isAdmin = userTipo === 'admin';
    const isStaff = ['admin', 'entrenador'].includes(userTipo);
    const ID_Usuario = isStaff ? Number(req.body.ID_Usuario) : req.user?.ID_Usuario;
    const fechaUTC = getArgentinaDate();
    // Validar que los datos necesarios estén presentes
    if (!ID_Usuario || !ID_HorarioClase || !fecha) {
      res.status(400).json({ message: "Faltan datos obligatorios" });
      return;
    }

    // Verificar que el usuario exista
    const usuario = await prismaUsu.findUnique({
      where: { ID_Usuario },
    });
    if (!usuario) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    // Verificar que el horario exista
    const horario = await prismaHC.findUnique({
      where: { ID_HorarioClase },
      include: {
        Clase: true,
      },
    });

    if (!horario) {
      res.status(404).json({ message: "Horario no encontrado" });
      return;
    }

    const fechaTurno = parseWallClockDate(fecha);
    const nuevoTurno = await runSerializableTransaction(async (tx) => {
      const cuotaActiva = await tx.cuota.findFirst({
        where: {
          ID_Usuario,
          fechaInicio: { lte: fechaTurno },
          fechaFin: { gte: fechaTurno },
        },
        include: { Plan: true },
        orderBy: { fechaInicio: "desc" },
      }) || await tx.cuota.findFirst({
        where: {
          ID_Usuario,
          mes: `${fechaTurno.getFullYear()}-${String(fechaTurno.getMonth() + 1).padStart(2, "0")}`,
        },
        include: { Plan: true },
        orderBy: { vence: "desc" },
      });
      if (!cuotaActiva) {
        throw new Error("El usuario no tiene una cuota activa para la fecha seleccionada");
      }

      if (!isAdmin) {
        const periodError = await validatePeriodAvailability(ID_Usuario, cuotaActiva, undefined, tx);
        if (periodError) throw new Error(periodError);

        if (await hasTurnoSameDay(ID_Usuario, fechaTurno, undefined, tx)) {
          throw new Error("Ya tenés un turno para ese día. No podés tener dos turnos el mismo día.");
        }

        const horarioActual = await tx.horarioClase.findUnique({
          where: { ID_HorarioClase: Number(ID_HorarioClase) },
          select: { cupos: true },
        });
        if (!horarioActual) throw new Error("Horario no encontrado");

        const cupoError = await validateHorarioCupoAvailability(
          Number(ID_HorarioClase),
          fechaTurno,
          horarioActual.cupos,
          {
            releaseFixedReservationForUserId: Number(ID_Usuario),
            client: tx,
          },
        );
        if (cupoError) throw new Error(cupoError);
      }

      return tx.turno.create({
        data: {
          fecha: fechaTurno,
          estado: "ACTIVO",
          origen: req.body.origen || "MANUAL",
          ID_Usuario,
          ID_HorarioClase,
          ID_Cuota: cuotaActiva.ID_Cuota,
          fechaCreacion: fechaUTC,
        },
        include: {
          HorarioClase: {
            include: {
              Clase: true,
            },
          },
          User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } },
        },
      });
    });

    res.status(201).json({ message: "Turno creado exitosamente", turno: nuevoTurno });
  } catch (error: any) {
    console.error(error);
    if (isRetryableTransactionError(error)) {
      res.status(409).json({ message: "El horario está siendo reservado por otra persona. Intentá nuevamente." });
      return;
    }
    const status = [
      "El usuario no tiene una cuota activa",
      "El plan permite",
      "Ya tenés un turno",
      "No hay cupos",
    ].some(message => String(error.message || "").startsWith(message)) ? 400 : 500;
    res.status(status).json({ message: status === 400 ? error.message : "Error al crear el turno", error: error.message });
  }
};


const deleteTurno = async (req: Request, res: Response): Promise<void> => {
  try {
    const id_turno = parseInt(req.params.id);

    // Validar que se haya proporcionado el ID del turno
    if (!id_turno) {
      res.status(400).json({ message: "El ID del turno es obligatorio" });
      return;
    }

    const turno = await prisma.turno.findUnique({
      where: { id_turno: Number(id_turno) },
    });

    if (!turno) {
      res.status(404).json({ message: "El turno no existe" });
      return;
    }

    // Ownership: un cliente sólo puede cancelar sus propios turnos.
    const userTipo = String(req.user?.tipo || '').toLowerCase();
    const isAdmin = userTipo === 'admin';
    const isStaff = ['admin', 'entrenador'].includes(userTipo);
    if (!isStaff && turno.ID_Usuario !== req.user?.ID_Usuario) {
      res.status(403).json({ message: "No tenés permiso para cancelar este turno" });
      return;
    }

    if (!isAdmin && turno.estado === 'ASISTIDO') {
      res.status(400).json({ message: "No se puede cancelar un turno que ya fue asistido" });
      return;
    }

    const now = getArgentinaDate();
    const fechaTurno = new Date(turno.fecha);
    const diffMs = fechaTurno.getTime() - now.getTime();
    if (!isAdmin && diffMs < 60 * 60 * 1000) {
      res.status(400).json({ message: "El turno solo puede cancelarse con al menos 1 hora de anticipación. Si necesitás resolverlo, hablá con el administrador." });
      return;
    }

    await prisma.turno.update({
      where: { id_turno: Number(id_turno) },
      data: {
        estado: "CANCELADO",
        canceladoEn: now
      }
    });

    res.status(200).json({ message: "Turno cancelado exitosamente" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el turno", error: error.message });
  }
};

const getTurnoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id_turno = parseInt(req.params.id);

    // Validar que se haya proporcionado el ID del turno
    if (!id_turno) {
      res.status(400).json({ message: "El ID del turno es obligatorio" });
      return;
    }

    // Buscar el turno por ID
    const turno = await prisma.turno.findUnique({
      where: { id_turno: Number(id_turno) },
      include: {
        User: {
          select: {
            ID_Usuario: true,
            email: true,
            nombre: true,
            apellido: true,
          }
        }, // Información del usuario relacionado
        HorarioClase: {
          include: {
            Clase: true, // Información de la clase relacionada
          },
        },
      },
    });

    // Verificar si el turno existe
    if (!turno) {
      res.status(404).json({ message: "El turno no existe" });
      return;
    }

    res.status(200).json(turno);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el turno", error: error.message });
  }
};

const updateTurno = async (req: Request, res: Response): Promise<void> => {
  try {
    const id_turno = parseInt(req.params.id);
    const { fecha, estado, ID_HorarioClase, ID_Usuario } = req.body;

    // Validar si existe el turno
    const turnoExistente = await prisma.turno.findUnique({
      where: { id_turno: Number(id_turno) },
    });

    if (!turnoExistente) {
      res.status(404).json({ message: "El turno no existe" });
      return;
    }

    const nextFecha = fecha ? parseWallClockDate(fecha) : turnoExistente.fecha;
    const nextUsuario = Number(ID_Usuario || turnoExistente.ID_Usuario);
    const nextHorarioClase = Number(ID_HorarioClase || turnoExistente.ID_HorarioClase);
    const nextEstado = estado || turnoExistente.estado;
    const turnoActualizado = await runSerializableTransaction(async (tx) => {
      const cuotaActiva = await tx.cuota.findFirst({
        where: {
          ID_Usuario: nextUsuario,
          fechaInicio: { lte: nextFecha },
          fechaFin: { gte: nextFecha },
        },
        include: { Plan: true },
        orderBy: { fechaInicio: "desc" },
      }) || await tx.cuota.findFirst({
        where: {
          ID_Usuario: nextUsuario,
          mes: `${nextFecha.getFullYear()}-${String(nextFecha.getMonth() + 1).padStart(2, "0")}`,
        },
        include: { Plan: true },
        orderBy: { vence: "desc" },
      });
      if (!cuotaActiva) {
        throw new Error("El usuario no tiene una cuota activa para la fecha seleccionada");
      }

      const periodError = await validatePeriodAvailability(nextUsuario, cuotaActiva, id_turno, tx);
      if (periodError) throw new Error(periodError);

      if (await hasTurnoSameDay(nextUsuario, nextFecha, id_turno, tx)) {
        throw new Error("El usuario ya tiene un turno para ese día.");
      }

      if (ACTIVE_TURNO_STATES.includes(nextEstado)) {
        const horarioClase = await tx.horarioClase.findUnique({
          where: { ID_HorarioClase: nextHorarioClase },
        });

        const cupoError = horarioClase
          ? await validateHorarioCupoAvailability(
            nextHorarioClase,
            nextFecha,
            horarioClase.cupos,
            {
              excludeTurnoId: id_turno,
              releaseFixedReservationForUserId: nextUsuario,
              client: tx,
            },
          )
          : null;
        if (cupoError) throw new Error(cupoError);
      }

      return tx.turno.update({
        where: { id_turno: Number(id_turno) },
        data: {
          fecha: nextFecha,
          estado,
          ID_HorarioClase: ID_HorarioClase || turnoExistente.ID_HorarioClase,
          ID_Usuario: ID_Usuario || turnoExistente.ID_Usuario,
          ID_Cuota: cuotaActiva.ID_Cuota,
        },
        include: {
          User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } },
          HorarioClase: {
            include: { Clase: true },
          },
        },
      });
    });

    res.status(200).json({
      message: "Turno actualizado exitosamente",
      turno: turnoActualizado,
    });
  } catch (error: any) {
    console.error(error);
    if (isRetryableTransactionError(error)) {
      res.status(409).json({ message: "El horario está siendo modificado por otra operación. Intentá nuevamente." });
      return;
    }
    const status = [
      "El usuario no tiene una cuota activa",
      "El plan permite",
      "El usuario ya tiene un turno",
      "No hay cupos",
    ].some(message => String(error.message || "").startsWith(message)) ? 400 : 500;
    res.status(status).json({
      message: status === 400 ? error.message : "Error al actualizar el turno",
      error: error.message,
    });
  }
};

const getTurnosByUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = parseInt(req.params.idUsuario);

    // Validar que se haya pasado un ID de usuario válido
    if (isNaN(userId)) {
      res.status(400).json({ message: "El ID de usuario es obligatorio y debe ser un número" });
      return;
    }

    // Ownership: un cliente sólo puede ver sus propios turnos.
    const isStaff = ['admin', 'entrenador'].includes(String(req.user?.tipo || '').toLowerCase());
    if (!isStaff && req.user?.ID_Usuario !== userId) {
      res.status(403).json({ message: "No tenés permiso para ver los turnos de otro usuario" });
      return;
    }

    // Buscar todos los turnos de ese usuario
    const turnos = await prisma.turno.findMany({
      where: { ID_Usuario: userId },
      include: {
        User: {
          select: {
            ID_Usuario: true,
            email: true,
            nombre: true,
            apellido: true,
          }
        },
        HorarioClase: {
          include: { Clase: true }
        }
      },
      orderBy: { fecha: 'asc' }  // opcional: ordenados por fecha
    });

    res.status(200).json({ turnos });
  } catch (error: any) {
    console.error("Error al obtener turnos por usuario:", error);
    res.status(500).json({ message: "Error al obtener los turnos", error: error.message });
  }
};

/* Borrado FÍSICO de un turno (solo admin, vía ruta). A diferencia de deleteTurno (cancelación
   lógica), elimina el registro definitivamente para liberar la sesión del período y el día.
   Solo aplica a turnos AUSENTE o CANCELADO: los ACTIVO se cancelan por el flujo normal y los
   ASISTIDO son historia real del alumno. */
const deleteTurnoFisico = async (req: Request, res: Response): Promise<void> => {
  try {
    const id_turno = parseInt(req.params.id, 10);
    if (!id_turno) {
      res.status(400).json({ message: "El ID del turno es obligatorio" });
      return;
    }

    const turno = await prisma.turno.findUnique({ where: { id_turno } });
    if (!turno) {
      res.status(404).json({ message: "El turno no existe" });
      return;
    }

    if (!['AUSENTE', 'CANCELADO'].includes(turno.estado)) {
      res.status(400).json({
        message: "Solo se pueden eliminar físicamente turnos AUSENTES o CANCELADOS",
      });
      return;
    }

    await prisma.$transaction([
      // Desvincular asistencias por las dudas (no debería haber en AUSENTE/CANCELADO)
      prisma.asistencia.updateMany({ where: { ID_Turno: id_turno }, data: { ID_Turno: null } }),
      prisma.turno.delete({ where: { id_turno } }),
    ]);

    res.status(200).json({ ok: true, message: "Turno eliminado definitivamente" });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el turno", error: error.message });
  }
};

export const turnoMethods = {
  createTurno,
  deleteTurno,
  deleteTurnoFisico,
  getTurnoById,
  getAllTurnos,
  updateTurno,
  getTurnosByUsuario
}
