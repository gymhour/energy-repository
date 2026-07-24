import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Request, Response } from "express";
import prisma from "../models/Prisma.js";
import { ROLES } from "../services/auth.service.js";
import { deleteImage, getImageUrl, uploadImageBuffer } from "../services/cloudinary.service.js";
import { sendWelcomeEmail } from "../services/email.service.js";
import { hashPassword } from "../services/password.service.js";

// Parsea la fecha de cumpleaños del import masivo. Acepta DD/MM/AAAA (formato del Excel) e ISO AAAA-MM-DD.
// Devuelve { date } (mediodía UTC para evitar drift de día), { date: null } si viene vacío, o { error }.
const parseFechaImport = (value: unknown): { date: Date | null } | { error: string } => {
    const raw = String(value ?? '').trim();
    if (!raw) return { date: null };

    let y: number, mo: number, d: number;
    let m: RegExpMatchArray | null;
    if ((m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
        // DD/MM/AAAA
        d = Number(m[1]); mo = Number(m[2]); y = Number(m[3]);
    } else if ((m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
        // AAAA-MM-DD (ISO)
        y = Number(m[1]); mo = Number(m[2]); d = Number(m[3]);
    } else {
        return { error: 'Formato inválido. Usá DD/MM/AAAA (ej: 15/10/1999)' };
    }

    if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) {
        return { error: 'Fecha fuera de rango. Usá DD/MM/AAAA (ej: 15/10/1999)' };
    }
    const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
    // Verifica que la fecha exista realmente (rechaza 31/02, 30/02, etc.)
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
        return { error: 'Fecha inexistente. Usá DD/MM/AAAA (ej: 15/10/1999)' };
    }
    return { date };
};

const parseImportPlanId = (value: unknown): { planId: number | null } | { error: string } => {
    const raw = String(value ?? '').trim();
    if (!raw) return { planId: null };

    const planId = Number(raw);
    if (!Number.isInteger(planId) || planId < 1) {
        return { error: 'ID_Plan debe ser un entero positivo' };
    }
    return { planId };
};

const IMPORT_USERS_BATCH_SIZE = 100;

const chunkArray = <T>(items: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

// Motivos de baja (whitelist). El front muestra el desplegable; el backend valida.
const MOTIVOS_BAJA = [
    'Falta de pago / cobranza',
    'Motivos económicos',
    'Falta de tiempo',
    'Mudanza',
    'Lesión o problema de salud',
    'Insatisfacción (servicio/instalaciones)',
    'Se cambió a otro gimnasio',
    'Objetivo cumplido',
    'Desmotivación',
    'Otros / Sin motivo',
] as const;
const MOTIVO_BAJA_DEFAULT = 'Otros / Sin motivo';

// Motivos de alta / reactivación (whitelist). Mismo criterio que MOTIVOS_BAJA.
const MOTIVOS_ALTA = [
    'Buenas instalaciones',
    'Precio competitivo / promoción',
    'Buena atención',
    'Cercanía / ubicación',
    'Recomendación de un conocido',
    'Redes sociales / publicidad',
    'Variedad de clases y horarios',
    'Calidad de los entrenadores',
    'Recomendación médica / salud',
    'Otro / Sin motivo',
] as const;
const MOTIVO_ALTA_DEFAULT = 'Otro / Sin motivo';

const parseMotivoAlta = (value: unknown): string | null => (
    typeof value === 'string' && (MOTIVOS_ALTA as readonly string[]).includes(value) ? value : null
);

// ---------------------------------------------------------------------------
// Guardas de escalada de privilegios para los roles que no son admin.
// Recepción comparte casi toda el área administrativa con el admin, así que sin
// estas guardas podría crearse (o convertirse en) un usuario admin y ver las
// finanzas del negocio que justamente le estamos ocultando. El entrenador da de
// alta socios, y nada más.
// El admin no figura acá: no tiene restricciones.
// ---------------------------------------------------------------------------
const TIPOS_ASIGNABLES: Record<string, string[]> = {
    [ROLES.RECEPCION]: [ROLES.CLIENTE, ROLES.ENTRENADOR],
    [ROLES.ENTRENADOR]: [ROLES.CLIENTE],
};

const normalizarTipo = (value: unknown): string => String(value ?? '').trim().toLowerCase();

// El valor del rol va sin tilde (matchea el JWT); estas son las etiquetas para mostrar.
const ETIQUETA_ROL: Record<string, string> = { [ROLES.RECEPCION]: 'recepción' };

const errorTipoNoPermitido = (rol: string, permitidos: string[]): string => (
    `Acceso denegado: ${ETIQUETA_ROL[rol] ?? rol} sólo puede asignar ${permitidos.length > 1 ? 'los tipos' : 'el tipo'} ${permitidos.join(' o ')}`
);

/**
 * Valida que `requester` pueda asignar el tipo `tipoDestino` en una actualización.
 * Un tipo vacío significa "no se cambia", así que se permite.
 * Devuelve un mensaje de error si no puede, o null si está permitido.
 */
const validarTipoAsignable = (requesterTipo: unknown, tipoDestino: unknown): string | null => {
    const rol = normalizarTipo(requesterTipo);
    const permitidos = TIPOS_ASIGNABLES[rol];
    if (!permitidos) return null;

    const destino = normalizarTipo(tipoDestino);
    if (!destino) return null; // no viene en el body: no se cambia el tipo

    return permitidos.includes(destino) ? null : errorTipoNoPermitido(rol, permitidos);
};

/**
 * Igual que validarTipoAsignable pero para el alta: el tipo es obligatorio, así
 * que omitirlo no puede usarse para crear un usuario sin rol definido.
 */
const validarTipoAlCrear = (requesterTipo: unknown, tipoDestino: unknown): string | null => {
    const rol = normalizarTipo(requesterTipo);
    const permitidos = TIPOS_ASIGNABLES[rol];
    if (!permitidos) return null;

    return permitidos.includes(normalizarTipo(tipoDestino))
        ? null
        : errorTipoNoPermitido(rol, permitidos);
};

/**
 * Valida que `requester` pueda modificar/eliminar al usuario destino.
 * Nadie fuera del admin puede tocar cuentas de admin (si no, recepción o un
 * entrenador podrían cambiarle el email y la contraseña a un admin y quedarse
 * con esa cuenta).
 */
const validarUsuarioModificable = (requesterTipo: unknown, tipoUsuarioDestino: unknown): string | null => {
    const rol = normalizarTipo(requesterTipo);
    if (rol === ROLES.ADMIN || !TIPOS_ASIGNABLES[rol]) return null;
    if (normalizarTipo(tipoUsuarioDestino) === ROLES.ADMIN) {
        return `Acceso denegado: ${ETIQUETA_ROL[rol] ?? rol} no puede modificar cuentas de administrador`;
    }
    return null;
};

const parseMonthRangeUTC = (value: unknown): { gte: Date; lt: Date } | null => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isInteger(year) || month < 1 || month > 12) return null;

    return {
        gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
        lt: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    };
};

