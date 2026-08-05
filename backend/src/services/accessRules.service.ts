import prisma from "../models/Prisma.js";
import { runSerializableTransaction } from "./transaction.service.js";

type TurnoOmitido = {
  ID_HorarioClase: number;
  fecha: Date;
  motivo: string;
  nombreClase?: string;
  diaSemana?: string;
};

type PlanLike = {
  nombre?: string | null;
  precio?: number | null;
  duracion?: string | null;
  sesionesPorSemana?: number | null;
  sesionesTotales?: number | null;
  sesionesGracia?: number | null;
  requiereTurno?: boolean | null;
};

export const ACTIVE_TURNO_STATES = ["ACTIVO", "ASISTIDO", "AUSENTE"];

const DAY_INDEX: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

// "Miércoles", "miercoles" y "MIÉRCOLES" (precompuesto o descompuesto) son el mismo día.
export const normalizeDayKey = (value: unknown): string => (
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
);

export const getDayIndex = (value: unknown): number | undefined => DAY_INDEX[normalizeDayKey(value)];

const getWallClockTimeParts = (date: Date): { hours: number; minutes: number } => {
  const iso = date.toISOString();
  return {
    hours: Number(iso.slice(11, 13)),
    minutes: Number(iso.slice(14, 16)),
  };
};

export const getArgentinaDate = (): Date => new Date(Date.now() - 3 * 60 * 60 * 1000);

export const normalizePlanDuration = (value: unknown): string => {
  const normalized = String(value || "MENSUAL").trim().toUpperCase();
  return ["SEMANAL", "MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"].includes(normalized)
    ? normalized
    : "MENSUAL";
};

export const getWeekRange = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
};

export const calculatePeriodEnd = (start: Date, duration: string): Date => {
  const end = new Date(start);
  switch (normalizePlanDuration(duration)) {
    case "SEMANAL":
      end.setDate(end.getDate() + 7);
      break;
    case "TRIMESTRAL":
      end.setMonth(end.getMonth() + 3);
      break;
    case "SEMESTRAL":
      end.setMonth(end.getMonth() + 6);
      break;
    case "ANUAL":
      end.setFullYear(end.getFullYear() + 1);
      break;
    case "MENSUAL":
    default:
      end.setMonth(end.getMonth() + 1);
      break;
  }
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
};

export const inferPeriodStart = (mes: string, fallback = getArgentinaDate()): Date => {
  const match = String(mes || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return fallback;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1, 0, 0, 0, 0);
};

export const buildCuotaPeriod = (
  mes: string,
  duration: unknown,
  explicitStart?: Date | null,
  explicitEnd?: Date | null
): { fechaInicio: Date; fechaFin: Date; duration: string } => {
  const normalizedDuration = normalizePlanDuration(duration);
  const fechaInicio = explicitStart || inferPeriodStart(mes);
  const fechaFin = explicitEnd || calculatePeriodEnd(fechaInicio, normalizedDuration);
  return { fechaInicio, fechaFin, duration: normalizedDuration };
};

export const findBlockingCuotaForPeriod = async (
  ID_Usuario: number,
  mes: string,
  fechaInicio: Date,
  fechaFin: Date,
  client: any = prisma
) => (
  client.cuota.findFirst({
    where: {
      ID_Usuario,
      OR: [
        {
          fechaInicio: { lte: fechaFin },
          fechaFin: { gte: fechaInicio },
        },
        {
          mes,
          OR: [
            { fechaInicio: null },
            { fechaFin: null },
          ],
        },
      ],
    },
    select: {
      ID_Cuota: true,
      mes: true,
      fechaInicio: true,
      fechaFin: true,
      vence: true,
      planNombreSnapshot: true,
      planDuracionSnapshot: true,
    },
    orderBy: [
      { fechaInicio: "desc" },
      { vence: "desc" },
    ],
  })
);

export const buildCuotaPlanSnapshot = (plan: PlanLike | null | undefined) => ({
  planNombreSnapshot: plan?.nombre ?? null,
  planDuracionSnapshot: normalizePlanDuration(plan?.duracion),
  planSesionesSemanaSnapshot: Number(plan?.sesionesPorSemana || 0),
  planSesionesTotalesSnapshot: Number(plan?.sesionesTotales || 0),
  planSesionesGraciaSnapshot: Number(plan?.sesionesGracia || 0),
  planRequiereTurnoSnapshot: plan?.requiereTurno !== false,
});

