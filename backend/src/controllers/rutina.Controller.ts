import { BlockType } from '@prisma/client';
import { Request, Response } from "express";
import prisma from "../models/Prisma.js";
import { getImageUrl } from '../services/cloudinary.service.js';

const parseIdList = (value: unknown): number[] => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(
        value
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0)
    ));
};

const rutinaAsignacionesInclude = {
    asignacionesUsuarios: {
        include: {
            usuario: {
                select: {
                    ID_Usuario: true,
                    nombre: true,
                    apellido: true,
                    dni: true,
                    email: true,
                    tipo: true,
                    estado: true,
                    observacionesSalud: true,
                    fichaMedicaUrl: true
                }
            }
        }
    },
    asignacionesGrupos: {
        include: {
            grupoUsuario: {
                select: {
                    ID_GrupoUsuario: true,
                    nombre: true,
                    descripcion: true,
                    estado: true,
                    miembros: {
                        include: {
                            usuario: {
                                select: {
                                    ID_Usuario: true,
                                    nombre: true,
                                    apellido: true,
                                    dni: true,
                                    email: true,
                                    tipo: true,
                                    estado: true,
                                    observacionesSalud: true,
                                    fichaMedicaUrl: true
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};

const mapAsignacionesRutina = (rutinaFull: any) => ({
    asignacionesUsuarios: (rutinaFull.asignacionesUsuarios || []).map((a: any) => a.usuario),
    asignacionesGrupos: (rutinaFull.asignacionesGrupos || []).map((a: any) => ({
        ID_GrupoUsuario: a.grupoUsuario.ID_GrupoUsuario,
        nombre: a.grupoUsuario.nombre,
        descripcion: a.grupoUsuario.descripcion,
        estado: a.grupoUsuario.estado,
        miembros: (a.grupoUsuario.miembros || []).map((m: any) => m.usuario)
    }))
});

const syncRutinaAsignaciones = async (
    tx: any,
    idRutina: number,
    usuariosAsignadosRaw: unknown,
    gruposAsignadosRaw: unknown,
    fallbackUsuarioId?: number | null
) => {
    const usuariosAsignados = parseIdList(usuariosAsignadosRaw);
    const gruposAsignados = parseIdList(gruposAsignadosRaw);
    const shouldSyncUsuarios = Array.isArray(usuariosAsignadosRaw) || typeof fallbackUsuarioId === 'number';
    const shouldSyncGrupos = Array.isArray(gruposAsignadosRaw);

    if (shouldSyncUsuarios) {
        const ids = usuariosAsignados.length
            ? usuariosAsignados
            : (fallbackUsuarioId ? [fallbackUsuarioId] : []);
        await tx.rutinaAsignacionUsuario.deleteMany({ where: { ID_Rutina: idRutina } });
        if (ids.length) {
            await tx.rutinaAsignacionUsuario.createMany({
                data: ids.map(ID_Usuario => ({ ID_Rutina: idRutina, ID_Usuario })),
                skipDuplicates: true
            });
        }
    }

    if (shouldSyncGrupos) {
        await tx.rutinaAsignacionGrupo.deleteMany({ where: { ID_Rutina: idRutina } });
        if (gruposAsignados.length) {
            await tx.rutinaAsignacionGrupo.createMany({
                data: gruposAsignados.map(ID_GrupoUsuario => ({ ID_Rutina: idRutina, ID_GrupoUsuario })),
                skipDuplicates: true
            });
        }
    }
};

export const getAllRutinasWithDetails = async (req: Request, res: Response): Promise<void> => {
    try {
        const rutinas = await prisma.rutina.findMany({
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!rutinas || rutinas.length === 0) {
            res.status(404).json({ message: "No se encontraron rutinas" });
            return;
        }

        const resultado = rutinas.map(rutinaFull => {
            const diasMap: Record<string, any> = {};
            const semanasMap: Record<string, any> = {};

            // días sueltos (sin semana)
            for (const d of rutinaFull.DiasRutina) {
                if (!d.rutinaSemanaId) {
                    diasMap[d.dia] = {
                        nombre: d.nombre ?? undefined,
                        descripcion: d.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // inicializar semanas y sus días
            for (const s of rutinaFull.Semanas) {
                const semanaKey = `semana_${s.id}`;
                semanasMap[semanaKey] = {
                    id: s.id,
                    nombre: s.nombre ?? null,
                    numero: s.numero ?? null,
                    dias: {} as Record<string, any>
                };
                for (const day of s.Dias) {
                    semanasMap[semanaKey].dias[day.dia] = {
                        nombre: day.nombre ?? undefined,
                        descripcion: day.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // placeholder sin_dia
            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            // poblar bloques en dias o semanas según corresponda
            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                // si el día pertenece a una semana, guardarlo en la semana correspondiente
                const rutinaDia = blo.rutinaDia;
                if (rutinaDia?.rutinaSemanaId) {
                    const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                    if (semanaObj) {
                        const semanaKey = `semana_${semanaObj.id}`;
                        if (!semanasMap[semanaKey]) {
                            semanasMap[semanaKey] = {
                                id: semanaObj.id,
                                nombre: semanaObj.nombre ?? null,
                                numero: semanaObj.numero ?? null,
                                dias: {}
                            };
                        }
                        if (!semanasMap[semanaKey].dias[diaKey]) {
                            semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                        }
                        semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                        continue;
                    }
                }

                // si no pertenece a semana, queda en diasMap
                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap,
                semanas: Object.values(semanasMap),
                ...mapAsignacionesRutina(rutinaFull)
            };
        });

        res.status(200).json({
            message: "Rutinas obtenidas exitosamente",
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas:", error);
        res.status(500).json({ message: "Error obteniendo rutinas", error: error.message });
    }
};

// export const getAllRutinasWithDetails = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const rutinas = await prisma.rutina.findMany({
//             include: {
//                 DiasRutina: true,
//                 User: { select: { nombre: true, apellido: true, tipo: true } },
//                 Entrenador: { select: { nombre: true, apellido: true, tipo: true } },
//                 Bloques: {
//                     include: {
//                         rutinaDia: true,
//                         bloqueEjercicios: {
//                             include: { ejercicio: true }
//                         }
//                     }
//                 }
//             },
//             orderBy: { createdAt: 'desc' }
//         });

//         if (!rutinas || rutinas.length === 0) {
//             res.status(404).json({ message: "No se encontraron rutinas" });
//             return;
//         }

//         const resultado = rutinas.map(rutinaFull => {
//             const diasMap: Record<string, any> = {};
//             for (const d of rutinaFull.DiasRutina) {
//                 diasMap[d.dia] = {
//                     nombre: d.nombre ?? undefined,
//                     descripcion: d.descripcion ?? undefined,
//                     bloques: [] as any[]
//                 };
//             }

//             if (!diasMap['sin_dia']) {
//                 diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
//             }

//             for (const blo of rutinaFull.Bloques) {
//                 const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
//                 const bloqueMapped = {
//                     ID_Bloque: blo.ID_Bloque,
//                     type: blo.type,
//                     setsReps: blo.setsReps,
//                     nombreEj: blo.nombreEj,
//                     weight: blo.weight,
//                     descansoRonda: blo.descansoRonda,
//                     cantRondas: blo.cantRondas,
//                     durationMin: blo.durationMin,
//                     tipoEscalera: blo.tipoEscalera,
//                     // nuevos campos TABATA
//                     cantSeries: (blo as any).cantSeries ?? null,
//                     descTabata: (blo as any).descTabata ?? null,
//                     tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
//                     ejercicios: blo.bloqueEjercicios.map(be => ({
//                         ID_Ejercicio: be.ID_Ejercicio,
//                         reps: be.reps,
//                         setRepWeight: be.setRepWeight,
//                         ejercicio: {
//                             ID_Ejercicio: be.ejercicio.ID_Ejercicio,
//                             nombre: be.ejercicio.nombre,
//                             descripcion: be.ejercicio.descripcion,
//                             mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
//                             esGenerico: be.ejercicio.esGenerico
//                         }
//                     }))
//                 };

//                 if (!diasMap[diaKey]) {
//                     diasMap[diaKey] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
//                 }
//                 diasMap[diaKey].bloques.push(bloqueMapped);
//             }

//             if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
//                 delete diasMap['sin_dia'];
//             }

//             return {
//                 ID_Rutina: rutinaFull.ID_Rutina,
//                 nombre: rutinaFull.nombre,
//                 desc: rutinaFull.desc,
//                 claseRutina: rutinaFull.claseRutina,
//                 grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
//                 createdAt: rutinaFull.createdAt,
//                 updatedAt: rutinaFull.updatedAt,
//                 alumno: rutinaFull.User,
//                 entrenador: rutinaFull.Entrenador,
//                 dias: diasMap
//             };
//         });

//         res.status(200).json({
//             message: "Rutinas obtenidas exitosamente",
//             rutinas: resultado
//         });
//     } catch (error: any) {
//         console.error("Error obteniendo rutinas:", error);
//         res.status(500).json({ message: "Error obteniendo rutinas", error: error.message });
//     }
// };

export const getRutinaById = async (req: Request, res: Response): Promise<void> => {
    const rutinaId = parseInt(req.params.id, 10);
    if (isNaN(rutinaId)) {
        res.status(400).json({ message: "ID de rutina inválido" });
        return;
    }

    try {
        const rutina = await prisma.rutina.findUnique({
            where: { ID_Rutina: rutinaId },
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            }
        });

        if (!rutina) {
            res.status(404).json({ message: "Rutina no encontrada" });
            return;
        }

        const diasMap: Record<string, any> = {};
        const semanasMap: Record<string, any> = {};

        for (const d of rutina.DiasRutina) {
            if (!d.rutinaSemanaId) {
                diasMap[d.dia] = {
                    nombre: d.nombre ?? undefined,
                    descripcion: d.descripcion ?? undefined,
                    bloques: [] as any[]
                };
            }
        }

        // inicializar semanas
        for (const s of rutina.Semanas) {
            const semanaKey = `semana_${s.id}`;
            semanasMap[semanaKey] = {
                id: s.id,
                nombre: s.nombre ?? null,
                numero: s.numero ?? null,
                dias: {} as Record<string, any>
            };
            for (const day of s.Dias) {
                semanasMap[semanaKey].dias[day.dia] = {
                    nombre: day.nombre ?? undefined,
                    descripcion: day.descripcion ?? undefined,
                    bloques: [] as any[]
                };
            }
        }

        if (!diasMap['sin_dia']) {
            diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
        }

        for (const blo of rutina.Bloques) {
            const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
            const bloqueMapped = {
                ID_Bloque: blo.ID_Bloque,
                type: blo.type,
                setsReps: blo.setsReps,
                nombreEj: blo.nombreEj,
                weight: blo.weight,
                descansoRonda: blo.descansoRonda,
                cantRondas: blo.cantRondas,
                durationMin: blo.durationMin,
                tipoEscalera: blo.tipoEscalera,
                cantSeries: (blo as any).cantSeries ?? null,
                descTabata: (blo as any).descTabata ?? null,
                tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                ejercicios: blo.bloqueEjercicios.map(be => ({
                    ID_Ejercicio: be.ID_Ejercicio,
                    reps: be.reps,
                    setRepWeight: be.setRepWeight,
                    ejercicio: {
                        ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                        nombre: be.ejercicio.nombre,
                        descripcion: be.ejercicio.descripcion,
                        mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                        esGenerico: be.ejercicio.esGenerico,
                        youtubeUrl: be.ejercicio.youtubeUrl,
                        musculos: be.ejercicio.musculos,
                        equipamiento: be.ejercicio.equipamiento
                    }
                }))
            };

            const rutinaDia = blo.rutinaDia;
            if (rutinaDia?.rutinaSemanaId) {
                const semanaObj = rutina.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                if (semanaObj) {
                    const semanaKey = `semana_${semanaObj.id}`;
                    if (!semanasMap[semanaKey]) {
                        semanasMap[semanaKey] = { id: semanaObj.id, nombre: semanaObj.nombre ?? null, numero: semanaObj.numero ?? null, dias: {} };
                    }
                    if (!semanasMap[semanaKey].dias[diaKey]) {
                        semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                    }
                    semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                    continue;
                }
            }

            if (!diasMap[diaKey]) {
                diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
            }
            diasMap[diaKey].bloques.push(bloqueMapped);
        }

        if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
            delete diasMap['sin_dia'];
        }

        const rutinaResp = {
            ID_Rutina: rutina.ID_Rutina,
            nombre: rutina.nombre,
            desc: rutina.desc,
            claseRutina: rutina.claseRutina,
            grupoMuscularRutina: rutina.grupoMuscularRutina,
            urlPlanificacion: rutina.urlPlanificacion,
            createdAt: rutina.createdAt,
            updatedAt: rutina.updatedAt,
            alumno: rutina.User,
            entrenador: rutina.Entrenador,
            dias: diasMap,
            semanas: Object.values(semanasMap),
            ...mapAsignacionesRutina(rutina)
        };

        res.status(200).json({
            message: "Rutina obtenida exitosamente",
            rutina: rutinaResp
        });
    } catch (error: any) {
        console.error(`Error obteniendo rutina con ID ${rutinaId}:`, error);
        res.status(500).json({ message: "Error obteniendo rutina", error: error.message });
    }
};

// export const getRutinaById = async (req: Request, res: Response): Promise<void> => {
//     const rutinaId = parseInt(req.params.id, 10);
//     if (isNaN(rutinaId)) {
//         res.status(400).json({ message: "ID de rutina inválido" });
//         return;
//     }

//     try {
//         const rutina = await prisma.rutina.findUnique({
//             where: { ID_Rutina: rutinaId },
//             include: {
//                 DiasRutina: true,
//                 User: { select: { nombre: true, apellido: true, tipo: true } },
//                 Entrenador: { select: { nombre: true, apellido: true, tipo: true } },
//                 Bloques: {
//                     include: {
//                         rutinaDia: true,
//                         bloqueEjercicios: {
//                             include: { ejercicio: true }
//                         }
//                     }
//                 }
//             }
//         });

//         if (!rutina) {
//             res.status(404).json({ message: "Rutina no encontrada" });
//             return;
//         }

//         const diasMap: Record<string, any> = {};
//         for (const d of rutina.DiasRutina) {
//             diasMap[d.dia] = {
//                 nombre: d.nombre ?? undefined,
//                 descripcion: d.descripcion ?? undefined,
//                 bloques: [] as any[]
//             };
//         }

//         if (!diasMap['sin_dia']) {
//             diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
//         }

//         for (const blo of rutina.Bloques) {
//             const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
//             const bloqueMapped = {
//                 ID_Bloque: blo.ID_Bloque,
//                 type: blo.type,
//                 setsReps: blo.setsReps,
//                 nombreEj: blo.nombreEj,
//                 weight: blo.weight,
//                 descansoRonda: blo.descansoRonda,
//                 cantRondas: blo.cantRondas,
//                 durationMin: blo.durationMin,
//                 tipoEscalera: blo.tipoEscalera,
//                 // nuevos campos TABATA
//                 cantSeries: (blo as any).cantSeries ?? null,
//                 descTabata: (blo as any).descTabata ?? null,
//                 tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
//                 ejercicios: blo.bloqueEjercicios.map(be => ({
//                     ID_Ejercicio: be.ID_Ejercicio,
//                     reps: be.reps,
//                     setRepWeight: be.setRepWeight,
//                     ejercicio: {
//                         ID_Ejercicio: be.ejercicio.ID_Ejercicio,
//                         nombre: be.ejercicio.nombre,
//                         descripcion: be.ejercicio.descripcion,
//                         mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
//                         esGenerico: be.ejercicio.esGenerico,
//                         youtubeUrl: be.ejercicio.youtubeUrl,
//                         musculos: be.ejercicio.musculos,
//                         equipamientos: be.ejercicio.equipamiento
//                     }
//                 }))
//             };

//             if (!diasMap[diaKey]) {
//                 diasMap[diaKey] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
//             }
//             diasMap[diaKey].bloques.push(bloqueMapped);
//         }

//         if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
//             delete diasMap['sin_dia'];
//         }

//         const rutinaResp = {
//             ID_Rutina: rutina.ID_Rutina,
//             nombre: rutina.nombre,
//             desc: rutina.desc,
//             claseRutina: rutina.claseRutina,
//             grupoMuscularRutina: rutina.grupoMuscularRutina,
//             createdAt: rutina.createdAt,
//             updatedAt: rutina.updatedAt,
//             alumno: rutina.User,
//             entrenador: rutina.Entrenador,
//             dias: diasMap
//         };

//         res.status(200).json({
//             message: "Rutina obtenida exitosamente",
//             rutina: rutinaResp
//         });
//     } catch (error: any) {
//         console.error(`Error obteniendo rutina con ID ${rutinaId}:`, error);
//         res.status(500).json({ message: "Error obteniendo rutina", error: error.message });
//     }
// };



interface NuevoEjercicioInput {
    nombre: string;
    descripcion?: string | null;
    mediaUrl?: string | null;
}

interface BloqueEjercicioInput {
    ejercicioId?: number;
    orden?: number;
    reps?: string | null;
    setRepWeight?: string | null;
    nuevoEjercicio?: NuevoEjercicioInput;
}

interface BloqueInput {
    type: BlockType;
    setsReps?: string | null;
    descansoRonda?: number | null;
    cantRondas?: number | null;
    durationMin?: number | null;
    tipoEscalera?: string | null;
    bloqueEjercicios: BloqueEjercicioInput[];
    nombreEj?: string | null;   // <-- añadido
    weight?: string | null;     // <-- añadido
    cantSeries?: number | null; // <-- añadido
    descTabata?: string | null;  // <-- añadido
    tiempoTrabajoDescansoTabata?: string | null; // <-- añadido
}
export const updateRutinaWithBlocks = async (req: Request, res: Response): Promise<void> => {
    const idRutina = Number(req.params.id);
    const {
        nombre,
        desc,
        claseRutina,
        grupoMuscularRutina,
        urlPlanificacion,
        dias,
        semanas,
        bloques: legacyBloques,
        ID_Usuario,
        usuariosAsignados,
        gruposAsignados
    } = req.body;

    if (
        isNaN(idRutina) ||
        (!nombre && !desc && !claseRutina && !grupoMuscularRutina && !urlPlanificacion && !dias && !semanas && !legacyBloques && !Array.isArray(usuariosAsignados) && !Array.isArray(gruposAsignados))
    ) {
        res.status(400).json({ message: "Datos insuficientes o inválidos" });
        return;
    }

    try {
        const dataRutina: any = {};
        if (typeof nombre === 'string') dataRutina.nombre = nombre;
        if (typeof desc === 'string') dataRutina.desc = desc;
        if (typeof claseRutina === 'string') dataRutina.claseRutina = claseRutina;
        if (typeof grupoMuscularRutina === 'string') dataRutina.grupoMuscularRutina = grupoMuscularRutina;
        if (typeof urlPlanificacion !== 'undefined') dataRutina.urlPlanificacion = urlPlanificacion?.trim() || null;

        if (typeof ID_Usuario !== 'undefined' && ID_Usuario !== null) {
            const idUserNum = Number(ID_Usuario);
            if (Number.isNaN(idUserNum)) {
                res.status(400).json({ message: "ID_Usuario inválido" });
                return;
            }
            dataRutina.ID_Usuario = idUserNum;
        }

        if (Object.keys(dataRutina).length > 0) {
            await prisma.rutina.update({ where: { ID_Rutina: idRutina }, data: dataRutina });
        }

        await syncRutinaAsignaciones(
            prisma,
            idRutina,
            Array.isArray(usuariosAsignados) ? usuariosAsignados : undefined,
            Array.isArray(gruposAsignados) ? gruposAsignados : undefined,
            typeof dataRutina.ID_Usuario === 'number' && !Array.isArray(usuariosAsignados) ? dataRutina.ID_Usuario : null
        );

        const shouldRebuildStructure = Boolean(dias || semanas || legacyBloques);
        if (!shouldRebuildStructure) {
            await getRutinaById(req, res);
            return;
        }

        // clean slate bloques y bloqueEjercicios
        const existingBlocks = await prisma.bloque.findMany({ where: { ID_Rutina: idRutina }, select: { ID_Bloque: true } });
        const blockIds = existingBlocks.map(b => b.ID_Bloque);
        if (blockIds.length) {
            await prisma.bloqueEjercicio.deleteMany({ where: { ID_Bloque: { in: blockIds } } });
        }
        await prisma.bloque.deleteMany({ where: { ID_Rutina: idRutina } });

        // borrar días y semanas existentes
        await prisma.rutinaDia.deleteMany({ where: { rutinaId: idRutina } });
        await prisma.semana.deleteMany({ where: { rutinaId: idRutina } });

        // normalizar entrada y construir dayOrder
        type DayOrderItem = { diaKey: string; payload: any; rutinaDiaId: number };
        const dayOrder: DayOrderItem[] = [];

        // recolectar nuevos ejercicios (dedupe global)
        const newEjercicioKeyMap = new Map<string, { nombre: string; descripcion?: string; mediaUrl?: string }>();
        const collectNewEjFromBloques = (bloquesArr: any[] | undefined) => {
            for (const blo of bloquesArr || []) {
                for (const be of blo.bloqueEjercicios || []) {
                    if (!be.ejercicioId && be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
                        const key = be.nuevoEjercicio.nombre.trim().toLowerCase();
                        if (!newEjercicioKeyMap.has(key)) {
                            newEjercicioKeyMap.set(key, {
                                nombre: be.nuevoEjercicio.nombre.trim(),
                                descripcion: be.nuevoEjercicio.descripcion ?? undefined,
                                mediaUrl: be.nuevoEjercicio.mediaUrl ?? undefined,
                            });
                        }
                    }
                }
            }
        };

        const semanasObj = semanas && typeof semanas === 'object' && !Array.isArray(semanas) ? semanas : null;
        if (semanasObj) {
            for (const [, weekPayload] of Object.entries(semanasObj) as Array<[string, any]>) {
                const diasInWeek = weekPayload?.dias && typeof weekPayload.dias === 'object' ? Object.entries(weekPayload.dias) as Array<[string, any]> : [];
                for (const [diaKey, dayPayload] of diasInWeek) {
                    collectNewEjFromBloques(dayPayload.bloques);
                }
            }
        }

        if (dias && typeof dias === 'object' && !Array.isArray(dias)) {
            for (const [diaKey, dayPayload] of Object.entries(dias) as Array<[string, any]>) {
                collectNewEjFromBloques(dayPayload.bloques);
            }
        }

        // crear ejercicios nuevos secuencialmente
        const newEjCreatedMap = new Map<string, number>();
        if (newEjercicioKeyMap.size) {
            for (const payload of Array.from(newEjercicioKeyMap.values())) {
                const created = await prisma.ejercicio.create({
                    data: {
                        nombre: payload.nombre,
                        descripcion: payload.descripcion ?? undefined,
                        mediaUrl: payload.mediaUrl ?? undefined,
                        esGenerico: true
                    }
                });
                newEjCreatedMap.set(created.nombre.trim().toLowerCase(), created.ID_Ejercicio);
            }
        }

        // 4) Crear semanas y días manteniendo el orden en "dayOrder"
        // helper para crear un día y push al orden
        const createRutinaDia = async (diaKey: string, dayPayload: any, rutinaSemanaId?: number) => {
            const nombreDia = typeof dayPayload?.nombre === 'string' && dayPayload.nombre.trim().length > 0
                ? dayPayload.nombre.trim()
                : undefined;
            const descripcionDia = typeof dayPayload?.descripcion === 'string' && dayPayload.descripcion.trim().length > 0
                ? dayPayload.descripcion.trim()
                : undefined;

            const createdDay = await prisma.rutinaDia.create({
                data: {
                    dia: diaKey,
                    nombre: nombreDia,
                    descripcion: descripcionDia,
                    rutinaId: idRutina,
                    rutinaSemanaId: rutinaSemanaId ?? null,
                }
            });
            dayOrder.push({ diaKey, payload: dayPayload, rutinaDiaId: createdDay.id });
        };

        // 4.a) crear semanas (si vienen) y sus días
        if (semanasObj) {
            for (const [weekKey, weekPayload] of Object.entries(semanasObj) as Array<[string, any]>) {
                const nombreSemana = typeof weekPayload?.nombre === 'string' && weekPayload.nombre.trim().length > 0
                    ? weekPayload.nombre.trim()
                    : undefined;
                const numeroSemana = typeof weekPayload?.numero === 'number' ? weekPayload.numero : undefined;

                const createdWeek = await prisma.semana.create({
                    data: {
                        nombre: nombreSemana,
                        numero: numeroSemana ?? null,
                        rutinaId: idRutina
                    }
                });
                const diasInWeek = weekPayload?.dias && typeof weekPayload.dias === 'object' ? Object.entries(weekPayload.dias) as Array<[string, any]> : [];
                for (const [diaKey, dayPayload] of diasInWeek) {
                    await createRutinaDia(diaKey, dayPayload, createdWeek.id);
                }
            }
        }

        // 4.b) crear días que vienen en la raíz (si vienen) — se agregan después de las semanas
        const diasObj = dias && typeof dias === 'object' && !Array.isArray(dias) ? dias : null;
        if (diasObj) {
            for (const [diaKey, dayPayload] of Object.entries(diasObj) as Array<[string, any]>) {
                await createRutinaDia(diaKey, dayPayload, undefined);
            }
        } else if (Array.isArray(dias)) {
            for (const d of dias as string[]) {
                await createRutinaDia(d, { nombre: undefined, descripcion: undefined, bloques: [] }, undefined);
            }
        } else if ((!dias || (typeof dias === 'object' && Object.keys(dias || {}).length === 0)) && Array.isArray(legacyBloques) && legacyBloques.length > 0) {
            await createRutinaDia('dia1', { nombre: undefined, descripcion: undefined, bloques: legacyBloques }, undefined);
        }

        // 5) Crear bloques por día (iterando dayOrder para preservar el mismo orden)
        const createdBloquesInfo: Array<{ ID_Bloque: number; rutinaDiaId: number }> = [];
        for (const dayItem of dayOrder) {
            const bloquesDelDia = dayItem.payload?.bloques || [];
            for (const blo of bloquesDelDia) {
                if (!Object.values(BlockType).includes(blo.type as any)) {
                    throw new Error(`Tipo de bloque no válido: ${blo.type}`);
                }

                const createdBloque = await prisma.bloque.create({
                    data: {
                        type: blo.type as any,
                        ID_Rutina: idRutina,
                        rutinaDiaId: dayItem.rutinaDiaId,
                        setsReps: blo.setsReps ?? null,
                        nombreEj: blo.nombreEj ?? null,
                        weight: blo.weight ?? null,
                        descansoRonda: blo.descansoRonda ?? null,
                        cantRondas: blo.cantRondas ?? null,
                        durationMin: blo.durationMin ?? null,
                        cantSeries: blo.cantSeries ?? null,
                        descTabata: blo.descTabata ?? null,
                        tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata ?? null,
                        tipoEscalera: blo.tipoEscalera ?? null,
                    }
                });

                createdBloquesInfo.push({ ID_Bloque: createdBloque.ID_Bloque, rutinaDiaId: dayItem.rutinaDiaId });
            }
        }

        // 6) Crear bloqueEjercicios (bulk por bloque)
        const bloqueEjerciciosOps: Array<Promise<any>> = [];
        let mappingIndex = 0;
        for (const dayItem of dayOrder) {
            const bloquesDelDia = dayItem.payload?.bloques || [];
            for (let i = 0; i < (bloquesDelDia as any[]).length; i++) {
                const bloInput = (bloquesDelDia as any[])[i];
                const createdBlo = createdBloquesInfo[mappingIndex++];
                const ID_Bloque = createdBlo?.ID_Bloque;
                if (!ID_Bloque) continue;

                const rows: Array<any> = [];
                let ordenCounter = 1;
                for (const be of bloInput.bloqueEjercicios || []) {
                    let ID_Ejercicio: number | undefined;
                    if (typeof be.ejercicioId === 'number') {
                        ID_Ejercicio = be.ejercicioId;
                    } else if (be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
                        ID_Ejercicio = newEjCreatedMap.get(be.nuevoEjercicio.nombre.trim().toLowerCase());
                        if (!ID_Ejercicio) continue;
                    } else {
                        continue;
                    }

                    rows.push({
                        ID_Bloque,
                        ID_Ejercicio,
                        reps: be.reps ?? null,
                        setRepWeight: be.setRepWeight ?? null,
                        orden: typeof be.orden === 'number' ? be.orden : ordenCounter
                    });

                    ordenCounter++;
                }

                if (rows.length) {
                    bloqueEjerciciosOps.push(prisma.bloqueEjercicio.createMany({ data: rows }));
                }
            }
        }

        if (bloqueEjerciciosOps.length) {
            await Promise.all(bloqueEjerciciosOps);
        }

        // fetch final
        const rutinaFull = await prisma.rutina.findUnique({
            where: { ID_Rutina: idRutina },
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: { include: { ejercicio: true } }
                    }
                }
            }
        });

        if (!rutinaFull) {
            res.status(404).json({ message: `Rutina con ID ${idRutina} no encontrada luego del update` });
            return;
        }

        // mapear respuesta (igual que antes)
        const diasMap: Record<string, any> = {};
        const semanasMap: Record<string, any> = {};

        for (const d of rutinaFull.DiasRutina) {
            if (!d.rutinaSemanaId) {
                const diaKey = d.dia;
                diasMap[diaKey] = { nombre: d.nombre ?? undefined, descripcion: d.descripcion ?? undefined, bloques: [] as any[] };
            }
        }

        for (const s of rutinaFull.Semanas) {
            const semanaKey = `semana_${s.id}`;
            semanasMap[semanaKey] = { id: s.id, nombre: s.nombre ?? null, numero: s.numero ?? null, dias: {} as Record<string, any> };
            for (const day of s.Dias) {
                semanasMap[semanaKey].dias[day.dia] = { nombre: day.nombre ?? undefined, descripcion: day.descripcion ?? undefined, bloques: [] as any[] };
            }
        }

        if (!diasMap['sin_dia']) {
            diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
        }

        for (const blo of rutinaFull.Bloques) {
            const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
            const bloqueMapped = {
                ID_Bloque: blo.ID_Bloque,
                type: blo.type,
                setsReps: blo.setsReps,
                nombreEj: blo.nombreEj,
                weight: blo.weight,
                descansoRonda: blo.descansoRonda,
                cantRondas: blo.cantRondas,
                durationMin: blo.durationMin,
                tipoEscalera: blo.tipoEscalera,
                cantSeries: (blo as any).cantSeries ?? null,
                descTabata: (blo as any).descTabata ?? null,
                tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                ejercicios: blo.bloqueEjercicios.map(be => ({
                    ID_Ejercicio: be.ID_Ejercicio,
                    reps: be.reps,
                    setRepWeight: be.setRepWeight,
                    orden: (be as any).orden ?? null,
                    ejercicio: {
                        ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                        nombre: be.ejercicio.nombre,
                        descripcion: be.ejercicio.descripcion,
                        mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                        esGenerico: be.ejercicio.esGenerico
                    }
                }))
            };

            const rutinaDia = blo.rutinaDia;
            if (rutinaDia?.rutinaSemanaId) {
                const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                if (semanaObj) {
                    const semanaKey = `semana_${semanaObj.id}`;
                    if (!semanasMap[semanaKey]) {
                        semanasMap[semanaKey] = { id: semanaObj.id, nombre: semanaObj.nombre ?? null, numero: semanaObj.numero ?? null, dias: {} };
                    }
                    if (!semanasMap[semanaKey].dias[diaKey]) {
                        semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] };
                    }
                    semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                    continue;
                }
            }

            if (!diasMap[diaKey]) {
                diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] };
            }
            diasMap[diaKey].bloques.push(bloqueMapped);
        }

        if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
            delete diasMap['sin_dia'];
        }

        const rutinaResp = {
            ID_Rutina: rutinaFull.ID_Rutina,
            nombre: rutinaFull.nombre,
            desc: rutinaFull.desc,
            claseRutina: rutinaFull.claseRutina,
            grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
            urlPlanificacion: rutinaFull.urlPlanificacion,
            createdAt: rutinaFull.createdAt,
            updatedAt: rutinaFull.updatedAt,
            dias: diasMap,
            semanas: Object.values(semanasMap),
            ...mapAsignacionesRutina(rutinaFull)
        };

        res.status(200).json({ message: "Rutina actualizada exitosamente", rutina: rutinaResp });
        return;
    } catch (error: any) {
        console.error("Error actualizando rutina:", error);
        res.status(500).json({ message: "Error actualizando rutina", error: error.message });
        return;
    }
};


// export const updateRutinaWithBlocks = async (req: Request, res: Response): Promise<void> => {
//     const idRutina = Number(req.params.id);
//     const {
//         nombre,
//         desc,
//         claseRutina,
//         grupoMuscularRutina,
//         dias,   // puede ser objeto nuevo { dia1: { nombre, descripcion, bloques } } o array legacy ['dia1','dia2']
//         bloques, // legacy: array de bloques sueltos (opcional)
//         ID_Usuario
//     } = req.body;

//     if (
//         isNaN(idRutina) ||
//         (!nombre && !desc && !claseRutina && !grupoMuscularRutina && !dias && !bloques)
//     ) {
//         res.status(400).json({ message: "Datos insuficientes o inválidos" });
//         return;
//     }

//     try {
//         // 1) Actualizar campos básicos de la rutina
//         const dataRutina: any = {};
//         if (typeof nombre === 'string') dataRutina.nombre = nombre;
//         if (typeof desc === 'string') dataRutina.desc = desc;
//         if (typeof claseRutina === 'string') dataRutina.claseRutina = claseRutina;
//         if (typeof grupoMuscularRutina === 'string') dataRutina.grupoMuscularRutina = grupoMuscularRutina;
//         // Si vino ID_Usuario (puede venir 0/number/string), convertimos y validamos
//         if (typeof ID_Usuario !== 'undefined' && ID_Usuario !== null) {
//             const idUserNum = Number(ID_Usuario);
//             if (Number.isNaN(idUserNum)) {
//                 res.status(400).json({ message: "ID_Usuario inválido" });
//                 return;
//             }
//             dataRutina.ID_Usuario = idUserNum;
//         }

//         if (Object.keys(dataRutina).length > 0) {
//             await prisma.rutina.update({ where: { ID_Rutina: idRutina }, data: dataRutina });
//         }

//         // 2) Borrar bloques y bloqueEjercicios existentes (clean-slate)
//         const existingBlocks = await prisma.bloque.findMany({
//             where: { ID_Rutina: idRutina },
//             select: { ID_Bloque: true }
//         });
//         const blockIds = existingBlocks.map(b => b.ID_Bloque);
//         if (blockIds.length) {
//             await prisma.bloqueEjercicio.deleteMany({ where: { ID_Bloque: { in: blockIds } } });
//         }
//         await prisma.bloque.deleteMany({ where: { ID_Rutina: idRutina } });

//         // 3) Borrar días existentes (los recrearemos según payload)
//         await prisma.rutinaDia.deleteMany({ where: { rutinaId: idRutina } });

//         // 4) Normalizar diasEntries:
//         let diasEntries: Array<[string, { nombre?: string; descripcion?: string; bloques?: any[] }]> = [];

//         if (dias && typeof dias === 'object' && !Array.isArray(dias)) {
//             diasEntries = Object.entries(dias) as any;
//         } else if (Array.isArray(dias)) {
//             diasEntries = (dias as string[]).map((d: string) => [d, { nombre: undefined, descripcion: undefined, bloques: [] }]);
//         } else if ((!dias || (typeof dias === 'object' && Object.keys(dias).length === 0)) && Array.isArray(bloques) && bloques.length > 0) {
//             diasEntries = [['dia1', { nombre: undefined, descripcion: undefined, bloques }]];
//         } else {
//             diasEntries = [];
//         }

//         // 5) Recolectar nuevos ejercicios (dedupe global) desde todos los bloques en diasEntries
//         const newEjercicioKeyMap = new Map<string, { nombre: string; descripcion?: string; mediaUrl?: string }>();
//         for (const [, dayPayload] of diasEntries) {
//             for (const blo of dayPayload.bloques || []) {
//                 for (const be of blo.bloqueEjercicios || []) {
//                     if (!be.ejercicioId && be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
//                         const key = be.nuevoEjercicio.nombre.trim().toLowerCase();
//                         if (!newEjercicioKeyMap.has(key)) {
//                             newEjercicioKeyMap.set(key, {
//                                 nombre: be.nuevoEjercicio.nombre.trim(),
//                                 descripcion: be.nuevoEjercicio.descripcion ?? undefined,
//                                 mediaUrl: be.nuevoEjercicio.mediaUrl ?? undefined
//                             });
//                         }
//                     }
//                 }
//             }
//         }

//         // 6) Crear ejercicios nuevos (si existen) y mapear nombre->id
//         const newEjCreatedMap = new Map<string, number>();
//         if (newEjercicioKeyMap.size) {
//             // secuencial para evitar issues en providers serverless
//             for (const payload of Array.from(newEjercicioKeyMap.values())) {
//                 const created = await prisma.ejercicio.create({
//                     data: {
//                         nombre: payload.nombre,
//                         descripcion: payload.descripcion ?? undefined,
//                         mediaUrl: payload.mediaUrl ?? undefined,
//                         esGenerico: true
//                     }
//                 });
//                 newEjCreatedMap.set(created.nombre.trim().toLowerCase(), created.ID_Ejercicio);
//             }
//         }

//         // 7) Crear días y mapear diaKey -> id
//         const diaKeyToId = new Map<string, number>();
//         for (const [diaKey, dayPayload] of diasEntries) {
//             const nombreDia = typeof dayPayload.nombre === 'string' && dayPayload.nombre.trim().length > 0
//                 ? dayPayload.nombre.trim()
//                 : undefined;
//             const descripcionDia = typeof dayPayload.descripcion === 'string' && dayPayload.descripcion.trim().length > 0
//                 ? dayPayload.descripcion.trim()
//                 : undefined;

//             const createdDay = await prisma.rutinaDia.create({
//                 data: {
//                     dia: diaKey,
//                     nombre: nombreDia,
//                     descripcion: descripcionDia,
//                     rutinaId: idRutina
//                 }
//             });
//             diaKeyToId.set(diaKey, createdDay.id);
//         }

//         // 8) Crear bloques por día (secuencial por día; puede paralelizarse por día si querés)
//         const createdBloquesInfo: Array<{ ID_Bloque: number; rutinaDiaId: number }> = [];
//         for (const [diaKey, dayPayload] of diasEntries) {
//             const rutinaDiaId = diaKeyToId.get(diaKey)!;
//             const bloquesDelDia = dayPayload.bloques || [];

//             // Validar y crear bloques del día
//             for (const blo of (bloquesDelDia as any[])) {
//                 if (!Object.values(BlockType).includes(blo.type)) {
//                     throw new Error(`Tipo de bloque no válido: ${blo.type}`);
//                 }

//                 const createdBloque = await prisma.bloque.create({
//                     data: {
//                         type: (blo.type as any),
//                         ID_Rutina: idRutina,
//                         rutinaDiaId,
//                         setsReps: blo.setsReps ?? null,
//                         nombreEj: blo.nombreEj ?? null,
//                         weight: blo.weight ?? null,
//                         descansoRonda: blo.descansoRonda ?? null,
//                         cantRondas: blo.cantRondas ?? null,
//                         durationMin: blo.durationMin ?? null,
//                         cantSeries: blo.cantSeries ?? null,
//                         descTabata: blo.descTabata ?? null,
//                         tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata ?? null,
//                         tipoEscalera: blo.tipoEscalera ?? null
//                     }
//                 });

//                 createdBloquesInfo.push({ ID_Bloque: createdBloque.ID_Bloque, rutinaDiaId });
//             }
//         }

//         // 9) Crear bloqueEjercicios (bulk por bloque) — **permitir duplicados** y asignar orden
//         const bloqueEjerciciosOps: Array<Promise<any>> = [];
//         let mappingIndex = 0;
//         for (const [, dayPayload] of diasEntries) {
//             const bloquesDelDia = dayPayload.bloques || [];
//             for (let i = 0; i < (bloquesDelDia as any[]).length; i++) {
//                 const bloInput = (bloquesDelDia as any[])[i];
//                 const createdBlo = createdBloquesInfo[mappingIndex++];
//                 const ID_Bloque = createdBlo?.ID_Bloque;
//                 if (!ID_Bloque) continue;

//                 const rows: Array<any> = [];
//                 let ordenCounter = 1;

//                 for (const be of bloInput.bloqueEjercicios || []) {
//                     let ID_Ejercicio: number | undefined;
//                     if (typeof be.ejercicioId === 'number') {
//                         ID_Ejercicio = be.ejercicioId;
//                     } else if (be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
//                         ID_Ejercicio = newEjCreatedMap.get(be.nuevoEjercicio.nombre.trim().toLowerCase());
//                         if (!ID_Ejercicio) continue;
//                     } else {
//                         continue;
//                     }

//                     rows.push({
//                         ID_Bloque,
//                         ID_Ejercicio,
//                         reps: be.reps ?? null,
//                         setRepWeight: be.setRepWeight ?? null,
//                         orden: typeof be.orden === 'number' ? be.orden : ordenCounter
//                     });

//                     ordenCounter++;
//                 }

//                 if (rows.length) {
//                     // Insertamos todo tal cual (sin skipDuplicates) para permitir repeticiones.
//                     bloqueEjerciciosOps.push(prisma.bloqueEjercicio.createMany({ data: rows }));
//                 }
//             }
//         }

//         if (bloqueEjerciciosOps.length) {
//             await Promise.all(bloqueEjerciciosOps);
//         }

//         // Fetch final con includes
//         const rutinaFull = await prisma.rutina.findUnique({
//             where: { ID_Rutina: idRutina },
//             include: {
//                 DiasRutina: true,
//                 Bloques: {
//                     include: {
//                         rutinaDia: true,
//                         bloqueEjercicios: { include: { ejercicio: true } }
//                     }
//                 }
//             }
//         });

//         if (!rutinaFull) {
//             res.status(404).json({ message: `Rutina con ID ${idRutina} no encontrada luego del update` });
//             return;
//         }

//         // Mapear respuesta a formato dias: { dia1: { nombre, descripcion, bloques: [...] } }
//         const diasMap: Record<string, any> = {};
//         for (const d of rutinaFull.DiasRutina) {
//             diasMap[d.dia] = { nombre: d.nombre ?? undefined, descripcion: d.descripcion ?? undefined, bloques: [] as any[] };
//         }

//         for (const blo of rutinaFull.Bloques) {
//             const diaKey = blo.rutinaDia?.dia;
//             if (!diaKey) continue;
//             const bloqueMapped = {
//                 ID_Bloque: blo.ID_Bloque,
//                 type: blo.type,
//                 setsReps: blo.setsReps,
//                 nombreEj: blo.nombreEj,
//                 weight: blo.weight,
//                 descansoRonda: blo.descansoRonda,
//                 cantRondas: blo.cantRondas,
//                 durationMin: blo.durationMin,
//                 tipoEscalera: blo.tipoEscalera,
//                 cantSeries: (blo as any).cantSeries ?? null,
//                 descTabata: (blo as any).descTabata ?? null,
//                 tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
//                 ejercicios: blo.bloqueEjercicios.map(be => ({
//                     ID_Ejercicio: be.ID_Ejercicio,
//                     reps: be.reps,
//                     setRepWeight: be.setRepWeight,
//                     orden: (be as any).orden ?? null,
//                     ejercicio: {
//                         ID_Ejercicio: be.ejercicio.ID_Ejercicio,
//                         nombre: be.ejercicio.nombre,
//                         descripcion: be.ejercicio.descripcion,
//                         mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
//                         esGenerico: be.ejercicio.esGenerico
//                     }
//                 }))
//             };
//             diasMap[diaKey].bloques.push(bloqueMapped);
//         }

//         const rutinaResp = {
//             ID_Rutina: rutinaFull.ID_Rutina,
//             nombre: rutinaFull.nombre,
//             desc: rutinaFull.desc,
//             claseRutina: rutinaFull.claseRutina,
//             grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
//             createdAt: rutinaFull.createdAt,
//             updatedAt: rutinaFull.updatedAt,
//             dias: diasMap
//         };

//         res.status(200).json({ message: "Rutina actualizada exitosamente", rutina: rutinaResp });
//         return;
//     } catch (error: any) {
//         console.error("Error actualizando rutina:", error);
//         res.status(500).json({ message: "Error actualizando rutina", error: error.message });
//         return;
//     }
// };

export const createRutinaSimple = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            ID_Usuario,
            ID_Entrenador,
            nombre,
            desc,
            claseRutina,
            grupoMuscularRutina,
            urlPlanificacion,
            usuariosAsignados,
            gruposAsignados
        } = req.body;

        const usuariosAsignadosIds = parseIdList(usuariosAsignados);
        const gruposAsignadosIds = parseIdList(gruposAsignados);
        const legacyUsuarioId = Number(ID_Usuario) || usuariosAsignadosIds[0] || Number(req.user?.ID_Usuario);

        if (!legacyUsuarioId || !nombre) {
            res.status(400).json({ message: "Faltan campos obligatorios: ID_Usuario o nombre" });
            return;
        }

        if (Array.isArray(usuariosAsignados) || Array.isArray(gruposAsignados)) {
            if (usuariosAsignadosIds.length === 0 && gruposAsignadosIds.length === 0) {
                res.status(400).json({ message: "Seleccioná al menos un usuario o grupo para asignar la rutina" });
                return;
            }
        }

        if (Array.isArray(gruposAsignados) && gruposAsignadosIds.length > 0) {
            const gruposCount = await prisma.grupoUsuario.count({
                where: { ID_GrupoUsuario: { in: gruposAsignadosIds }, estado: true }
            });
            if (gruposCount !== gruposAsignadosIds.length) {
                res.status(400).json({ message: "Uno o más grupos asignados no existen o están inactivos" });
                return;
            }
        }

        if ((Array.isArray(usuariosAsignados) && usuariosAsignadosIds.length > 0) || legacyUsuarioId) {
            const idsValidar = Array.from(new Set([...usuariosAsignadosIds, legacyUsuarioId]));
            const usuariosCount = await prisma.user.count({
                where: { ID_Usuario: { in: idsValidar } }
            });
            if (usuariosCount !== idsValidar.length) {
                res.status(400).json({ message: "Uno o más usuarios asignados no existen" });
                return;
            }
        }

        const rutina = await prisma.rutina.create({
            data: {
                ID_Usuario: legacyUsuarioId,
                ID_Entrenador: ID_Entrenador ?? null,
                nombre,
                desc: desc?.trim() || undefined,
                claseRutina: claseRutina?.trim() || undefined,
                grupoMuscularRutina: grupoMuscularRutina?.trim() || undefined,
                urlPlanificacion: urlPlanificacion?.trim() || null,
            },
            include: {
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude
            }
        });

        const rutinaId = rutina.ID_Rutina;

        await syncRutinaAsignaciones(
            prisma,
            rutinaId,
            Array.isArray(usuariosAsignados) ? usuariosAsignadosIds : undefined,
            Array.isArray(gruposAsignados) ? gruposAsignadosIds : undefined,
            Array.isArray(usuariosAsignados) ? null : legacyUsuarioId
        );

        const rutinaConAsignaciones = await prisma.rutina.findUnique({
            where: { ID_Rutina: rutinaId },
            include: {
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude
            }
        });

        if (!rutinaConAsignaciones) {
            res.status(500).json({ message: "Error al recuperar la rutina creada" });
            return;
        }

        const rutinaResp = {
            ID_Rutina: rutinaConAsignaciones.ID_Rutina,
            nombre: rutinaConAsignaciones.nombre,
            desc: rutinaConAsignaciones.desc,
            claseRutina: rutinaConAsignaciones.claseRutina,
            grupoMuscularRutina: rutinaConAsignaciones.grupoMuscularRutina,
            urlPlanificacion: rutinaConAsignaciones.urlPlanificacion,
            createdAt: rutinaConAsignaciones.createdAt,
            updatedAt: rutinaConAsignaciones.updatedAt,
            alumno: rutinaConAsignaciones.User,
            entrenador: rutinaConAsignaciones.Entrenador,
            dias: {},
            semanas: [],
            ...mapAsignacionesRutina(rutinaConAsignaciones)
        };

        res.status(201).json({
            message: "Rutina simple creada exitosamente",
            rutina: rutinaResp
        });
    } catch (error: any) {
        console.error("Error creando rutina simple:", error);
        res.status(500).json({ message: "Error al crear rutina simple", error: error.message });
    }
};

export const createRutinaWithBlocks = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            ID_Usuario,
            ID_Entrenador,
            nombre,
            desc,
            claseRutina,
            grupoMuscularRutina,
            usuariosAsignados,
            gruposAsignados,
            dias: diasObj,       // opcional: { lun: { nombre, descripcion, bloques: [...] }, ... }
            semanas: semanasObj  // opcional: { s1: { nombre, numero, dias: { lun: {...}, mar: {...} } }, ... }
        } = req.body;

        const usuariosAsignadosIds = parseIdList(usuariosAsignados);
        const gruposAsignadosIds = parseIdList(gruposAsignados);
        const legacyUsuarioId = Number(ID_Usuario) || usuariosAsignadosIds[0] || Number(req.user?.ID_Usuario);

        if (!legacyUsuarioId || !nombre) {
            res.status(400).json({ message: "Faltan campos obligatorios: ID_Usuario o nombre" });
            return;
        }

        if (Array.isArray(usuariosAsignados) || Array.isArray(gruposAsignados)) {
            if (usuariosAsignadosIds.length === 0 && gruposAsignadosIds.length === 0) {
                res.status(400).json({ message: "Seleccioná al menos un usuario o grupo para asignar la rutina" });
                return;
            }
        }

        if (Array.isArray(gruposAsignados) && gruposAsignadosIds.length > 0) {
            const gruposCount = await prisma.grupoUsuario.count({
                where: { ID_GrupoUsuario: { in: gruposAsignadosIds }, estado: true }
            });
            if (gruposCount !== gruposAsignadosIds.length) {
                res.status(400).json({ message: "Uno o más grupos asignados no existen o están inactivos" });
                return;
            }
        }

        if ((Array.isArray(usuariosAsignados) && usuariosAsignadosIds.length > 0) || legacyUsuarioId) {
            const idsValidar = Array.from(new Set([...usuariosAsignadosIds, legacyUsuarioId]));
            const usuariosCount = await prisma.user.count({
                where: { ID_Usuario: { in: idsValidar } }
            });
            if (usuariosCount !== idsValidar.length) {
                res.status(400).json({ message: "Uno o más usuarios asignados no existen" });
                return;
            }
        }

        if (!ID_Usuario && !Array.isArray(usuariosAsignados)) {
            res.status(400).json({ message: "Faltan campos obligatorios: ID_Usuario o usuariosAsignados" });
            return;
        }

        // 1) Crear rutina padre
        const rutina = await prisma.rutina.create({
            data: {
                ID_Usuario: legacyUsuarioId,
                ID_Entrenador: ID_Entrenador ?? null,
                nombre,
                desc: desc?.trim() || undefined,
                claseRutina: claseRutina?.trim() || undefined,
                grupoMuscularRutina: grupoMuscularRutina?.trim() || undefined,
            }
        });
        const rutinaId = rutina.ID_Rutina;

        await syncRutinaAsignaciones(
            prisma,
            rutinaId,
            Array.isArray(usuariosAsignados) ? usuariosAsignadosIds : undefined,
            Array.isArray(gruposAsignados) ? gruposAsignadosIds : undefined,
            Array.isArray(usuariosAsignados) ? null : legacyUsuarioId
        );

        // 2) Recolectar nuevos ejercicios (dedupe global)
        const newEjercicioKeyMap = new Map<string, { nombre: string; descripcion?: string; mediaUrl?: string }>();
        const collectNewEjFromBloques = (bloques: any[] | undefined) => {
            for (const blo of bloques || []) {
                for (const be of blo.bloqueEjercicios || []) {
                    if (!be.ejercicioId && be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
                        const key = be.nuevoEjercicio.nombre.trim().toLowerCase();
                        if (!newEjercicioKeyMap.has(key)) {
                            newEjercicioKeyMap.set(key, {
                                nombre: be.nuevoEjercicio.nombre.trim(),
                                descripcion: be.nuevoEjercicio.descripcion ?? undefined,
                                mediaUrl: be.nuevoEjercicio.mediaUrl ?? undefined,
                            });
                        }
                    }
                }
            }
        };

        // recorrer semanas -> dias -> bloques para recolectar nuevos ejercicios
        if (semanasObj && typeof semanasObj === "object") {
            for (const [, weekPayload] of Object.entries(semanasObj) as Array<[string, any]>) {
                const diasInWeek = weekPayload?.dias;
                if (diasInWeek && typeof diasInWeek === "object") {
                    for (const [, dayPayload] of Object.entries(diasInWeek) as Array<[string, any]>) {
                        collectNewEjFromBloques(dayPayload.bloques);
                    }
                }
            }
        }

        // recolectar de dias directos (si vienen)
        if (diasObj && typeof diasObj === "object") {
            for (const [, dayPayload] of Object.entries(diasObj) as Array<[string, any]>) {
                collectNewEjFromBloques(dayPayload.bloques);
            }
        }

        // 3) Crear ejercicios nuevos y mapear nombre->id
        const newEjCreatedMap = new Map<string, number>();
        if (newEjercicioKeyMap.size) {
            for (const payload of Array.from(newEjercicioKeyMap.values())) {
                const created = await prisma.ejercicio.create({
                    data: {
                        nombre: payload.nombre,
                        descripcion: payload.descripcion ?? undefined,
                        mediaUrl: payload.mediaUrl ?? undefined,
                        esGenerico: true
                    }
                });
                newEjCreatedMap.set(created.nombre.trim().toLowerCase(), created.ID_Ejercicio);
            }
        }

        // 4) Crear semanas y días manteniendo el orden en "dayOrder"
        type DayOrderItem = { diaKey: string; payload: any; rutinaDiaId: number };
        const dayOrder: DayOrderItem[] = [];

        // helper para crear un día y push al orden
        const createRutinaDia = async (diaKey: string, dayPayload: any, rutinaSemanaId?: number) => {
            const nombreDia = typeof dayPayload?.nombre === 'string' && dayPayload.nombre.trim().length > 0
                ? dayPayload.nombre.trim()
                : undefined;
            const descripcionDia = typeof dayPayload?.descripcion === 'string' && dayPayload.descripcion.trim().length > 0
                ? dayPayload.descripcion.trim()
                : undefined;

            const createdDay = await prisma.rutinaDia.create({
                data: {
                    dia: diaKey,
                    nombre: nombreDia,
                    descripcion: descripcionDia,
                    rutinaId,
                    rutinaSemanaId: rutinaSemanaId ?? null,
                }
            });
            dayOrder.push({ diaKey, payload: dayPayload, rutinaDiaId: createdDay.id });
        };

        // 4.a) crear semanas (si vienen) y sus días
        if (semanasObj && typeof semanasObj === "object") {
            for (const [weekKey, weekPayload] of Object.entries(semanasObj) as Array<[string, any]>) {
                const nombreSemana = typeof weekPayload?.nombre === 'string' && weekPayload.nombre.trim().length > 0
                    ? weekPayload.nombre.trim()
                    : undefined;
                const numeroSemana = typeof weekPayload?.numero === 'number' ? weekPayload.numero : undefined;

                const createdWeek = await prisma.semana.create({
                    data: {
                        nombre: nombreSemana,
                        numero: numeroSemana ?? null,
                        rutinaId
                    }
                });
                const diasInWeek = weekPayload?.dias && typeof weekPayload.dias === 'object' ? Object.entries(weekPayload.dias) as Array<[string, any]> : [];
                for (const [diaKey, dayPayload] of diasInWeek) {
                    await createRutinaDia(diaKey, dayPayload, createdWeek.id);
                }
            }
        }

        // 4.b) crear días que vienen en la raíz (si vienen) — se agregan después de las semanas
        if (diasObj && typeof diasObj === "object") {
            for (const [diaKey, dayPayload] of Object.entries(diasObj) as Array<[string, any]>) {
                await createRutinaDia(diaKey, dayPayload, undefined);
            }
        }

        // 5) Crear bloques por día (iterando dayOrder para preservar el mismo orden)
        const createdBloquesInfo: Array<{ ID_Bloque: number; rutinaDiaId: number }> = [];
        for (const dayItem of dayOrder) {
            const bloquesDelDia = dayItem.payload?.bloques || [];
            for (const blo of bloquesDelDia) {
                // validación simple del tipo (si tenés enum local, mantenlo)
                if (!Object.values(BlockType).includes(blo.type as any)) {
                    throw new Error(`Tipo de bloque no válido: ${blo.type}`);
                }

                const createdBloque = await prisma.bloque.create({
                    data: {
                        type: blo.type as any,
                        ID_Rutina: rutinaId,
                        rutinaDiaId: dayItem.rutinaDiaId,
                        setsReps: blo.setsReps ?? null,
                        nombreEj: blo.nombreEj ?? null,
                        weight: blo.weight ?? null,
                        descansoRonda: blo.descansoRonda ?? null,
                        cantRondas: blo.cantRondas ?? null,
                        durationMin: blo.durationMin ?? null,
                        cantSeries: blo.cantSeries ?? null,
                        descTabata: blo.descTabata ?? null,
                        tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata ?? null,
                        tipoEscalera: blo.tipoEscalera ?? null,
                    }
                });

                createdBloquesInfo.push({ ID_Bloque: createdBloque.ID_Bloque, rutinaDiaId: dayItem.rutinaDiaId });
            }
        }

        // 6) Crear bloqueEjercicios (bulk por bloque) — armamos rows para createMany manteniendo el orden
        const bloqueEjerciciosOps: Array<Promise<any>> = [];
        let mappingIndex = 0;
        for (const dayItem of dayOrder) {
            const bloquesDelDia = dayItem.payload?.bloques || [];
            for (let i = 0; i < bloquesDelDia.length; i++) {
                const bloInput = bloquesDelDia[i];
                const createdBlo = createdBloquesInfo[mappingIndex++];
                const ID_Bloque = createdBlo.ID_Bloque;

                const rows: Array<any> = [];
                let ordenCounter = 1;
                for (const be of bloInput.bloqueEjercicios || []) {
                    let ID_Ejercicio: number | undefined;
                    if (typeof be.ejercicioId === 'number') {
                        ID_Ejercicio = be.ejercicioId;
                    } else if (be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
                        ID_Ejercicio = newEjCreatedMap.get(be.nuevoEjercicio.nombre.trim().toLowerCase());
                        if (!ID_Ejercicio) continue;
                    } else {
                        continue;
                    }

                    rows.push({
                        ID_Bloque,
                        ID_Ejercicio,
                        reps: be.reps ?? null,
                        setRepWeight: be.setRepWeight ?? null,
                        orden: be.orden ?? ordenCounter,
                    });

                    ordenCounter++;
                }

                if (rows.length) {
                    bloqueEjerciciosOps.push(prisma.bloqueEjercicio.createMany({ data: rows }));
                }
            }
        }

        if (bloqueEjerciciosOps.length) {
            await Promise.all(bloqueEjerciciosOps);
        }

        // 7) Fetch final con includes
        const rutinaFull = await prisma.rutina.findUnique({
            where: { ID_Rutina: rutinaId },
            include: {
                DiasRutina: true,
                Semanas: {
                    include: { Dias: true }
                },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: { include: { ejercicio: true } }
                    }
                }
            }
        });

        if (!rutinaFull) {
            res.status(500).json({ message: "Error al recuperar la rutina creada" });
            return;
        }

        // 8) Mapear respuesta: reconstruyo 'dias' y 'semanas' según lo que haya en DB
        const diasMap: Record<string, any> = {};
        const semanasMap: Record<string, any> = {};

        // días sueltos (sin semana)
        for (const d of rutinaFull.DiasRutina) {
            if (!d.rutinaSemanaId) {
                diasMap[d.dia] = { nombre: d.nombre ?? null, descripcion: d.descripcion ?? null, bloques: [] as any[] };
            }
        }

        // semanas y sus días
        for (const s of rutinaFull.Semanas) {
            const semanaKey = `semana_${s.id}`;
            semanasMap[semanaKey] = { id: s.id, nombre: s.nombre ?? null, numero: s.numero ?? null, dias: {} as Record<string, any> };
            for (const day of s.Dias) {
                semanasMap[semanaKey].dias[day.dia] = { nombre: day.nombre ?? null, descripcion: day.descripcion ?? null, bloques: [] as any[] };
            }
        }

        // completar bloques (cada bloque tiene rutinaDia que nos indica a que día pertenece)
        for (const blo of rutinaFull.Bloques) {
            const diaKey = blo.rutinaDia?.dia;
            if (!diaKey) continue;
            const bloqueMapped = {
                ID_Bloque: blo.ID_Bloque,
                type: blo.type,
                setsReps: blo.setsReps,
                nombreEj: blo.nombreEj,
                weight: blo.weight,
                descansoRonda: blo.descansoRonda,
                cantRondas: blo.cantRondas,
                durationMin: blo.durationMin,
                tipoEscalera: blo.tipoEscalera,
                cantSeires: blo.cantSeries,
                descTabata: blo.descTabata,
                tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata,
                ejercicios: blo.bloqueEjercicios.map(be => ({
                    ID_Ejercicio: be.ID_Ejercicio,
                    reps: be.reps,
                    setRepWeight: be.setRepWeight,
                    ejercicio: {
                        ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                        nombre: be.ejercicio.nombre,
                        descripcion: be.ejercicio.descripcion,
                        mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                        esGenerico: be.ejercicio.esGenerico
                    }
                }))
            };

            // Si el día pertenece a una semana, buscarla en semanasMap (por id)
            const rutinaDia = blo.rutinaDia;
            if (rutinaDia?.rutinaSemanaId) {
                // encontrar semana en rutinaFull.Semanas que tenga ese día (podemos buscar por rutinaSemanaId)
                const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                if (semanaObj) {
                    const semanaKey = `semana_${semanaObj.id}`;
                    semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                    continue;
                }
            }

            // si no pertenece a semana, está en diasMap
            if (!diasMap[diaKey]) {
                // caso raro: si no estaba creado (por nombre duplicado), inicializar
                diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? null, descripcion: rutinaDia?.descripcion ?? null, bloques: [] };
            }
            diasMap[diaKey].bloques.push(bloqueMapped);
        }

        const rutinaResp = {
            ID_Rutina: rutinaFull.ID_Rutina,
            nombre: rutinaFull.nombre,
            desc: rutinaFull.desc,
            claseRutina: rutinaFull.claseRutina,
            grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
            createdAt: rutinaFull.createdAt,
            updatedAt: rutinaFull.updatedAt,
            dias: diasMap,
            semanas: Object.values(semanasMap), // array de semanas con sus dias
            ...mapAsignacionesRutina(rutinaFull)
        };

        res.status(201).json({ message: "Rutina creada exitosamente", rutina: rutinaResp });
        return;
    } catch (error: any) {
        console.error("Error creando rutina:", error);
        res.status(500).json({ message: "Error al crear la rutina", error: error.message });
        return;
    }
};
// export const createRutinaWithBlocks = async (req: Request, res: Response): Promise<void> => {
//     try {
//         const {
//             ID_Usuario,
//             ID_Entrenador,
//             nombre,
//             desc,
//             claseRutina,
//             grupoMuscularRutina,
//             dias: diasObj, // objeto { dia1: { nombre, descripcion, bloques: [...] }, ... }
//         } = req.body;

