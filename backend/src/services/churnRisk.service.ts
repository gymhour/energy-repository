import prisma from "../models/Prisma.js";
import { getArgentinaDate } from "./accessRules.service.js";

export type ChurnRiskLevel = "ALTO" | "MEDIO" | "BAJO";
export type ChurnRiskFilter = ChurnRiskLevel | "MEDIO_ALTO";

type ChurnRiskQuery = {
  page?: number;
  take?: number;
  riskLevel?: ChurnRiskFilter;
  search?: string;
};

type AttendanceRecord = {
  fechaIngreso: Date;
};

type RiskUser = {
  ID_Usuario: number;
  dni: string | null;
  nombre: string | null;
  apellido: string | null;
  email: string;
  tel: string | null;
  fechaRegistro: Date | null;
  plan: {
    ID_Plan: number;
    nombre: string;
    sesionesTotales: number;
  } | null;
  Asistencias: AttendanceRecord[];
  contactos?: Array<{ fecha: Date }>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 14;
const BASELINE_WINDOW_DAYS = 60;
const LOOKBACK_DAYS = RECENT_WINDOW_DAYS + BASELINE_WINDOW_DAYS;

const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const clampScore = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const daysBetween = (from: Date, to: Date): number => (
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS))
);

const subDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
};

const countFrom = (attendances: AttendanceRecord[], from: Date): number => (
  attendances.filter(a => a.fechaIngreso >= from).length
);

const countBetween = (attendances: AttendanceRecord[], from: Date, to: Date): number => (
  attendances.filter(a => a.fechaIngreso >= from && a.fechaIngreso < to).length
);

const countActiveWeeks = (attendances: AttendanceRecord[], now: Date): number => {
  const activeWeeks = new Set<number>();

  attendances.forEach(attendance => {
    const diffDays = daysBetween(attendance.fechaIngreso, now);
    if (diffDays >= 0 && diffDays < 28) {
      activeWeeks.add(Math.floor(diffDays / 7));
    }
  });

  return activeWeeks.size;
};

const getRiskLevel = (score: number): ChurnRiskLevel => {
  if (score >= 70) return "ALTO";
  if (score >= 45) return "MEDIO";
  return "BAJO";
};

const buildMainReason = ({
  daysSinceLastAttendance,
  recentWeeklyAverage,
  baselineWeeklyAverage,
  activeWeeksLast4,
  attendanceCount,
  accountAgeDays,
}: {
  daysSinceLastAttendance: number | null;
  recentWeeklyAverage: number;
  baselineWeeklyAverage: number;
  activeWeeksLast4: number;
  attendanceCount: number;
  accountAgeDays: number;
}): string => {
  if (attendanceCount === 0) {
    if (accountAgeDays < 14) return "Usuario nuevo sin asistencias registradas todavía.";
    return `No registra asistencias desde hace ${accountAgeDays} días.`;
  }

  if (daysSinceLastAttendance !== null && daysSinceLastAttendance >= 15) {
    return `Hace ${daysSinceLastAttendance} días que no asiste.`;
  }

  if (baselineWeeklyAverage >= 0.75) {
    const dropRatio = (baselineWeeklyAverage - recentWeeklyAverage) / baselineWeeklyAverage;
    if (dropRatio >= 0.5) {
      return `Bajó de ${round(baselineWeeklyAverage, 1)} a ${round(recentWeeklyAverage, 1)} asistencias por semana.`;
    }
  }

  if (activeWeeksLast4 <= 1) {
    return `Sólo asistió en ${activeWeeksLast4} de las últimas 4 semanas.`;
  }

  if (activeWeeksLast4 >= 3) {
    return "Mantiene una rutina estable de asistencia.";
  }

  return "Actividad reciente con señales moderadas de seguimiento.";
};