export const findActiveCuota = async (ID_Usuario: number, date = getArgentinaDate()) => {
  const cuotaByPeriod = await prisma.cuota.findFirst({
    where: {
      ID_Usuario,
      fechaInicio: { lte: date },
      fechaFin: { gte: date },
    },
    include: { Plan: true },
    orderBy: { fechaInicio: "desc" },
  });

  if (cuotaByPeriod) return cuotaByPeriod;

  const mes = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return prisma.cuota.findFirst({
    where: { ID_Usuario, mes },
    include: { Plan: true },
    orderBy: { vence: "desc" },
  });
};

// La cuota que cubre la fecha dada y, si no hay, la próxima ya cargada.
// Sirve para las acciones que operan sobre el período (generar/regenerar turnos fijos):
// el 30/07, con la cuota de agosto ya creada, hay que poder trabajar sobre ella.
// El control de ingreso NO usa esto: para entrar al gimnasio hace falta cuota de HOY.
export const findActiveOrUpcomingCuota = async (ID_Usuario: number, date = getArgentinaDate()) => {
  const vigente = await findActiveCuota(ID_Usuario, date);
  if (vigente) return vigente;

  return prisma.cuota.findFirst({
    where: {
      ID_Usuario,
      fechaInicio: { gt: date },
    },
    include: { Plan: true },
    orderBy: { fechaInicio: "asc" },
  });
};

export const getWeeklySessionLimit = (cuota: any): number => (
  Number(cuota?.planSesionesSemanaSnapshot ?? cuota?.Plan?.sesionesPorSemana ?? 0)
);

export const getGraceSessionLimit = (cuota: any): number => (
  Number(cuota?.planSesionesGraciaSnapshot ?? cuota?.Plan?.sesionesGracia ?? 0)
);

// Tope TOTAL de sesiones del período (reemplaza al semanal).
export const getTotalSessionLimit = (cuota: any): number => (
  Number(cuota?.planSesionesTotalesSnapshot ?? cuota?.Plan?.sesionesTotales ?? 0)
);

// Máximo de sesiones cargables según la duración (1 turno por día como máximo).
export const getMaxSessionsForDuration = (duration: unknown): number => {
  switch (normalizePlanDuration(duration)) {
    case "SEMANAL": return 7;
    case "MENSUAL": return 31;
    case "TRIMESTRAL": return 92;
    case "SEMESTRAL": return 184;
    case "ANUAL": return 366;
    default: return 31;
  }
};

export const requiresTurno = (cuota: any): boolean => (
  cuota?.planRequiereTurnoSnapshot ?? cuota?.Plan?.requiereTurno ?? true
);

export const countWeeklyUsedSessions = async (
  ID_Usuario: number,
  date: Date,
  excludeTurnoId?: number
): Promise<number> => {
  const { start, end } = getWeekRange(date);
  return prisma.turno.count({
    where: {
      ID_Usuario,
      fecha: { gte: start, lt: end },
      estado: { in: ACTIVE_TURNO_STATES },
      ...(excludeTurnoId ? { id_turno: { not: excludeTurnoId } } : {}),
    },
  });
};

export const countUnpaidAllowedAttendances = async (
  ID_Usuario: number,
  ID_Cuota: number,
  client: any = prisma
): Promise<number> => (
  client.asistencia.count({
    where: {
      ID_Usuario,
      ID_Cuota,
      permitido: true,
    },
  })
);

// Reglas de pago para RESERVAR un turno. Mismo criterio que el control de ingreso
// (registrarAsistencia), para que el alumno no pueda reservar algo a lo que después no
// lo van a dejar entrar:
//   - cualquier cuota impaga y vencida bloquea, aunque sea de un mes anterior;
//   - con la cuota del período pendiente puede reservar mientras le queden sesiones de
//     gracia, y la gracia se consume con las asistencias permitidas de esa cuota.
// El tope de sesiones del plan y el rango de fechas se validan aparte.
export const validateCuotaPaymentForBooking = async (
  ID_Usuario: number,
  cuota: any,
  client: any = prisma
): Promise<string | null> => {
  const deudaVencida = await client.cuota.findFirst({
    where: {
      ID_Usuario,
      pagada: false,
      OR: [
        { vencida: true },
        { vence: { lt: getArgentinaDate() } },
      ],
    },
    select: { mes: true },
  });
  if (deudaVencida) {
    return `No podés agendar turnos porque tenés una cuota vencida impaga (${deudaVencida.mes}). Regularizá el pago para volver a reservar.`;
  }

  if (cuota?.pagada) return null;

  const graceLimit = getGraceSessionLimit(cuota);
  if (graceLimit <= 0) {
    return "No podés agendar turnos con la cuota pendiente de pago. Tu plan no incluye sesiones de gracia.";
  }

  const graceUsed = await countUnpaidAllowedAttendances(ID_Usuario, cuota.ID_Cuota, client);
  if (graceUsed >= graceLimit) {
    return `No podés agendar turnos: ya usaste las ${graceLimit} sesión(es) de gracia de tu cuota pendiente. Regularizá el pago para seguir reservando.`;
  }

  return null;
};