type UsuarioReturn = {
    ID_Usuario: number;
    email: string;
    dni: string | null;
    nombre: string | null;
    apellido: string | null;
    direc: string | null;
    tel: string | null;
    profesion: string | null;
    tipo: string | null;
    fechaCumple: Date | null;
    estado: boolean | null;
    imagenUsuario: string | null;
    observacionesSalud: string | null;
    fichaMedicaUrl: string | null;
    fechaRegistro: Date;
    usaTurnosFijos: boolean;
    plan: {
        ID_Plan: number;
        nombre: string;
        precio: number;
    } | null;
};

const parseBoolean = (value: unknown): boolean => (
    value === true || value === 'true' || value === '1' || value === 1
);

const parseTurnosFijosIds = (value: unknown): number[] => {
    if (!value) return [];
    const raw = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item: any) => Number(item?.ID_HorarioClase ?? item))
        .filter((id: number) => Number.isInteger(id) && id > 0);
};

const normalizeOptionalText = (value: unknown): string | null => {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
};

const normalizeSearchText = (value: unknown): string => (
    String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
);

const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array(b.length + 1).fill(0);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }
        previous.splice(0, previous.length, ...current);
    }

    return previous[b.length];
};

const maxFuzzyDistance = (term: string): number => {
    if (term.length <= 3) return 0;
    if (term.length <= 5) return 1;
    if (term.length <= 9) return 2;
    return 3;
};

const tokenMatches = (valueToken: string, queryToken: string): boolean => (
    valueToken.includes(queryToken) ||
    queryToken.includes(valueToken) ||
    levenshteinDistance(valueToken, queryToken) <= maxFuzzyDistance(queryToken)
);

const approximateTextMatch = (value: unknown, query: unknown): boolean => {
    const normalizedValue = normalizeSearchText(value);
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return true;
    if (!normalizedValue) return false;
    if (normalizedValue.includes(normalizedQuery)) return true;

    const compactValue = normalizedValue.replace(/\s/g, '');
    const compactQuery = normalizedQuery.replace(/\s/g, '');
    if (compactValue.includes(compactQuery)) return true;

    const valueTokens = normalizedValue.split(' ').filter(Boolean);
    const queryTokens = normalizedQuery.split(' ').filter(Boolean);

    return queryTokens.every(queryToken =>
        valueTokens.some(valueToken => tokenMatches(valueToken, queryToken)) ||
        tokenMatches(compactValue, queryToken)
    );
};

// No se permiten dos turnos fijos en el mismo día de la semana.
const assertNoDuplicateFixedDays = async (horarioIds: number[]): Promise<string | null> => {
    if (horarioIds.length < 2) return null;
    const horarios = await prisma.horarioClase.findMany({
        where: { ID_HorarioClase: { in: horarioIds } },
        select: { diaSemana: true },
    });
    const seen = new Set<string>();
    for (const h of horarios) {
        const dia = String(h.diaSemana).trim().toLowerCase();
        if (seen.has(dia)) return "No se pueden asignar dos turnos fijos el mismo día.";
        seen.add(dia);
    }
    return null;
};

const formatHorarioHora = (value: Date): string => (
    value.toISOString().slice(11, 16)
);

