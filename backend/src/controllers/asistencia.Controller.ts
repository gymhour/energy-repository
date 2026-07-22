import { Request, Response } from 'express';
import prisma from '../models/Prisma.js';
import { Prisma } from '@prisma/client';
import {
  countUnpaidAllowedAttendances,
  findActiveCuota,
  getGraceSessionLimit,
  getTotalSessionLimit,
  requiresTurno
} from '../services/accessRules.service.js';

/**
 * Obtiene la fecha y hora actual en zona horaria de Argentina (UTC-3).
 * Resta 3 horas al tiempo absoluto UTC para obtener la hora local "de pared".
 * De esta forma, Prisma la guardará en la columna DATETIME de MySQL tal como es localmente.
 */
const getArgentinaDate = (): Date => {
  return new Date(Date.now() - 3 * 60 * 60 * 1000);
};

const normalizeMetodo = (metodo: unknown): 'DNI' | 'QR' => (
  String(metodo || 'DNI').trim().toUpperCase() === 'QR' ? 'QR' : 'DNI'
);

const getArgentinaDayRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const buildAlumnoResponse = (user: {
  ID_Usuario: number;
  nombre: string | null;
  apellido: string | null;
  dni?: string | null;
}) => ({
  id: user.ID_Usuario,
  nombre: user.nombre,
  apellido: user.apellido,
  dni: user.dni
});

const buildAsistenciaResponse = (asistencia: {
  ID_Asistencia: number;
  fechaIngreso: Date;
  metodo: string;
}) => ({
  id: asistencia.ID_Asistencia,
  fechaIngreso: asistencia.fechaIngreso,
  metodo: asistencia.metodo
});

const getTurnoWindow = (date: Date) => {
  // Ventana de check-in: el alumno puede registrar desde 20 min antes hasta 20 min después
  // del horario de su turno. Como 'date' es el momento actual (nowArg), buscamos turnos cuya
  // 'fecha' esté en [now-20, now+20] (equivale a now ∈ [turno-20, turno+20]).
  const start = new Date(date);
  start.setMinutes(start.getMinutes() - 20);
  const end = new Date(date);
  end.setMinutes(end.getMinutes() + 20);
  return { start, end };
};

/**
 * REGISTRAR INGRESO POR DNI
 * POST /usuarios/asistencias/registrar
 */