const scoreUser = (user: RiskUser, now: Date) => {
  const attendances = [...user.Asistencias].sort(
    (a, b) => b.fechaIngreso.getTime() - a.fechaIngreso.getTime()
  );
  const lastAttendanceAt = attendances[0]?.fechaIngreso ?? null;
  const accountAgeDays = daysBetween(user.fechaRegistro ?? now, now);
  const daysSinceLastAttendance = lastAttendanceAt ? daysBetween(lastAttendanceAt, now) : null;

  const recentStart = subDays(now, RECENT_WINDOW_DAYS);
  const baselineStart = subDays(now, LOOKBACK_DAYS);
  const last30Start = subDays(now, 30);

  const recentAttendances = countFrom(attendances, recentStart);
  const baselineAttendances = countBetween(attendances, baselineStart, recentStart);
  const usageLast30 = countFrom(attendances, last30Start);
  const activeWeeksLast4 = countActiveWeeks(attendances, now);

  const recentWeeklyAverage = recentAttendances / (RECENT_WINDOW_DAYS / 7);
  const baselineWeeklyAverage = baselineAttendances / (BASELINE_WINDOW_DAYS / 7);
  const planSessionsTotal = Number(user.plan?.sesionesTotales || 0);
  const planUsageRatio = planSessionsTotal > 0 ? usageLast30 / planSessionsTotal : null;

  let score = 0;

  if (attendances.length === 0) {
    score += accountAgeDays < 14 ? 30 : accountAgeDays < 30 ? 55 : 78;
  } else if (daysSinceLastAttendance !== null) {
    if (daysSinceLastAttendance <= 7) score += 0;
    else if (daysSinceLastAttendance <= 14) score += 15;
    else if (daysSinceLastAttendance <= 21) score += 30;
    else score += 42;
  }

  if (baselineWeeklyAverage >= 0.75) {
    const dropRatio = (baselineWeeklyAverage - recentWeeklyAverage) / baselineWeeklyAverage;
    if (dropRatio >= 0.75) score += 35;
    else if (dropRatio >= 0.5) score += 25;
    else if (dropRatio >= 0.25) score += 12;
  }

  if (attendances.length > 0) {
    if (activeWeeksLast4 === 0) score += 25;
    else if (activeWeeksLast4 === 1) score += 15;
    else if (activeWeeksLast4 === 2) score += 7;
    else score -= 10;

    if (planUsageRatio !== null) {
      if (planUsageRatio < 0.25 && (daysSinceLastAttendance ?? accountAgeDays) > 7) score += 8;
      if (planUsageRatio >= 0.5) score -= 5;
    }

    if (activeWeeksLast4 >= 3 && (daysSinceLastAttendance ?? 99) <= 7) score -= 15;
    if (baselineWeeklyAverage > 0 && recentWeeklyAverage >= baselineWeeklyAverage * 0.75) score -= 20;
  }

  const riskScore = clampScore(score);
  const riskLevel = getRiskLevel(riskScore);

  return {
    user: {
      id: user.ID_Usuario,
      dni: user.dni,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      tel: user.tel,
    },
    plan: user.plan ? {
      id: user.plan.ID_Plan,
      nombre: user.plan.nombre,
      sesionesTotales: planSessionsTotal,
    } : null,
    riskLevel,
    riskScore,
    lastContactAt: user.contactos?.[0]?.fecha ?? null,
    mainReason: buildMainReason({
      daysSinceLastAttendance,
      recentWeeklyAverage,
      baselineWeeklyAverage,
      activeWeeksLast4,
      attendanceCount: attendances.length,
      accountAgeDays,
    }),
    lastAttendanceAt,
    metrics: {
      accountAgeDays,
      daysSinceLastAttendance,
      recentAttendances,
      baselineAttendances,
      recentWeeklyAverage: round(recentWeeklyAverage),
      baselineWeeklyAverage: round(baselineWeeklyAverage),
      activeWeeksLast4,
      usageLast30,
      planUsageRatio: planUsageRatio === null ? null : round(planUsageRatio),
    },
  };
};

const normalizeRiskLevel = (value: unknown): ChurnRiskFilter | undefined => {
  const normalized = String(value || "").trim().toUpperCase();
  return ["ALTO", "MEDIO", "BAJO", "MEDIO_ALTO"].includes(normalized)
    ? normalized as ChurnRiskFilter
    : undefined;
};

const matchesRiskFilter = (riskLevel: ChurnRiskLevel, selectedRiskLevel?: ChurnRiskFilter): boolean => {
  if (!selectedRiskLevel) return true;
  if (selectedRiskLevel === "MEDIO_ALTO") return riskLevel === "ALTO" || riskLevel === "MEDIO";
  return riskLevel === selectedRiskLevel;
};

export const getChurnRiskReport = async ({
  page = 1,
  take = 20,
  riskLevel,
  search,
}: ChurnRiskQuery = {}) => {
  const now = getArgentinaDate();
  const cutoff = subDays(now, LOOKBACK_DAYS);
  const cleanSearch = String(search || "").trim();
  const selectedRiskLevel = normalizeRiskLevel(riskLevel);

  const users = await prisma.user.findMany({
    where: {
      estado: true,
      tipo: "cliente",
      ...(cleanSearch ? {
        OR: [
          { nombre: { contains: cleanSearch } },
          { apellido: { contains: cleanSearch } },
          { dni: { contains: cleanSearch } },
        ],
      } : {}),
    },
    select: {
      ID_Usuario: true,
      dni: true,
      nombre: true,
      apellido: true,
      email: true,
      tel: true,
      fechaRegistro: true,
      plan: {
        select: {
          ID_Plan: true,
          nombre: true,
          sesionesTotales: true,
        },
      },
      Asistencias: {
        where: {
          permitido: true,
          fechaIngreso: { gte: cutoff },
        },
        select: { fechaIngreso: true },
        orderBy: { fechaIngreso: "desc" },
      },
      contactos: {
        orderBy: { fecha: "desc" },
        take: 1,
        select: { fecha: true },
      },
    },
  });

  const scoredAll = (users as RiskUser[])
    .map(user => scoreUser(user, now))
    .sort((a, b) => b.riskScore - a.riskScore || (a.user.nombre || "").localeCompare(b.user.nombre || ""));

  // Totales globales: SIEMPRE sobre todos los evaluados, sin importar el filtro de riesgo,
  // para que las tarjetas del frontend muestren los conteos reales del gimnasio.
  const counts = scoredAll.reduce((acc, item) => {
    acc[item.riskLevel] += 1;
    return acc;
  }, { ALTO: 0, MEDIO: 0, BAJO: 0 } as Record<ChurnRiskLevel, number>);

  // El listado paginado sí respeta el filtro de riesgo seleccionado.
  const filtered = scoredAll.filter(item => matchesRiskFilter(item.riskLevel, selectedRiskLevel));

  const pageNumber = Math.max(1, Number(page) || 1);
  const takeNumber = Math.min(100, Math.max(1, Number(take) || 20));
  const skip = (pageNumber - 1) * takeNumber;
  const data = filtered.slice(skip, skip + takeNumber);

  return {
    summary: {
      evaluatedUsers: scoredAll.length,
      highRisk: counts.ALTO,
      mediumRisk: counts.MEDIO,
      lowRisk: counts.BAJO,
      generatedAt: now,
    },
    pagination: {
      total: filtered.length,
      page: pageNumber,
      take: takeNumber,
      totalPages: Math.ceil(filtered.length / takeNumber),
    },
    data,
  };
};