const assertFixedSchedulesHaveCapacity = async (
    horarioIds: number[],
    excludeUsuarioId?: number
): Promise<string | null> => {
    const uniqueHorarioIds = Array.from(new Set(horarioIds));
    if (uniqueHorarioIds.length === 0) return null;

    const horarios = await prisma.horarioClase.findMany({
        where: { ID_HorarioClase: { in: uniqueHorarioIds } },
        select: {
            ID_HorarioClase: true,
            diaSemana: true,
            horaIni: true,
            cupos: true,
            Clase: { select: { nombre: true } },
        },
    });

    const fixedCounts = await prisma.turnoFijo.groupBy({
        by: ['ID_HorarioClase'],
        where: {
            ID_HorarioClase: { in: uniqueHorarioIds },
            activo: true,
            ...(excludeUsuarioId ? { ID_Usuario: { not: excludeUsuarioId } } : {}),
        },
        _count: { ID_HorarioClase: true },
    });
    const countByHorario = new Map(fixedCounts.map(item => [item.ID_HorarioClase, item._count.ID_HorarioClase]));

    for (const horario of horarios) {
        const ocupadosPorFijos = countByHorario.get(horario.ID_HorarioClase) || 0;
        if (ocupadosPorFijos + 1 > Number(horario.cupos || 0)) {
            const clase = horario.Clase?.nombre || 'la clase';
            return `No hay cupo fijo disponible para ${clase} (${horario.diaSemana} ${formatHorarioHora(horario.horaIni)}).`;
        }
    }

    return null;
};

/** CREATE USER */
export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            email, password, dni, nombre, apellido,
            profesion, direc, tel, tipo,
            fechaCumple, ID_Plan: rawPlanId, usaTurnosFijos,
            observacionesSalud, fichaMedicaUrl, motivoAlta
        } = req.body;

        if (!email || !password) {
            res.status(400).json({ message: 'Email y password son obligatorios' });
            return;
        }
        const errorTipo = validarTipoAlCrear(req.user?.tipo, tipo);
        if (errorTipo) {
            res.status(403).json({ message: errorTipo });
            return;
        }
        // Convertir ID_Plan a número
        const planId = rawPlanId !== undefined
            ? Number.parseInt(rawPlanId as string, 10)
            : null;
        if (rawPlanId !== undefined && (!Number.isInteger(planId) || planId! < 1)) {
            res.status(400).json({ message: 'ID_Plan debe ser un entero válido' });
            return;
        }
        // 1) Crear usuario sin imagen
        const hashedPassword = await hashPassword(password);
        const turnosFijosIds = parseTurnosFijosIds(req.body.turnosFijos);
        if (parseBoolean(usaTurnosFijos) && turnosFijosIds.length > 0) {
            const dupError = await assertNoDuplicateFixedDays(turnosFijosIds);
            if (dupError) {
                res.status(400).json({ message: dupError });
                return;
            }
            const capacityError = await assertFixedSchedulesHaveCapacity(turnosFijosIds);
            if (capacityError) {
                res.status(400).json({ message: capacityError });
                return;
            }
        }
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                dni: dni || null,
                nombre: nombre || null,
                apellido: apellido || null,
                profesion: profesion || null,
                direc: direc || null,
                tel: tel || null,
                tipo: tipo || null,
                observacionesSalud: normalizeOptionalText(observacionesSalud),
                fichaMedicaUrl: normalizeOptionalText(fichaMedicaUrl),
                fechaCumple: fechaCumple ? new Date(fechaCumple) : null,
                estado: true,
                motivoAlta: parseMotivoAlta(motivoAlta),
                // Registra el ALTA en el log de movimientos de socios
                movimientos: { create: { tipo: 'ALTA', esReactivacion: false, fecha: new Date() } },
                ID_Plan: planId,
                usaTurnosFijos: parseBoolean(usaTurnosFijos),
                ...(parseBoolean(usaTurnosFijos) && turnosFijosIds.length > 0 ? {
                    TurnosFijos: {
                        create: turnosFijosIds.map(ID_HorarioClase => ({ ID_HorarioClase }))
                    }
                } : {})
            },
            include: {
                plan: true,
                TurnosFijos: true
            }
        });

        // 2) Si viene archivo, subirlo a la carpeta 'users'
        if (req.file) {
            const publicId = `user_${user.ID_Usuario}`;
            const result = await uploadImageBuffer(
                req.file.buffer as Buffer,
                publicId,
                'users'
            );
            await prisma.user.update({
                where: { ID_Usuario: user.ID_Usuario },
                data: { imagenUsuario: result.public_id }
            });
            user.imagenUsuario = result.public_id;
        }

        // 3) Enviar email (sin bloquear)
        try {
            await sendWelcomeEmail(user.email, user.nombre ?? "");
        } catch {
            // no hacemos nada si falla el mail
        }

        res.status(201).json(user);
    } catch (error: any) {
        if (error.code === 'P2002') {
            if (error.meta?.target?.includes('email')) {
                res.status(400).json({ message: 'El email ya existe' });
            } else if (error.meta?.target?.includes('dni')) {
                res.status(400).json({ message: 'El DNI ya existe' });
            } else {
                res.status(400).json({ message: 'Clave única duplicada en la base de datos' });
            }
        } else {
            console.error(error);
            res.status(500).json({ error: 'Hubo un error en el registro' });
        }
    }
};

