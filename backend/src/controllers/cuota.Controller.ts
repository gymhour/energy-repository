import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prismaC from '../models/Cuota.js'; // Ajusta la ruta según tu proyecto
import prisma from '../models/Prisma.js';
import prismaU from '../models/User.js';
import {
  buildCuotaPlanSnapshot,
  buildCuotaPeriod,
  calculatePeriodEnd,
  findActiveCuota,
  findBlockingCuotaForPeriod,
  generateFixedTurnosForCuota,
  getArgentinaDate,
  getHorarioCupoUsage,
  getTotalSessionLimit,
  inferPeriodStart,
  normalizePlanDuration,
} from '../services/accessRules.service.js';
import { runSerializableTransaction } from '../services/transaction.service.js';

type CuotaReturn = {
  ID_Cuota: number;
  mes: string;
  importe: number;
  vence: Date;
  plan?: string;
  pagada: boolean;
  vencida: boolean;
  formaPago: string | null;
  fechaPago: Date | null;
  ID_Usuario: number;
  User: {
    ID_Usuario: number;
    email: string;
    nombre: string | null;
    apellido: string | null;
    // … otros campos de usuario que quieras incluir
  };
};

type TurnoCandidato = {
  ID_Usuario: number;
  usuario: string;
  ID_HorarioClase: number;
  fecha: Date;
  cupos: number;
  nombreClase: string | null;
  diaSemana: string;
};

const CREATE_MANY_CHUNK_SIZE = 500;

const normalizeDayKey = (value: unknown): string => (
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00c3\u00a9/g, "e")
    .replace(/\u00c3\u00a1/g, "a")
);

const DAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const getWallClockTimeParts = (date: Date): { hours: number; minutes: number } => {
  const iso = date.toISOString();
  return {
    hours: Number(iso.slice(11, 13)),
    minutes: Number(iso.slice(14, 16)),
  };
};

const buildUsuarioNombre = (user: { ID_Usuario: number; nombre: string | null; apellido: string | null }) => (
  `${user.nombre || ""} ${user.apellido || ""}`.trim() || `ID ${user.ID_Usuario}`
);

const buildTurnoKey = (ID_Usuario: number, ID_HorarioClase: number, fecha: Date): string => (
  `${ID_Usuario}:${ID_HorarioClase}:${fecha.getTime()}`
);

const buildHorarioFechaKey = (ID_HorarioClase: number, fecha: Date): string => (
  `${ID_HorarioClase}:${fecha.getTime()}`
);

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const formatDateArg = (date: Date | null | undefined): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const buildBlockingCuotaMessage = (cuota: {
  ID_Cuota: number;
  mes: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}): string => {
  const desde = formatDateArg(cuota.fechaInicio);
  const hasta = formatDateArg(cuota.fechaFin);
  if (desde && hasta) {
    return `No se creó la cuota porque el alumno ya tiene una cuota vigente desde ${desde} hasta ${hasta}.`;
  }
  return `No se creó la cuota porque el alumno ya tiene una cuota registrada para el mes ${cuota.mes}.`;
};

const buildInvalidVenceMessage = (fechaInicio: Date): string => (
  `La fecha de vencimiento debe ser posterior a la fecha de inicio de la cuota (${formatDateArg(fechaInicio)}).`
);

const getUtcDayTime = (date: Date): number => (
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
);

const validateVenceAfterStart = (venceDate: Date, fechaInicio: Date): string | null => (
  getUtcDayTime(venceDate) > getUtcDayTime(fechaInicio) ? null : buildInvalidVenceMessage(fechaInicio)
);

