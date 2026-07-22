import { Request, Response } from "express";
import prisma from "../models/Prisma.js";
import { deleteImage, getImageUrl, uploadImageBuffer } from "../services/cloudinary.service.js";
import {
    ACTIVE_TURNO_STATES,
    countPendingFixedReservationsForHorarioFecha,
    getArgentinaDate,
    getHorarioCupoUsage,
    resolveSlotHorarioIds,
    selectCurrentSlotHorario
} from "../services/accessRules.service.js";
import { isRetryableTransactionError, runSerializableTransaction } from "../services/transaction.service.js";

const normalizeDayName = (day?: string | null): string => (
    (day || "")
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
);

const dayIndex = (day?: string | null): number | null => {
    switch (normalizeDayName(day)) {
        case "domingo": return 0;
        case "lunes": return 1;
        case "martes": return 2;
        case "miercoles": return 3;
        case "jueves": return 4;
        case "viernes": return 5;
        case "sabado": return 6;
        default: return null;
    }
};

const getWallClockTime = (value: Date | string | null | undefined): { hours: number; minutes: number } => {
    if (!value) return { hours: 0, minutes: 0 };
    const date = value instanceof Date ? value : new Date(value);

    if (!Number.isNaN(date.getTime())) {
        return {
            hours: date.getUTCHours(),
            minutes: date.getUTCMinutes(),
        };
    }

    const [rawHours = "0", rawMinutes = "0"] = String(value).split(":");
    return {
        hours: Number(rawHours),
        minutes: Number(rawMinutes),
    };
};

const getNextTurnoDateForHorario = (horario: any): Date | null => {
    const targetDay = dayIndex(horario?.diaSemana);
    if (targetDay === null) return null;

    const now = getArgentinaDate();
    const { hours, minutes } = getWallClockTime(horario?.horaIni);
    const baseDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hours,
        minutes,
        0,
        0
    ));
    const offset = (targetDay - baseDate.getUTCDay() + 7) % 7;
    baseDate.setUTCDate(baseDate.getUTCDate() + offset);

    if (baseDate <= now) {
        baseDate.setUTCDate(baseDate.getUTCDate() + 7);
    }

    return baseDate;
};

const enrichHorariosWithCupos = async <T extends { HorariosClase?: any[] }>(clase: T): Promise<T> => {
    const horarios = clase.HorariosClase ?? [];

    const enrichedHorarios = await Promise.all(horarios.map(async (horario) => {
        const fechaProximoTurno = getNextTurnoDateForHorario(horario);
        const usage = fechaProximoTurno
            ? await getHorarioCupoUsage(horario.ID_HorarioClase, fechaProximoTurno)
            : { turnosActivos: 0, reservasFijasPendientes: 0, cuposComprometidos: 0 };
        const cuposTotales = Number(horario.cupos ?? 0);

        return {
            ...horario,
            cuposUsados: usage.cuposComprometidos,
            turnosActivos: usage.turnosActivos,
            reservasFijasPendientes: usage.reservasFijasPendientes,
            cuposDisponibles: Math.max(cuposTotales - usage.cuposComprometidos, 0),
            fechaProximoTurno,
        };
    }));

    return {
        ...clase,
        HorariosClase: enrichedHorarios,
    };
};