export const validateWeeklyAvailability = async (
  ID_Usuario: number,
  fecha: Date,
  cuota: any,
  excludeTurnoId?: number
): Promise<string | null> => {
  const limit = getWeeklySessionLimit(cuota);
  if (limit <= 0) return null;
  const used = await countWeeklyUsedSessions(ID_Usuario, fecha, excludeTurnoId);
  return used >= limit ? `El plan permite hasta ${limit} sesión(es) por semana.` : null;
};

// Cuenta los turnos (sesiones) ya tomados dentro del período de la cuota.
export const countPeriodUsedSessions = async (
  ID_Usuario: number,
  cuota: any,
  excludeTurnoId?: number,
  client: any = prisma
): Promise<number> => {
  return client.turno.count({
    where: {
      ID_Usuario,
      ...(cuota?.ID_Cuota ? { ID_Cuota: cuota.ID_Cuota } : {}),
      estado: { in: ACTIVE_TURNO_STATES },
      ...(excludeTurnoId ? { id_turno: { not: excludeTurnoId } } : {}),
    },
  });
};

// Tope TOTAL del período: el alumno no puede superar las sesiones totales del plan.
export const validatePeriodAvailability = async (
  ID_Usuario: number,
  cuota: any,
  excludeTurnoId?: number,
  client: any = prisma
): Promise<string | null> => {
  const limit = getTotalSessionLimit(cuota);
  if (limit <= 0) return null;
  const used = await countPeriodUsedSessions(ID_Usuario, cuota, excludeTurnoId, client);
  return used >= limit ? `El plan permite hasta ${limit} sesión(es) en el período.` : null;
};

// El alumno no puede tener dos turnos el mismo día calendario.
// Los turnos se guardan como "hora de pared" en UTC, por eso el rango se calcula en UTC.
export const hasTurnoSameDay = async (
  ID_Usuario: number,
  fecha: Date,
  excludeTurnoId?: number,
  client: any = prisma
): Promise<boolean> => {
  const dayStart = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), 0, 0, 0, 0));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const count = await client.turno.count({
    where: {
      ID_Usuario,
      fecha: { gte: dayStart, lt: dayEnd },
      estado: { in: ACTIVE_TURNO_STATES },
      ...(excludeTurnoId ? { id_turno: { not: excludeTurnoId } } : {}),
    },
  });
  return count > 0;
};

type HorarioCupoUsageOptions = {
  excludeTurnoId?: number;
  releaseFixedReservationForUserId?: number;
  releaseFixedReservationForUserIds?: number[];
  client?: any;
  // IDs de horarios hermanos ya resueltos (para no recalcularlos entre funciones).
  horarioIds?: number[];
};

type HorarioSlotCapacity = {
  ID_HorarioClase: number;
  cupos: number;
  activo?: boolean;
};

export const selectCurrentSlotHorario = (
  horarios: HorarioSlotCapacity[],
  fallback: HorarioSlotCapacity
): HorarioSlotCapacity => {
  const activeHorarios = horarios
    .filter((horario) => horario.activo)
    .sort((a, b) => b.ID_HorarioClase - a.ID_HorarioClase);

  return activeHorarios[0] ?? fallback;
};

// Un "slot" es una sesión real del gimnasio: clase + día de la semana + hora de inicio.
// Un mismo slot puede quedar repartido en varios registros de HorarioClase cuando se
// edita un horario en modo "preserve": se crea un horario nuevo (activo) y se desactiva
// el viejo, pero los turnos ya existentes quedan asociados al horario viejo.
//
// Regla del sistema: la ocupación se cuenta sobre TODOS los hermanos del slot, pero la
// capacidad se lee del horario VIGENTE y los turnos nuevos se escriben sobre él. Los
// horarios desactivados sólo existen para contabilizar los turnos históricos.
export type ResolvedSlot = {
  // Todos los HorarioClase del slot (activos e inactivos). Es el universo a contar.
  horarioIds: number[];
  // Horario sobre el que se lee la capacidad y se escriben los turnos nuevos.
  vigente: { ID_HorarioClase: number; cupos: number; activo: boolean };
  // Clave estable de la sesión: agrupa candidatos aunque apunten a hermanos distintos.
  slotKey: string;
};