const parseMesParam = (mes: unknown): { year: number; monthIndex: number } | null => {
  const match = String(mes || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;

  return { year, monthIndex: month - 1 };
};

const startOfLocalDay = (date: Date): Date => (
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
);

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;
const FREE_PLAN_PAYMENT_METHOD = "Plan gratuito";

const isFreePlan = (plan: { precio?: number | null } | null | undefined): boolean => (
  Number(plan?.precio) === 0
);

const buildCuotaPaymentData = (
  plan: { precio?: number | null } | null | undefined,
  requestedImporte: number,
  formaPago: string | null = null,
  paidAt: Date = getArgentinaDate(),
): Pick<Prisma.CuotaCreateManyInput, "importe" | "pagada" | "vencida" | "formaPago" | "fechaPago"> => {
  if (isFreePlan(plan)) {
    return {
      importe: 0,
      pagada: true,
      vencida: false,
      formaPago: FREE_PLAN_PAYMENT_METHOD,
      fechaPago: paidAt,
    };
  }

  return {
    importe: requestedImporte,
    pagada: false,
    vencida: false,
    formaPago: formaPago || null,
    fechaPago: null,
  };
};

const getManualMonthlyEquivalentPrice = (plan: { precio: number; duracion?: string | null } | null | undefined): number | null => {
  const precioPlan = Number(plan?.precio);
  if (!Number.isFinite(precioPlan)) return null;

  switch (normalizePlanDuration(plan?.duracion)) {
    case "TRIMESTRAL":
      return precioPlan / 3;
    case "SEMESTRAL":
      return precioPlan / 6;
    case "ANUAL":
      return precioPlan / 12;
    case "SEMANAL":
    case "MENSUAL":
    default:
      return precioPlan;
  }
};

const calculateManualCuotaPreview = (mes: string, plan: { precio: number; duracion?: string | null } | null | undefined) => {
  const parsedMes = parseMesParam(mes);
  if (!parsedMes) return null;

  const { year, monthIndex } = parsedMes;
  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const diasDelMes = monthEnd.getDate();
  const today = startOfLocalDay(getArgentinaDate());
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
  const fechaInicioSugerida = isCurrentMonth ? today : monthStart;
  const msPerDay = 24 * 60 * 60 * 1000;
  const diasCubiertos = Math.max(
    0,
    Math.floor((startOfLocalDay(monthEnd).getTime() - startOfLocalDay(fechaInicioSugerida).getTime()) / msPerDay) + 1
  );
  const precioMensualEquivalente = getManualMonthlyEquivalentPrice(plan);

  return {
    fechaInicioSugerida,
    fechaFinSugerida: monthEnd,
    diasCubiertos,
    diasDelMes,
    importeSugerido: precioMensualEquivalente !== null
      ? roundMoney((precioMensualEquivalente * diasCubiertos) / diasDelMes)
      : null,
  };
};

const buildManualCuotaMonthPeriod = (
  mes: string,
  explicitStart?: Date | null,
): { fechaInicio: Date; fechaFin: Date } | null => {
  const parsedMes = parseMesParam(mes);
  if (!parsedMes) return null;

  const { year, monthIndex } = parsedMes;
  return {
    fechaInicio: explicitStart || new Date(year, monthIndex, 1, 0, 0, 0, 0),
    fechaFin: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
  };
};

// Select compartido por toda la generación masiva: solo alumnos (tipo cliente) activos con plan.
const USUARIO_PLAN_SELECT = {
  ID_Usuario: true,
  nombre: true,
  apellido: true,
  ID_Plan: true,
  usaTurnosFijos: true,
  plan: true,
} satisfies Prisma.UserSelect;

type UsuarioConPlan = Prisma.UserGetPayload<{ select: typeof USUARIO_PLAN_SELECT }>;

type UsuariosPendientesResult = {
  pendientes: UsuarioConPlan[];
  usuariosOmitidosPorCuotaExistente: number;
  usuariosOmitidosPorPlanSemanal: number;
};

const filtrarUsuariosPendientesPorPeriodo = async (
  usuarios: UsuarioConPlan[],
  mes: string,
): Promise<UsuariosPendientesResult> => {
  const pendientes: UsuarioConPlan[] = [];
  let usuariosOmitidosPorCuotaExistente = 0;
  let usuariosOmitidosPorPlanSemanal = 0;

  for (const usuario of usuarios) {
    const duration = normalizePlanDuration(usuario.plan?.duracion);
    if (duration === "SEMANAL") {
      usuariosOmitidosPorPlanSemanal += 1;
      continue;
    }

    const { fechaInicio, fechaFin } = buildCuotaPeriod(mes, duration);
    const blockingCuota = await findBlockingCuotaForPeriod(usuario.ID_Usuario, mes, fechaInicio, fechaFin);
    if (blockingCuota) {
      usuariosOmitidosPorCuotaExistente += 1;
      continue;
    }

    pendientes.push(usuario);
  }

  return { pendientes, usuariosOmitidosPorCuotaExistente, usuariosOmitidosPorPlanSemanal };
};

type ConflictoCupo = {
  ID_HorarioClase: number;
  fecha: string;
  clase: string | null;
  diaSemana: string;
  cupos: number;
  turnosExistentes: number;
  reservasFijasPendientes: number;
  turnosSolicitados: number;
  exceso: number;
  usuariosAfectados: Array<{ ID_Usuario: number; nombre: string }>;
};

type PlanMasivoResult = {
  cuotasData: Prisma.CuotaCreateManyInput[];
  turnosACrear: TurnoCandidato[];
  conflictosCupo: ConflictoCupo[];
  turnosOmitidosPorExistentes: number;
};

class CupoConflictError extends Error {
  conflictosCupo: ConflictoCupo[];

  constructor(conflictosCupo: ConflictoCupo[]) {
    super(`Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`);
    this.name = "CupoConflictError";
    this.conflictosCupo = conflictosCupo;
  }
}

const isCupoConflictError = (error: unknown): error is CupoConflictError => (
  error instanceof CupoConflictError
);

const USUARIO_TURNOS_FIJOS_SELECT = {
  ID_Usuario: true,
  nombre: true,
  apellido: true,
  usaTurnosFijos: true,
  TurnosFijos: {
    where: { activo: true },
    orderBy: { ID_HorarioClase: "asc" as const },
    include: {
      HorarioClase: {
        include: { Clase: { select: { nombre: true } } },
      },
    },
  },
} satisfies Prisma.UserSelect;

type UsuarioConTurnosFijos = Prisma.UserGetPayload<{ select: typeof USUARIO_TURNOS_FIJOS_SELECT }>;

type CuotaTurnosBase = {
  ID_Cuota?: number;
  ID_Usuario: number;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  planSesionesTotalesSnapshot?: number | null;
  planSesionesSemanaSnapshot?: number | null;
  Plan?: {
    sesionesTotales?: number | null;
    sesionesPorSemana?: number | null;
  } | null;
};

const construirCandidatosTurnosFijosUsuario = (
  user: UsuarioConTurnosFijos,
  cuota: CuotaTurnosBase,
): TurnoCandidato[] => {
  if (!user.usaTurnosFijos || user.TurnosFijos.length === 0 || !cuota.fechaInicio || !cuota.fechaFin) {
    return [];
  }

  const totalLimit = getTotalSessionLimit(cuota);
  const candidatos: TurnoCandidato[] = [];
  const cursor = new Date(cuota.fechaInicio);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(cuota.fechaFin);
  end.setHours(23, 59, 59, 999);
  const nowArg = getArgentinaDate();

  while (cursor <= end) {
    if (totalLimit > 0 && candidatos.length >= totalLimit) break;

    for (const fixed of user.TurnosFijos) {
      if (totalLimit > 0 && candidatos.length >= totalLimit) break;
      const horario = fixed.HorarioClase;
      if (!horario) continue;

      const expectedDay = DAY_INDEX[normalizeDayKey(horario.diaSemana)];
      if (expectedDay === undefined || cursor.getDay() !== expectedDay) continue;

      const horaIni = getWallClockTimeParts(new Date(horario.horaIni));
      const fechaTurno = new Date(Date.UTC(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        horaIni.hours,
        horaIni.minutes,
        0,
        0
      ));

      if (fechaTurno <= nowArg) continue;

      candidatos.push({
        ID_Usuario: user.ID_Usuario,
        usuario: buildUsuarioNombre(user),
        ID_HorarioClase: horario.ID_HorarioClase,
        fecha: fechaTurno,
        cupos: horario.cupos,
        nombreClase: horario.Clase?.nombre ?? null,
        diaSemana: horario.diaSemana,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return candidatos;
};

const validarCupoTurnosCandidatos = async (
  candidatos: TurnoCandidato[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{
  turnosACrear: TurnoCandidato[];
  conflictosCupo: ConflictoCupo[];
  turnosOmitidosPorExistentes: number;
}> => {
  const horarioIds = Array.from(new Set(candidatos.map(c => c.ID_HorarioClase)));
  const minFecha = candidatos.length
    ? new Date(Math.min(...candidatos.map(c => c.fecha.getTime())))
    : null;
  const maxFecha = candidatos.length
    ? new Date(Math.max(...candidatos.map(c => c.fecha.getTime())))
    : null;

  const turnosExistentes = horarioIds.length && minFecha && maxFecha
    ? await client.turno.findMany({
      where: {
        ID_HorarioClase: { in: horarioIds },
        fecha: { gte: minFecha, lte: maxFecha },
      },
      select: {
        ID_Usuario: true,
        ID_HorarioClase: true,
        fecha: true,
        estado: true,
      },
    })
    : [];
  const horariosActuales = horarioIds.length
    ? await client.horarioClase.findMany({
      where: { ID_HorarioClase: { in: horarioIds } },
      select: { ID_HorarioClase: true, cupos: true },
    })
    : [];
  const cuposActualesByHorario = new Map(
    horariosActuales.map((horario: { ID_HorarioClase: number; cupos: number }) => [
      horario.ID_HorarioClase,
      Number(horario.cupos || 0),
    ])
  );

  const existingTurnoKeys = new Set<string>();

  for (const turno of turnosExistentes) {
    const fechaTurno = new Date(turno.fecha);

    if (turno.estado !== "CANCELADO") {
      existingTurnoKeys.add(buildTurnoKey(turno.ID_Usuario, turno.ID_HorarioClase, fechaTurno));
    }
  }

  const turnosACrear = candidatos.filter(c => (
    !existingTurnoKeys.has(buildTurnoKey(c.ID_Usuario, c.ID_HorarioClase, c.fecha))
  ));
  const turnosOmitidosPorExistentes = candidatos.length - turnosACrear.length;

  const candidatosPorHorarioFecha = new Map<string, {
    ID_HorarioClase: number;
    fecha: Date;
    cupos: number;
    nombreClase: string | null;
    diaSemana: string;
    candidatos: TurnoCandidato[];
  }>();

  for (const candidato of turnosACrear) {
    const key = buildHorarioFechaKey(candidato.ID_HorarioClase, candidato.fecha);
    const group = candidatosPorHorarioFecha.get(key);

    if (group) {
      group.candidatos.push(candidato);
    } else {
      const cuposActuales = cuposActualesByHorario.get(candidato.ID_HorarioClase) ?? candidato.cupos;
      candidatosPorHorarioFecha.set(key, {
        ID_HorarioClase: candidato.ID_HorarioClase,
        fecha: candidato.fecha,
        cupos: cuposActuales,
        nombreClase: candidato.nombreClase,
        diaSemana: candidato.diaSemana,
        candidatos: [candidato],
      });
    }
  }

  const conflictosCupo = (await Promise.all(Array.from(candidatosPorHorarioFecha.values())
    .map(async group => {
      const usage = await getHorarioCupoUsage(group.ID_HorarioClase, group.fecha, {
        releaseFixedReservationForUserIds: group.candidatos.map(c => c.ID_Usuario),
        client,
      });
      const turnosExistentesActivos = usage.turnosActivos;
      const reservasFijasPendientes = usage.reservasFijasPendientes;
      const turnosSolicitados = group.candidatos.length;
      const total = turnosExistentesActivos + reservasFijasPendientes + turnosSolicitados;

      return {
        ID_HorarioClase: group.ID_HorarioClase,
        fecha: group.fecha.toISOString(),
        clase: group.nombreClase,
        diaSemana: group.diaSemana,
        cupos: group.cupos,
        turnosExistentes: turnosExistentesActivos,
        reservasFijasPendientes,
        turnosSolicitados,
        exceso: total - group.cupos,
        usuariosAfectados: group.candidatos.map(c => ({
          ID_Usuario: c.ID_Usuario,
          nombre: c.usuario,
        })),
      };
    }))).filter(conflict => conflict.exceso > 0);

  return { turnosACrear, conflictosCupo, turnosOmitidosPorExistentes };
};

const crearTurnosFijosParaCuota = async (
  tx: Prisma.TransactionClient,
  cuotaId: number,
  candidatos: TurnoCandidato[],
): Promise<number> => {
  const finalValidation = await validarCupoTurnosCandidatos(candidatos, tx);
  if (finalValidation.conflictosCupo.length > 0) {
    throw new CupoConflictError(finalValidation.conflictosCupo);
  }

  const fechaCreacion = getArgentinaDate();
  const turnosData: Prisma.TurnoCreateManyInput[] = finalValidation.turnosACrear.map(candidato => ({
    fecha: candidato.fecha,
    estado: "ACTIVO",
    origen: "FIJO",
    fechaCreacion,
    ID_HorarioClase: candidato.ID_HorarioClase,
    ID_Usuario: candidato.ID_Usuario,
    ID_Cuota: cuotaId,
  }));

  let turnosGenerados = 0;
  for (const chunk of chunkArray(turnosData, CREATE_MANY_CHUNK_SIZE)) {
    const result = await tx.turno.createMany({ data: chunk, skipDuplicates: true });
    turnosGenerados += result.count;
  }

  return turnosGenerados;
};

/**
 * Construye las cuotas + los candidatos de turnos fijos de un conjunto de alumnos y valida los cupos
 * de cada horario/fecha. NO crea nada: lo usan tanto la validación previa (preparar) como cada lote.
 * Saltea turnos en fechas/horarios ya pasados y respeta el tope de sesiones totales del plan.
 */
const construirPlanMasivo = async (
  usuarios: UsuarioConPlan[],
  mes: string,
  venceDate: Date,
  formaPago: string | null,
): Promise<PlanMasivoResult> => {
  const usuariosConTurnos = usuarios.filter(u => u.usaTurnosFijos);
  const turnosFijos = usuariosConTurnos.length > 0
    ? await prisma.turnoFijo.findMany({
        where: {
          ID_Usuario: { in: usuariosConTurnos.map(u => u.ID_Usuario) },
          activo: true,
        },
        include: {
          HorarioClase: {
            include: { Clase: { select: { nombre: true } } },
          },
        },
      })
    : [];

  const turnosFijosByUser = new Map<number, typeof turnosFijos>();
  for (const tf of turnosFijos) {
    const arr = turnosFijosByUser.get(tf.ID_Usuario);
    if (arr) arr.push(tf);
    else turnosFijosByUser.set(tf.ID_Usuario, [tf]);
  }

  const periodStart = inferPeriodStart(mes);
  const cuotasData: Prisma.CuotaCreateManyInput[] = [];
  const candidatos: TurnoCandidato[] = [];
  // No generar turnos en fechas/horarios ya pasados (mismo marco wall-clock que fechaTurno).
  const nowArg = getArgentinaDate();

  for (const u of usuarios) {
    if (!u.plan) continue;

    const duration = normalizePlanDuration(u.plan.duracion);
    const periodEnd = calculatePeriodEnd(periodStart, duration);

    cuotasData.push({
      ID_Usuario: u.ID_Usuario,
      ID_Plan: u.ID_Plan,
      mes,
      vence: venceDate,
      fechaInicio: periodStart,
      fechaFin: periodEnd,
      ...buildCuotaPaymentData(u.plan, Number(u.plan.precio), formaPago, nowArg),
      ...buildCuotaPlanSnapshot(u.plan)
    });

    const userTurnos = turnosFijosByUser.get(u.ID_Usuario) ?? [];
    if (userTurnos.length === 0) continue;

    // Tope: no generar más turnos que las sesiones totales del plan.
    const totalLimit = Number(u.plan.sesionesTotales || 0);
    let userCreated = 0;
    const cursor = new Date(periodStart);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(periodEnd);
    end.setHours(23, 59, 59, 999);

    while (cursor <= end) {
      if (totalLimit > 0 && userCreated >= totalLimit) break;
      for (const fixed of userTurnos) {
        if (totalLimit > 0 && userCreated >= totalLimit) break;
        const horario = fixed.HorarioClase;
        if (!horario) continue;
        const expectedDay = DAY_INDEX[normalizeDayKey(horario.diaSemana)];

        if (expectedDay === undefined || cursor.getDay() !== expectedDay) {
          continue;
        }

        const horaIni = getWallClockTimeParts(new Date(horario.horaIni));
        const fechaTurno = new Date(Date.UTC(
          cursor.getFullYear(),
          cursor.getMonth(),
          cursor.getDate(),
          horaIni.hours,
          horaIni.minutes,
          0,
          0
        ));

        // Turno en fecha/horario ya pasado: no se genera (tampoco consume el tope de sesiones).
        if (fechaTurno <= nowArg) continue;

        candidatos.push({
          ID_Usuario: u.ID_Usuario,
          usuario: buildUsuarioNombre(u),
          ID_HorarioClase: horario.ID_HorarioClase,
          fecha: fechaTurno,
          cupos: horario.cupos,
          nombreClase: horario.Clase?.nombre ?? null,
          diaSemana: horario.diaSemana,
        });
        userCreated += 1;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const { turnosACrear, conflictosCupo, turnosOmitidosPorExistentes } =
    await validarCupoTurnosCandidatos(candidatos);

  return { cuotasData, turnosACrear, conflictosCupo, turnosOmitidosPorExistentes };
};

/**
 * Persiste las cuotas y sus turnos dentro de una transacción (tx). Reutilizado por la generación
 * de una sola request y por cada lote. Revalida solapamientos dentro de la transacción.
 */
const persistirCuotasYTurnos = async (
  tx: Prisma.TransactionClient,
  mes: string,
  cuotasData: Prisma.CuotaCreateManyInput[],
  turnosACrear: TurnoCandidato[],
): Promise<{ cuotasCreadas: number; turnosGenerados: number; cuotasOmitidasPorCuotaExistente: number }> => {
  const cuotasSeguras: Prisma.CuotaCreateManyInput[] = [];

  for (const cuota of cuotasData) {
    const ID_Usuario = Number(cuota.ID_Usuario);
    const fechaInicio = cuota.fechaInicio ? new Date(cuota.fechaInicio as Date) : inferPeriodStart(mes);
    const fechaFin = cuota.fechaFin ? new Date(cuota.fechaFin as Date) : calculatePeriodEnd(fechaInicio, cuota.planDuracionSnapshot || "MENSUAL");
    const blockingCuota = await findBlockingCuotaForPeriod(ID_Usuario, mes, fechaInicio, fechaFin, tx);
    if (!blockingCuota) {
      cuotasSeguras.push(cuota);
    }
  }

  if (cuotasSeguras.length === 0) {
    return {
      cuotasCreadas: 0,
      turnosGenerados: 0,
      cuotasOmitidasPorCuotaExistente: cuotasData.length,
    };
  }

  const cuotasCreadas = await tx.cuota.createMany({ data: cuotasSeguras });
  const idsCreados = cuotasSeguras.map(c => Number(c.ID_Usuario));
  const idsCreadosSet = new Set(idsCreados);

  const cuotas = await tx.cuota.findMany({
    where: { mes, ID_Usuario: { in: idsCreados } },
    select: { ID_Cuota: true, ID_Usuario: true }
  });

  const cuotaByUsuario = new Map(cuotas.map(c => [c.ID_Usuario, c.ID_Cuota]));

  if (cuotaByUsuario.size < idsCreados.length) {
    throw new Error("No se pudieron recuperar todas las cuotas creadas para generar turnos");
  }

  const candidatosFinales = turnosACrear.filter(candidato => idsCreadosSet.has(candidato.ID_Usuario));
  const finalValidation = await validarCupoTurnosCandidatos(candidatosFinales, tx);
  if (finalValidation.conflictosCupo.length > 0) {
    throw new CupoConflictError(finalValidation.conflictosCupo);
  }

  const fechaCreacion = getArgentinaDate();
  const turnosData: Prisma.TurnoCreateManyInput[] = finalValidation.turnosACrear.map(candidato => {
    const ID_Cuota = cuotaByUsuario.get(candidato.ID_Usuario);
    if (!ID_Cuota) {
      throw new Error(`No se encontro cuota creada para el usuario ${candidato.ID_Usuario}`);
    }

    return {
      fecha: candidato.fecha,
      estado: "ACTIVO",
      origen: "FIJO",
      fechaCreacion,
      ID_HorarioClase: candidato.ID_HorarioClase,
      ID_Usuario: candidato.ID_Usuario,
      ID_Cuota,
    };
  });

  let turnosGenerados = 0;
  for (const chunk of chunkArray(turnosData, CREATE_MANY_CHUNK_SIZE)) {
    const result = await tx.turno.createMany({ data: chunk, skipDuplicates: true });
    turnosGenerados += result.count;
  }

  return {
    cuotasCreadas: cuotasCreadas.count,
    turnosGenerados,
    cuotasOmitidasPorCuotaExistente: cuotasData.length - cuotasSeguras.length,
  };
};

// 1. Crear cuota
const createCuota = async (req: Request, res: Response): Promise<void> => {
  try {
    const idUsuarioParam = req.params.idUsuario;
    const { ID_Usuario, mes, importe, vence, fechaInicio, fechaFin } = req.body;
    const usuarioId = idUsuarioParam ? Number(idUsuarioParam) : Number(ID_Usuario);
    const importeText = String(importe ?? '').trim();
    const importeNumber = Number(importeText);

    if (!usuarioId || !mes || !importeText || !vence) {
      res.status(400).json({ message: 'Faltan datos obligatorios' });
      return;
    }
    if (!Number.isFinite(importeNumber)) {
      res.status(400).json({ message: "'importe' no es válido" });
      return;
    }
    const venceDate = new Date(vence);
    if (isNaN(venceDate.getTime())) {
      res.status(400).json({ message: "'vence' no es una fecha válida" });
      return;
    }

    const usuario = await prismaU.findUnique({
      where: { ID_Usuario: usuarioId },
      select: {
        ID_Usuario: true,
        ID_Plan: true,
        plan: true
      }
    });
    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const explicitStart = fechaInicio ? new Date(fechaInicio) : null;
    const explicitEnd = fechaFin ? new Date(fechaFin) : null;
    if ((explicitStart && isNaN(explicitStart.getTime())) || (explicitEnd && isNaN(explicitEnd.getTime()))) {
      res.status(400).json({ message: "'fechaInicio' o 'fechaFin' no son fechas válidas" });
      return;
    }

    const manualPeriod = buildManualCuotaMonthPeriod(mes, explicitStart);
    if (!manualPeriod) {
      res.status(400).json({ message: "Mes inválido. Usá el formato YYYY-MM" });
      return;
    }
    const { fechaInicio: periodStart, fechaFin: periodEnd } = manualPeriod;
    const venceError = validateVenceAfterStart(venceDate, periodStart);
    if (venceError) {
      res.status(400).json({ message: venceError });
      return;
    }

    const blockingCuota = await findBlockingCuotaForPeriod(usuarioId, mes, periodStart, periodEnd);
    if (blockingCuota) {
      res.status(409).json({
        message: buildBlockingCuotaMessage(blockingCuota),
        cuotaExistente: blockingCuota,
      });
      return;
    }

    const snapshot = buildCuotaPlanSnapshot(usuario.plan);
    const paymentData = buildCuotaPaymentData(usuario.plan, importeNumber);

    const nuevaCuota = await prismaC.create({
      data: {
        ID_Usuario: usuarioId,
        ID_Plan: usuario.ID_Plan,
        mes,
        vence: venceDate,
        fechaInicio: periodStart,
        fechaFin: periodEnd,
        ...paymentData,
        ...snapshot
      },
      include: {
        User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } },
        Plan: true
      }
    });

    const { created: turnosGenerados, errores: turnosNoGenerados } = await generateFixedTurnosForCuota(nuevaCuota);

    res.status(201).json({
      message: 'Cuota creada exitosamente',
      cuota: nuevaCuota,
      turnosGenerados,
      ...(turnosNoGenerados.length > 0 && {
        advertencias: {
          mensaje: `${turnosNoGenerados.length} turno(s) no se pudieron generar por falta de cupo en el horario. Revisá los turnos fijos del alumno.`,
          detalles: turnosNoGenerados
        }
      })
    });
  } catch (error: any) {
    console.error('Error al crear cuota:', error);
    res.status(500).json({ message: 'Error al crear cuota', error: error.message });
  }
};

const getCuotaManualPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = Number(req.params.idUsuario);
    const mes = String(req.query.mes || "");

    if (!usuarioId || !parseMesParam(mes)) {
      res.status(400).json({ message: "ID de usuario o mes inválido" });
      return;
    }

    const usuario = await prisma.user.findUnique({
      where: { ID_Usuario: usuarioId },
      select: {
        ID_Usuario: true,
        ID_Plan: true,
        plan: {
          select: {
            ID_Plan: true,
            nombre: true,
            precio: true,
            duracion: true,
          },
        },
      },
    });

    if (!usuario) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const preview = calculateManualCuotaPreview(mes, usuario.plan);
    if (!preview) {
      res.status(400).json({ message: "Mes inválido. Usá el formato YYYY-MM" });
      return;
    }

    res.status(200).json({
      plan: usuario.plan
        ? {
          id: usuario.plan.ID_Plan,
          nombre: usuario.plan.nombre,
          precio: usuario.plan.precio,
          duracion: usuario.plan.duracion,
        }
        : null,
      importeSugerido: usuario.plan ? preview.importeSugerido : null,
      fechaInicioSugerida: preview.fechaInicioSugerida.toISOString(),
      fechaFinSugerida: preview.fechaFinSugerida.toISOString(),
      diasCubiertos: preview.diasCubiertos,
      diasDelMes: preview.diasDelMes,
    });
  } catch (error: any) {
    console.error("Error obteniendo preview de cuota manual:", error);
    res.status(500).json({ message: "Error obteniendo preview de cuota manual", error: error.message });
  }
};

const prepararCuotaUsuarioLotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = Number(req.params.idUsuario || req.body.ID_Usuario);
    const { mes, importe, vence, fechaInicio, fechaFin } = req.body;
    const importeText = String(importe ?? '').trim();

    if (!usuarioId || !mes || !importeText || !vence) {
      res.status(400).json({ message: 'Faltan datos obligatorios' });
      return;
    }

    const importeNumber = Number(importeText);
    if (!Number.isFinite(importeNumber)) {
      res.status(400).json({ message: "'importe' no es válido" });
      return;
    }

    const venceDate = new Date(vence);
    if (isNaN(venceDate.getTime())) {
      res.status(400).json({ message: "'vence' no es una fecha válida" });
      return;
    }

    const usuario = await prisma.user.findUnique({
      where: { ID_Usuario: usuarioId },
      select: {
        ID_Usuario: true,
        ID_Plan: true,
        plan: true,
      },
    });

    if (!usuario) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const explicitStart = fechaInicio ? new Date(fechaInicio) : null;
    const explicitEnd = fechaFin ? new Date(fechaFin) : null;
    if ((explicitStart && isNaN(explicitStart.getTime())) || (explicitEnd && isNaN(explicitEnd.getTime()))) {
      res.status(400).json({ message: "'fechaInicio' o 'fechaFin' no son fechas válidas" });
      return;
    }

    const manualPeriod = buildManualCuotaMonthPeriod(mes, explicitStart);
    if (!manualPeriod) {
      res.status(400).json({ message: "Mes inválido. Usá el formato YYYY-MM" });
      return;
    }
    const { fechaInicio: periodStart, fechaFin: periodEnd } = manualPeriod;
    const venceError = validateVenceAfterStart(venceDate, periodStart);
    if (venceError) {
      res.status(400).json({ message: venceError });
      return;
    }

    const snapshot = buildCuotaPlanSnapshot(usuario.plan);
    const userWithTurnos = await prisma.user.findUnique({
      where: { ID_Usuario: usuarioId },
      select: USUARIO_TURNOS_FIJOS_SELECT,
    });

    if (!userWithTurnos) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const cuotaBase: CuotaTurnosBase = {
      ID_Usuario: usuarioId,
      fechaInicio: periodStart,
      fechaFin: periodEnd,
      Plan: usuario.plan,
      ...snapshot,
    };
    const candidatos = construirCandidatosTurnosFijosUsuario(userWithTurnos, cuotaBase);
    const { conflictosCupo } = await validarCupoTurnosCandidatos(candidatos);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `No se puede crear la cuota. Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`,
        valido: false,
        conflictosCupo,
      });
      return;
    }

    const blockingCuota = await findBlockingCuotaForPeriod(usuarioId, mes, periodStart, periodEnd);
    const paymentData = buildCuotaPaymentData(usuario.plan, importeNumber);
    const cuota = blockingCuota
      ? await prisma.cuota.findUnique({
        where: { ID_Cuota: blockingCuota.ID_Cuota },
        include: {
          User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } },
          Plan: true,
        },
      })
      : await prisma.cuota.create({
        data: {
          ID_Usuario: usuarioId,
          ID_Plan: usuario.ID_Plan,
          mes,
          vence: venceDate,
          fechaInicio: periodStart,
          fechaFin: periodEnd,
          ...paymentData,
          ...snapshot,
        },
        include: {
          User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } },
          Plan: true,
        },
      });

    if (!cuota) {
      res.status(500).json({ message: 'No se pudo preparar la cuota' });
      return;
    }

    const candidatosCuota = construirCandidatosTurnosFijosUsuario(userWithTurnos, {
      ID_Cuota: cuota.ID_Cuota,
      ID_Usuario: cuota.ID_Usuario,
      fechaInicio: cuota.fechaInicio,
      fechaFin: cuota.fechaFin,
      planSesionesTotalesSnapshot: cuota.planSesionesTotalesSnapshot,
      planSesionesSemanaSnapshot: cuota.planSesionesSemanaSnapshot,
      Plan: cuota.Plan,
    });

    res.status(blockingCuota ? 200 : 201).json({
      message: blockingCuota
        ? 'La cuota ya existía. Se continuará con la generación de turnos fijos faltantes.'
        : 'Cuota creada. Se continuará con la generación de turnos fijos.',
      cuota,
      cuotaId: cuota.ID_Cuota,
      cuotaCreada: !blockingCuota,
      totalTurnosEstimados: candidatosCuota.length,
      loteSize: 50,
    });
  } catch (error: any) {
    console.error('Error preparando cuota por lotes:', error);
    res.status(500).json({ message: 'Error al preparar la cuota por lotes', error: error.message });
  }
};