//         // Validación mínima
//         if (!ID_Usuario || !nombre) {
//             res.status(400).json({ message: "Faltan campos obligatorios: ID_Usuario o nombre" });
//             return;
//         }

//         // Normalizar entries de dias (Array de [diaKey, payload])
//         const diasEntries = diasObj && typeof diasObj === "object"
//             ? Object.entries(diasObj) as Array<[string, { nombre?: string; descripcion?: string; bloques?: BloqueInput[] }]>
//             : [];

//         // 1) Crear rutina padre (sin tx)
//         const rutina = await prisma.rutina.create({
//             data: {
//                 ID_Usuario,
//                 ID_Entrenador: ID_Entrenador ?? null,
//                 nombre,
//                 desc: desc?.trim() || undefined,
//                 claseRutina: claseRutina?.trim() || undefined,
//                 grupoMuscularRutina: grupoMuscularRutina?.trim() || undefined,
//             }
//         });
//         const rutinaId = rutina.ID_Rutina;

//         // 2) Recolectar nuevos ejercicios (dedupe global)
//         const newEjercicioKeyMap = new Map<string, { nombre: string; descripcion?: string; mediaUrl?: string }>();
//         for (const [, dayPayload] of diasEntries) {
//             for (const blo of dayPayload.bloques || []) {
//                 for (const be of blo.bloqueEjercicios || []) {
//                     if (!be.ejercicioId && be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
//                         const key = be.nuevoEjercicio.nombre.trim().toLowerCase();
//                         if (!newEjercicioKeyMap.has(key)) {
//                             newEjercicioKeyMap.set(key, {
//                                 nombre: be.nuevoEjercicio.nombre.trim(),
//                                 descripcion: be.nuevoEjercicio.descripcion ?? undefined,
//                                 mediaUrl: be.nuevoEjercicio.mediaUrl ?? undefined,
//                             });
//                         }
//                     }
//                 }
//             }
//         }

