// controllers/admin.Controller.ts
import { Request, Response } from 'express';
import prisma from "../models/Prisma.js";
import prismaC from "../models/Cuota.js";
import prismaU from "../models/User.js";
import { getChurnRiskReport } from '../services/churnRisk.service.js';
import { sendRetencionEmail } from '../services/email.service.js';

// Helper: "YYYY-MM" desde los componentes UTC de una fecha (igual criterio que Gasto/Cuota).
const monthKeyUTC = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        // 1) Cantidad total de clientes activos/inactivos
        const [totalActiveUsers, totalInactiveUsers] = await Promise.all([
            prismaU.count({ where: { estado: true, tipo: 'cliente' } }),
            prismaU.count({ where: { estado: false, tipo: 'cliente' } }),
        ]);

        // 2) Definir el mes actual en formato YYYY-MM
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const monthStr = `${year}-${month}`; // e.g. "2025-05"

        // 3) Cuotas pagadas y pendientes en el mes actual (conteo)
        const [paidCount, pendingCount] = await Promise.all([
            prismaC.count({
                where: { mes: monthStr, pagada: true }
            }),
            prismaC.count({
                where: { mes: monthStr, pagada: false }
            })
        ]);

        // 4) Suma de importes de cuotas pagadas y pendientes en el mes actual
        const [paidSum, pendingSum] = await Promise.all([
            prismaC.aggregate({
                where: { mes: monthStr, pagada: true },
                _sum: { importe: true }
            }),
            prismaC.aggregate({
                where: { mes: monthStr, pagada: false },
                _sum: { importe: true }
            })
        ]);

        // 5) Histórico mensual de importes pagados
        const monthlySums = await prismaC.groupBy({
            by: ['mes'],
            where: { pagada: true },
            _sum: { importe: true },
            orderBy: { mes: 'asc' }
        });

        const monthlyPaidAmounts = monthlySums.map(entry => ({
            mes: entry.mes,
            totalPagado: entry._sum.importe ?? 0
        }));

        // -----------------------------
        // Cuotas vencidas (por flag `vencida: true`)
        // -----------------------------
        const [overdueCount, overdueSumAgg] = await Promise.all([
            prismaC.count({ where: { vencida: true } }),
            prismaC.aggregate({ where: { vencida: true }, _sum: { importe: true } })
        ]);
        const overdueAmount = overdueSumAgg._sum.importe ?? 0;

        // -----------------------------
        // FINANZAS: gastos, ganancia neta, tasa de cobranza
        // -----------------------------
        const ingresosMes = paidSum._sum.importe ?? 0;
        const pendienteMes = pendingSum._sum.importe ?? 0;

        const [gastosMesAgg, gastosByMes] = await Promise.all([
            prisma.gasto.aggregate({ where: { mes: monthStr }, _sum: { monto: true } }),
            prisma.gasto.groupBy({ by: ['mes'], _sum: { monto: true } }),
        ]);
        const gastosMes = gastosMesAgg._sum.monto ?? 0;
        const gananciaNetaMes = ingresosMes - gastosMes;
        const tasaCobranzaMes = (ingresosMes + pendienteMes) > 0
            ? Math.round((ingresosMes / (ingresosMes + pendienteMes)) * 100)
            : 0;

        // Serie financiera combinada por mes: ingresos + gastos + ganancia
        const finMap = new Map<string, { ingresos: number; gastos: number }>();
        for (const e of monthlyPaidAmounts) finMap.set(e.mes, { ingresos: e.totalPagado, gastos: 0 });
        for (const g of gastosByMes) {
            const cur = finMap.get(g.mes) ?? { ingresos: 0, gastos: 0 };
            cur.gastos = g._sum.monto ?? 0;
            finMap.set(g.mes, cur);
        }
        const financeHistory = Array.from(finMap.entries())
            .map(([mes, v]) => ({ mes, ingresos: v.ingresos, gastos: v.gastos, ganancia: v.ingresos - v.gastos }))
            .sort((a, b) => a.mes.localeCompare(b.mes));

        // -----------------------------
        // SOCIOS: altas/bajas desde el log de movimientos (fuente de verdad)
        // -----------------------------
        const movimientos = await prisma.movimientoSocio.findMany({
            select: {
                tipo: true,
                esReactivacion: true,
                motivoBaja: true,
                motivoReactivacion: true,
                fecha: true,
                // El motivo del ALTA inicial vive en User.motivoAlta (el de reactivación, en el evento)
                User: { select: { motivoAlta: true } },
            }
        });

        const memMap = new Map<string, { altasNuevas: number; reactivaciones: number; bajas: number }>();
        const motivoMap = new Map<string, number>(); // bajas: `${mes}__${motivo}` -> cantidad
        const altaMotivoMap = new Map<string, number>(); // altas: `${mes}__${motivo}` -> cantidad
        for (const m of movimientos) {
            const mes = monthKeyUTC(m.fecha);
            const bucket = memMap.get(mes) ?? { altasNuevas: 0, reactivaciones: 0, bajas: 0 };
            if (m.tipo === 'ALTA') {
                if (m.esReactivacion) bucket.reactivaciones += 1;
                else bucket.altasNuevas += 1;
                const motivoAlta = (m.esReactivacion ? m.motivoReactivacion : m.User?.motivoAlta) || 'Otro / Sin motivo';
                const altaKey = `${mes}__${motivoAlta}`;
                altaMotivoMap.set(altaKey, (altaMotivoMap.get(altaKey) ?? 0) + 1);
            } else if (m.tipo === 'BAJA') {
                bucket.bajas += 1;
                const motivo = m.motivoBaja || 'Otros / Sin motivo';
                const key = `${mes}__${motivo}`;
                motivoMap.set(key, (motivoMap.get(key) ?? 0) + 1);
            }
            memMap.set(mes, bucket);
        }

        const membershipHistory = Array.from(memMap.entries())
            .map(([mes, v]) => ({
                mes,
                altasNuevas: v.altasNuevas,
                reactivaciones: v.reactivaciones,
                altas: v.altasNuevas + v.reactivaciones,
                bajas: v.bajas,
                neto: v.altasNuevas + v.reactivaciones - v.bajas,
            }))
            .sort((a, b) => a.mes.localeCompare(b.mes));

        const bajasPorMotivo = Array.from(motivoMap.entries()).map(([k, cantidad]) => {
            const [mes, motivo] = k.split('__');
            return { mes, motivo, cantidad };
        });

        const altasPorMotivo = Array.from(altaMotivoMap.entries()).map(([k, cantidad]) => {
            const [mes, motivo] = k.split('__');
            return { mes, motivo, cantidad };
        });

        const cur = memMap.get(monthStr) ?? { altasNuevas: 0, reactivaciones: 0, bajas: 0 };
        const altasMes = cur.altasNuevas + cur.reactivaciones;
        const reactivacionesMes = cur.reactivaciones;
        const bajasMes = cur.bajas;
        const crecimientoNetoMes = altasMes - bajasMes;

        // 6) Responder todo junto
        res.status(200).json({
            kpi: {
                totalActiveUsers,
                totalInactiveUsers,
                quotasPaidThisMonth: paidCount,
                quotasPendingThisMonth: pendingCount,
                totalAmountPaidThisMonth: ingresosMes,
                totalAmountPendingThisMonth: pendienteMes,
                quotasOverdue: overdueCount,
                totalAmountOverdue: overdueAmount,
                // Finanzas
                gastosMes,
                gananciaNetaMes,
                tasaCobranzaMes,
                // Socios
                altasMes,
                reactivacionesMes,
                bajasMes,
                crecimientoNetoMes,
            },
            history: monthlyPaidAmounts,
            financeHistory,
            membershipHistory,
            bajasPorMotivo,
            altasPorMotivo,
        });
    } catch (error: any) {
        console.error('Error obteniendo estadísticas de dashboard:', error);
        res.status(500).json({
            message: 'Error al obtener estadísticas de dashboard',
            error: error.message
        });
    }
};