const generarTurnosCuotaUsuarioLote = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = Number(req.params.idUsuario);
    const cuotaId = Number(req.body.cuotaId);
    const offset = Math.max(0, Number(req.body.offset) || 0);
    const limit = Math.min(200, Math.max(1, Number(req.body.limit) || 50));

    if (!usuarioId || !cuotaId) {
      res.status(400).json({ message: 'ID de usuario o cuota inválido' });
      return;
    }

    const cuota = await prisma.cuota.findFirst({
      where: { ID_Cuota: cuotaId, ID_Usuario: usuarioId },
      include: { Plan: true },
    });

    if (!cuota) {
      res.status(404).json({ message: 'Cuota no encontrada para el usuario' });
      return;
    }

    if (!cuota.fechaInicio || !cuota.fechaFin) {
      res.status(400).json({ message: 'La cuota no tiene período definido para generar turnos fijos' });
      return;
    }

    const userWithTurnos = await prisma.user.findUnique({
      where: { ID_Usuario: usuarioId },
      select: USUARIO_TURNOS_FIJOS_SELECT,
    });

    if (!userWithTurnos) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const candidatos = construirCandidatosTurnosFijosUsuario(userWithTurnos, {
      ID_Cuota: cuota.ID_Cuota,
      ID_Usuario: cuota.ID_Usuario,
      fechaInicio: cuota.fechaInicio,
      fechaFin: cuota.fechaFin,
      planSesionesTotalesSnapshot: cuota.planSesionesTotalesSnapshot,
      planSesionesSemanaSnapshot: cuota.planSesionesSemanaSnapshot,
      Plan: cuota.Plan,
    });
    const candidatosLote = candidatos.slice(offset, offset + limit);

    if (candidatosLote.length === 0) {
      res.status(200).json({
        procesados: 0,
        turnosGenerados: 0,
        turnosOmitidosPorExistentes: 0,
      });
      return;
    }

    const { turnosACrear, conflictosCupo, turnosOmitidosPorExistentes } =
      await validarCupoTurnosCandidatos(candidatosLote);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`,
        valido: false,
        conflictosCupo,
      });
      return;
    }

    const turnosGenerados = await runSerializableTransaction(
      (tx) => crearTurnosFijosParaCuota(tx, cuota.ID_Cuota, turnosACrear),
      { maxWait: 10000, timeout: 30000 },
    );

    res.status(200).json({
      procesados: candidatosLote.length,
      turnosGenerados,
      turnosOmitidosPorExistentes,
    });
  } catch (error: any) {
    if (isCupoConflictError(error)) {
      res.status(409).json({
        message: error.message,
        valido: false,
        conflictosCupo: error.conflictosCupo,
      });
      return;
    }
    console.error('Error generando lote de turnos fijos de cuota:', error);
    res.status(500).json({ message: 'Error al generar el lote de turnos fijos', error: error.message });
  }
};

export const generateMonthlyCuotas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mes, vence, formaPago } = req.body;
    if (!mes || !vence) {
      res.status(400).json({ message: 'Faltan parametros obligatorios: mes, vence' });
      return;
    }

    const venceDate = new Date(vence);
    if (isNaN(venceDate.getTime())) {
      res.status(400).json({ message: "'vence' no es una fecha valida" });
      return;
    }
    const periodStart = inferPeriodStart(mes);
    const venceError = validateVenceAfterStart(venceDate, periodStart);
    if (venceError) {
      res.status(400).json({ message: venceError });
      return;
    }

    const usuarios = await prisma.user.findMany({
      where: { estado: true, tipo: 'cliente', plan: { isNot: null } },
      select: USUARIO_PLAN_SELECT,
    });

    if (usuarios.length === 0) {
      res.status(404).json({ message: 'No hay alumnos activos con plan asignado' });
      return;
    }

    const {
      pendientes,
      usuariosOmitidosPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
    } = await filtrarUsuariosPendientesPorPeriodo(usuarios, mes);

    if (pendientes.length === 0) {
      res.status(200).json({
        message: `No hay cuotas nuevas para generar en ${mes}. Los alumnos ya tienen una cuota vigente o usan plan semanal.`,
        totalUsuarios: usuarios.length,
        inserted: 0,
        turnosGenerados: 0,
        usuariosOmitidosPorCuotaExistente,
        usuariosOmitidosPorPlanSemanal,
      });
      return;
    }

    const { cuotasData, turnosACrear, conflictosCupo, turnosOmitidosPorExistentes } =
      await construirPlanMasivo(pendientes, mes, venceDate, formaPago || null);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `No se generaron cuotas. Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`,
        valido: false,
        totalUsuarios: pendientes.length,
        conflictosCupo,
      });
      return;
    }

    const transactionResult = await runSerializableTransaction(
      (tx) => persistirCuotasYTurnos(tx, mes, cuotasData, turnosACrear),
      { maxWait: 10000, timeout: 120000 },
    );

    res.status(201).json({
      message: `Se generaron ${transactionResult.cuotasCreadas} cuotas para el mes ${mes} con todos los turnos fijos correctamente.`,
      totalUsuarios: usuarios.length,
      inserted: transactionResult.cuotasCreadas,
      turnosGenerados: transactionResult.turnosGenerados,
      usuariosOmitidosPorCuotaExistente: usuariosOmitidosPorCuotaExistente + transactionResult.cuotasOmitidasPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
      turnosOmitidosPorExistentes,
    });
  } catch (error: any) {
    if (isCupoConflictError(error)) {
      res.status(409).json({
        message: error.message,
        valido: false,
        conflictosCupo: error.conflictosCupo,
      });
      return;
    }
    console.error('Error generando cuotas masivas:', error);
    res.status(500).json({ message: 'Error al generar cuotas', error: error.message });
  }
};

/**
 * Paso 1 del flujo por lotes: valida cupos GLOBALES y devuelve los IDs de alumnos pendientes + totales.
 * NO crea nada. Si hay conflicto de cupos responde 409 con el detalle para mostrar al admin.
 */
export const prepararCuotasMasivas = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mes, vence } = req.body;
    if (!mes || !vence) {
      res.status(400).json({ message: 'Faltan parametros obligatorios: mes, vence' });
      return;
    }

    const venceDate = new Date(vence);
    if (isNaN(venceDate.getTime())) {
      res.status(400).json({ message: "'vence' no es una fecha valida" });
      return;
    }
    const periodStart = inferPeriodStart(mes);
    const venceError = validateVenceAfterStart(venceDate, periodStart);
    if (venceError) {
      res.status(400).json({ message: venceError });
      return;
    }

    const usuarios = await prisma.user.findMany({
      where: { estado: true, tipo: 'cliente', plan: { isNot: null } },
      select: USUARIO_PLAN_SELECT,
    });

    const {
      pendientes,
      usuariosOmitidosPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
    } = await filtrarUsuariosPendientesPorPeriodo(usuarios, mes);

    if (pendientes.length === 0) {
      res.status(200).json({
        message: usuarios.length === 0
          ? 'No hay alumnos activos con plan asignado.'
          : `No hay cuotas nuevas para generar en ${mes}. Los alumnos ya tienen una cuota vigente o usan plan semanal.`,
        total: 0,
        ids: [],
        totalTurnosEstimados: 0,
        usuariosOmitidos: usuariosOmitidosPorCuotaExistente + usuariosOmitidosPorPlanSemanal,
        usuariosOmitidosPorCuotaExistente,
        usuariosOmitidosPorPlanSemanal,
      });
      return;
    }

    const { turnosACrear, conflictosCupo } = await construirPlanMasivo(pendientes, mes, venceDate, null);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `No se pueden generar las cuotas. Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`,
        valido: false,
        conflictosCupo,
      });
      return;
    }

    res.status(200).json({
      message: `Listo para generar ${pendientes.length} cuota(s).`,
      total: pendientes.length,
      ids: pendientes.map(u => u.ID_Usuario),
      totalTurnosEstimados: turnosACrear.length,
      usuariosOmitidos: usuariosOmitidosPorCuotaExistente + usuariosOmitidosPorPlanSemanal,
      usuariosOmitidosPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
    });
  } catch (error: any) {
    console.error('Error preparando cuotas masivas:', error);
    res.status(500).json({ message: 'Error al preparar la generación de cuotas', error: error.message });
  }
};

/**
 * Paso 2 del flujo por lotes: procesa un chunk de alumnos (ids). Dedupea por período (reintento seguro),
 * valida cupos del lote (incluye lo ya creado por lotes previos) y crea en una transacción CORTA.
 * Idempotente: reintentar el mismo lote no duplica.
 */
export const generarCuotasLote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { mes, vence, formaPago, ids } = req.body;
    if (!mes || !vence) {
      res.status(400).json({ message: 'Faltan parametros obligatorios: mes, vence' });
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: 'Faltan los ids de alumnos del lote' });
      return;
    }

    const venceDate = new Date(vence);
    if (isNaN(venceDate.getTime())) {
      res.status(400).json({ message: "'vence' no es una fecha valida" });
      return;
    }
    const periodStart = inferPeriodStart(mes);
    const venceError = validateVenceAfterStart(venceDate, periodStart);
    if (venceError) {
      res.status(400).json({ message: venceError });
      return;
    }

    const idsNum = Array.from(new Set(
      ids.map((v: unknown) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
    ));
    if (idsNum.length === 0) {
      res.status(400).json({ message: 'Los ids del lote no son válidos' });
      return;
    }

    const usuarios = await prisma.user.findMany({
      where: { ID_Usuario: { in: idsNum }, estado: true, tipo: 'cliente', plan: { isNot: null } },
      select: USUARIO_PLAN_SELECT,
    });

    const {
      pendientes,
      usuariosOmitidosPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
    } = await filtrarUsuariosPendientesPorPeriodo(usuarios, mes);

    if (pendientes.length === 0) {
      res.status(200).json({
        procesados: 0,
        cuotasCreadas: 0,
        turnosGenerados: 0,
        turnosOmitidosPorExistentes: 0,
        usuariosOmitidosPorCuotaExistente,
        usuariosOmitidosPorPlanSemanal,
      });
      return;
    }

    const { cuotasData, turnosACrear, conflictosCupo, turnosOmitidosPorExistentes } =
      await construirPlanMasivo(pendientes, mes, venceDate, formaPago || null);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `Hay ${conflictosCupo.length} horario(s) sin cupo suficiente para los turnos fijos.`,
        valido: false,
        conflictosCupo,
      });
      return;
    }

    const result = await runSerializableTransaction(
      (tx) => persistirCuotasYTurnos(tx, mes, cuotasData, turnosACrear),
      { maxWait: 10000, timeout: 30000 },
    );

    res.status(200).json({
      procesados: pendientes.length,
      cuotasCreadas: result.cuotasCreadas,
      turnosGenerados: result.turnosGenerados,
      turnosOmitidosPorExistentes,
      usuariosOmitidosPorCuotaExistente: usuariosOmitidosPorCuotaExistente + result.cuotasOmitidasPorCuotaExistente,
      usuariosOmitidosPorPlanSemanal,
    });
  } catch (error: any) {
    if (isCupoConflictError(error)) {
      res.status(409).json({
        message: error.message,
        valido: false,
        conflictosCupo: error.conflictosCupo,
      });
      return;
    }
    console.error('Error generando lote de cuotas:', error);
    res.status(500).json({ message: 'Error al generar el lote de cuotas', error: error.message });
  }
};

const regenerateTurnosFijosByUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = Number(req.params.idUsuario);
    if (!usuarioId) {
      res.status(400).json({ message: 'ID de usuario inválido' });
      return;
    }

    const now = getArgentinaDate();
    const cuota = await findActiveCuota(usuarioId, now);
    if (!cuota?.ID_Cuota || !cuota.fechaInicio || !cuota.fechaFin) {
      res.status(400).json({ message: 'El usuario no tiene una cuota vigente para regenerar turnos fijos.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { ID_Usuario: usuarioId },
      select: {
        ID_Usuario: true,
        nombre: true,
        apellido: true,
        usaTurnosFijos: true,
        TurnosFijos: {
          where: { activo: true },
          include: {
            HorarioClase: {
              include: { Clase: { select: { nombre: true } } },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (!user.usaTurnosFijos || user.TurnosFijos.length === 0) {
      res.status(400).json({ message: 'El usuario no tiene turnos fijos activos para regenerar.' });
      return;
    }

    const candidatos = construirCandidatosTurnosFijosUsuario(user, {
      ID_Cuota: cuota.ID_Cuota,
      ID_Usuario: cuota.ID_Usuario,
      fechaInicio: cuota.fechaInicio,
      fechaFin: cuota.fechaFin,
      planSesionesTotalesSnapshot: cuota.planSesionesTotalesSnapshot,
      planSesionesSemanaSnapshot: cuota.planSesionesSemanaSnapshot,
      Plan: cuota.Plan,
    });

    if (candidatos.length === 0) {
      res.status(200).json({
        message: 'No hay turnos fijos futuros para regenerar en la cuota vigente.',
        usuarioId,
        cuotaId: cuota.ID_Cuota,
        turnosGenerados: 0,
        turnosOmitidosPorExistentes: 0,
      });
      return;
    }

    const { turnosACrear, conflictosCupo, turnosOmitidosPorExistentes } =
      await validarCupoTurnosCandidatos(candidatos);

    if (conflictosCupo.length > 0) {
      res.status(409).json({
        message: `No se pueden regenerar todos los turnos fijos. Hay ${conflictosCupo.length} horario(s) sin cupo suficiente.`,
        valido: false,
        conflictosCupo,
      });
      return;
    }

    const turnosGenerados = await runSerializableTransaction(
      (tx) => crearTurnosFijosParaCuota(tx, cuota.ID_Cuota, turnosACrear),
      { maxWait: 10000, timeout: 30000 },
    );

    res.status(200).json({
      message: `Se regeneraron ${turnosGenerados} turno(s) fijo(s).`,
      usuarioId,
      cuotaId: cuota.ID_Cuota,
      fechaInicio: cuota.fechaInicio,
      fechaFin: cuota.fechaFin,
      turnosGenerados,
      turnosOmitidosPorExistentes,
    });
  } catch (error: any) {
    if (isCupoConflictError(error)) {
      res.status(409).json({
        message: error.message,
        valido: false,
        conflictosCupo: error.conflictosCupo,
      });
      return;
    }
    console.error('Error regenerando turnos fijos:', error);
    res.status(500).json({ message: 'Error al regenerar turnos fijos', error: error.message });
  }
};

export const getAllCuotas = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      email,
      dni,
      studentName,
      estado,
      mes,
      plan,
      vencida // "true" | "false"
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
    const take = 15;
    const skip = (pageNumber - 1) * take;
    const where: Prisma.CuotaWhereInput = {};

    // 1) filtro por 'vencida' si viene explícito (tiene prioridad)
    if (typeof vencida === 'string') {
      where.vencida = vencida.toLowerCase() === 'true';
    }

    // 2) filtro por 'estado'
    if (typeof estado === 'string') {
      const est = estado.toLowerCase();

      // caso especial: 'pendiente' => pagada = false AND vencida = false
      if (est === 'pendiente' || est === 'pending') {
        where.pagada = false;
        // Sólo setear vencida=false si no vino explícito por query
        if (typeof vencida !== 'string') {
          where.vencida = false;
        }
      } else if (est === 'pagada' || est === 'true') {
        where.pagada = true;
      } else if (est === 'false') {
        // mantiene backward compatibility: pagada=false (pero puede incluir vencidas salvo que 'vencida' también se setee)
        where.pagada = false;
      }
    }

    // 3) mes (contains)
    if (mes && typeof mes === 'string') {
      where.mes = { contains: mes } as Prisma.StringFilter;
    }

    // 4) Construir de forma segura el filtro sobre User (plan + email + dni)
    const existingUserIs = (where.User as any)?.is ?? {};
    let userIs: any = { ...existingUserIs };

    if (plan && typeof plan === 'string') {
      userIs.plan = { is: { nombre: { contains: plan } as Prisma.StringFilter } };
    }

    if (email && typeof email === 'string') {
      userIs.email = { contains: email } as Prisma.StringFilter;
    }

    if (dni && typeof dni === 'string') {
      userIs.dni = { contains: dni } as Prisma.StringFilter;
    }

    if (studentName && typeof studentName === 'string') {
      const nameTerms = studentName.trim().split(/\s+/).filter(Boolean);

      if (nameTerms.length > 0) {
        userIs.AND = [
          ...(Array.isArray(userIs.AND) ? userIs.AND : []),
          ...nameTerms.map(term => ({
            OR: [
              { nombre: { contains: term } as Prisma.StringFilter },
              { apellido: { contains: term } as Prisma.StringFilter },
            ],
          })),
        ];
      }
    }

    if (Object.keys(userIs).length > 0) {
      where.User = { is: userIs } as any;
    }

    const [totalCuotas, cuotas] = await prisma.$transaction([
      prisma.cuota.count({ where }),
      prisma.cuota.findMany({
        where,
        skip,
        take,
        orderBy: { vence: 'desc' },
        select: {
          ID_Cuota: true,
          mes: true,
          importe: true,
          vence: true,
          pagada: true,
          vencida: true,
          formaPago: true,
          fechaPago: true,
          ID_Usuario: true,
          User: {
            select: {
              ID_Usuario: true,
              email: true,
              nombre: true,
              apellido: true,
              plan: { select: { ID_Plan: true, nombre: true, precio: true, duracion: true, sesionesPorSemana: true, sesionesGracia: true, requiereTurno: true } }
            }
          },
          Plan: true,
          fechaInicio: true,
          fechaFin: true,
          planNombreSnapshot: true,
          planDuracionSnapshot: true,
          planSesionesSemanaSnapshot: true,
          planSesionesGraciaSnapshot: true,
          planRequiereTurnoSnapshot: true
        }
      })
    ]);

    const totalPages = Math.ceil(totalCuotas / take);

    res.status(200).json({
      meta: { totalItems: totalCuotas, take, page: pageNumber, totalPages },
      data: cuotas
    });
  } catch (error: any) {
    console.error('Error al obtener las cuotas paginadas:', error);
    res.status(500).json({ message: 'Error al obtener las cuotas', error: error.message });
  }
};


// 4. Obtener todas las cuotas por usuario
export const getAllCuotasByUsuario = async (req: Request, res: Response): Promise<void> => {
  try {
    const idUsuario = parseInt(req.params.idUsuario, 10);
    if (isNaN(idUsuario)) {
      res.status(400).json({ message: 'ID de usuario inválido' });
      return;
    }

    const cuotas = await prisma.cuota.findMany({
      where: { ID_Usuario: idUsuario },
      orderBy: { vence: 'desc' }, // <-- orden descendente por fecha de vencimiento
      select: {
        ID_Cuota: true,
        mes: true,
        importe: true,
        vence: true,
        pagada: true,
        vencida: true,
        formaPago: true,
        fechaPago: true,
        ID_Usuario: true,
        User: {
          select: {
            ID_Usuario: true,
            email: true,
            nombre: true,
            apellido: true,
            plan: { select: { ID_Plan: true, nombre: true, precio: true, duracion: true, sesionesPorSemana: true, sesionesGracia: true, requiereTurno: true } }
          }
        },
        Plan: true,
        fechaInicio: true,
        fechaFin: true,
        planNombreSnapshot: true,
        planDuracionSnapshot: true,
        planSesionesSemanaSnapshot: true,
        planSesionesGraciaSnapshot: true,
        planRequiereTurnoSnapshot: true
      }
    });

    res.status(200).json(cuotas);
  } catch (error: any) {
    console.error('Error al obtener las cuotas por usuario:', error);
    res.status(500).json({ message: 'Error al obtener las cuotas por usuario', error: error.message });
  }
};

// 5. Eliminar cuota
const deleteCuota = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID de cuota inválido' });
      return;
    }
    const result = await prisma.$transaction(async (tx) => {
      const cuota = await tx.cuota.findUnique({
        where: { ID_Cuota: id },
        select: { ID_Cuota: true }
      });

      if (!cuota) {
        return null;
      }

      const turnosEliminados = await tx.turno.deleteMany({
        where: { ID_Cuota: id }
      });

      await tx.cuota.delete({ where: { ID_Cuota: id } });

      return { turnosEliminados: turnosEliminados.count };
    });

    if (!result) {
      res.status(404).json({ message: 'Cuota no encontrada' });
      return;
    }

    res.status(200).json({
      message: `Cuota ${id} eliminada exitosamente`,
      turnosEliminados: result.turnosEliminados
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error al eliminar la cuota', error: error.message });
  }
};

const prepararEliminacionCuotasByMes = async (req: Request, res: Response): Promise<void> => {
  try {
    const mes = String(req.body?.mes || req.query?.mes || '').trim();

    if (!parseMesParam(mes)) {
      res.status(400).json({ message: "Mes inválido. Usá el formato YYYY-MM" });
      return;
    }

    const cuotasMes = await prisma.cuota.findMany({
      where: { mes },
      select: { ID_Cuota: true, pagada: true },
    });

    if (cuotasMes.length === 0) {
      res.status(200).json({
        message: `No hay cuotas registradas para el mes ${mes}`,
        mes,
        ids: [],
        total: 0,
        totalCuotasAEliminar: 0,
        totalTurnosAEliminar: 0,
        cuotasPagadasOmitidas: 0,
        totalCuotasMes: 0,
      });
      return;
    }

    const cuotasPagadasOmitidas = cuotasMes.filter(c => c.pagada).length;
    const cuotaIds = cuotasMes
      .filter(c => !c.pagada)
      .map(c => c.ID_Cuota)
      .sort((a, b) => a - b);

    if (cuotaIds.length === 0) {
      res.status(200).json({
        message: `No se eliminaron cuotas de ${mes}: todas las cuotas del mes estan pagadas.`,
        mes,
        ids: [],
        total: 0,
        totalCuotasAEliminar: 0,
        totalTurnosAEliminar: 0,
        cuotasPagadasOmitidas,
        totalCuotasMes: cuotasMes.length,
      });
      return;
    }

    const totalTurnosAEliminar = await prisma.turno.count({
      where: { ID_Cuota: { in: cuotaIds } },
    });

    res.status(200).json({
      message: `Se prepararon ${cuotaIds.length} cuota(s) de ${mes} para eliminar.`,
      mes,
      ids: cuotaIds,
      total: cuotaIds.length,
      totalCuotasAEliminar: cuotaIds.length,
      totalTurnosAEliminar,
      cuotasPagadasOmitidas,
      totalCuotasMes: cuotasMes.length,
    });
  } catch (error: any) {
    console.error('Error preparando eliminacion de cuotas por mes:', error);
    res.status(500).json({ message: 'Error al preparar la eliminación de cuotas del mes', error: error.message });
  }
};

const eliminarCuotasByMesLote = async (req: Request, res: Response): Promise<void> => {
  try {
    const mes = String(req.body?.mes || '').trim();
    const idsRaw = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const idsNumericos: number[] = idsRaw.map((id: unknown): number => Number(id));
    const ids: number[] = Array.from(new Set(idsNumericos.filter((id: number) => Number.isInteger(id))));

    if (!parseMesParam(mes)) {
      res.status(400).json({ message: "Mes inválido. Usá el formato YYYY-MM" });
      return;
    }

    if (ids.length === 0 || ids.length > 100) {
      res.status(400).json({ message: 'El lote debe tener entre 1 y 100 cuotas.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const cuotasLote = await tx.cuota.findMany({
        where: {
          ID_Cuota: { in: ids },
          mes,
          pagada: false,
        },
        select: { ID_Cuota: true },
      });

      const cuotaIds = cuotasLote.map(c => c.ID_Cuota);

      if (cuotaIds.length === 0) {
        return {
          cuotasEliminadas: 0,
          turnosEliminados: 0,
          cuotasOmitidas: ids.length,
        };
      }

      const turnosEliminados = await tx.turno.deleteMany({
        where: { ID_Cuota: { in: cuotaIds } },
      });

      const cuotasEliminadas = await tx.cuota.deleteMany({
        where: {
          ID_Cuota: { in: cuotaIds },
          pagada: false,
        },
      });

      return {
        cuotasEliminadas: cuotasEliminadas.count,
        turnosEliminados: turnosEliminados.count,
        cuotasOmitidas: ids.length - cuotasEliminadas.count,
      };
    });

    res.status(200).json({
      message: `Se eliminaron ${result.cuotasEliminadas} cuota(s) del lote de ${mes}.`,
      mes,
      procesados: ids.length,
      cuotasEliminadas: result.cuotasEliminadas,
      turnosEliminados: result.turnosEliminados,
      cuotasOmitidas: result.cuotasOmitidas,
    });
  } catch (error: any) {
    console.error('Error eliminando lote de cuotas por mes:', error);
    res.status(500).json({ message: 'Error al eliminar el lote de cuotas del mes', error: error.message });
  }
};

// 6. Actualizar cuota
const updateCuota = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID de cuota inválido' });
      return;
    }

    const body = req.body ?? {};
    const hasImporte = Object.prototype.hasOwnProperty.call(body, 'importe');
    const importeRaw = body.importe;
    const importeNumber = typeof importeRaw === 'number' || typeof importeRaw === 'string'
      ? Number(importeRaw)
      : NaN;

    if (!hasImporte || !Number.isFinite(importeNumber) || importeNumber <= 0) {
      res.status(400).json({ message: 'Importe inválido. Debe ser un número mayor a 0.' });
      return;
    }

    const cuota = await prismaC.findUnique({
      where: { ID_Cuota: id },
      select: { ID_Cuota: true, pagada: true },
    });

    if (!cuota) {
      res.status(404).json({ message: 'Cuota no encontrada' });
      return;
    }

    if (cuota.pagada) {
      res.status(409).json({ message: 'Solo se pueden editar cuotas pendientes o vencidas' });
      return;
    }

    const updatedCuota = await prismaC.update({
      where: { ID_Cuota: id },
      data: { importe: importeNumber },
      include: { User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } } }
    });

    res.status(200).json({ message: 'Importe de cuota actualizado exitosamente', cuota: updatedCuota });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar la cuota', error: error.message });
  }
};

// 7. Pagar cuota
const payCuota = async (req: Request, res: Response): Promise<void> => {
  try {
    const cuotaId = parseInt(req.params.id, 10);
    const { formaPago } = req.body;

    if (isNaN(cuotaId) || !formaPago) {
      res.status(400).json({ message: 'ID de cuota o formaPago inválido' });
      return;
    }

    const updatedCuota = await prismaC.update({
      where: { ID_Cuota: cuotaId },
      data: {
        pagada: true,
        vencida: false,
        fechaPago: new Date(),
        formaPago
      },
      include: { User: { select: { ID_Usuario: true, email: true, nombre: true, apellido: true } } }
    });

    res.status(200).json({ message: 'Cuota pagada exitosamente', cuota: updatedCuota });
  } catch (error: any) {
    console.error('Error al pagar cuota:', error);
    res.status(500).json({ message: 'Error al actualizar la cuota', error: error.message });
  }
};

// recordatorio pago cuota a 3 dias de vencer.
// export const getCuotasVencenPronto = async (req: Request, res: Response): Promise<void> => {
//   const idUsuario = Number(req.params.idUsuario || req.params.id);
//   if (isNaN(idUsuario)) {
//     res.status(400).json({ message: "El parámetro 'idUsuario' debe ser un número válido" });
//     return;
//   }

//   try {
//     // 1) Obtener todas las cuotas pendientes del usuario (no pagadas)
//     const cuotasPendientes = await prisma.cuota.findMany({
//       where: {
//         ID_Usuario: idUsuario,
//         pagada: false
//       },
//       orderBy: { vence: "asc" }
//     });

//     // 2) Calcular "días restantes" respecto a ahora
//     // Ten en cuenta zona horaria: el cálculo usa la hora del servidor.
//     const MS_PER_DAY = 1000 * 60 * 60 * 24;
//     const now = new Date();

//     const proximas: Array<any> = [];
//     for (const c of cuotasPendientes) {
//       // c.vence viene como Date (JS Date) desde prisma
//       const venceDate = new Date(c.vence);
//       // Tomamos diferencia en días (redondeo hacia arriba para contar días parciales como 1 día restante)
//       const diffMs = venceDate.getTime() - now.getTime();
//       const daysLeft = Math.ceil(diffMs / MS_PER_DAY);

//       // Condición: si vence en 0..3 días (incluye hoy si daysLeft === 0)
//       if (daysLeft >= 0 && daysLeft <= 3) {
//         proximas.push({
//           ID_Cuota: c.ID_Cuota,
//           mes: c.mes,
//           importe: c.importe,
//           vence: venceDate.toISOString(),
//           daysLeft,
//           pagada: c.pagada,
//           formaPago: c.formaPago ?? null
//         });
//       }
//     }

//     const message = proximas.length > 0
//       ? `Tienes ${proximas.length} cuota(s) que vencen en menos de 3 días`
//       : "No hay cuotas por vencer en los próximos 3 días";

//     res.status(200).json({
//       message,
//       remindersCount: proximas.length,
//       reminders: proximas
//     });
//   } catch (error: any) {
//     console.error("Error obteniendo recordatorios de cuotas:", error);
//     res.status(500).json({ message: "Error obteniendo recordatorios de cuotas", error: error.message });
//   }
// };
export const getCuotasVencenPronto = async (req: Request, res: Response): Promise<void> => {
  const idUsuario = Number(req.params.idUsuario || req.params.id);
  if (isNaN(idUsuario)) {
    res.status(400).json({ message: "El parámetro 'idUsuario' debe ser un número válido" });
    return;
  }

  try {
    // 1) Obtener todas las cuotas NO pagadas del usuario ordenadas por vencimiento ascendente
    const cuotasPendientes = await prisma.cuota.findMany({
      where: {
        ID_Usuario: idUsuario,
        pagada: false
      },
      orderBy: { vence: "asc" }
    });

    // 2) Preparar cálculo por día (UTC)
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const now = new Date();
    const startOfTodayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // 3) Buckets
    const vencidas: any[] = [];
    const venceHoy: any[] = [];
    const porVencer: any[] = [];

    for (const c of cuotasPendientes) {
      const venceDate = new Date(c.vence);
      const venceDayUTC = Date.UTC(venceDate.getUTCFullYear(), venceDate.getUTCMonth(), venceDate.getUTCDate());
      const daysLeft = Math.floor((venceDayUTC - startOfTodayUTC) / MS_PER_DAY);

      // Ignorar pagadas (ya filtradas por query), clasificar según daysLeft
      const common = {
        ID_Cuota: c.ID_Cuota,
        mes: c.mes,
        importe: c.importe,
        vence: venceDate.toISOString(),
        daysLeft,
        pagada: c.pagada,
        formaPago: c.formaPago ?? null
      };

      if (daysLeft < 0) {
        // ya vencida
        vencidas.push({ ...common, vencida: true, estado: "Vencida" });
      } else if (daysLeft === 0) {
        // vence hoy
        venceHoy.push({ ...common, vencida: false, estado: "Vence hoy" });
      } else if (daysLeft > 0 && daysLeft <= 3) {
        // por vencer en <= 3 días
        porVencer.push({ ...common, vencida: false, estado: `Vence en ${daysLeft} día(s)` });
      } else {
        // > 3 días => no lo devolvemos en los arrays (pero podrías agregarlos si lo querés)
      }
    }

    // 4) Construir mensajes legibles para el frontend
    const totalVencidas = vencidas.length;
    const totalVenceHoy = venceHoy.length;
    const totalPorVencer = porVencer.length;
    const totalRecordatorios = totalVenceHoy + totalPorVencer;

    let messageParts: string[] = [];
    if (totalRecordatorios > 0) {
      messageParts.push(`Tienes ${totalRecordatorios} cuota(s) que vencen hoy o en los próximos 3 días`);
    } else {
      messageParts.push("No hay cuotas por vencer en los próximos 3 días");
    }

    if (totalVencidas > 0) {
      messageParts.push(`Además tienes ${totalVencidas} cuota(s) vencida(s)`);
    } else {
      messageParts.push("No tienes cuotas vencidas");
    }

    const combinedMessage = messageParts.join(". ") + ".";

    res.status(200).json({
      message: combinedMessage,
      hasVencidas: totalVencidas > 0,
      totals: {
        vencidas: totalVencidas,
        venceHoy: totalVenceHoy,
        porVencer: totalPorVencer,
        recordatorios: totalRecordatorios
      },
      vencidas,
      venceHoy,
      porVencer
    });
  } catch (error: any) {
    console.error("Error obteniendo recordatorios de cuotas:", error);
    res.status(500).json({ message: "Error obteniendo recordatorios de cuotas", error: error.message });
  }
};

export const cuotaMethods = {
  createCuota,
  getCuotaManualPreview,
  prepararCuotaUsuarioLotes,
  generarTurnosCuotaUsuarioLote,
  generateMonthlyCuotas,
  prepararCuotasMasivas,
  generarCuotasLote,
  regenerateTurnosFijosByUsuario,
  getAllCuotas,
  getAllCuotasByUsuario,
  deleteCuota,
  prepararEliminacionCuotasByMes,
  eliminarCuotasByMesLote,
  updateCuota,
  payCuota,
  getCuotasVencenPronto,
};