//         // 3) Crear ejercicios nuevos (si hay) y mapear nombre->id
//         const newEjCreatedMap = new Map<string, number>();
//         if (newEjercicioKeyMap.size) {
//             // Creamos secuencialmente (podés paralelizar si querés)
//             for (const payload of Array.from(newEjercicioKeyMap.values())) {
//                 const created = await prisma.ejercicio.create({
//                     data: {
//                         nombre: payload.nombre,
//                         descripcion: payload.descripcion ?? undefined,
//                         mediaUrl: payload.mediaUrl ?? undefined,
//                         esGenerico: true
//                     }
//                 });
//                 newEjCreatedMap.set(created.nombre.trim().toLowerCase(), created.ID_Ejercicio);
//             }
//         }

//         // 4) Crear los días uno por uno para obtener sus ids (map diaKey -> id)
//         const diaKeyToId = new Map<string, number>();
//         for (const [diaKey, dayPayload] of diasEntries) {
//             const nombreDia = typeof dayPayload.nombre === 'string' && dayPayload.nombre.trim().length > 0
//                 ? dayPayload.nombre.trim()
//                 : undefined;
//             const descripcionDia = typeof dayPayload.descripcion === 'string' && dayPayload.descripcion.trim().length > 0
//                 ? dayPayload.descripcion.trim()
//                 : undefined;