export const registrarAsistencia = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dni } = req.body;
    const metodo = normalizeMetodo(req.body?.metodo);

    if (!dni || String(dni).trim() === '') {
      res.status(400).json({ message: 'El DNI es obligatorio' });
      return;
    }

    const dniLimpio = String(dni).replace(/\D/g, '').trim();
    if (!dniLimpio) {
      res.status(400).json({ message: 'El DNI es obligatorio' });
      return;
    }
    const nowArg = getArgentinaDate();

    // 1) Buscar el usuario por DNI
    const user = await prisma.user.findUnique({
      where: { dni: dniLimpio },
      select: {
        ID_Usuario: true,
        nombre: true,
        apellido: true,
        estado: true,
        email: true,
        tipo: true,
        dni: true
      }
    });

    // Caso: No existe el usuario.
    // No se persiste asistencia para DNIs no registrados (evita registros basura con ID_Usuario null).
    // Se responde el rechazo igual para que el frontend avise al alumno.
    if (!user) {
      res.status(404).json({
        permitido: false,
        resultado: 'DENEGADO_NO_EXISTE',
        motivo: 'El DNI ingresado no pertenece a ningún alumno registrado.'
      });
      return;
    }

    // Caso: Usuario inactivo o dado de baja
    if (user.estado !== true) {
      const asistencia = await prisma.asistencia.create({
        data: {
          metodo,
          permitido: false,
          resultado: 'DENEGADO_INACTIVO',
          motivo: 'El usuario está inactivo o dado de baja en el sistema.',
          ID_Usuario: user.ID_Usuario,
          fechaIngreso: nowArg
        }
      });

      res.status(403).json({
        permitido: false,
        resultado: 'DENEGADO_INACTIVO',
        motivo: 'El usuario está inactivo o dado de baja en el sistema.',
        alumno: buildAlumnoResponse(user),
        asistencia: buildAsistenciaResponse(asistencia)
      });
      return;
    }

    const cuotaMesActual = await findActiveCuota(user.ID_Usuario, nowArg);

    // 2. Buscar si tiene alguna otra cuota vencida e impaga
    const cuotaVencida = await prisma.cuota.findFirst({
      where: {
        ID_Usuario: user.ID_Usuario,
        pagada: false,
        OR: [
          { vencida: true },
          { vence: { lt: nowArg } }
        ]
      }
    });

    const graceLimit = cuotaMesActual ? getGraceSessionLimit(cuotaMesActual) : 0;
    const graceUsed = cuotaMesActual ? await countUnpaidAllowedAttendances(user.ID_Usuario, cuotaMesActual.ID_Cuota) : 0;
    const hasGraceAvailable = !!cuotaMesActual && !cuotaMesActual.pagada && graceUsed < graceLimit;

    // Evaluar estado de pago
    if (!cuotaMesActual || cuotaVencida || (!cuotaMesActual.pagada && !hasGraceAvailable)) {
      let motivoDenegacion = 'Acceso denegado por falta de pago.';
      if (cuotaVencida) {
        motivoDenegacion = `Acceso denegado. Registra cuotas vencidas impagas.`;
      } else if (!cuotaMesActual) {
        motivoDenegacion = `Acceso denegado. No se encontró una cuota activa para la fecha actual.`;
      } else if (!cuotaMesActual.pagada && graceLimit <= 0) {
        motivoDenegacion = `Acceso denegado. La cuota activa no está pagada.`;
      } else if (!cuotaMesActual.pagada) {
        motivoDenegacion = `Acceso denegado. Ya consumió las ${graceLimit} sesión(es) de gracia.`;
      }

      const asistencia = await prisma.asistencia.create({
        data: {
          metodo,
          permitido: false,
          resultado: 'DENEGADO_CUOTA',
          motivo: motivoDenegacion,
          ID_Usuario: user.ID_Usuario,
          ID_Cuota: cuotaMesActual?.ID_Cuota ?? null,
          fechaIngreso: nowArg
        }
      });

      res.status(403).json({
        permitido: false,
        resultado: 'DENEGADO_CUOTA',
        motivo: motivoDenegacion,
        alumno: buildAlumnoResponse(user),
        asistencia: buildAsistenciaResponse(asistencia)
      });
      return;
    }

    let turnoValido: any = null;
    if (requiresTurno(cuotaMesActual)) {
      const { start, end } = getTurnoWindow(nowArg);
      turnoValido = await prisma.turno.findFirst({
        where: {
          ID_Usuario: user.ID_Usuario,
          ID_Cuota: cuotaMesActual.ID_Cuota,
          estado: { in: ['ACTIVO'] },
          fecha: { gte: start, lte: end }
        },
        orderBy: { fecha: 'asc' },
      });

      if (!turnoValido) {
        const motivo = 'Acceso denegado. No tiene un turno activo para este horario.';
        const asistencia = await prisma.asistencia.create({
          data: {
            metodo,
            permitido: false,
            resultado: 'DENEGADO_SIN_TURNO',
            motivo,
            ID_Usuario: user.ID_Usuario,
            ID_Cuota: cuotaMesActual.ID_Cuota,
            fechaIngreso: nowArg
          }
        });

        res.status(403).json({
          permitido: false,
          resultado: 'DENEGADO_SIN_TURNO',
          motivo,
          alumno: buildAlumnoResponse(user),
          asistencia: buildAsistenciaResponse(asistencia)
        });
        return;
      }
    }

    const totalLimit = getTotalSessionLimit(cuotaMesActual);
    if (totalLimit > 0) {
      const periodAttendances = await prisma.asistencia.count({
        where: {
          ID_Usuario: user.ID_Usuario,
          ID_Cuota: cuotaMesActual.ID_Cuota,
          permitido: true,
        }
      });

      if (periodAttendances >= totalLimit) {
        const motivo = `Acceso denegado. Ya consumió las ${totalLimit} sesión(es) del período.`;
        const asistencia = await prisma.asistencia.create({
          data: {
            metodo,
            permitido: false,
            resultado: 'DENEGADO_LIMITE_SEMANAL',
            motivo,
            ID_Usuario: user.ID_Usuario,
            ID_Cuota: cuotaMesActual.ID_Cuota,
            ID_Turno: turnoValido?.id_turno ?? null,
            fechaIngreso: nowArg
          }
        });

        res.status(403).json({
          permitido: false,
          resultado: 'DENEGADO_LIMITE_SEMANAL',
          motivo,
          alumno: buildAlumnoResponse(user),
          asistencia: buildAsistenciaResponse(asistencia)
        });
        return;
      }
    }

    // TODO: descomentar para prod. Actualmente esta asi para pruebas de asistencia de asistencias ilimitadas en el dia
    const { start, end } = getArgentinaDayRange(nowArg);
    const asistenciaPermitidaHoy = await prisma.asistencia.findFirst({
      where: {
        ID_Usuario: user.ID_Usuario,
        permitido: true,
        fechaIngreso: {
          gte: start,
          lt: end
        }
      },
      orderBy: { fechaIngreso: 'desc' }
    });

    if (asistenciaPermitidaHoy) {
      const motivoDuplicado = 'El alumno ya registró una asistencia permitida durante el día de hoy.';
      const asistencia = await prisma.asistencia.create({
        data: {
          metodo,
          permitido: false,
          resultado: 'DENEGADO_DUPLICADO',
          motivo: motivoDuplicado,
          ID_Usuario: user.ID_Usuario,
          fechaIngreso: nowArg
        }
      });

      res.status(409).json({
        permitido: false,
        resultado: 'DENEGADO_DUPLICADO',
        motivo: motivoDuplicado,
        alumno: buildAlumnoResponse(user),
        asistencia: buildAsistenciaResponse(asistencia)
      });
      return;
    }

    // Caso de Éxito: Acceso Permitido
    const asistencia = await prisma.asistencia.create({
      data: {
        metodo,
        permitido: true,
        resultado: 'PERMITIDO',
        motivo: 'Acceso autorizado. Cuota al día.',
        ID_Usuario: user.ID_Usuario,
        ID_Cuota: cuotaMesActual.ID_Cuota,
        ID_Turno: turnoValido?.id_turno ?? null,
        fechaIngreso: nowArg
      }
    });

    if (turnoValido) {
      await prisma.turno.updateMany({
        where: { id_turno: turnoValido.id_turno, estado: 'ACTIVO' },
        data: { estado: 'ASISTIDO', asistidoEn: nowArg }
      });
    }

    res.status(200).json({
      permitido: true,
      resultado: 'PERMITIDO',
      motivo: cuotaMesActual.pagada ? 'Acceso autorizado. Cuota al día.' : 'Acceso autorizado usando sesión de gracia.',
      alumno: buildAlumnoResponse(user),
      asistencia: buildAsistenciaResponse(asistencia)
    });

  } catch (error: any) {
    console.error('[registrarAsistencia] Error:', error);
    res.status(500).json({ message: 'Error interno al registrar la asistencia', error: error.message });
  }
};