/** GET ALL USERS (PAGINATED + FILTERS + PLAN) */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            page = '1',
            take: takeQuery = '15',
            tipo,
            nombre,
            apellido,
            email,
            dni,
            estado,
            planId,
            sinPlan,
            search,
            movimientoTipo,
            movimientoMes,
        } = req.query;
        const pageNumber = Math.max(1, parseInt(page as string, 10) || 1);
        const take = Math.min(100, Math.max(1, parseInt(takeQuery as string, 10) || 15));
        const skip = (pageNumber - 1) * take;

        const where: Prisma.UserWhereInput = {};
        if (tipo) where.tipo = tipo as string;
        if (String(sinPlan).toLowerCase() === 'true' || sinPlan === '1') {
            where.ID_Plan = null;
        } else if (planId) {
            const parsedPlanId = Number(planId);
            if (!Number.isInteger(parsedPlanId) || parsedPlanId < 1) {
                res.status(400).json({ message: "Parametro 'planId' invalido. Usar un ID de plan válido" });
                return;
            }
            where.ID_Plan = parsedPlanId;
        }

        if (movimientoTipo !== undefined || movimientoMes !== undefined) {
            const tipoMovimiento = String(movimientoTipo || '').toUpperCase();
            if (tipoMovimiento !== 'ALTA' && tipoMovimiento !== 'BAJA') {
                res.status(400).json({ message: "Parametro 'movimientoTipo' invalido. Usar ALTA|BAJA" });
                return;
            }

            const fechaMovimiento = parseMonthRangeUTC(movimientoMes);
            if (!fechaMovimiento) {
                res.status(400).json({ message: "Parametro 'movimientoMes' invalido. Usar YYYY-MM" });
                return;
            }

            where.movimientos = {
                some: {
                    tipo: tipoMovimiento,
                    fecha: fechaMovimiento,
                },
            };
        }

        const textFilters = {
            nombre: normalizeSearchText(nombre),
            apellido: normalizeSearchText(apellido),
            email: normalizeSearchText(email),
            dni: normalizeSearchText(dni),
            search: normalizeSearchText(search),
        };
        const hasTextFilters = Object.values(textFilters).some(Boolean);

        const searchTerms = typeof search === 'string'
            ? search.trim().split(/\s+/).filter(Boolean).slice(0, 5)
            : [];

        // nuevo: parseo y validación de "estado"
        if (estado !== undefined) {
            const s = (estado as string).toLowerCase();
            if (s === 'true' || s === '1') {
                where.estado = true;
            } else if (s === 'false' || s === '0') {
                where.estado = false;
            } else if (s === 'null') {
                // Prisma typing puede no aceptar `null` directo, casteamos (es seguro semánticamente)
                (where as any).estado = null;
            } else {
                res.status(400).json({ message: "Parametro 'estado' invalido. Usar true|false|1|0|null" });
                return;
            }
        }

        const userListSelect = {
            ID_Usuario: true, email: true, dni: true, nombre: true, apellido: true,
            direc: true, tel: true, profesion: true, tipo: true,
            fechaCumple: true, estado: true, imagenUsuario: true,
            observacionesSalud: true, fichaMedicaUrl: true,
            fechaRegistro: true,
            usaTurnosFijos: true,
            plan: { select: { ID_Plan: true, nombre: true, precio: true, duracion: true, sesionesPorSemana: true, sesionesGracia: true, requiereTurno: true } },
            TurnosFijos: {
                where: { activo: true },
                include: { HorarioClase: { include: { Clase: true } } }
            }
        } satisfies Prisma.UserSelect;

        const textMatchesUser = (user: any): boolean => {
            const fullName = `${user.nombre || ''} ${user.apellido || ''}`;
            const searchable = `${fullName} ${user.email || ''} ${user.dni || ''}`;

            return (
                approximateTextMatch(user.nombre, textFilters.nombre) &&
                approximateTextMatch(user.apellido, textFilters.apellido) &&
                approximateTextMatch(user.email, textFilters.email) &&
                approximateTextMatch(user.dni, textFilters.dni) &&
                searchTerms.every(term => approximateTextMatch(searchable, term))
            );
        };

        let total = 0;
        let users: any[] = [];

        if (hasTextFilters) {
            const allUsers = await prisma.user.findMany({
                where,
                orderBy: { fechaRegistro: 'desc' },
                select: userListSelect,
            });
            const filteredUsers = allUsers.filter(textMatchesUser);
            total = filteredUsers.length;
            users = filteredUsers.slice(skip, skip + take);
        } else {
            const result = await prisma.$transaction([
                prisma.user.count({ where }),
                prisma.user.findMany({
                    where, skip, take, orderBy: { fechaRegistro: 'desc' },
                    select: userListSelect,
                })
            ]);
            total = result[0];
            users = result[1];
        }

        const data = (users as (UsuarioReturn & { imagenUsuario: string | null })[]).map(u => ({
            ...u,
            avatarUrl: u.imagenUsuario
                ? getImageUrl(u.imagenUsuario, { secure: true, width: 80, height: 80, crop: 'thumb' })
                : null
        }));

        res.status(200).json({
            meta: { totalItems: total, take, page: pageNumber, totalPages: Math.ceil(total / take) },
            data
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde' });
    }
};

const getUserStats = async (_req: Request, res: Response): Promise<void> => {
    try {
        const clienteWhere: Prisma.UserWhereInput = { tipo: 'cliente' };
        const [activos, inactivos, sinPlanAsignado] = await prisma.$transaction([
            prisma.user.count({ where: { ...clienteWhere, estado: true } }),
            prisma.user.count({ where: { ...clienteWhere, estado: false } }),
            prisma.user.count({ where: { ...clienteWhere, ID_Plan: null } }),
        ]);

        res.status(200).json({
            alumnos: {
                activos,
                inactivos,
                sinPlanAsignado,
            },
        });
    } catch (error: any) {
        console.error('Error obteniendo KPIs de usuarios:', error);
        res.status(500).json({ message: 'Error obteniendo KPIs de usuarios', error: error.message });
    }
};