//             const createdDay = await prisma.rutinaDia.create({
//                 data: {
//                     dia: diaKey,
//                     nombre: nombreDia,
//                     descripcion: descripcionDia,
//                     rutinaId,
//                 }
//             });
//             diaKeyToId.set(diaKey, createdDay.id);
//         }

//         // 5) Crear bloques por día (paralelizar por día)
//         const createdBloquesInfo: Array<{ ID_Bloque: number; rutinaDiaId: number }> = [];
//         for (const [diaKey, dayPayload] of diasEntries) {
//             const rutinaDiaId = diaKeyToId.get(diaKey)!;
//             const bloquesDelDia = dayPayload.bloques || [];

//             // Validar tipos y crear bloques secuencialmente (puedes paralelizar si interesa)
//             for (const blo of bloquesDelDia) {
//                 // validación simple del tipo
//                 if (!Object.values(BlockType).includes(blo.type as any)) {
//                     // opcional: saltar o lanzar error; aquí lanzamos para que frontend sepa
//                     throw new Error(`Tipo de bloque no válido: ${blo.type}`);
//                 }

//                 const createdBloque = await prisma.bloque.create({
//                     data: {
//                         type: blo.type as any,
//                         ID_Rutina: rutinaId,
//                         rutinaDiaId,
//                         setsReps: blo.setsReps ?? null,
//                         nombreEj: blo.nombreEj ?? null,
//                         weight: blo.weight ?? null,
//                         descansoRonda: blo.descansoRonda ?? null,
//                         cantRondas: blo.cantRondas ?? null,
//                         durationMin: blo.durationMin ?? null,
//                         cantSeries: blo.cantSeries ?? null,
//                         descTabata: blo.descTabata ?? null,
//                         tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata ?? null,
//                         tipoEscalera: blo.tipoEscalera ?? null,
//                     }
//                 });

