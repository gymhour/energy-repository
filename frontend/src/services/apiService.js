import apiClient, { authClient } from '../axiosConfig';
import { ATTENDANCE_REJECT_REASON, ATTENDANCE_STATUS } from '../types/attendanceTypes';

const attendanceReasonMap = {
    DENEGADO_NO_EXISTE: ATTENDANCE_REJECT_REASON.STUDENT_NOT_FOUND,
    DENEGADO_INACTIVO: ATTENDANCE_REJECT_REASON.USER_INACTIVE,
    DENEGADO_CUOTA: ATTENDANCE_REJECT_REASON.MEMBERSHIP_EXPIRED,
    DENEGADO_DUPLICADO: ATTENDANCE_REJECT_REASON.DUPLICATE_ATTENDANCE,
    DENEGADO_SIN_TURNO: ATTENDANCE_REJECT_REASON.NO_ACTIVE_PLAN,
    DENEGADO_LIMITE_SEMANAL: ATTENDANCE_REJECT_REASON.WEEKLY_LIMIT_REACHED,
};

const normalizeAttendanceMethod = method => (
    String(method || 'DNI').toLowerCase() === 'qr' ? 'qr' : 'dni'
);

const mapCheckInResponse = data => {
    const allowed = Boolean(data?.permitido);
    const fullName = [data?.alumno?.nombre, data?.alumno?.apellido].filter(Boolean).join(' ');

    return {
        allowed,
        status: allowed ? ATTENDANCE_STATUS.ALLOWED : ATTENDANCE_STATUS.REJECTED,
        message: data?.motivo || (allowed ? 'Ingreso permitido.' : 'Ingreso rechazado.'),
        reason: attendanceReasonMap[data?.resultado],
        student: data?.alumno ? {
            id: data.alumno.id ? String(data.alumno.id) : '',
            name: fullName || '-',
            dni: data.alumno.dni || '',
        } : undefined,
        attendance: data?.asistencia ? {
            id: String(data.asistencia.id),
            date: data.asistencia.fechaIngreso,
            method: normalizeAttendanceMethod(data.asistencia.metodo),
        } : undefined,
    };
};

const mapAttendanceHistoryItem = item => {
    const fullName = [item?.User?.nombre, item?.User?.apellido].filter(Boolean).join(' ');

    return {
        id: String(item?.ID_Asistencia),
        student: item?.User ? {
            id: item?.ID_Usuario ? String(item.ID_Usuario) : '',
            name: fullName || '-',
            dni: item.User.dni || '',
        } : undefined,
        date: item?.fechaIngreso,
        method: normalizeAttendanceMethod(item?.metodo),
        status: item?.permitido ? ATTENDANCE_STATUS.ALLOWED : ATTENDANCE_STATUS.REJECTED,
        reason: attendanceReasonMap[item?.resultado],
        rejectionReason: item?.permitido ? '' : item?.motivo,
        plan: item?.Cuota?.planNombreSnapshot
            ? { name: item.Cuota.planNombreSnapshot }
            : undefined,
    };
};

const getApiErrorData = error => {
    if (error?.response?.data) return error.response.data;
    return null;
};

// Clases
const getClases = async () => {
    try {
        const response = await apiClient.get(`/clase/horario`);
        return response.data;
    } catch (err) {
        throw new Error("Error al cargar las clases. Intente nuevamente.");
    }
};

// Disponibilidad de cupos de un horario para una fecha concreta (ISO sin zona, ej: "2026-07-27T11:00:00")
const getHorarioCupos = async (idHorario, fechaISO) => {
    try {
        const response = await apiClient.get(`/clase/horario/${idHorario}/cupos`, {
            params: { fecha: fechaISO },
        });
        return response.data;
    } catch (err) {
        throw new Error("Error al cargar la disponibilidad del horario.");
    }
};

// Turnos
const getTurnos = async (filters = {}) => {
    try {
        const params = {};
        if (filters.fechaDesde) params.fechaDesde = filters.fechaDesde;
        if (filters.fechaHasta) params.fechaHasta = filters.fechaHasta;

        const response = await apiClient.get(`/turnos`, { params });
        return response.data;
    } catch (error) {
        throw new Error("Error en el service de getTurnos")
    }
}