export const getChurnRisk = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const take = Math.min(100, Math.max(1, parseInt(String(req.query.take || '20'), 10) || 20));
        const riskLevel = typeof req.query.riskLevel === 'string' ? req.query.riskLevel : undefined;
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const normalizedRiskLevel = riskLevel?.trim().toUpperCase();

        if (normalizedRiskLevel && !['ALTO', 'MEDIO', 'BAJO', 'MEDIO_ALTO'].includes(normalizedRiskLevel)) {
            res.status(400).json({ message: "Parametro 'riskLevel' invalido. Usar ALTO|MEDIO|BAJO|MEDIO_ALTO" });
            return;
        }

        const report = await getChurnRiskReport({ page, take, riskLevel: normalizedRiskLevel as any, search });
        res.status(200).json(report);
    } catch (error: any) {
        console.error('Error obteniendo predictor de bajas:', error);
        res.status(500).json({
            message: 'Error al obtener el predictor de bajas',
            error: error.message
        });
    }
};

// Mail de retención manual desde "Riesgo de baja" (con log en ContactoAlumno).
export const sendChurnContactEmail = async (req: Request, res: Response): Promise<void> => {
    try {
        const { ID_Usuario, asunto, mensaje, plantilla } = req.body;

        const usuarioId = Number(ID_Usuario);
        if (!Number.isInteger(usuarioId) || usuarioId < 1) {
            res.status(400).json({ message: "'ID_Usuario' inválido" });
            return;
        }
        const asuntoClean = typeof asunto === 'string' ? asunto.trim() : '';
        const mensajeClean = typeof mensaje === 'string' ? mensaje.trim() : '';
        if (!asuntoClean || asuntoClean.length > 150) {
            res.status(400).json({ message: "El 'asunto' es obligatorio (máx. 150 caracteres)" });
            return;
        }
        if (!mensajeClean || mensajeClean.length > 2000) {
            res.status(400).json({ message: "El 'mensaje' es obligatorio (máx. 2000 caracteres)" });
            return;
        }

        const user = await prisma.user.findUnique({
            where: { ID_Usuario: usuarioId },
            select: { ID_Usuario: true, email: true, nombre: true, apellido: true },
        });
        if (!user) {
            res.status(404).json({ message: 'Usuario no encontrado' });
            return;
        }

        const nombre = `${user.nombre ?? ''} ${user.apellido ?? ''}`.trim();
        await sendRetencionEmail(user.email, { nombre, asunto: asuntoClean, mensaje: mensajeClean });

        const contacto = await prisma.contactoAlumno.create({
            data: {
                ID_Usuario: user.ID_Usuario,
                asunto: asuntoClean,
                plantilla: typeof plantilla === 'string' && plantilla.trim() ? plantilla.trim() : null,
                enviadoPor: req.user?.ID_Usuario ?? null,
            },
        });

        res.status(200).json({ ok: true, fecha: contacto.fecha, enviadoA: user.email });
    } catch (error: any) {
        console.error('Error enviando mail de retención:', error);
        res.status(500).json({ message: 'No se pudo enviar el mail', error: error.message });
    }
};

export const adminMethods = {
    getDashboardStats,
    getChurnRisk,
    sendChurnContactEmail
}