//                 createdBloquesInfo.push({ ID_Bloque: createdBloque.ID_Bloque, rutinaDiaId });
//             }
//         }

//         // 6) Crear bloqueEjercicios (bulk por bloque) — armamos rows para createMany
//         const bloqueEjerciciosOps: Array<Promise<any>> = [];
//         // Necesitamos iterar en el mismo orden: diasEntries -> bloques por día
//         let mappingIndex = 0;
//         for (const [, dayPayload] of diasEntries) {
//             const bloquesDelDia = dayPayload.bloques || [];
//             for (let i = 0; i < bloquesDelDia.length; i++) {
//                 const bloInput = bloquesDelDia[i];
//                 const createdBlo = createdBloquesInfo[mappingIndex++];
//                 const ID_Bloque = createdBlo.ID_Bloque;

//                 // Ya NO usamos 'seen' ni deduplicación: permitimos repetidos exactamente como vino el payload.
//                 const rows: Array<any> = [];

//                 // si querés mantener orden dentro del bloque (1,2,3...), calculalo aquí:
//                 let ordenCounter = 1;
//                 for (const be of bloInput.bloqueEjercicios || []) {
//                     let ID_Ejercicio: number | undefined;
//                     if (typeof be.ejercicioId === 'number') {
//                         ID_Ejercicio = be.ejercicioId;
//                     } else if (be.nuevoEjercicio && be.nuevoEjercicio.nombre) {
//                         ID_Ejercicio = newEjCreatedMap.get(be.nuevoEjercicio.nombre.trim().toLowerCase());
//                         if (!ID_Ejercicio) continue; // si por alguna razón no se creó, saltamos
//                     } else {
//                         continue;
//                     }