const getTurnosUsuario = async (usuarioId) => {
    try {
        const response = await apiClient.get(`/turnos/usuario/${usuarioId}`)
        return response.data.turnos;
    } catch (error) {
        throw new Error("Error en el service de getTurnosUsuario");
    }
}

const getTurnoById = async (id) => {
    try {
        const response = await apiClient.get(`/turnos/${id}`);
        return response.data;
    } catch (error) {
        throw new Error("Error en el service de getTurnosByUsuario")
    }
}
// services/apiService.js
const postTurno = async (body) => {
    try {
        const response = await apiClient.post("/turnos", body);
        return response.data;
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || error.message);
    }
};


// Borrado FÍSICO (solo admin): elimina definitivamente un turno AUSENTE/CANCELADO
const deleteTurnoFisico = async (id) => {
    try {
        const response = await apiClient.delete(`/turnos/${id}/fisico`);
        return response.data;
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || 'No se pudo eliminar el turno.');
    }
};

const deleteTurno = async (id) => {
    try {
        const response = await apiClient.delete(`/turnos/${id}`);
        return response.data
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || "Error en el service de deleteTurno")
    }
}

// Rutinas
const getRutinas = async () => {
    try {
        const response = await apiClient.get("/rutinas");
        return response.data
    } catch (error) {
        throw new Error("Error en el service de getRutinas");
    }
}

const getRutinaById = async (rutinaId) => {
    try {
        const response = await apiClient.get(`/rutinas/${rutinaId}`);
        return response.data.rutina;
    } catch (error) {
        throw new Error("Error en el service de getRutinas");
    }
}

const getUserRutinas = async (id) => {
    try {
        const response = await apiClient.get(`/rutinas/usuario/${id}`);
        return response.data
    } catch (error) {
        throw new Error("Error en el service de getRutinas");
    }
}

const createRutina = async (data) => {
    try {
        const response = await apiClient.post("/rutinas", data);
        return response.data;
    } catch (error) {
        throw new Error("Error al crear la rutina");
    }
};

const createRutinaSimple = async (data) => {
    try {
        const response = await apiClient.post("/rutinas/simple", data);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || "Error al crear la rutina simplificada");
    }
};

const editRutina = async (idRutina, data) => {
    try {
        const response = await apiClient.put(`/rutinas/${idRutina}`, data);
        return response.data
    } catch (error) {
        throw new Error("Error en el service de getRutinas");
    }
}

const deleteRutina = async (id) => {
    try {
        const response = await apiClient.delete(`/rutinas/${id}`);
        return response.data;
    } catch (error) {
        throw new Error("Error al eliminar la rutina");
    }
}

const getRutinasAsignadas = async ({ page = 1, take = 6, grupoId, usuarioId, asignadasPorMi } = {}) => {
    try {
        const params = { page, take };
        if (grupoId) params.grupoId = grupoId;
        if (usuarioId) params.usuarioId = usuarioId;
        if (asignadasPorMi) params.asignadasPorMi = true;
        const response = await apiClient.get("/rutinas/asignadas", { params });
        return response.data;
    } catch {
        throw new Error("Error al traer las rutinas asignadas");
    }
}

const getRutinasEntrenadores = async (idEntrenador) => {
    try {
        const response = await apiClient.get(`/rutinas/entrenador/${idEntrenador}`)
        return response.data;
    } catch (error) {
        throw new Error("Error al traer las rutinas asignadas por el entrenador");
    }
}

const getRutinasAdmins = async () => {
    try {
        const response = await apiClient.get(`/rutinas/admins`)
        return response.data;
    } catch (error) {
        const apiMessage = error.response?.data?.message;
        if (error.response?.status === 404 && apiMessage === 'No se encontraron rutinas creadas por admins') {
            return { rutinas: [] };
        }

        throw new Error("Error al traer las rutinas del admin");
    }
}

// Grupos de usuarios
const getGruposUsuarios = async () => {
    try {
        const response = await apiClient.get('/grupos-usuarios');
        return response.data;
    } catch (error) {
        throw new Error('Error al obtener grupos de usuarios');
    }
}

const getGrupoUsuarioById = async (id) => {
    try {
        const response = await apiClient.get(`/grupos-usuarios/${id}`);
        return response.data;
    } catch (error) {
        throw new Error('Error al obtener el grupo de usuarios');
    }
}