/** GET ENTRENADORES (INCLUYE PLAN) */
export const getAllEntrenadores = async (req: Request, res: Response): Promise<void> => {
    try {
        const entrenadores = await prisma.user.findMany({
            where: { tipo: "entrenador" },
            select: {
                ID_Usuario: true,
                email: true,
                dni: true,
                nombre: true,
                apellido: true,
                direc: true,
                tel: true,
                profesion: true,
                tipo: true,
                fechaCumple: true,
                estado: true,
                usaTurnosFijos: true,
                imagenUsuario: true,
                observacionesSalud: true,
                fichaMedicaUrl: true,
                fechaRegistro: true,
                plan: {
                    select: {
                        ID_Plan: true,
                        nombre: true,
                        precio: true,
                        duracion: true,
                        sesionesPorSemana: true,
                        sesionesGracia: true,
                        requiereTurno: true
                    }
                },
                ClasesACargo: {               // <— relación que queremos incluir
                    select: {
                        ID_Clase: true,
                        nombre: true,
                        descripcion: true,        // opcional, si quieres más datos
                        imagenClase: true
                    }
                }
            }
        });

        // Añadimos avatarUrl y devolvemos todo junto
        const result = entrenadores.map(e => ({
            ID_Usuario: e.ID_Usuario,
            email: e.email,
            dni: e.dni,
            nombre: e.nombre,
            apellido: e.apellido,
            direc: e.direc,
            tel: e.tel,
            profesion: e.profesion,
            tipo: e.tipo,
            fechaCumple: e.fechaCumple,
            estado: e.estado,
            observacionesSalud: e.observacionesSalud,
            fichaMedicaUrl: e.fichaMedicaUrl,
            fechaRegistro: e.fechaRegistro,
            plan: e.plan,
            clasesACargo: e.ClasesACargo.map(c => ({
                ID_Clase: c.ID_Clase,
                nombre: c.nombre,
                descripcion: c.descripcion,
                imagenClase: c.imagenClase
            })),
            avatarUrl: e.imagenUsuario
                ? getImageUrl(e.imagenUsuario)
                : null
        }));

        res.status(200).json(result);
    } catch (error: any) {
        console.error("[getAllEntrenadores] Error:", error);
        res.status(500).json({ message: "Hubo un error, prueba más tarde" });
    }
};

/** GET USER BY ID (INCLUYE PLAN) */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        res.status(400).json({ message: "ID inválido" });
        return;
    }

    // Ownership: un cliente sólo puede ver su propio perfil; admin/entrenador, cualquiera.
    const requester = req.user;
    const isStaff = ['admin', 'entrenador'].includes(String(requester?.tipo || '').toLowerCase());
    if (!isStaff && requester?.ID_Usuario !== id) {
        res.status(403).json({ message: "No tenés permiso para ver este usuario" });
        return;
    }

    try {
        const user = await prisma.user.findUnique({
            where: { ID_Usuario: id },
            select: {
                ID_Usuario: true,
                email: true,
                dni: true,
                nombre: true,
                apellido: true,
                profesion: true,
                direc: true,
                tel: true,
                tipo: true,
                fechaRegistro: true,
                fechaBaja: true,
                fechaCumple: true,
                estado: true,
                imagenUsuario: true,
                observacionesSalud: true,
                fichaMedicaUrl: true,
                ID_Plan: true,
                usaTurnosFijos: true,
                plan: {
                    select: {
                        ID_Plan: true,
                        nombre: true,
                        precio: true,
                        duracion: true,
                        sesionesPorSemana: true,
                        sesionesGracia: true,
                        requiereTurno: true
                    }
                },
                TurnosFijos: {
                    where: { activo: true },
                    include: { HorarioClase: { include: { Clase: true } } }
                }
            }
        });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        const avatarUrl = user.imagenUsuario
            ? getImageUrl(user.imagenUsuario, { secure: true, width: 200, height: 200, crop: 'thumb' })
            : null;

        res.status(200).json({ ...user, avatarUrl });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Hubo un error, prueba más tarde" });
    }
};