//                     rows.push({
//                         ID_Bloque,
//                         ID_Ejercicio,
//                         reps: be.reps ?? null,
//                         setRepWeight: be.setRepWeight ?? null,
//                         orden: be.orden ?? ordenCounter, // usa orden si viene, si no asigna secuencial
//                     });

//                     ordenCounter++;
//                 }

//                 if (rows.length) {
//                     // IMPORTANTE: NO usamos skipDuplicates aquí, queremos insertar TODO tal cual viene.
//                     bloqueEjerciciosOps.push(prisma.bloqueEjercicio.createMany({ data: rows }));
//                 }
//             }
//         }

//         // Ejecutar todas las operaciones createMany en paralelo
//         if (bloqueEjerciciosOps.length) {
//             await Promise.all(bloqueEjerciciosOps);
//         }

//         // 7) Fetch final con includes (incluimos rutinaDia en cada bloque)
//         const rutinaFull = await prisma.rutina.findUnique({
//             where: { ID_Rutina: rutinaId },
//             include: {
//                 DiasRutina: true,
//                 Bloques: {
//                     include: {
//                         rutinaDia: true,
//                         bloqueEjercicios: { include: { ejercicio: true } }
//                     }
//                 }
//             }
//         });

//         if (!rutinaFull) {
//             res.status(500).json({ message: "Error al recuperar la rutina creada" });
//             return;
//         }