/**
 * OBTENER HISTORIAL DE ASISTENCIAS CON FILTROS (Solo Admin/Entrenador)
 * GET /usuarios/asistencias/historial
 */
export const obtenerHistorialAsistencias = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      dni,
      fechaInicio,
      fechaFin,
      permitido,
      metodo,
      student
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.max(1, parseInt(limit as string, 10) || 20);
    const skip = (pageNumber - 1) * take;

    const where: Prisma.AsistenciaWhereInput = {};

    // Filtro por alumno (DNI y/o nombre/apellido) a través de la relación con User
    const userFilter: Prisma.UserWhereInput = {};
    if (dni && typeof dni === 'string' && dni.trim()) {
      userFilter.dni = { contains: dni.trim() };
    }
    if (student && typeof student === 'string' && student.trim()) {
      const term = student.trim();
      userFilter.OR = [
        { nombre: { contains: term } },
        { apellido: { contains: term } },
      ];
    }
    if (Object.keys(userFilter).length > 0) {
      where.User = userFilter;
    }

    // Filtro por método de ingreso (DNI/QR)
    if (metodo && typeof metodo === 'string' && metodo.trim()) {
      where.metodo = metodo.trim().toUpperCase();
    }

    // Filtro por estado de acceso permitido (true/false)
    if (permitido !== undefined) {
      const isPermitted = String(permitido).toLowerCase();
      if (isPermitted === 'true' || isPermitted === '1') {
        where.permitido = true;
      } else if (isPermitted === 'false' || isPermitted === '0') {
        where.permitido = false;
      }
    }

    // Filtro por rango de fechas de ingreso
    if (fechaInicio || fechaFin) {
      const fechaObj: Prisma.DateTimeFilter = {};
      if (fechaInicio && typeof fechaInicio === 'string') {
        const start = new Date(fechaInicio);
        if (!isNaN(start.getTime())) {
          fechaObj.gte = start;
        }
      }
      if (fechaFin && typeof fechaFin === 'string') {
        const end = new Date(fechaFin);
        if (!isNaN(end.getTime())) {
          fechaObj.lte = end;
        }
      }
      where.fechaIngreso = fechaObj;
    }

    // Consulta con transacción para obtener total y datos paginados
    const [total, asistencias] = await prisma.$transaction([
      prisma.asistencia.count({ where }),
      prisma.asistencia.findMany({
        where,
        skip,
        take,
        orderBy: { fechaIngreso: 'desc' },
        include: {
          User: {
            select: {
              nombre: true,
              apellido: true,
              dni: true,
              email: true,
            },
          },
          Cuota: {
            select: {
              planNombreSnapshot: true,
            },
          },
        },
      })
    ]);

    const totalPages = Math.ceil(total / take);

    res.status(200).json({
      pagination: {
        total,
        pages: totalPages,
        page: pageNumber,
        limit: take
      },
      data: asistencias
    });

  } catch (error: any) {
    console.error('[obtenerHistorialAsistencias] Error:', error);
    res.status(500).json({ message: 'Error al obtener el historial de asistencias', error: error.message });
  }
};