const getAllClasesAndHorarioClases = async (req: Request, res: Response): Promise<void> => {
    try {
        // Traemos todas las clases con sus horarios y entrenadores
        const clases = await prisma.clase.findMany({
            include: {
                HorariosClase: true,
                Entrenadores: {
                    select: {
                        ID_Usuario: true,
                        email: true,
                        nombre: true,
                        apellido: true,
                        profesion: true,
                        fechaRegistro: true,
                        imagenUsuario: true,
                    }
                },
            },
        });

        // Contar TurnosFijos activos por HorarioClase
        const horarioIds = clases.flatMap(c => c.HorariosClase.map(h => h.ID_HorarioClase));
        const turnosFijosCounts = await prisma.turnoFijo.groupBy({
            by: ['ID_HorarioClase'],
            where: { ID_HorarioClase: { in: horarioIds }, activo: true },
            _count: { ID_HorarioClase: true },
        });
        const countMap = new Map(turnosFijosCounts.map(t => [t.ID_HorarioClase, t._count.ID_HorarioClase]));

        // Adjuntar conteo a cada horario
        for (const clase of clases) {
            for (const h of clase.HorariosClase) {
                (h as any).turnosFijosCount = countMap.get(h.ID_HorarioClase) || 0;
            }
        }

        // Para cada clase, si tiene un public_id en imagenClase,
        // reemplazamos por la URL completa de Cloudinary
        const clasesConUrl = await Promise.all(clases.map(async (clase) => {
            const claseConCupos = await enrichHorariosWithCupos(clase);

            return {
                ...claseConCupos,
                imagenClase: clase.imagenClase
                    ? getImageUrl(clase.imagenClase)
                    : null,
            };
        }));

        res.status(200).json(clasesConUrl);
    } catch (error: any) {
        console.error('Error fetching clases:', error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde' });
    }
};

// Disponibilidad de cupos de un horario para UNA fecha concreta.
// El endpoint de listado (getAllClasesAndHorarioClases) solo calcula la próxima
// ocurrencia; este permite que el front consulte la fecha exacta que el alumno elige,
// para que el número mostrado siempre corresponda al día seleccionado.
const getHorarioCupos = async (req: Request, res: Response): Promise<void> => {
    const idHorario = parseInt(req.params.id, 10);
    const fechaRaw = req.query.fecha;

    if (isNaN(idHorario)) {
        res.status(400).json({ message: 'ID de horario inválido' });
        return;
    }
    if (!fechaRaw || Array.isArray(fechaRaw)) {
        res.status(400).json({ message: 'Falta el parámetro "fecha"' });
        return;
    }

    let fecha: Date;
    try {
        fecha = parseDate(String(fechaRaw));
    } catch {
        res.status(400).json({ message: 'Fecha inválida' });
        return;
    }

    try {
        const horarioSolicitado = await prisma.horarioClase.findUnique({
            where: { ID_HorarioClase: idHorario },
            select: { ID_HorarioClase: true, cupos: true },
        });
        if (!horarioSolicitado) {
            res.status(404).json({ message: 'Horario no encontrado' });
            return;
        }

        const horarioIds = await resolveSlotHorarioIds(idHorario);
        const horariosDelSlot = await prisma.horarioClase.findMany({
            where: { ID_HorarioClase: { in: horarioIds } },
            select: { ID_HorarioClase: true, cupos: true, activo: true },
            orderBy: { ID_HorarioClase: 'desc' },
        });
        const horarioVigente = selectCurrentSlotHorario(horariosDelSlot, horarioSolicitado);
        const usage = await getHorarioCupoUsage(idHorario, fecha);
        const cupos = Number(horarioVigente.cupos ?? 0);

        res.status(200).json({
            ID_HorarioClase: idHorario,
            ID_HorarioClaseVigente: horarioVigente.ID_HorarioClase,
            fecha,
            cupos,
            cuposUsados: usage.cuposComprometidos,
            turnosActivos: usage.turnosActivos,
            reservasFijasPendientes: usage.reservasFijasPendientes,
            cuposDisponibles: Math.max(cupos - usage.cuposComprometidos, 0),
        });
    } catch (error: any) {
        console.error('getHorarioCupos error:', error);
        res.status(500).json({ message: 'Error al calcular cupos del horario' });
    }
};

const getClaseById = async (req: Request, res: Response): Promise<void> => {
    const claseId = parseInt(req.params.id, 10);

    try {
        const clase = await prisma.clase.findUnique({
            where: { ID_Clase: claseId },
            include: {
                HorariosClase: true,
                Entrenadores: {
                    select: {
                        ID_Usuario: true,
                        email: true,
                        nombre: true,
                        apellido: true,
                        profesion: true,
                        fechaRegistro: true,
                        imagenUsuario: true,
                    }
                },
            },
        });

        if (!clase) {
            res.status(404).json({ message: 'Clase no encontrada' });
            return;
        }

        // Transformar la imagen de la clase
        const imagenClaseUrl = clase.imagenClase
            ? getImageUrl(clase.imagenClase)
            : null;

        // Transformar las imágenes de los entrenadores
        const entrenadoresConUrl = clase.Entrenadores.map(entrenador => ({
            ...entrenador,
            imagenUsuario: entrenador.imagenUsuario
                ? getImageUrl(entrenador.imagenUsuario)
                : null
        }));

        // Enviar clase con URLs resueltas
        const claseConCupos = await enrichHorariosWithCupos(clase);

        res.status(200).json({
            ...claseConCupos,
            imagenClase: imagenClaseUrl,
            Entrenadores: entrenadoresConUrl
        });
    } catch (error: any) {
        console.error('Error fetching clase by id:', error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde' });
    }
};

export const createClaseWithHorarios = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nombre, descripcion, horarios: rawHorarios } = req.body;
        let horarios = rawHorarios;
        if (typeof rawHorarios === 'string') {
            try {
                horarios = JSON.parse(rawHorarios);
            } catch {
                res.status(400).json({ message: 'El formato de horarios es inválido' });
                return;
            }
        }

        if (!nombre || !Array.isArray(horarios) || horarios.length === 0) {
            res.status(400).json({ message: 'El nombre y los horarios son obligatorios' });
            return;
        }

        if (horarios.some((h: any) => !isValidCuposValue(Number(h.cupos ?? 0)))) {
            res.status(400).json({ message: CUPOS_INVALIDOS_MESSAGE });
            return;
        }

        // Subida de imagen (si aplica)
        let publicIdImagen: string | null = null;
        if (req.file) {
            const publicId = `class_${Date.now()}`;
            const result = await uploadImageBuffer(req.file.buffer as Buffer, publicId, 'classes');
            publicIdImagen = result.public_id;
        }

        const nuevaClase = await prisma.clase.create({
            data: {
                nombre,
                descripcion: descripcion || null,
                ...(publicIdImagen && { imagenClase: publicIdImagen }),
                HorariosClase: {
                    create: horarios.map((h: any) => ({
                        diaSemana: h.diaSemana,
                        horaIni: parseDate(h.horaIni),
                        horaFin: parseDate(h.horaFin),
                        cupos: Number(h.cupos ?? 0),
                        activo: true,
                    })),
                },
            },
            include: { HorariosClase: true },
        });

        res.status(201).json({ message: 'Clase creada exitosamente', clase: nuevaClase });
    } catch (error: any) {
        console.error('Error creando clase:', error);
        res.status(500).json({ message: 'Error al crear la clase', error: error.message });
    }
};