//         // Mapeo final: construir objeto 'dias'
//         const diasMap: Record<string, any> = {};
//         for (const d of rutinaFull.DiasRutina) {
//             diasMap[d.dia] = { nombre: d.nombre ?? null, descripcion: d.descripcion ?? null, bloques: [] as any[] };
//         }

//         for (const blo of rutinaFull.Bloques) {
//             const diaKey = blo.rutinaDia?.dia;
//             if (!diaKey) continue;
//             const bloqueMapped = {
//                 ID_Bloque: blo.ID_Bloque,
//                 type: blo.type,
//                 setsReps: blo.setsReps,
//                 nombreEj: blo.nombreEj,
//                 weight: blo.weight,
//                 descansoRonda: blo.descansoRonda,
//                 cantRondas: blo.cantRondas,
//                 durationMin: blo.durationMin,
//                 tipoEscalera: blo.tipoEscalera,
//                 cantSeires: blo.cantSeries,
//                 descTabata: blo.descTabata,
//                 tiempoTrabajoDescansoTabata: blo.tiempoTrabajoDescansoTabata,
//                 ejercicios: blo.bloqueEjercicios.map(be => ({
//                     ID_Ejercicio: be.ID_Ejercicio,
//                     reps: be.reps,
//                     setRepWeight: be.setRepWeight,
//                     ejercicio: {
//                         ID_Ejercicio: be.ejercicio.ID_Ejercicio,
//                         nombre: be.ejercicio.nombre,
//                         descripcion: be.ejercicio.descripcion,
//                         mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
//                         esGenerico: be.ejercicio.esGenerico
//                     }
//                 }))
//             };
//             diasMap[diaKey].bloques.push(bloqueMapped);
//         }

//         const rutinaResp = {
//             ID_Rutina: rutinaFull.ID_Rutina,
//             nombre: rutinaFull.nombre,
//             desc: rutinaFull.desc,
//             claseRutina: rutinaFull.claseRutina,
//             grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
//             createdAt: rutinaFull.createdAt,
//             updatedAt: rutinaFull.updatedAt,
//             dias: diasMap
//         };

//         res.status(201).json({ message: "Rutina creada exitosamente", rutina: rutinaResp });
//         return;
//     } catch (error: any) {
//         console.error("Error creando rutina:", error);
//         res.status(500).json({ message: "Error al crear la rutina", error: error.message });
//         return;
//     }
// };

export const deleteRutinaWithBlocks = async (req: Request, res: Response): Promise<void> => {
    const idRutina = Number(req.params.id);
    if (isNaN(idRutina)) {
        res.status(400).json({ message: "ID de rutina inválido" });
        return;
    }

    try {
        // Verificar existencia
        const rutina = await prisma.rutina.findUnique({
            where: { ID_Rutina: idRutina },
            select: { ID_Rutina: true }
        });
        if (!rutina) {
            res.status(404).json({ message: "Rutina no encontrada" });
            return;
        }

        // Borrar rutina y todas las relaciones en cascada (Bloque, BloqueEjercicio, DiasRutina)
        await prisma.rutina.delete({
            where: { ID_Rutina: idRutina }
        });

        res.status(200).json({ message: "Rutina y bloques asociados eliminados exitosamente" });
    } catch (error: any) {
        console.error("Error eliminando rutina:", error);
        res.status(500).json({ message: "Error eliminando rutina", error: error.message });
    }
};