const buildSlotKey = (ID_Clase: number, diaSemana: unknown, horaIni: Date): string => {
  const { hours, minutes } = getWallClockTimeParts(horaIni);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${ID_Clase}|${normalizeDayKey(diaSemana)}|${hh}:${mm}`;
};

const buildOrphanSlot = (ID_HorarioClase: number): ResolvedSlot => ({
  horarioIds: [ID_HorarioClase],
  vigente: { ID_HorarioClase, cupos: 0, activo: false },
  slotKey: `horario:${ID_HorarioClase}`,
});

type SlotHorarioRow = {
  ID_HorarioClase: number;
  ID_Clase: number;
  diaSemana: string;
  horaIni: Date;
  cupos: number;
  activo: boolean;
};

const SLOT_HORARIO_SELECT = {
  ID_HorarioClase: true,
  ID_Clase: true,
  diaSemana: true,
  horaIni: true,
  cupos: true,
  activo: true,
};

// Resuelve varios horarios de una sola vez (2 queries en total, sin importar cuántos
// horarios se pidan). Usarla siempre que haya que resolver más de un horario.
//
// El mapa queda indexado por TODOS los hermanos de cada slot resuelto, no sólo por los
// ids pedidos: así `get(idVigente)` funciona aunque se haya pedido el hermano viejo.
export const resolveSlots = async (
  ID_HorarioClases: number[],
  client: any = prisma
): Promise<Map<number, ResolvedSlot>> => {
  const uniqueIds = Array.from(new Set(ID_HorarioClases.filter((id) => Number.isInteger(id))));
  const resolved = new Map<number, ResolvedSlot>();
  if (uniqueIds.length === 0) return resolved;

  const solicitados: SlotHorarioRow[] = await client.horarioClase.findMany({
    where: { ID_HorarioClase: { in: uniqueIds } },
    select: SLOT_HORARIO_SELECT,
  });

  for (const id of uniqueIds) {
    if (!solicitados.some((h) => h.ID_HorarioClase === id)) {
      resolved.set(id, buildOrphanSlot(id));
    }
  }
  if (solicitados.length === 0) return resolved;

  const claseIds = Array.from(new Set(solicitados.map((h) => h.ID_Clase)));
  const hermanos: SlotHorarioRow[] = await client.horarioClase.findMany({
    where: { ID_Clase: { in: claseIds } },
    select: SLOT_HORARIO_SELECT,
  });

  const bySlotKey = new Map<string, SlotHorarioRow[]>();
  for (const horario of hermanos) {
    const key = buildSlotKey(horario.ID_Clase, horario.diaSemana, new Date(horario.horaIni));
    const group = bySlotKey.get(key);
    if (group) group.push(horario);
    else bySlotKey.set(key, [horario]);
  }

  for (const horario of solicitados) {
    const slotKey = buildSlotKey(horario.ID_Clase, horario.diaSemana, new Date(horario.horaIni));
    const group = bySlotKey.get(slotKey) ?? [horario];
    const capacidades = group.map((h) => ({
      ID_HorarioClase: h.ID_HorarioClase,
      cupos: Number(h.cupos ?? 0),
      activo: Boolean(h.activo),
    }));
    const fallback = {
      ID_HorarioClase: horario.ID_HorarioClase,
      cupos: Number(horario.cupos ?? 0),
      activo: Boolean(horario.activo),
    };
    const vigente = selectCurrentSlotHorario(capacidades, fallback);

    const slot: ResolvedSlot = {
      horarioIds: capacidades.map((h) => h.ID_HorarioClase),
      vigente: {
        ID_HorarioClase: vigente.ID_HorarioClase,
        cupos: Number(vigente.cupos ?? 0),
        activo: Boolean(vigente.activo),
      },
      slotKey,
    };

    // El slot es el mismo para todos los hermanos: se indexa por cada uno.
    for (const id of slot.horarioIds) resolved.set(id, slot);
    resolved.set(horario.ID_HorarioClase, slot);
  }

  return resolved;
};

export const resolveSlot = async (
  ID_HorarioClase: number,
  client: any = prisma
): Promise<ResolvedSlot> => {
  const resolved = await resolveSlots([ID_HorarioClase], client);
  return resolved.get(ID_HorarioClase) ?? buildOrphanSlot(ID_HorarioClase);
};

export const resolveSlotHorarioIds = async (
  ID_HorarioClase: number,
  client: any = prisma
): Promise<number[]> => (
  (await resolveSlot(ID_HorarioClase, client)).horarioIds
);

export const countPendingFixedReservationsForHorarioFecha = async (
  ID_HorarioClase: number,
  fecha: Date,
  options: HorarioCupoUsageOptions = {}
): Promise<number> => {
  const client = options.client || prisma;
  const horarioIds = options.horarioIds ?? await resolveSlotHorarioIds(ID_HorarioClase, client);
  const fixedUsers = await client.turnoFijo.findMany({
    where: {
      ID_HorarioClase: { in: horarioIds },
      activo: true,
    },
    select: { ID_Usuario: true },
  });

  const releasedFixedUserIds = new Set([
    ...(options.releaseFixedReservationForUserIds || []),
    ...(options.releaseFixedReservationForUserId ? [options.releaseFixedReservationForUserId] : []),
  ]);

  const fixedUserIds = Array.from(new Set(
    fixedUsers
      .map((fixed: { ID_Usuario: number }) => fixed.ID_Usuario)
      .filter((id: number) => !releasedFixedUserIds.has(id))
  ));

  if (fixedUserIds.length === 0) return 0;

  // Solo se reserva cupo para turnos fijos que efectivamente se van a generar:
  // el usuario debe tener una cuota vigente que cubra la fecha (mismo criterio que
  // generateFixedTurnosForCuota, que solo crea turnos dentro de [fechaInicio, fechaFin]).
  // Sin este filtro, un TurnoFijo activo de un usuario sin cuota vigente retiene un
  // cupo fantasma que nunca se materializa y hace que la disponibilidad muestre menos
  // lugares libres de los reales.
  const cuotasVigentes = await client.cuota.findMany({
    where: {
      ID_Usuario: { in: fixedUserIds },
      fechaInicio: { lte: fecha },
      fechaFin: { gte: fecha },
    },
    select: { ID_Usuario: true },
  });
  const usersWithActiveCuota = new Set(
    cuotasVigentes.map((cuota: { ID_Usuario: number }) => cuota.ID_Usuario)
  );
  const eligibleFixedUserIds = fixedUserIds.filter((id) => usersWithActiveCuota.has(id));

  if (eligibleFixedUserIds.length === 0) return 0;

  const existingFixedUserTurnos = await client.turno.findMany({
    where: {
      ID_HorarioClase: { in: horarioIds },
      fecha,
      ID_Usuario: { in: eligibleFixedUserIds },
      ...(options.excludeTurnoId ? { id_turno: { not: options.excludeTurnoId } } : {}),
    },
    select: { ID_Usuario: true },
  });

  const usersWithTurnoForDate = new Set(
    existingFixedUserTurnos.map((turno: { ID_Usuario: number }) => turno.ID_Usuario)
  );

  return eligibleFixedUserIds.filter((id) => !usersWithTurnoForDate.has(id)).length;
};

export const getHorarioCupoUsage = async (
  ID_HorarioClase: number,
  fecha: Date,
  options: HorarioCupoUsageOptions = {}
): Promise<{
  turnosActivos: number;
  reservasFijasPendientes: number;
  cuposComprometidos: number;
}> => {
  const client = options.client || prisma;
  const horarioIds = options.horarioIds ?? await resolveSlotHorarioIds(ID_HorarioClase, client);
  const [turnosActivos, reservasFijasPendientes] = await Promise.all([
    client.turno.count({
      where: {
        ID_HorarioClase: { in: horarioIds },
        fecha,
        estado: { in: ACTIVE_TURNO_STATES },
        ...(options.excludeTurnoId ? { id_turno: { not: options.excludeTurnoId } } : {}),
      },
    }),
    countPendingFixedReservationsForHorarioFecha(ID_HorarioClase, fecha, { ...options, horarioIds }),
  ]);

  return {
    turnosActivos,
    reservasFijasPendientes,
    cuposComprometidos: turnosActivos + reservasFijasPendientes,
  };
};

export const validateHorarioCupoAvailability = async (
  ID_HorarioClase: number,
  fecha: Date,
  cupos: number,
  options: HorarioCupoUsageOptions = {}
): Promise<string | null> => {
  const usage = await getHorarioCupoUsage(ID_HorarioClase, fecha, options);
  if (usage.cuposComprometidos < Number(cupos || 0)) return null;

  return usage.reservasFijasPendientes > 0
    ? "No hay cupos disponibles para este horario: los cupos libres están reservados para turnos fijos."
    : "No hay cupos disponibles para este horario";
};

export const generateFixedTurnosForCuota = async (cuota: any): Promise<{
  created: number;
  errores: TurnoOmitido[];
}> => {
  if (!cuota?.ID_Cuota || !cuota?.ID_Usuario || !cuota?.fechaInicio || !cuota?.fechaFin) return { created: 0, errores: [] };

  const user = await prisma.user.findUnique({
    where: { ID_Usuario: cuota.ID_Usuario },
    select: {
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

  if (!user?.usaTurnosFijos || user.TurnosFijos.length === 0) return { created: 0, errores: [] };

  // El TurnoFijo puede apuntar a un horario desactivado (slot fragmentado por una edición
  // "preserve"). Los turnos se crean SIEMPRE sobre el horario vigente del slot.
  const slots = await resolveSlots(
    user.TurnosFijos.map((fixed) => fixed.ID_HorarioClase),
  );

  // Tope: no se generan más turnos que las sesiones totales del plan.
  const totalLimit = getTotalSessionLimit(cuota);

  let created = 0;
  const errores: TurnoOmitido[] = [];
  const cursor = new Date(cuota.fechaInicio);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(cuota.fechaFin);
  end.setHours(23, 59, 59, 999);
  // No generar turnos en fechas/horarios ya pasados (mismo marco wall-clock que fechaTurno).
  const nowArg = getArgentinaDate();

  while (cursor <= end) {
    if (totalLimit > 0 && created >= totalLimit) break;
    for (const fixed of user.TurnosFijos) {
      if (totalLimit > 0 && created >= totalLimit) break;
      const horario = fixed.HorarioClase;
      const slot = slots.get(horario.ID_HorarioClase);
      const horarioIds = slot?.horarioIds ?? [horario.ID_HorarioClase];
      const ID_HorarioClaseDestino = slot?.vigente.ID_HorarioClase ?? horario.ID_HorarioClase;

      const expectedDay = getDayIndex(horario.diaSemana);
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

      // Turno en fecha/horario ya pasado: no se crea (nadie va a asistir).
      if (fechaTurno <= nowArg) continue;

      // El alumno ya puede tener el turno de esa sesión sobre cualquier hermano del slot.
      const existing = await prisma.turno.findFirst({
        where: {
          ID_Usuario: cuota.ID_Usuario,
          ID_HorarioClase: { in: horarioIds },
          fecha: fechaTurno,
        },
        select: { id_turno: true },
      });
      if (existing) continue;

      const resultado = await runSerializableTransaction(async (tx) => {
        const existingInTransaction = await tx.turno.findFirst({
          where: {
            ID_Usuario: cuota.ID_Usuario,
            ID_HorarioClase: { in: horarioIds },
            fecha: fechaTurno,
          },
          select: { id_turno: true },
        });
        if (existingInTransaction) return "existente";

        // La capacidad es la del horario vigente, no la del registro al que apunta el fijo.
        const horarioActual = await tx.horarioClase.findUnique({
          where: { ID_HorarioClase: ID_HorarioClaseDestino },
          select: { cupos: true },
        });
        if (!horarioActual) return "sin_cupo";

        const cupoError = await validateHorarioCupoAvailability(
          ID_HorarioClaseDestino,
          fechaTurno,
          horarioActual.cupos,
          {
            releaseFixedReservationForUserId: Number(cuota.ID_Usuario),
            client: tx,
            horarioIds,
          },
        );
        if (cupoError) return "sin_cupo";

        await tx.turno.create({
          data: {
            fecha: fechaTurno,
            estado: "ACTIVO",
            origen: "FIJO",
            ID_Usuario: cuota.ID_Usuario,
            ID_HorarioClase: ID_HorarioClaseDestino,
            ID_Cuota: cuota.ID_Cuota,
            fechaCreacion: getArgentinaDate(),
          },
        });
        return "creado";
      });

      if (resultado === "creado") {
        created += 1;
      } else if (resultado === "sin_cupo") {
        errores.push({
          ID_HorarioClase: ID_HorarioClaseDestino,
          fecha: fechaTurno,
          motivo: 'sin_cupo',
          nombreClase: horario.Clase?.nombre ?? null,
          diaSemana: horario.diaSemana,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { created, errores };
};