/** UPDATE USER (INCLUYE PLAN) */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const {
        email,
        password,
        dni,
        nombre,
        apellido,
        profesion,
        direc,
        tel,
        tipo,
        fechaCumple,
        estado,
        ID_Plan: ID_PlanStr,
        usaTurnosFijos,
        observacionesSalud,
        fichaMedicaUrl
    } = req.body;
    const file = req.file;

    try {
        // 0) Guardas de rol: recepción no puede tocar admins ni ascender a nadie a admin
        const destino = await prisma.user.findUnique({
            where: { ID_Usuario: id },
            select: { tipo: true }
        });
        if (!destino) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        const errorDestino = validarUsuarioModificable(req.user?.tipo, destino.tipo);
        if (errorDestino) {
            res.status(403).json({ message: errorDestino });
            return;
        }
        const errorTipo = validarTipoAsignable(req.user?.tipo, tipo);
        if (errorTipo) {
            res.status(403).json({ message: errorTipo });
            return;
        }

        // 1) Build data to update
        const data: any = {};
        if (email) data.email = email;
        if (dni !== undefined) data.dni = dni || null;
        if (nombre) data.nombre = nombre;
        if (apellido) data.apellido = apellido;
        if (profesion) data.profesion = profesion;
        if (direc) data.direc = direc;
        if (tel) data.tel = tel;
        if (tipo) data.tipo = tipo;
        if (fechaCumple) data.fechaCumple = new Date(fechaCumple);
        if (estado !== undefined) data.estado = estado;
        if (usaTurnosFijos !== undefined) data.usaTurnosFijos = parseBoolean(usaTurnosFijos);
        if (observacionesSalud !== undefined) data.observacionesSalud = normalizeOptionalText(observacionesSalud);
        if (fichaMedicaUrl !== undefined) data.fichaMedicaUrl = normalizeOptionalText(fichaMedicaUrl);

        // Convertir ID_Plan de string a number y validar
        if (ID_PlanStr !== undefined) {
            const planId = Number(ID_PlanStr);
            if (isNaN(planId)) {
                res.status(400).json({ message: 'ID_Plan inválido; debe ser un número' });
                return;
            }
            data.ID_Plan = planId;
        }

        if (password) {
            data.password = await hashPassword(password);
        }

        // 2) Si hay nuevo avatar, eliminar el anterior y subir el nuevo
        if (file) {
            const prev = await prisma.user.findUnique({
                where: { ID_Usuario: id },
                select: { imagenUsuario: true }
            });
            if (prev?.imagenUsuario) {
                try {
                    await deleteImage(prev.imagenUsuario);
                } catch { /* ignorar fallo */ }
            }
            const result = await uploadImageBuffer(
                file.buffer as Buffer,
                `user_${id}`,
                'users'
            );
            data.imagenUsuario = result.public_id;
        }

        // 3) Actualizar usuario en la BD
        const turnosFijosIds = req.body.turnosFijos !== undefined
            ? parseTurnosFijosIds(req.body.turnosFijos)
            : null;

        if (turnosFijosIds !== null && parseBoolean(usaTurnosFijos ?? data.usaTurnosFijos) && turnosFijosIds.length > 0) {
            const dupError = await assertNoDuplicateFixedDays(turnosFijosIds);
            if (dupError) {
                res.status(400).json({ message: dupError });
                return;
            }
            const capacityError = await assertFixedSchedulesHaveCapacity(turnosFijosIds, id);
            if (capacityError) {
                res.status(400).json({ message: capacityError });
                return;
            }
        }

        const updated = await prisma.$transaction(async (tx) => {
            if (turnosFijosIds !== null) {
                await tx.turnoFijo.deleteMany({ where: { ID_Usuario: id } });
                if (parseBoolean(usaTurnosFijos ?? data.usaTurnosFijos) && turnosFijosIds.length > 0) {
                    await tx.turnoFijo.createMany({
                        data: turnosFijosIds.map(ID_HorarioClase => ({ ID_Usuario: id, ID_HorarioClase })),
                        skipDuplicates: true
                    });
                }
            }

            return tx.user.update({
                where: { ID_Usuario: id },
                data,
                include: {
                    plan: true,
                    TurnosFijos: {
                        where: { activo: true },
                        include: { HorarioClase: { include: { Clase: true } } }
                    }
                }
            });
        });

        res.status(200).json(updated);
    } catch (error: any) {
        console.error('Error updating user:', error);
        // Manejar violación de unique en email y dni
        if (error.code === 'P2002') {
            if (error.meta?.target?.includes('email')) {
                res.status(400).json({ message: 'El email ya existe' });
            } else if (error.meta?.target?.includes('dni')) {
                res.status(400).json({ message: 'El DNI ya existe' });
            } else {
                res.status(400).json({ message: 'Clave única duplicada en la base de datos' });
            }
        } else {
            res.status(500).json({ message: 'Hubo un error, prueba más tarde', error: error.message });
        }
    }
};

export const updateUserHealth = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
        res.status(400).json({ message: "ID inválido" });
        return;
    }

    try {
        const updated = await prisma.user.update({
            where: { ID_Usuario: id },
            data: {
                observacionesSalud: normalizeOptionalText(req.body.observacionesSalud),
                fichaMedicaUrl: normalizeOptionalText(req.body.fichaMedicaUrl)
            },
            select: {
                ID_Usuario: true,
                observacionesSalud: true,
                fichaMedicaUrl: true
            }
        });

        res.status(200).json(updated);
    } catch (error: any) {
        if (error.code === "P2025") {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        console.error('Error updating user health:', error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde', error: error.message });
    }
};

/** DELETE USER */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    try {
        const user = await prisma.user.findUnique({ where: { ID_Usuario: id } });
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }
        // Los tipos se guardan en minúscula: comparar normalizado (antes comparaba
        // contra 'Admin' y la guarda nunca se disparaba).
        if (normalizarTipo(user.tipo) === ROLES.ADMIN) {
            res.status(403).json({ message: 'No se puede eliminar un admin' });
            return;
        }
        if (user.imagenUsuario) await deleteImage(user.imagenUsuario);
        await prisma.user.delete({ where: { ID_Usuario: id } });
        res.status(200).json({ message: `Usuario ${id} eliminado` });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde', error: error.message });
    }
};