/**
 * OBTENER MIS ASISTENCIAS (Alumno autenticado)
 * GET /usuarios/asistencias/mis-asistencias
 */
export const obtenerMisAsistencias = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.ID_Usuario;

    if (!userId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }

    const nowArg = getArgentinaDate();
    const currentYear = nowArg.getUTCFullYear();
    const currentMonth = String(nowArg.getUTCMonth() + 1).padStart(2, '0');
    const currentMonthString = `${currentYear}-${currentMonth}`;

    const [user, asistencias, totalPermitidasMes] = await prisma.$transaction([
      prisma.user.findUnique({
        where: { ID_Usuario: userId },
        select: {
          ID_Usuario: true,
          nombre: true,
          apellido: true,
          dni: true,
          plan: {
            select: {
              ID_Plan: true,
              nombre: true
            }
          },
          Cuotas: {
            where: { mes: currentMonthString },
            orderBy: { vence: 'desc' },
            take: 1,
            select: {
              vence: true,
              pagada: true,
              vencida: true
            }
          }
        }
      }),
      prisma.asistencia.findMany({
        where: { ID_Usuario: userId },
        orderBy: { fechaIngreso: 'desc' },
        take: 100,
        include: {
          User: {
            select: {
              nombre: true,
              apellido: true,
              dni: true,
              email: true
            }
          }
        }
      }),
      prisma.asistencia.count({
        where: {
          ID_Usuario: userId,
          permitido: true,
          fechaIngreso: {
            gte: new Date(Date.UTC(currentYear, nowArg.getUTCMonth(), 1, 0, 0, 0, 0)),
            lt: new Date(Date.UTC(currentYear, nowArg.getUTCMonth() + 1, 1, 0, 0, 0, 0))
          }
        }
      })
    ]);

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const cuotaActual = user.Cuotas[0] || null;

    res.status(200).json({
      summary: {
        plan: user.plan ? {
          id: user.plan.ID_Plan,
          name: user.plan.nombre
        } : null,
        usage: {
          used: totalPermitidasMes,
          available: null,
          period: 'monthly'
        },
        nextRenewalAt: cuotaActual?.vence || null,
        membershipEndsAt: cuotaActual?.vence || null,
        currentFee: cuotaActual ? {
          paid: cuotaActual.pagada,
          expired: cuotaActual.vencida
        } : null
      },
      data: asistencias
    });

  } catch (error: any) {
    console.error('[obtenerMisAsistencias] Error:', error);
    res.status(500).json({ message: 'Error al obtener tus asistencias', error: error.message });
  }
};

export const asistenciaMethods = {
  registrarAsistencia,
  obtenerHistorialAsistencias,
  obtenerMisAsistencias
};