export const deleteClaseWithHorarios = async (req: Request, res: Response): Promise<void> => {
    try {
        const idClase = parseInt(req.params.id);
        if (!idClase) {
            res.status(400).json({ message: "El ID_Clase es obligatorio" });
            return;
        }

        // Obtener clase para eliminar imagen de Cloudinary si existe
        const clasePrev = await prisma.clase.findUnique({ where: { ID_Clase: idClase } });
        if (clasePrev?.imagenClase) {
            await deleteImage(clasePrev.imagenClase);
        }

        // Eliminar la clase (Prisma manejará cascadas)
        const claseEliminada = await prisma.clase.delete({ where: { ID_Clase: idClase } });

        res.status(200).json({
            message: "Clase eliminada exitosamente junto con sus horarios e imagen",
            clase: claseEliminada,
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({
            message: "Error al eliminar la clase",
            error: error.message,
        });
    }
};


/* -------------------- Helpers -------------------- */
const normalizeDay = (s: any) => String(s ?? '').trim().toLowerCase();

const weekDayNameToIndex = (name: string) => {
    const map: Record<string, number> = {
        domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6,
    };
    return map[String(name).toLowerCase()] ?? 0;
};

// parseDate: ISO sin zona -> tratar como UTC; si tiene Z/offset respetar offset
const parseDate = (val: any): Date => {
    if (val instanceof Date) return val;
    if (typeof val === 'number') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
    }
    if (typeof val !== 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        throw new Error(`Fecha inválida: ${val}`);
    }

    const s = val.trim();
    // ISO sin zona: YYYY-MM-DDTHH:MM(:SS(.sss)?)  -> lo tratamos como UTC
    const isoNoZoneRe = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
    const m = s.match(isoNoZoneRe);
    if (m) {
        const year = Number(m[1]);
        const month = Number(m[2]);
        const day = Number(m[3]);
        const hour = Number(m[4]);
        const minute = Number(m[5]);
        const second = m[6] ? Number(m[6]) : 0;
        const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
        const ts = Date.UTC(year, month - 1, day, hour, minute, second, ms);
        const d = new Date(ts);
        if (!isNaN(d.getTime())) return d;
    }

    // si tiene Z o offset, Date(s) lo interpretará correctamente
    const d2 = new Date(s);
    if (!isNaN(d2.getTime())) return d2;

    throw new Error(`Fecha inválida: ${val}`);
};

// devuelve {h,m,s} en UTC
const timePartsFromDate = (d: Date) => ({ h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds() });

class HorarioCapacityError extends Error {
    statusCode: number;

    constructor(message: string, statusCode = 409) {
        super(message);
        this.name = 'HorarioCapacityError';
        this.statusCode = statusCode;
    }
}

const CUPOS_INVALIDOS_MESSAGE = 'Los cupos deben ser un número entero mayor o igual a 0.';

const isValidCuposValue = (cupos: number): boolean => Number.isInteger(cupos) && cupos >= 0;

const assertValidCuposValue = (cupos: number): void => {
    if (!isValidCuposValue(cupos)) {
        throw new HorarioCapacityError(CUPOS_INVALIDOS_MESSAGE, 400);
    }
};

const formatDateTimeForMessage = (date: Date): string => (
    `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
);

const countActiveFixedTemplatesForHorario = async (tx: any, horarioId: number): Promise<number> => (
    tx.turnoFijo.count({
        where: {
            ID_HorarioClase: horarioId,
            activo: true,
        },
    })
);

const assertFixedTemplatesFitCapacity = async (
    tx: any,
    horarioId: number,
    cupos: number,
): Promise<void> => {
    const fixedCount = await countActiveFixedTemplatesForHorario(tx, horarioId);
    if (fixedCount > cupos) {
        throw new HorarioCapacityError(`No se puede guardar el horario con ${cupos} cupo(s): tiene ${fixedCount} turno(s) fijo(s) asignado(s).`);
    }
};

const assertProjectedHorarioCapacity = async (
    tx: any,
    horarioId: number,
    cupos: number,
    projectedActiveTurnos: Array<{ ID_Usuario: number; fecha: Date }>,
    now: Date,
): Promise<void> => {
    const byDate = new Map<string, { fecha: Date; userIds: number[]; turnosActivos: number }>();

    for (const turno of projectedActiveTurnos) {
        const fecha = new Date(turno.fecha);
        const key = String(fecha.getTime());
        const group = byDate.get(key);
        if (group) {
            group.turnosActivos += 1;
            group.userIds.push(turno.ID_Usuario);
        } else {
            byDate.set(key, {
                fecha,
                userIds: [turno.ID_Usuario],
                turnosActivos: 1,
            });
        }
    }

    for (const group of byDate.values()) {
        const reservasFijasPendientes = group.fecha > now
            ? await countPendingFixedReservationsForHorarioFecha(horarioId, group.fecha, {
                releaseFixedReservationForUserIds: group.userIds,
                client: tx,
            })
            : 0;
        const totalComprometido = group.turnosActivos + reservasFijasPendientes;

        if (totalComprometido > cupos) {
            throw new HorarioCapacityError(
                `No se puede guardar el horario con ${cupos} cupo(s): ${formatDateTimeForMessage(group.fecha)} quedaría con ${totalComprometido} cupo(s) comprometido(s).`
            );
        }
    }
};

const moveTurnosFijosToReplacementHorario = async (
    tx: any,
    oldHorarioId: number,
    newHorarioId: number,
): Promise<number> => {
    const fixedTurnos = await tx.turnoFijo.findMany({
        where: {
            ID_HorarioClase: oldHorarioId,
            activo: true,
        },
        select: {
            ID_TurnoFijo: true,
            ID_Usuario: true,
        },
    });

    if (fixedTurnos.length === 0) return 0;

    const duplicateFixedTurnos = await tx.turnoFijo.findMany({
        where: {
            ID_HorarioClase: newHorarioId,
            ID_Usuario: { in: fixedTurnos.map((fixed: { ID_Usuario: number }) => fixed.ID_Usuario) },
        },
        select: { ID_Usuario: true },
    });
    const duplicateUserIds = new Set(duplicateFixedTurnos.map((fixed: { ID_Usuario: number }) => fixed.ID_Usuario));
    const fixedTurnosToMove = fixedTurnos.filter((fixed: { ID_Usuario: number }) => !duplicateUserIds.has(fixed.ID_Usuario));

    if (fixedTurnosToMove.length === 0) return 0;

    const result = await tx.turnoFijo.updateMany({
        where: {
            ID_TurnoFijo: { in: fixedTurnosToMove.map((fixed: { ID_TurnoFijo: number }) => fixed.ID_TurnoFijo) },
        },
        data: { ID_HorarioClase: newHorarioId },
    });

    return result.count;
};

/* -------------------- Endpoint: modificar un solo HorarioClase --------------------
   RUTA SUGERIDA: POST /horario/:id/modify
   BODY: {
     "updateMode": "instant" | "preserve",
     "diaSemana": "Martes",
     "horaIni": "2025-09-02T20:30:00.000Z",
     "horaFin": "2025-09-02T21:30:00.000Z",
     "cupos": 10
   }
------------------------------------------------------------------------------- */
/* Cantidad de turnos sacados (ACTIVOS futuros) de un HorarioClase.
   Lo usa el front para decidir si pregunta preserve/instant antes de editar. */
export const getTurnosActivosByHorario = async (req: Request, res: Response): Promise<void> => {
    const idHorario = parseInt(req.params.id, 10);
    if (isNaN(idHorario)) {
        res.status(400).json({ message: 'ID de horario inválido' });
        return;
    }
    try {
        // Mismo criterio temporal que usa modifyHorarioSingle (instant mueve fecha >= now)
        const turnosActivos = await prisma.turno.count({
            where: { ID_HorarioClase: idHorario, estado: 'ACTIVO', fecha: { gte: new Date() } },
        });
        res.status(200).json({ idHorario, turnosActivos });
    } catch (error: any) {
        console.error('getTurnosActivosByHorario error:', error);
        res.status(500).json({ message: 'Error al consultar turnos del horario', error: error.message });
    }
};

export const modifyHorarioSingle = async (req: Request, res: Response) => {
    const idHorario = Number(req.params.id);
    const { updateMode = 'instant', diaSemana, horaIni, horaFin, cupos } = req.body;

    if (!idHorario || !['instant', 'preserve'].includes(updateMode)) {
        res.status(400).json({ message: 'Parámetros inválidos' });
        return;
    }

    if (!diaSemana || !horaIni || !horaFin) {
        res.status(400).json({ message: 'Faltan campos obligatorios: diaSemana, horaIni, horaFin' });
        return;
    }

    try {
        const result = await runSerializableTransaction(async (tx) => {
            const existing = await tx.horarioClase.findUnique({ where: { ID_HorarioClase: idHorario } });
            if (!existing) throw new Error(`HorarioClase id=${idHorario} no encontrado`);

            const incomingHoraIni = parseDate(horaIni);
            const incomingHoraFin = parseDate(horaFin);
            const incomingDayNorm = normalizeDay(diaSemana);
            const incomingCupos = Number(cupos ?? existing.cupos);
            assertValidCuposValue(incomingCupos);

            if (updateMode === 'preserve') {
                // preserve: si hay turnos asociados -> crear nuevo y desactivar viejo (preservar turnos)
                const turnosCount = await tx.turno.count({ where: { ID_HorarioClase: idHorario } });

                // si no hubo cambios y no hay turnos, podemos simplemente actualizar existente
                const sameDay = normalizeDay(existing.diaSemana) === incomingDayNorm;
                const existingIniParts = timePartsFromDate(parseDate(existing.horaIni));
                const incomingIniParts = timePartsFromDate(incomingHoraIni);
                const sameTime = existingIniParts.h === incomingIniParts.h && existingIniParts.m === incomingIniParts.m && existingIniParts.s === incomingIniParts.s;
                // También comparar horaFin: un cambio de duración solo modifica el fin.
                const existingFinParts = timePartsFromDate(parseDate(existing.horaFin));
                const incomingFinParts = timePartsFromDate(incomingHoraFin);
                const sameTimeFin = existingFinParts.h === incomingFinParts.h && existingFinParts.m === incomingFinParts.m;
                const sameCupos = Number(existing.cupos ?? 0) === incomingCupos;

                if (!turnosCount) {
                    await assertFixedTemplatesFitCapacity(tx, idHorario, incomingCupos);

                    // no hay turnos -> actualizar directamente el registro
                    const updated = await tx.horarioClase.update({
                        where: { ID_HorarioClase: idHorario },
                        data: {
                            diaSemana,
                            horaIni: incomingHoraIni,
                            horaFin: incomingHoraFin,
                            cupos: incomingCupos,
                            activo: true,
                        },
                    });
                    return { mode: 'preserve', action: 'updated_existing_no_turnos', horario: updated };
                }

                // hay turnos
                // Si el incoming es exactamente igual al existente -> no tiene sentido crear duplicado; devolvemos info
                if (sameDay && sameTime && sameTimeFin && sameCupos) {
                    return { mode: 'preserve', action: 'no_change_existing_with_turnos', message: 'Los valores ingresados son iguales a los del registro existente; no se creó nuevo horario.' };
                }

                await assertFixedTemplatesFitCapacity(tx, idHorario, incomingCupos);

                // crear nuevo y desactivar viejo
                const created = await tx.horarioClase.create({
                    data: {
                        diaSemana,
                        horaIni: incomingHoraIni,
                        horaFin: incomingHoraFin,
                        cupos: incomingCupos,
                        ID_Clase: existing.ID_Clase,
                        activo: true,
                    },
                });

                await tx.horarioClase.update({ where: { ID_HorarioClase: existing.ID_HorarioClase }, data: { activo: false } });
                const turnosFijosMovidos = await moveTurnosFijosToReplacementHorario(tx, existing.ID_HorarioClase, created.ID_HorarioClase);

                // Los turnos ya sacados permanecen en el horario viejo; la plantilla fija pasa al horario vigente.
                return {
                    mode: 'preserve',
                    action: 'created_new_and_disabled_old',
                    created,
                    disabledOldId: existing.ID_HorarioClase,
                    turnosFijosMovidos,
                };
            } else {
                // calcular baseDeltaDays respecto a hoy (UTC)
                const targetWeekIndex = weekDayNameToIndex(diaSemana);
                const timeParts = timePartsFromDate(incomingHoraIni);
                const todayUtc = getArgentinaDate();
                const todayWeekday = todayUtc.getUTCDay();
                let baseDeltaDays = (targetWeekIndex - todayWeekday + 7) % 7;

                if (baseDeltaDays === 0) {
                    const nowTotal = todayUtc.getUTCHours() * 3600 + todayUtc.getUTCMinutes() * 60 + todayUtc.getUTCSeconds();
                    const newTotal = timeParts.h * 3600 + timeParts.m * 60 + timeParts.s;
                    if (newTotal < nowTotal) baseDeltaDays = 7;
                }

                const newDateUtc = new Date(Date.UTC(
                    todayUtc.getUTCFullYear(),
                    todayUtc.getUTCMonth(),
                    todayUtc.getUTCDate() + baseDeltaDays,
                    timeParts.h,
                    timeParts.m,
                    timeParts.s,
                    0
                ));

                const futuros = await tx.turno.findMany({
                    where: { ID_HorarioClase: idHorario, fecha: { gte: todayUtc } },
                    select: {
                        id_turno: true,
                        ID_Usuario: true,
                        fecha: true,
                        estado: true,
                    },
                });
                const futurosIds = new Set(futuros.map(ft => ft.id_turno));
                const activeTurnos = await tx.turno.findMany({
                    where: {
                        ID_HorarioClase: idHorario,
                        estado: { in: ACTIVE_TURNO_STATES },
                    },
                    select: {
                        id_turno: true,
                        ID_Usuario: true,
                        fecha: true,
                    },
                });
                const projectedActiveTurnos = activeTurnos.map(turno => ({
                    ID_Usuario: turno.ID_Usuario,
                    fecha: futurosIds.has(turno.id_turno) ? newDateUtc : turno.fecha,
                }));

                await assertFixedTemplatesFitCapacity(tx, idHorario, incomingCupos);
                await assertProjectedHorarioCapacity(tx, idHorario, incomingCupos, projectedActiveTurnos, todayUtc);

                // instant: actualizar el horario y mover turnos futuros al próximo día objetivo respecto a HOY (UTC)
                const updatedHorario = await tx.horarioClase.update({
                    where: { ID_HorarioClase: idHorario },
                    data: {
                        diaSemana,
                        horaIni: incomingHoraIni,
                        horaFin: incomingHoraFin,
                        cupos: incomingCupos,
                        activo: true,
                    },
                });

                if (futuros.length === 0) {
                    return { mode: 'instant', action: 'updated_horario_no_future_turnos', horario: updatedHorario, updatedTurnos: 0 };
                }

                // actualizamos todos los turnos futuros al día calculado (el mismo para todos)
                const updatedTurnosPromises = futuros.map(ft => (
                    tx.turno.update({ where: { id_turno: ft.id_turno }, data: { fecha: newDateUtc } })
                ));
                const updatedTurnos = await Promise.all(updatedTurnosPromises);

                return { mode: 'instant', action: 'updated_horario_and_future_turnos', horario: updatedHorario, updatedTurnosCount: updatedTurnos.length };
            }
        }); // end transaction

        res.status(200).json({ ok: true, result });
    } catch (error: any) {
        console.error('modifyHorarioSingle error:', error);
        if (isRetryableTransactionError(error)) {
            res.status(409).json({ ok: false, message: 'El horario está siendo modificado por otra operación. Intentá nuevamente.' });
            return;
        }
        const status = error instanceof HorarioCapacityError ? error.statusCode : 500;
        res.status(status).json({
            ok: false,
            message: status === 500 ? 'Error al modificar horario' : error.message,
            error: error.message,
        });
    }
};

export const deleteHorarioSingle = async (req: Request, res: Response): Promise<void> => {
    const idHorario = parseInt(req.params.id, 10);

    if (isNaN(idHorario)) {
        res.status(400).json({ message: 'ID de horario inválido' });
        return;
    }

    try {
        // Verificar si existe
        const existing = await prisma.horarioClase.findUnique({ where: { ID_HorarioClase: idHorario } });
        if (!existing) {
            res.status(404).json({ message: `HorarioClase con ID ${idHorario} no encontrado` });
            return;
        }

        // Eliminar (Prisma manejará cascades a Turnos)
        await prisma.horarioClase.delete({ where: { ID_HorarioClase: idHorario } });

        res.status(200).json({
            message: `HorarioClase con ID ${idHorario} eliminado exitosamente. Nota: Los turnos asociados también se han eliminado debido a la configuración de cascade.`,
        });
    } catch (error: any) {
        console.error('Error al eliminar horario:', error);
        if (error.code === 'P2025') { // Prisma error: registro no encontrado (race condition)
            res.status(404).json({ message: 'HorarioClase no encontrado' });
        } else {
            res.status(500).json({ message: 'Error al eliminar el horario', error: error.message });
        }
    }
};

export const createHorarioSingle = async (req: Request, res: Response): Promise<void> => {
    const idClase = parseInt(req.params.idClase, 10);
    const { diaSemana, horaIni, horaFin, cupos } = req.body;

    if (isNaN(idClase)) {
        res.status(400).json({ message: 'ID de clase inválido' });
        return;
    }

    if (!diaSemana || !horaIni || !horaFin) {
        res.status(400).json({ message: 'Faltan campos obligatorios: diaSemana, horaIni, horaFin' });
        return;
    }

    try {
        // Verificar si la clase existe
        const claseExists = await prisma.clase.findUnique({ where: { ID_Clase: idClase } });
        if (!claseExists) {
            res.status(404).json({ message: `Clase con ID ${idClase} no encontrada` });
            return;
        }

        const incomingHoraIni = parseDate(horaIni); // Usa tu helper parseDate
        const incomingHoraFin = parseDate(horaFin);
        const incomingDayNorm = normalizeDay(diaSemana); // Usa tu helper normalizeDay
        const incomingCupos = Number(cupos ?? 0);

        if (!isValidCuposValue(incomingCupos)) {
            res.status(400).json({ message: CUPOS_INVALIDOS_MESSAGE });
            return;
        }

        // Validar no duplicado: buscar si ya existe un horario activo con mismo día y horaIni
        const duplicado = await prisma.horarioClase.findFirst({
            where: {
                ID_Clase: idClase,
                activo: true,
                diaSemana: { equals: diaSemana }, // Case-insensitive
                horaIni: incomingHoraIni,
            },
        });

        if (duplicado) {
            res.status(409).json({
                message: `Ya existe un horario activo en la misma clase para ${diaSemana} a las ${horaIni.split('T')[1].slice(0, 5)}`,
            });
            return;
        }

        // Crear el nuevo horario
        const nuevoHorario = await prisma.horarioClase.create({
            data: {
                diaSemana,
                horaIni: incomingHoraIni,
                horaFin: incomingHoraFin,
                cupos: incomingCupos,
                ID_Clase: idClase,
                activo: true,
            },
        });

        res.status(201).json({
            message: 'Nuevo horario creado exitosamente',
            horario: nuevoHorario,
        });
    } catch (error: any) {
        console.error('Error al crear horario:', error);
        res.status(500).json({ message: 'Error al crear el horario', error: error.message });
    }
};

/* -------------------- Endpoint: actualizar solo campos de la clase --------------------
   RUTA SUGERIDA: PUT /clase/:id
   BODY: multipart/form-data (opcional file) o JSON { nombre, descripcion }
   NO toca horarios.
------------------------------------------------------------------------------- */
export const updateClaseFields = async (req: Request, res: Response) => {
    const idClase = Number(req.params.id);
    const { nombre, descripcion, horarios } = req.body;
    const file = req.file;

    if (!idClase) {
        res.status(400).json({ message: 'ID de clase faltante' });
        return;
    }

    if (!nombre && !descripcion && !file && !horarios) {
        res.status(400).json({ message: 'Nada para actualizar' });
        return;
    }

    // Helpers usados aquí (si ya los tenés definidos en el archivo, sáltalos o elimina duplicados)
    const normalizeDay = (s: any) => String(s ?? '').trim().toLowerCase();
    const parseDateLocal = (val: any): Date => {
        // Usa tu parseDate existente si la tienes; este es equivalente (ISO sin zona -> UTC)
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d;
        }
        if (typeof val !== 'string') {
            const d = new Date(val);
            if (!isNaN(d.getTime())) return d;
            throw new Error(`Fecha inválida: ${val}`);
        }
        const s = val.trim();
        const isoNoZoneRe = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
        const m = s.match(isoNoZoneRe);
        if (m) {
            const year = Number(m[1]);
            const month = Number(m[2]);
            const day = Number(m[3]);
            const hour = Number(m[4]);
            const minute = Number(m[5]);
            const second = m[6] ? Number(m[6]) : 0;
            const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0;
            const ts = Date.UTC(year, month - 1, day, hour, minute, second, ms);
            const d = new Date(ts);
            if (!isNaN(d.getTime())) return d;
        }
        const d2 = new Date(s);
        if (!isNaN(d2.getTime())) return d2;
        throw new Error(`Fecha inválida: ${val}`);
    };
    const timeKeyFrom = (value: Date | string) => {
        const d = (typeof value === 'string') ? parseDateLocal(value) : value;
        if (!(d instanceof Date) || isNaN(d.getTime())) return 'invalid';
        const h = String(d.getUTCHours()).padStart(2, '0');
        const m = String(d.getUTCMinutes()).padStart(2, '0');
        const s = String(d.getUTCSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    try {
        // Validaciones y creación de horarios (si vienen)
        let updatedClase: any = null;

        await prisma.$transaction(async (tx) => {
            // 1) Actualizar nombre/descripcion si vienen
            const dataToUpdate: any = {};
            if (nombre) dataToUpdate.nombre = nombre;
            if (descripcion) dataToUpdate.descripcion = descripcion;

            if (Object.keys(dataToUpdate).length > 0) {
                updatedClase = await tx.clase.update({ where: { ID_Clase: idClase }, data: dataToUpdate });
            } else {
                // obtener el registro actual para manejar imagen si sólo viene file/horarios
                updatedClase = await tx.clase.findUnique({ where: { ID_Clase: idClase } });
            }

            // 2) Si enviaron 'horarios', los procesamos como SÓLO nuevos (sin ID)
            if (horarios !== undefined) {
                let parsedHorarios;
                if (typeof horarios === 'string') {
                    try { parsedHorarios = JSON.parse(horarios); }
                    catch { throw new Error('Formato de horarios inválido (JSON)'); }
                } else {
                    parsedHorarios = horarios;
                }

                if (!Array.isArray(parsedHorarios)) {
                    throw new Error('El campo "horarios" debe ser un array');
                }

                // Si algún objeto trae ID_HorarioClase, rechazamos (usar otro endpoint para editar)
                const hasId = parsedHorarios.some((h: any) => typeof h.ID_HorarioClase !== 'undefined' && h.ID_HorarioClase !== null);
                if (hasId) {
                    throw new Error('No enviar ID_HorarioClase en este endpoint. Usar /horario/:id/modify para editar horarios existentes.');
                }

                // obtener horarios existentes activos para la clase (para evitar duplicados)
                const existentes = await tx.horarioClase.findMany({ where: { ID_Clase: idClase, activo: true } });

                const createdKeys = new Set<string>();
                const createdHorarios: any[] = [];

                for (const h of parsedHorarios) {
                    if (!h.diaSemana || !h.horaIni || !h.horaFin) {
                        // salto inválidos (podrías decidir lanzar error en su lugar)
                        continue;
                    }

                    // parseo
                    const incomingHoraIni = parseDateLocal(h.horaIni);
                    const incomingHoraFin = parseDateLocal(h.horaFin);
                    const incomingDay = normalizeDay(h.diaSemana);
                    const cuposNum = Number(h.cupos ?? 0);

                    if (!isValidCuposValue(cuposNum)) {
                        throw new Error(CUPOS_INVALIDOS_MESSAGE);
                    }

                    const incKey = `${incomingDay}-${timeKeyFrom(incomingHoraIni)}`;
                    if (createdKeys.has(incKey)) continue; // ya creado en este payload

                    // buscar match en existentes activos (mismo dia + misma hora inicio)
                    const match = existentes.find(e => {
                        if (!e.activo) return false;
                        if (normalizeDay(e.diaSemana) !== incomingDay) return false;
                        const eKey = timeKeyFrom(e.horaIni);
                        return eKey === timeKeyFrom(incomingHoraIni);
                    });

                    if (match) {
                        // ya existe uno activo idéntico -> NO crear (evitamos duplicado)
                        continue;
                    }

                    // crear nuevo horario
                    const created = await tx.horarioClase.create({
                        data: {
                            diaSemana: h.diaSemana,
                            horaIni: incomingHoraIni,
                            horaFin: incomingHoraFin,
                            cupos: cuposNum,
                            ID_Clase: idClase,
                            activo: true,
                        }
                    });

                    createdKeys.add(incKey);
                    createdHorarios.push(created);

                    // mantener 'existentes' actualizado para evitar duplicados con siguientes items
                    existentes.push(created);
                }

                // si creamos alguno, actualizamos la variable updatedClase local para luego devolver
                if (createdHorarios.length > 0) {
                    // si updatedClase fue creado/actualizado antes en tx, lo sobreescribimos con la última versión
                    updatedClase = await tx.clase.findUnique({ where: { ID_Clase: idClase }, include: { HorariosClase: true } });
                }
            } // end if horarios
        }); // end transaction

        // manejar imagen fuera de la transacción (subida/eliminación)
        if (file) {
            const clasePrev = await prisma.clase.findUnique({ where: { ID_Clase: idClase } });
            if (clasePrev?.imagenClase) {
                await deleteImage(clasePrev.imagenClase);
            }
            const publicId = `clase_${idClase}_${Date.now()}`;
            const uploadRes = await uploadImageBuffer(file.buffer as Buffer, publicId, 'classes');
            updatedClase = await prisma.clase.update({ where: { ID_Clase: idClase }, data: { imagenClase: uploadRes.public_id }, include: { HorariosClase: true } });
        }

        // si no actualizó nada dentro de tx y no había file ni horarios, obtener la clase final
        if (!updatedClase) {
            updatedClase = await prisma.clase.findUnique({ where: { ID_Clase: idClase }, include: { HorariosClase: true } });
        } else {
            // si updatedClase existe pero no trae HorariosClase (cuando actualizamos solo nombre/desc), fetch con include para consistencia en la respuesta
            if (!updatedClase.HorariosClase) {
                updatedClase = await prisma.clase.findUnique({ where: { ID_Clase: idClase }, include: { HorariosClase: true } });
            }
        }

        res.status(200).json({ ok: true, clase: updatedClase });
    } catch (error: any) {
        console.error('updateClaseFields error:', error);
        res.status(400).json({ ok: false, message: error.message ?? 'Error al actualizar clase' });
    }
};

const asignarEntrenadorAClase = async (req: Request, res: Response): Promise<void> => {
    try {
        const idClase = parseInt(req.params.idClase, 10);
        const idEntrenador = parseInt(req.params.idEntrenador, 10);

        // Validar IDs
        if (isNaN(idClase) || isNaN(idEntrenador)) {
            res.status(400).json({ message: "IDs inválidos" });
            return;
        }

        // Verificar que la clase exista
        const clase = await prisma.clase.findUnique({ where: { ID_Clase: idClase } });
        if (!clase) {
            res.status(404).json({ message: "Clase no encontrada" });
            return;
        }

        // Verificar que el usuario exista y sea un entrenador
        // (Aquí asumimos que `tipo` o algún campo indica si es entrenador)
        const entrenador = await prisma.user.findUnique({ where: { ID_Usuario: idEntrenador } });
        if (!entrenador) {
            res.status(404).json({ message: "Entrenador no encontrado" });
            return;
        }

        // Conectar la clase con el entrenador
        const claseActualizada = await prisma.clase.update({
            where: { ID_Clase: idClase },
            data: {
                Entrenadores: {
                    connect: { ID_Usuario: idEntrenador },
                },
            },
            include: {
                Entrenadores: true, // Para ver los entrenadores asignados tras la conexión
            },
        });

        res.status(200).json({
            message: `El entrenador ${idEntrenador} ha sido asignado a la clase ${idClase}`,
            clase: claseActualizada,
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Error asignando entrenador a la clase", error: error.message });
    }
};

const removeEntrenadorFromClase = async (req: Request, res: Response): Promise<void> => {
    try {
        const idClase = parseInt(req.params.idClase, 10);
        const idEntrenador = parseInt(req.params.idEntrenador, 10);

        // Validar IDs
        if (isNaN(idClase) || isNaN(idEntrenador)) {
            res.status(400).json({ message: "IDs inválidos" });
            return;
        }

        // Verificar que la clase exista
        const clase = await prisma.clase.findUnique({ where: { ID_Clase: idClase } });
        if (!clase) {
            res.status(404).json({ message: "Clase no encontrada" });
            return;
        }

        // Verificar que el usuario exista
        const entrenador = await prisma.user.findUnique({ where: { ID_Usuario: idEntrenador } });
        if (!entrenador) {
            res.status(404).json({ message: "Entrenador no encontrado" });
            return;
        }

        // Desconectar la clase del entrenador en la relación muchos a muchos
        const claseActualizada = await prisma.clase.update({
            where: { ID_Clase: idClase },
            data: {
                Entrenadores: {
                    disconnect: { ID_Usuario: idEntrenador },
                },
            },
            include: {
                Entrenadores: true, // Para ver los entrenadores restantes en la clase
            },
        });

        res.status(200).json({
            message: `El entrenador ${idEntrenador} ha sido removido de la clase ${idClase}`,
            clase: claseActualizada,
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Error removiendo el entrenador de la clase", error: error.message });
    }
};

export const claseMethods = {
    getClaseById,
    createClaseWithHorarios,
    updateClaseFields,
    modifyHorarioSingle,
    getTurnosActivosByHorario,
    getHorarioCupos,
    deleteClaseWithHorarios,
    getAllClasesAndHorarioClases,
    asignarEntrenadorAClase,
    removeEntrenadorFromClase,
    createHorarioSingle,
    deleteHorarioSingle,
};