const estadoUser = async (req: Request, res: Response): Promise<void> => {
    try {
        // 1) Parsea y valida el ID de ruta
        const rawId = req.params.id;
        const ID_Usuario = Number.parseInt(rawId, 10);
        if (!rawId || !Number.isInteger(ID_Usuario) || ID_Usuario < 1) {
            res.status(400).json({ message: "Parámetro ‘id’ inválido" });
            return;
        }

        // 2) Valida que en el body venga `estado` y sea booleano
        const { estado, motivoBaja, motivoReactivacion } = req.body;
        if (typeof estado !== 'boolean') {
            res.status(400).json({ message: "El campo 'estado' es obligatorio y debe ser true o false" });
            return;
        }

        // 3) Lee el estado actual para registrar el movimiento sólo si realmente cambia
        const actual = await prisma.user.findUnique({
            where: { ID_Usuario },
            select: { estado: true, tipo: true }
        });
        if (!actual) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        // Recepción no puede dar de baja a un admin
        const errorDestino = validarUsuarioModificable(req.user?.tipo, actual.tipo);
        if (errorDestino) {
            res.status(403).json({ message: errorDestino });
            return;
        }

        const ahora = new Date();
        const data: Prisma.UserUpdateInput = { estado };
        let evento: Prisma.MovimientoSocioCreateWithoutUserInput | null = null;

        if (estado === false && actual.estado !== false) {
            // BAJA: guarda fecha y motivo (validado contra whitelist)
            data.fechaBaja = ahora;
            const motivo = typeof motivoBaja === 'string' && (MOTIVOS_BAJA as readonly string[]).includes(motivoBaja)
                ? motivoBaja
                : MOTIVO_BAJA_DEFAULT;
            evento = { tipo: 'BAJA', motivoBaja: motivo, fecha: ahora };
        } else if (estado === true && actual.estado !== true) {
            // ALTA por reactivación (con su motivo, validado contra MOTIVOS_ALTA)
            data.fechaBaja = null;
            evento = {
                tipo: 'ALTA',
                esReactivacion: true,
                motivoReactivacion: parseMotivoAlta(motivoReactivacion) ?? MOTIVO_ALTA_DEFAULT,
                fecha: ahora,
            };
        }

        // 4) Actualiza el usuario (+ registra el movimiento si hubo cambio de estado)
        const user = await prisma.user.update({
            where: { ID_Usuario },
            data: {
                ...data,
                ...(evento ? { movimientos: { create: evento } } : {})
            },
            select: {
                ID_Usuario: true,
                email: true,
                estado: true,
                nombre: true,
                apellido: true
            }
        });

        // 4) Devuelve el usuario actualizado
        const mensaje = estado
            ? "Usuario activado correctamente"
            : "Usuario desactivado correctamente";

        res.json({ message: mensaje, user });

    } catch (error: any) {
        if (error.code === "P2025") {
            // Prisma no encontró el registro
            res.status(404).json({ message: "Usuario no encontrado" });
        } else {
            console.error(error);
            res.status(500).json({ message: "Error interno al actualizar estado de usuario" });
        }
    }
};

export const getAllAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
        const admins = await prisma.user.findMany({
            where: { tipo: { equals: "admin" } }, // sin mode
            orderBy: { fechaRegistro: "desc" },
            select: {
                ID_Usuario: true,
                tipo: true,
                estado: true,
            }
        });

        res.status(200).json(admins);
    } catch (error: any) {
        console.error("[getAllAdmins] Error:", error);
        res.status(500).json({ message: "Hubo un error, prueba más tarde" });
    }
};