export const getRutinasByUsuario = async (req: Request, res: Response): Promise<void> => {
    const idUsuario = Number(req.params.idUsuario);
    if (isNaN(idUsuario)) {
        res.status(400).json({ message: "El parámetro 'idUsuario' debe ser un número válido" });
        return;
    }

    // Ownership: un cliente sólo puede ver sus propias rutinas; admin/entrenador, cualquiera.
    const requester = req.user;
    const isStaff = ['admin', 'entrenador'].includes(String(requester?.tipo || '').toLowerCase());
    if (!isStaff && requester?.ID_Usuario !== idUsuario) {
        res.status(403).json({ message: "No tenés permiso para ver las rutinas de otro usuario" });
        return;
    }

    try {
        const rutinas = await prisma.rutina.findMany({
            where: {
                OR: [
                    { asignacionesUsuarios: { some: { ID_Usuario: idUsuario } } },
                    {
                        asignacionesGrupos: {
                            some: {
                                grupoUsuario: {
                                    estado: true,
                                    miembros: { some: { ID_Usuario: idUsuario } }
                                }
                            }
                        }
                    },
                    { ID_Usuario: idUsuario }
                ]
            },
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, imagenUsuario: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!rutinas || rutinas.length === 0) {
            res.status(404).json({ message: `No se encontraron rutinas para el usuario ${idUsuario}` });
            return;
        }

        const resultado = rutinas.map(rutinaFull => {
            const diasMap: Record<string, any> = {};
            const semanasMap: Record<string, any> = {};

            // días sueltos (sin semana)
            for (const d of rutinaFull.DiasRutina) {
                if (!d.rutinaSemanaId) {
                    diasMap[d.dia] = {
                        nombre: d.nombre ?? undefined,
                        descripcion: d.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // inicializar semanas y sus días
            for (const s of rutinaFull.Semanas) {
                const semanaKey = `semana_${s.id}`;
                semanasMap[semanaKey] = {
                    id: s.id,
                    nombre: s.nombre ?? null,
                    numero: s.numero ?? null,
                    dias: {} as Record<string, any>
                };
                for (const day of s.Dias) {
                    semanasMap[semanaKey].dias[day.dia] = {
                        nombre: day.nombre ?? undefined,
                        descripcion: day.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // placeholder sin_dia
            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            // poblar bloques
            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                const rutinaDia = blo.rutinaDia;
                if (rutinaDia?.rutinaSemanaId) {
                    const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                    if (semanaObj) {
                        const semanaKey = `semana_${semanaObj.id}`;
                        if (!semanasMap[semanaKey]) {
                            semanasMap[semanaKey] = {
                                id: semanaObj.id,
                                nombre: semanaObj.nombre ?? null,
                                numero: semanaObj.numero ?? null,
                                dias: {}
                            };
                        }
                        if (!semanasMap[semanaKey].dias[diaKey]) {
                            semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                        }
                        semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                        continue;
                    }
                }

                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap,
                semanas: Object.values(semanasMap),
                ...mapAsignacionesRutina(rutinaFull)
            };
        });

        res.status(200).json({
            message: "Rutinas obtenidas exitosamente",
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas por usuario:", error);
        res.status(500).json({ message: "Error obteniendo rutinas", error: error.message });
    }
};

export const getRutinasByEntrenador = async (req: Request, res: Response): Promise<void> => {
    const idEntrenador = Number(req.params.idEntrenador);
    if (isNaN(idEntrenador)) {
        res.status(400).json({ message: "El parámetro 'entrenadorId' debe ser un número" });
        return;
    }

    try {
        const rutinas = await prisma.rutina.findMany({
            where: { ID_Entrenador: idEntrenador },
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!rutinas || rutinas.length === 0) {
            res.status(404).json({ message: `No se encontraron rutinas para el entrenador ${idEntrenador}` });
            return;
        }

        const resultado = rutinas.map(rutinaFull => {
            const diasMap: Record<string, any> = {};
            const semanasMap: Record<string, any> = {};

            for (const d of rutinaFull.DiasRutina) {
                if (!d.rutinaSemanaId) {
                    diasMap[d.dia] = {
                        nombre: d.nombre ?? undefined,
                        descripcion: d.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            for (const s of rutinaFull.Semanas) {
                const semanaKey = `semana_${s.id}`;
                semanasMap[semanaKey] = {
                    id: s.id,
                    nombre: s.nombre ?? null,
                    numero: s.numero ?? null,
                    dias: {} as Record<string, any>
                };
                for (const day of s.Dias) {
                    semanasMap[semanaKey].dias[day.dia] = {
                        nombre: day.nombre ?? undefined,
                        descripcion: day.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                const rutinaDia = blo.rutinaDia;
                if (rutinaDia?.rutinaSemanaId) {
                    const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                    if (semanaObj) {
                        const semanaKey = `semana_${semanaObj.id}`;
                        if (!semanasMap[semanaKey]) {
                            semanasMap[semanaKey] = {
                                id: semanaObj.id,
                                nombre: semanaObj.nombre ?? null,
                                numero: semanaObj.numero ?? null,
                                dias: {}
                            };
                        }
                        if (!semanasMap[semanaKey].dias[diaKey]) {
                            semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                        }
                        semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                        continue;
                    }
                }

                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap,
                semanas: Object.values(semanasMap),
                ...mapAsignacionesRutina(rutinaFull)
            };
        });

        res.status(200).json({
            message: `Rutinas del entrenador ${idEntrenador}`,
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas por entrenador:", error);
        res.status(500).json({ message: "Error al obtener rutinas", error: error.message });
    }
};

export const getRutinasByAdmins = async (req: Request, res: Response): Promise<void> => {
    try {
        const rutinas = await prisma.rutina.findMany({
            where: {
                User: { is: { tipo: 'admin' } },
                ID_Entrenador: null,                 // recomendadas: nunca tienen entrenador (las asignadas siempre lo setean)
                asignacionesGrupos: { none: {} },    // ni grupo asignado
            },
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!rutinas || rutinas.length === 0) {
            res.status(404).json({ message: "No se encontraron rutinas creadas por admins" });
            return;
        }

        const resultado = rutinas.map(rutinaFull => {
            const diasMap: Record<string, any> = {};
            const semanasMap: Record<string, any> = {};

            for (const d of rutinaFull.DiasRutina) {
                if (!d.rutinaSemanaId) {
                    diasMap[d.dia] = {
                        nombre: d.nombre ?? undefined,
                        descripcion: d.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            for (const s of rutinaFull.Semanas) {
                const semanaKey = `semana_${s.id}`;
                semanasMap[semanaKey] = {
                    id: s.id,
                    nombre: s.nombre ?? null,
                    numero: s.numero ?? null,
                    dias: {} as Record<string, any>
                };
                for (const day of s.Dias) {
                    semanasMap[semanaKey].dias[day.dia] = {
                        nombre: day.nombre ?? undefined,
                        descripcion: day.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                const rutinaDia = blo.rutinaDia;
                if (rutinaDia?.rutinaSemanaId) {
                    const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                    if (semanaObj) {
                        const semanaKey = `semana_${semanaObj.id}`;
                        if (!semanasMap[semanaKey]) {
                            semanasMap[semanaKey] = {
                                id: semanaObj.id,
                                nombre: semanaObj.nombre ?? null,
                                numero: semanaObj.numero ?? null,
                                dias: {}
                            };
                        }
                        if (!semanasMap[semanaKey].dias[diaKey]) {
                            semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                        }
                        semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                        continue;
                    }
                }

                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap,
                semanas: Object.values(semanasMap),
                ...mapAsignacionesRutina(rutinaFull)
            };
        });

        res.status(200).json({
            message: "Rutinas creadas por usuarios tipo 'admin'",
            total: resultado.length,
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas por admins:", error);
        res.status(500).json({ message: "Error al obtener rutinas", error: error.message });
    }
};

export const getRutinasByDayOfWeek = async (req: Request, res: Response): Promise<void> => {
    const dayOfWeek = req.params.dayOfWeek;
    if (!dayOfWeek) {
        res.status(400).json({ message: "El parámetro 'dayOfWeek' es requerido" });
        return;
    }

    try {
        const rutinas = await prisma.rutina.findMany({
            where: {
                DiasRutina: {
                    some: { dia: dayOfWeek }
                }
            },
            include: {
                DiasRutina: true,
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: {
                            include: { ejercicio: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (!rutinas || rutinas.length === 0) {
            res.status(404).json({ message: `No se encontraron rutinas para el día ${dayOfWeek}` });
            return;
        }

        const resultado = rutinas.map(rutinaFull => {
            // Construir mapa de días
            const diasMap: Record<string, any> = {};
            for (const d of rutinaFull.DiasRutina) {
                diasMap[d.dia] = {
                    nombre: d.nombre ?? undefined,
                    descripcion: d.descripcion ?? undefined,
                    bloques: [] as any[]
                };
            }

            // Si hay bloques sin día asignado
            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            // Recorrer bloques y asignarlos al día correspondiente
            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            // Eliminar 'sin_dia' si no tiene bloques
            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap
            };
        });

        res.status(200).json({
            message: `Rutinas obtenidas exitosamente para el día ${dayOfWeek}`,
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas por día de la semana:", error);
        res.status(500).json({ message: "Error obteniendo rutinas", error: error.message });
    }
};

export const getRutinasAsignadas = async (req: Request, res: Response): Promise<void> => {
    try {
        const pageNumber = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
        const take = Math.max(1, parseInt(String(req.query.take ?? '6'), 10) || 6);
        const skip = (pageNumber - 1) * take;

        const { grupoId, usuarioId, asignadasPorMi } = req.query;
        const where: any = { NOT: [{ ID_Entrenador: null }] }; // solo rutinas que tienen entrenador
        if (usuarioId && !isNaN(Number(usuarioId))) {
            where.ID_Usuario = Number(usuarioId);
        }
        if (grupoId && !isNaN(Number(grupoId))) {
            where.asignacionesGrupos = { some: { ID_GrupoUsuario: Number(grupoId) } };
        }
        if (String(asignadasPorMi) === 'true' && req.user?.ID_Usuario) {
            where.ID_Entrenador = req.user.ID_Usuario;
        }

        const [totalItems, rutinas] = await prisma.$transaction([
          prisma.rutina.count({ where }),
          prisma.rutina.findMany({
            where,
            include: {
                DiasRutina: true,
                Semanas: { include: { Dias: true } },
                User: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, email: true } },
                Entrenador: { select: { ID_Usuario: true, nombre: true, apellido: true, tipo: true, imagenUsuario: true } },
                ...rutinaAsignacionesInclude,
                Bloques: {
                    include: {
                        rutinaDia: true,
                        bloqueEjercicios: { include: { ejercicio: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take,
          })
        ]);

        const resultado = rutinas.map(rutinaFull => {
            const diasMap: Record<string, any> = {};
            const semanasMap: Record<string, any> = {};

            // días sueltos (sin semana)
            for (const d of rutinaFull.DiasRutina) {
                if (!d.rutinaSemanaId) {
                    diasMap[d.dia] = {
                        nombre: d.nombre ?? undefined,
                        descripcion: d.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // inicializar semanas y sus días
            for (const s of rutinaFull.Semanas) {
                const semanaKey = `semana_${s.id}`;
                semanasMap[semanaKey] = {
                    id: s.id,
                    nombre: s.nombre ?? null,
                    numero: s.numero ?? null,
                    dias: {} as Record<string, any>
                };
                for (const day of s.Dias) {
                    semanasMap[semanaKey].dias[day.dia] = {
                        nombre: day.nombre ?? undefined,
                        descripcion: day.descripcion ?? undefined,
                        bloques: [] as any[]
                    };
                }
            }

            // placeholder sin_dia
            if (!diasMap['sin_dia']) {
                diasMap['sin_dia'] = { nombre: undefined, descripcion: undefined, bloques: [] as any[] };
            }

            // poblar bloques (en dias o en semanas según corresponda)
            for (const blo of rutinaFull.Bloques) {
                const diaKey = blo.rutinaDia?.dia ?? 'sin_dia';
                const bloqueMapped = {
                    ID_Bloque: blo.ID_Bloque,
                    type: blo.type,
                    setsReps: blo.setsReps,
                    nombreEj: blo.nombreEj,
                    weight: blo.weight,
                    descansoRonda: blo.descansoRonda,
                    cantRondas: blo.cantRondas,
                    durationMin: blo.durationMin,
                    tipoEscalera: blo.tipoEscalera,
                    cantSeries: (blo as any).cantSeries ?? null,
                    descTabata: (blo as any).descTabata ?? null,
                    tiempoTrabajoDescansoTabata: (blo as any).tiempoTrabajoDescansoTabata ?? null,
                    ejercicios: blo.bloqueEjercicios.map(be => ({
                        ID_Ejercicio: be.ID_Ejercicio,
                        reps: be.reps,
                        setRepWeight: be.setRepWeight,
                        ejercicio: {
                            ID_Ejercicio: be.ejercicio.ID_Ejercicio,
                            nombre: be.ejercicio.nombre,
                            descripcion: be.ejercicio.descripcion,
                            mediaUrl: be.ejercicio.mediaUrl ? getImageUrl(be.ejercicio.mediaUrl, { secure: true }) : null,
                            esGenerico: be.ejercicio.esGenerico
                        }
                    }))
                };

                const rutinaDia = blo.rutinaDia;
                if (rutinaDia?.rutinaSemanaId) {
                    const semanaObj = rutinaFull.Semanas.find(s => s.id === rutinaDia.rutinaSemanaId);
                    if (semanaObj) {
                        const semanaKey = `semana_${semanaObj.id}`;
                        if (!semanasMap[semanaKey]) {
                            semanasMap[semanaKey] = {
                                id: semanaObj.id,
                                nombre: semanaObj.nombre ?? null,
                                numero: semanaObj.numero ?? null,
                                dias: {}
                            };
                        }
                        if (!semanasMap[semanaKey].dias[diaKey]) {
                            semanasMap[semanaKey].dias[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                        }
                        semanasMap[semanaKey].dias[diaKey].bloques.push(bloqueMapped);
                        continue;
                    }
                }

                if (!diasMap[diaKey]) {
                    diasMap[diaKey] = { nombre: rutinaDia?.nombre ?? undefined, descripcion: rutinaDia?.descripcion ?? undefined, bloques: [] as any[] };
                }
                diasMap[diaKey].bloques.push(bloqueMapped);
            }

            if (diasMap['sin_dia'] && diasMap['sin_dia'].bloques.length === 0) {
                delete diasMap['sin_dia'];
            }

            return {
                ID_Rutina: rutinaFull.ID_Rutina,
                nombre: rutinaFull.nombre,
                desc: rutinaFull.desc,
                claseRutina: rutinaFull.claseRutina,
                grupoMuscularRutina: rutinaFull.grupoMuscularRutina,
                urlPlanificacion: rutinaFull.urlPlanificacion,
                createdAt: rutinaFull.createdAt,
                updatedAt: rutinaFull.updatedAt,
                alumno: rutinaFull.User,
                entrenador: rutinaFull.Entrenador,
                dias: diasMap,
                semanas: Object.values(semanasMap),
                ...mapAsignacionesRutina(rutinaFull)
            };
        });

        const totalPages = Math.ceil(totalItems / take) || 1;
        res.status(200).json({
            message: `Rutinas con entrenador asignado`,
            meta: { totalItems, take, page: pageNumber, totalPages },
            rutinas: resultado
        });
    } catch (error: any) {
        console.error("Error obteniendo rutinas con entrenador:", error);
        res.status(500).json({ message: "Error al obtener rutinas", error: error.message });
    }
};



export const rutinaMethods = {
    getAllRutinasWithDetails,
    getRutinaById,
    createRutinaSimple,
    createRutinaWithBlocks,
    updateRutinaWithBlocks,
    deleteRutinaWithBlocks,
    getRutinasByDayOfWeek,
    getRutinasByUsuario,
    getRutinasByEntrenador,
    getRutinasByAdmins,
    getRutinasAsignadas
};
