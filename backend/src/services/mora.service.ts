import { Prisma, Cuota } from "@prisma/client";
import prisma from "../models/Prisma.js";

export const MORA_CONFIG_ID = 1;
export const MORA_SCOPE = {
  FUTURAS: "FUTURAS",
  TODAS_VENCIDAS: "TODAS_VENCIDAS",
} as const;

const TIMEZONE = process.env.TIMEZONE || "America/Argentina/Cordoba";
const DAY_MS = 86_400_000;

type MoraCuota = Pick<Cuota,
  "ID_Cuota" | "importe" | "vence" | "pagada" | "fechaPago" |
  "moraTasaDiariaBase" | "moraTasaDiariaOverride" | "moraFechaInicio" |
  "interesMoraPagado" | "totalPagado" | "diasMoraAlPagar" | "tasaMoraAplicadaPago"
>;

type PrismaLike = Prisma.TransactionClient | typeof prisma;

const dayParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
};

const dayNumber = (date: Date): number => {
  const { year, month, day } = dayParts(date);
  return Date.UTC(year, month - 1, day) / DAY_MS;
};

export const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const getMoraDays = (vence: Date, calculationDate = new Date()): number =>
  Math.max(0, dayNumber(calculationDate) - dayNumber(vence));

export const getMoraStart = (vence: Date): Date => {
  const { year, month, day } = dayParts(vence);
  // Argentina usa UTC-3: 03:00Z representa el inicio del día calendario local.
  return new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0, 0));
};

export const calculateMora = ({
  importe,
  vence,
  tasaDiaria,
  calculationDate = new Date(),
}: {
  importe: number;
  vence: Date;
  tasaDiaria: number;
  calculationDate?: Date;
}) => {
  const dias = getMoraDays(vence, calculationDate);
  const interes = roundMoney(Number(importe) * (Number(tasaDiaria) / 100) * dias);
  return {
    dias,
    interes,
    total: roundMoney(Number(importe) + interes),
  };
};

export const validateMoraRate = (value: unknown): number | null => {
  const text = String(value ?? "").trim();
  if (!/^\d+(?:\.\d{1,4})?$/.test(text)) return null;
  const rate = Number(text);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : null;
};

export const getMoraConfig = async (client: PrismaLike = prisma) =>
  client.moraConfiguracion.upsert({
    where: { id: MORA_CONFIG_ID },
    create: { id: MORA_CONFIG_ID, tasaDiaria: 0 },
    update: {},
  });

export const getHistoricalGlobalRate = async (
  moraStart: Date,
  client: PrismaLike = prisma,
): Promise<number> => {
  const change = await client.moraHistorial.findFirst({
    where: { tipo: "CONFIG_GLOBAL", fecha: { lte: moraStart } },
    orderBy: { fecha: "desc" },
    select: { tasaNueva: true },
  });
  return Number(change?.tasaNueva ?? 0);
};

export const ensureCuotaMoraAssigned = async <T extends MoraCuota>(
  cuota: T,
  client: PrismaLike = prisma,
  calculationDate = new Date(),
): Promise<T> => {
  if (cuota.pagada || getMoraDays(cuota.vence, calculationDate) === 0 || cuota.moraFechaInicio) {
    return cuota;
  }
  const moraFechaInicio = getMoraStart(cuota.vence);
  const moraTasaDiariaBase = await getHistoricalGlobalRate(moraFechaInicio, client);
  const updated = await client.cuota.update({
    where: { ID_Cuota: cuota.ID_Cuota },
    data: { moraFechaInicio, moraTasaDiariaBase, vencida: true },
  });
  return { ...cuota, ...updated } as T;
};

export const buildMoraView = (cuota: MoraCuota, calculationDate = new Date()) => {
  if (cuota.pagada) {
    const tasa = Number(cuota.tasaMoraAplicadaPago ?? 0);
    const interes = Number(cuota.interesMoraPagado ?? 0);
    return {
      aplica: interes > 0 || Number(cuota.diasMoraAlPagar ?? 0) > 0,
      tasaDiaria: tasa,
      dias: Number(cuota.diasMoraAlPagar ?? 0),
      interes,
      total: Number(cuota.totalPagado ?? cuota.importe),
      fechaInicio: cuota.moraFechaInicio,
      esExcepcion: cuota.moraTasaDiariaOverride !== null,
      estadoTasa: cuota.moraTasaDiariaOverride === 0
        ? "EXENTA"
        : cuota.moraTasaDiariaOverride !== null ? "PERSONALIZADA" : tasa > 0 ? "GLOBAL" : "SIN_INTERES",
      calculadoAl: cuota.fechaPago,
      congelado: true,
    };
  }

  const tasa = Number(cuota.moraTasaDiariaOverride ?? cuota.moraTasaDiariaBase ?? 0);
  const calculated = calculateMora({ importe: cuota.importe, vence: cuota.vence, tasaDiaria: tasa, calculationDate });
  return {
    aplica: calculated.dias > 0,
    tasaDiaria: tasa,
    ...calculated,
    fechaInicio: calculated.dias > 0 ? (cuota.moraFechaInicio ?? getMoraStart(cuota.vence)) : null,
    esExcepcion: cuota.moraTasaDiariaOverride !== null,
    estadoTasa: cuota.moraTasaDiariaOverride === 0
      ? "EXENTA"
      : cuota.moraTasaDiariaOverride !== null ? "PERSONALIZADA" : tasa > 0 ? "GLOBAL" : "SIN_INTERES",
    calculadoAl: calculationDate,
    congelado: false,
  };
};

export const enrichCuotasWithMora = async <T extends MoraCuota>(cuotas: T[]): Promise<Array<T & { mora: ReturnType<typeof buildMoraView> }>> => {
  const now = new Date();
  const result = [];
  for (const original of cuotas) {
    const cuota = await ensureCuotaMoraAssigned(original, prisma, now) as T;
    result.push({ ...cuota, mora: buildMoraView(cuota, now) });
  }
  return result;
};

export const syncOverdueCuotas = async (calculationDate = new Date()): Promise<number> => {
  const impagas = await prisma.cuota.findMany({ where: { pagada: false } });
  const cuotas = impagas.filter(cuota => getMoraDays(cuota.vence, calculationDate) > 0 && !cuota.moraFechaInicio);
  for (const cuota of cuotas) {
    await ensureCuotaMoraAssigned(cuota, prisma, calculationDate);
  }
  const overdueIds = impagas.filter(c => getMoraDays(c.vence, calculationDate) > 0).map(c => c.ID_Cuota);
  const currentIds = impagas.filter(c => getMoraDays(c.vence, calculationDate) === 0 && c.vencida).map(c => c.ID_Cuota);
  if (overdueIds.length) await prisma.cuota.updateMany({ where: { ID_Cuota: { in: overdueIds } }, data: { vencida: true } });
  if (currentIds.length) await prisma.cuota.updateMany({ where: { ID_Cuota: { in: currentIds } }, data: { vencida: false } });
  return cuotas.length;
};