/** IMPORT USERS FROM XLSX (bulk creation) */
export const importUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { usuarios } = req.body;
        if (!Array.isArray(usuarios) || usuarios.length === 0) {
            res.status(400).json({ message: 'Debe enviar un array de usuarios' });
            return;
        }

        const errors: { fila: number; campo: string; error: string }[] = [];

        // 1) Validar estructura individual (email/dni requeridos + formato de fecha)
        usuarios.forEach((u: any, i: number) => {
            const fila = i + 2; // +2 porque fila 1 = header, index 0 = fila 2
            if (!u.email || typeof u.email !== 'string' || !u.email.trim()) {
                errors.push({ fila, campo: 'email', error: 'Email es requerido' });
            }
            if (!u.dni || typeof u.dni !== 'string' || !u.dni.trim()) {
                errors.push({ fila, campo: 'dni', error: 'DNI es requerido' });
            }
            const fechaParsed = parseFechaImport(u.fechaCumple);
            if ('error' in fechaParsed) {
                errors.push({ fila, campo: 'fechaCumple', error: fechaParsed.error });
            }
            const planParsed = parseImportPlanId(u.ID_Plan);
            if ('error' in planParsed) {
                errors.push({ fila, campo: 'ID_Plan', error: planParsed.error });
            }
        });
        if (errors.length > 0) {
            res.status(400).json({ message: 'Error en algunos usuarios', errors });
            return;
        }

        const emails = usuarios.map((u: any) => u.email.trim().toLowerCase());
        const dnis = usuarios.map((u: any) => u.dni.trim());

        // 2) Verificar duplicados en la misma request
        const emailDuplicados = emails.filter((e: string, idx: number) => emails.indexOf(e) !== idx);
        const dniDuplicados = dnis.filter((d: string, idx: number) => dnis.indexOf(d) !== idx);
        if (emailDuplicados.length > 0 || dniDuplicados.length > 0) {
            usuarios.forEach((u: any, i: number) => {
                if (emailDuplicados.includes(u.email.trim().toLowerCase())) {
                    errors.push({ fila: i + 2, campo: 'email', error: 'Email duplicado en el archivo' });
                }
                if (dniDuplicados.includes(u.dni.trim())) {
                    errors.push({ fila: i + 2, campo: 'dni', error: 'DNI duplicado en el archivo' });
                }
            });
            res.status(400).json({ message: 'Error en algunos usuarios', errors });
            return;
        }

        // 3) Verificar emails existentes en DB
        const existingEmails = await prisma.user.findMany({
            where: { email: { in: emails } },
            select: { email: true }
        });
        const existingEmailSet = new Set(existingEmails.map(e => e.email.toLowerCase()));

        // 4) Verificar dnis existentes en DB
        const existingDnis = await prisma.user.findMany({
            where: { dni: { in: dnis } },
            select: { dni: true }
        });
        const existingDniSet = new Set(existingDnis.map(d => d.dni?.toLowerCase()));

        usuarios.forEach((u: any, i: number) => {
            if (existingEmailSet.has(u.email.trim().toLowerCase())) {
                errors.push({ fila: i + 2, campo: 'email', error: 'El email ya existe en el sistema' });
            }
            if (existingDniSet.has(u.dni.trim().toLowerCase())) {
                errors.push({ fila: i + 2, campo: 'dni', error: 'El DNI ya existe en el sistema' });
            }
        });
        if (errors.length > 0) {
            res.status(400).json({ message: 'Error en algunos usuarios', errors });
            return;
        }

        // 5) Validar planes por ID exacto
        const planIds = [...new Set(usuarios
            .map((u: any) => parseImportPlanId(u.ID_Plan))
            .filter((parsed): parsed is { planId: number } => 'planId' in parsed && parsed.planId !== null)
            .map(parsed => parsed.planId))];
        const planes = planIds.length > 0
            ? await prisma.plan.findMany({ where: { ID_Plan: { in: planIds } }, select: { ID_Plan: true } })
            : [];
        const existingPlanIds = new Set(planes.map(p => p.ID_Plan));

        usuarios.forEach((u: any, i: number) => {
            const planParsed = parseImportPlanId(u.ID_Plan);
            if ('planId' in planParsed && planParsed.planId !== null && !existingPlanIds.has(planParsed.planId)) {
                errors.push({ fila: i + 2, campo: 'ID_Plan', error: 'No existe un plan con ese ID' });
            }
        });
        if (errors.length > 0) {
            res.status(400).json({ message: 'Error en algunos usuarios', errors });
            return;
        }

        // 6) Armar data e insertar en lotes.
        // Password por defecto = DNI, con cost 10 (más liviano que el global 12) para que el import
        // masivo no se cuelgue por el hasheo; el alumno debería cambiarlo igual.
        const BULK_SALT_ROUNDS = 10;
        const data: Prisma.UserCreateManyInput[] = [];
        for (const batch of chunkArray(usuarios, IMPORT_USERS_BATCH_SIZE)) {
            const batchData = await Promise.all(batch.map(async (u: any) => {
                const fechaParsed = parseFechaImport(u.fechaCumple);
                const fechaCumple = 'date' in fechaParsed ? fechaParsed.date : null;
                const planParsed = parseImportPlanId(u.ID_Plan);
                const ID_Plan = 'planId' in planParsed ? planParsed.planId : null;
                return {
                    email: u.email.trim().toLowerCase(),
                    password: await bcrypt.hash(u.dni.trim(), BULK_SALT_ROUNDS),
                    dni: u.dni.trim(),
                    nombre: u.nombre?.trim() || null,
                    apellido: u.apellido?.trim() || null,
                    tel: u.tel?.trim() || null,
                    direc: u.direc?.trim() || null,
                    profesion: u.profesion?.trim() || null,
                    fechaCumple,
                    tipo: 'cliente',
                    estado: true,
                    ID_Plan,
                    usaTurnosFijos: false,
                };
            }));
            data.push(...batchData);
        }

        const ahora = new Date();
        const count = await prisma.$transaction(async (tx) => {
            let createdCount = 0;
            for (const batch of chunkArray(data, IMPORT_USERS_BATCH_SIZE)) {
                const res = await tx.user.createMany({ data: batch, skipDuplicates: true });
                createdCount += res.count;
            }

            // createMany no devuelve IDs ni soporta nested writes → buscamos los creados por email
            // (únicos, ya validados como no existentes) y registramos su ALTA en MovimientoSocio.
            const creados = await tx.user.findMany({
                where: { email: { in: emails } },
                select: { ID_Usuario: true },
            });
            if (creados.length > 0) {
                const movimientos: Prisma.MovimientoSocioCreateManyInput[] = creados.map((c) => ({
                    ID_Usuario: c.ID_Usuario,
                    tipo: 'ALTA',
                    esReactivacion: false,
                    fecha: ahora,
                }));
                for (const batch of chunkArray(movimientos, IMPORT_USERS_BATCH_SIZE)) {
                    await tx.movimientoSocio.createMany({
                        data: batch,
                    });
                }
            }
            return createdCount;
        });

        res.status(201).json({ message: 'ok', count });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: 'Hubo un error, prueba más tarde' });
    }
};

export const userMethods = {
    createUser,
    getAllUsers,
    getUserStats,
    deleteUser,
    getUserById,
    updateUser,
    updateUserHealth,
    getAllEntrenadores,
    getAllAdmins,
    estadoUser,
    importUsers
};