const createGrupoUsuario = async (body) => {
    try {
        const response = await apiClient.post('/grupos-usuarios', body);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al crear grupo de usuarios');
    }
}

const updateGrupoUsuario = async (id, body) => {
    try {
        const response = await apiClient.put(`/grupos-usuarios/${id}`, body);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al actualizar grupo de usuarios');
    }
}

const deleteGrupoUsuario = async (id) => {
    try {
        const response = await apiClient.delete(`/grupos-usuarios/${id}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || 'Error al eliminar grupo de usuarios');
    }
}

/* Entrenadores */
const getEntrenadores = async () => {
    try {
        const response = await apiClient.get('/usuarios/entrenadores');
        return response.data;
    } catch (error) {
        throw new Error("Error al obtener entrenadores");
    }
};

const addEntrenadorToClase = async (idClase, idEntrenador) => {
    try {
        const response = await apiClient.post(`/clase/${idClase}/entrenador/${idEntrenador}`)
    } catch (error) {
        throw new Error("Error al asignar entrenador a una clase");
    }
}

const removeEntrenadorFromClase = async (idClase, idEntrenador) => {
    try {
        const response = await apiClient.delete(`/clase/${idClase}/entrenador/${idEntrenador}`)
    } catch (error) {
        throw new Error("Error al asignar entrenador a una clase");
    }
}

const getAllUsuarios = async ({ page = 1, take = 15, tipo, estado, search, nombre, apellido, email, dni, planId, sinPlan } = {}) => {
    try {
        const params = { page, take };
        if (tipo) params.tipo = tipo;
        if (estado !== undefined) params.estado = estado;
        if (search?.trim()) params.search = search.trim();
        if (nombre?.trim()) params.nombre = nombre.trim();
        if (apellido?.trim()) params.apellido = apellido.trim();
        if (email?.trim()) params.email = email.trim();
        if (dni?.trim()) params.dni = dni.trim();
        if (planId) params.planId = planId;
        if (sinPlan) params.sinPlan = true;

        const response = await apiClient('/usuarios', {
            params,
        });
        return response.data;
    } catch (error) {
        throw new Error(`Error al obtener los usuarios`);
    }
};

const getUsuariosStats = async () => {
    try {
        const response = await apiClient.get('/usuarios/stats');
        return response.data;
    } catch (error) {
        throw new Error('Error al obtener KPIs de usuarios');
    }
};


const getUserById = async (id) => {
    try {
        const response = await apiClient.get(`/usuarios/${id}`);
        return response.data
    } catch (error) {
        throw new Error(`Error al obtener el usuario con ID ${id}`);
    }
}

const updateUserById = async (id, body) => {
    try {
        const response = await apiClient.put(`/usuarios/${id}`, body);
        return response.data
    } catch (error) {
        throw new Error(`Error al editar el usuario con ID ${id}`);
    }
}

const updateUserHealthById = async (id, body) => {
    try {
        const response = await apiClient.put(`/usuarios/${id}/salud`, body);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || `Error al editar salud del usuario con ID ${id}`);
    }
}

const getUsuariosAdmins = async () => {
    try {
        const response = await apiClient.get(`/usuarios/admins`);
        return response.data;
    } catch (error) {
        throw new Error(`Error al traer los usuarios administradores`);
    }
}

// Contraseñas
const forgotPassword = async (body) => {
    try {
        const response = await apiClient.post('/auth/forgot-password', body);
        return response.data;
    } catch (error) {
        throw new Error(`Error al enviar mail para recuperar contraseña`);
    }
}

const resetPassword = async (body) => {
    try {
        const response = await apiClient.post('/auth/reset-password', body);
        return response.data;
    } catch (error) {
        throw new Error('Error al crear nueva contraseña');
    }
}

const changePassword = async (body) => {
    try {
        const response = await apiClient.put("/auth/change-password", body);
        return response.data;
    } catch (error) {
        return error
    }
}

// Medicion resultado
const getEjerciciosResultados = async () => {
    try {
        const response = await apiClient.get('/ejercicios-resultados');
        return response.data;
    } catch (err) {
        throw new Error("Error al traer ejercicios y resultados");
    }
}

const getEjerciciosResultadosUsuario = async (usuarioId) => {
    try {
        const response = await apiClient.get(`/ejercicios-resultados/usuario/${usuarioId}`);
        return response.data.ejercicios;
    } catch (err) {
        throw new Error("Error en el servicio getEjerciciosResultadosUsuario");
    }
}

const deleteEjerciciosResultados = async (id) => {
    try {
        const response = await apiClient.delete(`/historicoEjercicio/${id}`);
        return response.data;
    } catch (err) {
        throw new Error("Error al traer ejercicios y resultados");
    }
}

const putEjercicioResultado = async (id, body) => {
    try {
        const response = await apiClient.put(`/historicoEjercicio/${id}`, body);
        return response.data;
    } catch (err) {
        throw new Error("Error al traer ejercicios y resultados");
    }
}

// Ejercicio
const postEjercicio = async (body) => {
    try {
        const response = await apiClient.post(`/ejercicios-resultados`, body);
        return response;
    } catch (err) {
        throw new Error("Error en el servicio postEjercicio");
    }
}

const postEjercicioResultado = async (body) => {
    try {
        const response = await apiClient.post("/historicoEjercicio", body);
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio postEjercicioResultado");
    }
}

const deleteEjercicio = async (ejercicioId) => {
    try {
        const response = await apiClient.delete(`/ejercicios-resultados/${ejercicioId}`);
        return response.data;
    } catch (err) {
        throw new Error("Error en el servicio postEjercicio");
    }
}

// Admin dashboard
const getKPIs = async () => {
    try {
        const response = await apiClient.get("/admin/dashboard");
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio de getKPIs")
    }
}

const getChurnRisk = async ({ page = 1, take = 20, riskLevel = '', search = '' } = {}) => {
    try {
        const params = { page, take };
        if (riskLevel) params.riskLevel = riskLevel;
        if (search?.trim()) params.search = search.trim();

        const response = await apiClient.get("/admin/churn-risk", { params });
        return response.data;
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || "Error en el servicio de getChurnRisk");
    }
}

const sendChurnContactEmail = async ({ ID_Usuario, asunto, mensaje, plantilla }) => {
    try {
        const response = await apiClient.post("/admin/churn-risk/contact", { ID_Usuario, asunto, mensaje, plantilla });
        return response.data;
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || "No se pudo enviar el mail.");
    }
}

// Admin planes
const getPlanes = async () => {
    try {
        const response = await apiClient.get("/planes");
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio de getPlanes")
    }
}

const postPlanes = async (body) => {
    try {
        const response = await apiClient.post("/planes", body);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de postPlanes")
    }
}

const deletePlanes = async (id) => {
    try {
        const response = await apiClient.delete(`/planes/${id}`);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de deletePlanes")
    }
}

const putPlanes = async (id, body) => {
    try {
        const response = await apiClient.put(`/planes/${id}`, body)
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio de putPlanes")
    }
}

// Cuotas
const postCuotasMasivas = async (body) => {
    try {
        const response = await apiClient.post("cuotas/generate-cuotas", body);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de postCuotasMasivas")
    }
}

const postValidarTurnosFijos = async (body) => {
    try {
        const response = await apiClient.post("cuotas/validate-turnos-fijos", body);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de postValidarTurnosFijos")
    }
}

// Generación masiva por lotes (paso 1: valida cupos globales y devuelve los IDs pendientes).
// No envolvemos el error: re-lanzamos el de axios para que el orquestador lea err.response.
const prepararCuotasMasivas = async (body) => {
    const response = await apiClient.post("cuotas/generate-cuotas/preparar", body);
    return response.data;
}

// Generación masiva por lotes (paso 2: procesa un chunk de IDs en una transacción corta).
const generarCuotasLote = async (body) => {
    const response = await apiClient.post("cuotas/generate-cuotas/lote", body);
    return response.data;
}

const prepararEliminacionCuotasByMes = async (body) => {
    const response = await apiClient.post("cuotas/delete-cuotas/preparar", body);
    return response.data;
}

const eliminarCuotasByMesLote = async (body) => {
    const response = await apiClient.post("cuotas/delete-cuotas/lote", body);
    return response.data;
}

const getCuotaManualPreview = async (idUsuario, mes) => {
    const response = await apiClient.get(`cuotas/usuario/${idUsuario}/preview`, {
        params: { mes },
    });
    return response.data;
}

const prepararCuotaUsuarioLotes = async (idUsuario, body) => {
    const response = await apiClient.post(`cuotas/usuario/${idUsuario}/preparar-lotes`, body);
    return response.data;
}

const generarTurnosCuotaUsuarioLote = async (idUsuario, body) => {
    const response = await apiClient.post(`cuotas/usuario/${idUsuario}/turnos-fijos/lote`, body);
    return response.data;
}

const regenerateTurnosFijosUsuario = async (idUsuario) => {
    try {
        const response = await apiClient.post(`cuotas/usuario/${idUsuario}/regenerate-turnos-fijos`);
        return response.data;
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || "Error en el servicio de regenerateTurnosFijosUsuario");
    }
}

const getCuotasUsuario = async (id) => {
    try {
        const response = await apiClient.get(`cuotas/usuario/${id}/cuotas`);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de getCuotasUsuario")
    }
}

const getCuotasReminder = async (idUsuario) => {
    try {
        const response = await apiClient.get(`/cuotas/reminder/${idUsuario}`);
        return response.data;
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || "Error en el servicio de getCuotasReminder");
    }
}

// Gastos (Salidas de dinero)
const getGastos = async ({ page = 1, categoria, mes, fechaDesde, fechaHasta } = {}) => {
    try {
        const params = { page };
        if (categoria) params.categoria = categoria;
        if (mes) params.mes = mes;
        if (fechaDesde) params.fechaDesde = fechaDesde;
        if (fechaHasta) params.fechaHasta = fechaHasta;
        const response = await apiClient.get('/gastos', { params });
        return response.data; // { meta, data }
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || 'No se pudieron cargar los gastos.');
    }
}

const createGasto = async (payload) => {
    try {
        const response = await apiClient.post('/gastos', payload);
        return response.data;
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || 'No se pudo crear el gasto.');
    }
}

const updateGasto = async (id, payload) => {
    try {
        const response = await apiClient.put(`/gastos/${id}`, payload);
        return response.data;
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || 'No se pudo actualizar el gasto.');
    }
}

const deleteGasto = async (id) => {
    try {
        const response = await apiClient.delete(`/gastos/${id}`);
        return response.data;
    } catch (error) {
        const apiMsg = error?.response?.data?.message;
        throw new Error(apiMsg || 'No se pudo eliminar el gasto.');
    }
}

// Asistencias
const registerAttendance = async ({ dni, method = 'DNI' }) => {
    try {
        const response = await authClient.post('/usuarios/asistencias/registrar', {
            dni,
            metodo: method,
        });
        return mapCheckInResponse(response.data);
    } catch (error) {
        const apiData = getApiErrorData(error);
        if (apiData) {
            return mapCheckInResponse(apiData);
        }
        throw new Error(error.message || 'No se pudo registrar la asistencia');
    }
}

const getAttendances = async (filters = {}, { page = 1, take = 20 } = {}) => {
    try {
        const params = {
            page,
            limit: take,
        };

        if (filters.dni?.trim()) {
            params.dni = filters.dni.trim();
        }
        if (filters.student?.trim()) {
            params.student = filters.student.trim();
        }
        if (filters.method?.trim()) {
            params.metodo = filters.method.trim().toUpperCase();
        }
        if (filters.fromDate) {
            params.fechaInicio = filters.fromDate;
        }
        if (filters.toDate) {
            params.fechaFin = `${filters.toDate}T23:59:59`;
        }
        if (filters.status === ATTENDANCE_STATUS.ALLOWED) {
            params.permitido = true;
        }
        if (filters.status === ATTENDANCE_STATUS.REJECTED) {
            params.permitido = false;
        }

        const response = await apiClient.get('/usuarios/asistencias/historial', { params });
        const data = Array.isArray(response.data?.data) ? response.data.data : [];

        return {
            items: data.map(mapAttendanceHistoryItem),
            pagination: response.data?.pagination || { total: data.length, pages: 1, page, limit: take },
        };
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || 'No se pudieron cargar las asistencias.');
    }
}

const getMyAttendances = async () => {
    try {
        const response = await apiClient.get('/usuarios/asistencias/mis-asistencias');
        const data = Array.isArray(response.data?.data) ? response.data.data : [];

        return {
            summary: response.data?.summary || null,
            attendances: data.map(mapAttendanceHistoryItem),
        };
    } catch (error) {
        const apiMsg = error.response?.data?.message;
        throw new Error(apiMsg || 'No se pudieron cargar tus asistencias.');
    }
}


// Ejercicios
const getEjercicios = async () => {
    try {
        const response = await apiClient.get("/ejercicios");
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio de getEjercicios")
    }
}

// Ejercicios
const getEjercicioById = async (id) => {
    try {
        const response = await apiClient.get(`/ejercicios/${id}`);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de getEjercicios")
    }
}

const postEjercicios = async (body) => {
    try {
        const response = await apiClient.post("/ejercicios", body);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de postEjercicios")
    }
}

const deleteEjercicios = async (id) => {
    try {
        const response = await apiClient.delete(`/ejercicios/${id}`);
        return response;
    } catch (error) {
        throw new Error("Error en el servicio de deleteEjercicios")
    }
}

const putEjercicios = async (id, body) => {
    try {
        const response = await apiClient.put(`/ejercicios/${id}`, body)
        return response.data;
    } catch (error) {
        throw new Error("Error en el servicio de putEjercicios")
    }
}

// Helpers
export async function fetchAllClientsActive(apiService, { take = 100 } = {}) {
    let page = 1;
    let totalPages = 1;

    const byId = new Map();

    do {
        const resp = await apiService.getAllUsuarios({ page, take });
        const data = Array.isArray(resp?.data) ? resp.data : [];

        // Filtrar solo clientes activos
        data.forEach(u => {
            const isCliente = String(u?.tipo ?? '').toLowerCase() === 'cliente';
            const isActivo = u?.estado === true;
            if (isCliente && isActivo) {
                byId.set(u.ID_Usuario, u);
            }
        });

        totalPages = Number(resp?.meta?.totalPages || 1);
        page += 1;
    } while (page <= totalPages);

    return Array.from(byId.values());
}

export default {
    // Clases
    getClases,
    getHorarioCupos,
    // Turnos
    getTurnos,
    getTurnosUsuario,
    getTurnoById,
    postTurno,
    deleteTurno,
    deleteTurnoFisico,
    // Rutinas
    getRutinas,
    getRutinaById,
    getUserRutinas,
    createRutina,
    createRutinaSimple,
    editRutina,
    deleteRutina,
    getRutinasEntrenadores,
    getRutinasAdmins,
    getRutinasAsignadas,
    getGruposUsuarios,
    getGrupoUsuarioById,
    createGrupoUsuario,
    updateGrupoUsuario,
    deleteGrupoUsuario,
    // Entrenadores
    getEntrenadores,
    addEntrenadorToClase,
    removeEntrenadorFromClase,
    // Usuario
    getAllUsuarios,
    getUsuariosStats,
    getUserById,
    updateUserById,
    updateUserHealthById,
    getUsuariosAdmins,
    // Contraseña
    forgotPassword,
    resetPassword,
    changePassword,
    // Medicion resultado
    getEjerciciosResultados,
    getEjerciciosResultadosUsuario,
    deleteEjerciciosResultados,
    putEjercicioResultado,
    postEjercicio,
    deleteEjercicio,
    postEjercicioResultado,
    // Admin dashboard
    getKPIs,
    getChurnRisk,
    sendChurnContactEmail,
    // Planes
    getPlanes,
    postPlanes,
    deletePlanes,
    putPlanes,
    // Cuotas
    getCuotasUsuario,
    postCuotasMasivas,
    prepararCuotasMasivas,
    generarCuotasLote,
    prepararEliminacionCuotasByMes,
    eliminarCuotasByMesLote,
    getCuotaManualPreview,
    prepararCuotaUsuarioLotes,
    generarTurnosCuotaUsuarioLote,
    postValidarTurnosFijos,
    regenerateTurnosFijosUsuario,
    getCuotasReminder,
    // Gastos
    getGastos,
    createGasto,
    updateGasto,
    deleteGasto,
    // Asistencias
    registerAttendance,
    getAttendances,
    getMyAttendances,
    // Ejercicios
    getEjercicios,
    getEjercicioById,
    postEjercicios,
    putEjercicios,
    deleteEjercicios,
    // Helpers
    fetchAllClientsActive
};
