import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiClient from '../../../axiosConfig';
import apiService from '../../../services/apiService';
import './usuariosList.css';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import { toast } from "react-toastify";
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, UserPlus, Upload, ExternalLink, SlidersHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import ReprogramarTurnoModal from '../../../Components/utils/ReprogramarTurnoModal/ReprogramarTurnoModal';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import ImportUsuariosModal from './ImportUsuariosModal';
import { ROLES, TIPOS_USUARIO, esRecepcion, labelDeTipo } from '../../../utils/roles';

// Motivos de baja (debe coincidir con la whitelist del backend en user.Controller.ts)
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
];

// Motivos de alta / reactivación (debe coincidir con MOTIVOS_ALTA del backend)
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
];

const normalizeFilterValue = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeTextFilters = (filters) => ({
  ...filters,
  nombre: normalizeFilterValue(filters.nombre),
  apellido: normalizeFilterValue(filters.apellido),
  email: normalizeFilterValue(filters.email),
  dni: normalizeFilterValue(filters.dni),
});

const emptyUsuariosFilters = { tipo: '', nombre: '', apellido: '', email: '', estado: '', dni: '', plan: '', movimiento: '', movimientoMes: '' };

// Espejo de la guarda del backend: recepción no puede editar cuentas de administrador.
const puedeGestionar = (usuario) => (
  !(esRecepcion() && String(usuario?.tipo || '').toLowerCase() === ROLES.ADMIN)
);

const normalizeTipoParam = (value) => {
  const normalized = String(value || '').toLowerCase();
  return TIPOS_USUARIO.some(t => t.value === normalized) ? normalized : '';
};

const normalizeEstadoParam = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'activo' || normalized === 'true' || normalized === '1') return 'Activo';
  if (normalized === 'inactivo' || normalized === 'false' || normalized === '0') return 'Inactivo';
  return '';
};

const normalizeMovimientoParam = (value) => {
  const normalized = String(value || '').toUpperCase();
  return normalized === 'ALTA' || normalized === 'BAJA' ? normalized : '';
};

const SIN_PLAN_FILTER_VALUE = '__SIN_PLAN__';

const getUsuariosFiltersFromSearch = (searchParams) => ({
  ...emptyUsuariosFilters,
  tipo: normalizeTipoParam(searchParams.get('tipo')),
  estado: normalizeEstadoParam(searchParams.get('estado')),
  plan: normalizeFilterValue(searchParams.get('plan')),
  movimiento: normalizeMovimientoParam(searchParams.get('movimiento')),
  movimientoMes: normalizeFilterValue(searchParams.get('mes')),
});

const UsuariosList = ({ fromAdmin, fromEntrenador }) => {
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const initialFilters = useMemo(
    () => getUsuariosFiltersFromSearch(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosStats, setUsuariosStats] = useState({ activos: 0, inactivos: 0, sinPlanAsignado: 0 });
  const [loading, setLoading] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [motivoSeleccionado, setMotivoSeleccionado] = useState('');
  // Flujo "Eliminar y reprogramar" turno AUSENTE/CANCELADO: { user: {id,nombre}, turno: {id,label} }
  const [reprogramarData, setReprogramarData] = useState(null);
  const [turnoCancelData, setTurnoCancelData] = useState(null);
  const [turnoCancelLoading, setTurnoCancelLoading] = useState(false);

  // Refresca el historial del modal "Ver turnos" sin cerrarlo (post borrado/creación de turno)
  const refreshTurnosHistory = () => {
    if (!historyUser) return;
    apiService.getTurnosUsuario(historyUser.ID_Usuario)
      .then((data) => setTurnosHistory(data || []))
      .catch(() => {});
  };
  const [showImportModal, setShowImportModal] = useState(false);

  // Historial de turnos modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyUser, setHistoryUser] = useState(null);
  const [turnosHistory, setTurnosHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histFiltroEstado, setHistFiltroEstado] = useState('');
  const [histFechaDesde, setHistFechaDesde] = useState('');
  const [histFechaHasta, setHistFechaHasta] = useState('');
  const [historyActiveTab, setHistoryActiveTab] = useState('past');
  const [showCancelPendingPopup, setShowCancelPendingPopup] = useState(false);
  const [cancelPendingLoading, setCancelPendingLoading] = useState(false);
  const [showRegenerateFixedPopup, setShowRegenerateFixedPopup] = useState(false);
  const [regenerateFixedLoading, setRegenerateFixedLoading] = useState(false);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthUser, setHealthUser] = useState(null);
  const [healthForm, setHealthForm] = useState({ observacionesSalud: '', fichaMedicaUrl: '' });
  const [healthLoading, setHealthLoading] = useState(false);

  // ➜ agregamos estado en filtros
  const [filtros, setFiltros] = useState(initialFilters);
  const [draftFiltros, setDraftFiltros] = useState(filtros);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const defaultAvatar = "https://..."; // tu URL
  const opcionesTipo = fromAdmin
    ? TIPOS_USUARIO
    : TIPOS_USUARIO.filter(t => t.value === ROLES.CLIENTE);
  const opcionesEstado = ['Activo', 'Inactivo'];
  const [planesList, setPlanesList] = useState([]);

  const [showFilters, setShowFilters] = useState(Boolean(searchParamsString));

  const estadoToBool = (s) => {
    if (s === 'Activo') return true;
    if (s === 'Inactivo') return false;
    return undefined;
  };

  const fetchUsuarios = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      const activeFilters = normalizeTextFilters(filtros);
      if (activeFilters.tipo) params.tipo = activeFilters.tipo; // TIPOS_USUARIO ya guarda el valor normalizado
      if (activeFilters.nombre) params.nombre = activeFilters.nombre;
      if (activeFilters.apellido) params.apellido = activeFilters.apellido;
      if (activeFilters.email) params.email = activeFilters.email;
      if (activeFilters.dni) params.dni = activeFilters.dni;
      if (activeFilters.plan === SIN_PLAN_FILTER_VALUE) {
        params.sinPlan = true;
      } else if (activeFilters.plan) {
        params.planId = activeFilters.plan;
      }
      if (activeFilters.movimiento) params.movimientoTipo = activeFilters.movimiento;
      if (activeFilters.movimientoMes) params.movimientoMes = activeFilters.movimientoMes;

      // ➜ enviar estado=true/false si corresponde
      if (activeFilters.estado) {
        const est = estadoToBool(activeFilters.estado);
        if (typeof est === 'boolean') params.estado = est;
      }

      params.page = page;

      const { data } = await apiClient.get('/usuarios', { params });
      const lista = data.data || [];
      const listaUsuariosClientes = lista.filter(u => u.tipo === "cliente");

      setUsuarios(fromAdmin ? lista : listaUsuariosClientes);
      setHasMore(lista.length > 0);
    } catch (err) {
      console.error('Error al obtener los usuarios:', err);
      toast.error('No se pudieron cargar los usuarios');
    } finally {
      setLoading(false);
    }
  }, [filtros, page, fromAdmin]);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  useEffect(() => {
    setFiltros(initialFilters);
    setDraftFiltros(initialFilters);
    setPage(1);
    if (searchParamsString) setShowFilters(true);
  }, [initialFilters, searchParamsString]);

  const fetchUsuariosStats = useCallback(async () => {
    try {
      const stats = await apiService.getUsuariosStats();
      setUsuariosStats({
        activos: Number(stats?.alumnos?.activos || 0),
        inactivos: Number(stats?.alumnos?.inactivos || 0),
        sinPlanAsignado: Number(stats?.alumnos?.sinPlanAsignado || 0),
      });
    } catch (err) {
      console.error('Error al obtener KPIs de usuarios:', err);
    }
  }, []);

  useEffect(() => { fetchUsuariosStats(); }, [fetchUsuariosStats]);

  useEffect(() => {
    apiService.getPlanes().then(res => {
      if (Array.isArray(res)) setPlanesList(res);
    }).catch(() => {});
  }, []);

  const handleChangeDraft = (e) =>
    setDraftFiltros(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const aplicarFiltros = (e) => {
    e.preventDefault();
    setPage(1);
    setFiltros(normalizeTextFilters(draftFiltros));
  };

  const limpiarFiltros = () => {
    setDraftFiltros(emptyUsuariosFilters);
    setFiltros(emptyUsuariosFilters);
    setPage(1);
  };

  const updateUsuarioEstado = async (id, nuevoEstado, motivo) => {
    setLoading(true);
    try {
      const body = { estado: nuevoEstado };
      if (!nuevoEstado && motivo) body.motivoBaja = motivo;
      if (nuevoEstado && motivo) body.motivoReactivacion = motivo;
      const { data } = await apiClient.put(`/usuarios/estado/${id}`, body);
      setUsuarios(prev =>
        prev.map(u =>
          u.ID_Usuario === id ? { ...u, estado: nuevoEstado } : u
        )
      );
      fetchUsuariosStats();
      // El backend detalla cuántos turnos y turnos fijos se liberaron con la baja.
      toast.success(data?.message || `Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
    } catch {
      toast.error('Error al actualizar estado');
    } finally {
      setLoading(false);
    }
  };

  const openEstadoPopup = user => {
    setSelectedUser(user);
    setMotivoSeleccionado('');
    setIsPopupOpen(true);
  };
  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedUser(null);
    setMotivoSeleccionado('');
  };
  const confirmEstadoChange = () => {
    if (!selectedUser) return;
    // Acción única según el estado actual: activo → baja; inactivo → reactivación.
    updateUsuarioEstado(selectedUser.ID_Usuario, !selectedUser.estado, motivoSeleccionado);
    closePopup();
  };

  const fetchTurnosHistory = async (user) => {
    setHistoryUser(user);
    setHistFiltroEstado('');
    setHistFechaDesde('');
    setHistFechaHasta('');
    setHistoryActiveTab('past');
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const data = await apiService.getTurnosUsuario(user.ID_Usuario);
      setTurnosHistory(data || []);
    } catch {
      toast.error('Error al cargar historial de turnos');
      setTurnosHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };
  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryUser(null);
    setTurnosHistory([]);
  };

  const parseLocalISO = useCallback((isoString) => {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  }, []);

  const getTurnoDateTime = useCallback((turno) => {
    const fecha = new Date(turno.fecha);
    if (Number.isNaN(fecha.getTime())) return new Date(0);

    const horaIni = turno.HorarioClase?.horaIni ? parseLocalISO(turno.HorarioClase.horaIni) : null;
    if (horaIni) {
      fecha.setHours(horaIni.getHours(), horaIni.getMinutes(), horaIni.getSeconds(), 0);
    }

    return fecha;
  }, [parseLocalISO]);

  const isPendingTurno = useCallback((turno, now = new Date()) =>
    getTurnoDateTime(turno) > now && turno.estado !== 'CANCELADO',
    [getTurnoDateTime]
  );

  const isPastTurno = useCallback((turno, now = new Date()) =>
    getTurnoDateTime(turno) <= now,
    [getTurnoDateTime]
  );

  const historyTabCounts = useMemo(() => {
    const now = new Date();
    return {
      past: turnosHistory.filter(t => isPastTurno(t, now)).length,
      pending: turnosHistory.filter(t => isPendingTurno(t, now)).length,
    };
  }, [turnosHistory, isPastTurno, isPendingTurno]);

  const pendingTurnos = useMemo(() => {
    const now = new Date();
    return turnosHistory.filter(t => isPendingTurno(t, now));
  }, [turnosHistory, isPendingTurno]);

  const handleCancelPendingTurnos = async () => {
    if (cancelPendingLoading) return;

    if (pendingTurnos.length === 0) {
      setShowCancelPendingPopup(false);
      return;
    }

    setCancelPendingLoading(true);
    try {
      const results = await Promise.allSettled(
        pendingTurnos.map(t => apiService.deleteTurno(t.id_turno))
      );
      const successfulIds = pendingTurnos
        .filter((_, index) => results[index].status === 'fulfilled')
        .map(t => t.id_turno);
      const failedCount = results.length - successfulIds.length;

      if (successfulIds.length > 0) {
        setTurnosHistory(prev =>
          prev.map(t =>
            successfulIds.includes(t.id_turno) ? { ...t, estado: 'CANCELADO' } : t
          )
        );
      }

      if (failedCount > 0) {
        toast.error(`Se cancelaron ${successfulIds.length} turno(s), pero ${failedCount} no se pudieron cancelar.`);
      } else {
        toast.success('Todos los turnos pendientes fueron cancelados.');
      }
    } catch {
      toast.error('Error al cancelar los turnos pendientes.');
    } finally {
      setCancelPendingLoading(false);
      setShowCancelPendingPopup(false);
    }
  };

  const openCancelTurnoPopup = (turno) => {
    const horario = turno.HorarioClase;
    const clase = horario?.Clase?.nombre || '—';
    setTurnoCancelData({
      id: turno.id_turno,
      label: `${getDiaSemana(turno.fecha)} ${formatFecha(turno.fecha)} ${formatHora(horario?.horaIni)} · ${clase}`,
    });
  };

  const handleCancelSingleTurno = async () => {
    if (!turnoCancelData?.id || turnoCancelLoading) return;

    setTurnoCancelLoading(true);
    try {
      await apiService.deleteTurno(turnoCancelData.id);
      setTurnosHistory(prev =>
        prev.map(t =>
          t.id_turno === turnoCancelData.id ? { ...t, estado: 'CANCELADO' } : t
        )
      );
      toast.success('Turno cancelado correctamente.');
      setTurnoCancelData(null);
    } catch (error) {
      toast.error(error?.message || 'No se pudo cancelar el turno.');
    } finally {
      setTurnoCancelLoading(false);
    }
  };

  const handleRegenerateFixedTurnos = async () => {
    if (regenerateFixedLoading) return;

    if (!historyUser?.ID_Usuario) {
      setShowRegenerateFixedPopup(false);
      return;
    }

    setRegenerateFixedLoading(true);
    try {
      const result = await apiService.regenerateTurnosFijosUsuario(historyUser.ID_Usuario);
      const data = await apiService.getTurnosUsuario(historyUser.ID_Usuario);
      setTurnosHistory(data || []);
      setHistoryActiveTab('pending');

      if (result?.advertencias?.detalles?.length > 0) {
        toast.warning(result.advertencias.mensaje || result.message || 'Se regeneraron algunos turnos fijos con advertencias.');
      } else {
        toast.success(result?.message || 'Turnos fijos regenerados correctamente.');
      }
    } catch (error) {
      toast.error(error?.message || 'Error al regenerar turnos fijos.');
    } finally {
      setRegenerateFixedLoading(false);
      setShowRegenerateFixedPopup(false);
    }
  };

  const openHealthModal = (user) => {
    setHealthUser(user);
    setHealthForm({
      observacionesSalud: user?.observacionesSalud || '',
      fichaMedicaUrl: user?.fichaMedicaUrl || '',
    });
    setShowHealthModal(true);
  };

  const closeHealthModal = () => {
    if (healthLoading) return;
    setShowHealthModal(false);
    setHealthUser(null);
    setHealthForm({ observacionesSalud: '', fichaMedicaUrl: '' });
  };

  const handleHealthChange = (e) => {
    const { name, value } = e.target;
    setHealthForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveHealth = async (e) => {
    e.preventDefault();
    if (healthLoading || !healthUser?.ID_Usuario) return;

    setHealthLoading(true);
    try {
      const updated = await apiService.updateUserHealthById(healthUser.ID_Usuario, {
        observacionesSalud: healthForm.observacionesSalud,
        fichaMedicaUrl: healthForm.fichaMedicaUrl,
      });
      setUsuarios(prev =>
        prev.map(u =>
          u.ID_Usuario === healthUser.ID_Usuario
            ? {
              ...u,
              observacionesSalud: updated.observacionesSalud || '',
              fichaMedicaUrl: updated.fichaMedicaUrl || '',
            }
            : u
        )
      );
      toast.success('Datos de salud actualizados correctamente.');
      setShowHealthModal(false);
      setHealthUser(null);
      setHealthForm({ observacionesSalud: '', fichaMedicaUrl: '' });
    } catch (error) {
      toast.error(error?.message || 'No se pudieron actualizar los datos de salud.');
    } finally {
      setHealthLoading(false);
    }
  };

  // Turnos filtrados
  const filteredTurnos = useMemo(() => {
    const now = new Date();
    let list = turnosHistory.filter(t =>
      historyActiveTab === 'pending' ? isPendingTurno(t, now) : isPastTurno(t, now)
    );

    if (histFiltroEstado) {
      list = list.filter(t => t.estado === histFiltroEstado);
    }
    if (histFechaDesde) {
      const d = new Date(histFechaDesde);
      list = list.filter(t => getTurnoDateTime(t) >= d);
    }
    if (histFechaHasta) {
      const d = new Date(histFechaHasta);
      d.setHours(23, 59, 59, 999);
      list = list.filter(t => getTurnoDateTime(t) <= d);
    }

    return list.sort((a, b) => {
      const dateA = getTurnoDateTime(a).getTime();
      const dateB = getTurnoDateTime(b).getTime();
      return historyActiveTab === 'pending' ? dateA - dateB : dateB - dateA;
    });
  }, [turnosHistory, historyActiveTab, histFiltroEstado, histFechaDesde, histFechaHasta, isPastTurno, isPendingTurno, getTurnoDateTime]);

  // Resumen de asistencia
  const stats = useMemo(() => {
    const total = filteredTurnos.length;
    const asistidos = filteredTurnos.filter(t => t.estado === 'ASISTIDO').length;
    const ausentes = filteredTurnos.filter(t => t.estado === 'AUSENTE').length;
    const activos = filteredTurnos.filter(t => t.estado === 'ACTIVO').length;
    const cancelados = filteredTurnos.filter(t => t.estado === 'CANCELADO').length;
    const conEstado = asistidos + ausentes;
    const porcentaje = conEstado > 0 ? Math.round((asistidos / conEstado) * 100) : 0;
    return { total, asistidos, ausentes, activos, cancelados, porcentaje };
  }, [filteredTurnos]);

  // Agrupación por mes
  const groupedByMonth = useMemo(() => {
    const groups = {};
    for (const t of filteredTurnos) {
      const d = new Date(t.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    const sorted = Object.entries(groups).sort((a, b) =>
      historyActiveTab === 'pending' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
    );
    return sorted;
  }, [filteredTurnos, historyActiveTab]);

  const formatFecha = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const formatHora = (iso) => (iso || '').slice(11, 16);
  const diasSemana = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const getDiaSemana = (iso) => diasSemana[new Date(iso).getDay()];
  const getMesLabel = (key) => {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };
  const badgeClass = (estado) => {
    const map = {
      ASISTIDO: 'turno-asistido',
      AUSENTE: 'turno-ausente',
      ACTIVO: 'turno-activo',
      CANCELADO: 'turno-cancelado',
    };
    return map[estado] || '';
  };
  const badgeLabel = (estado) => {
    const map = {
      ASISTIDO: 'Asistió',
      AUSENTE: 'Ausente',
      ACTIVO: 'Activo',
      CANCELADO: 'Cancelado',
    };
    return map[estado] || estado;
  };
  const badgeColor = (estado) => {
    const map = {
      ASISTIDO: '#10b981',
      AUSENTE: '#ef4444',
      ACTIVO: '#3b82f6',
      CANCELADO: '#6b7280',
    };
    return map[estado] || '#999';
  };

  const goPrevPage = () => page > 1 && setPage(p => p - 1);
  const goNextPage = () => hasMore && setPage(p => p + 1);

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />

      <div className='content-layout'>
        <div className="usuarios-page-header">
          <h2>Lista de usuarios</h2>
          <div className="usuarios-page-actions">
            <PrimaryButton
              text="Crear usuario"
              linkTo={fromEntrenador ? "/entrenador/crear-usuario" : "/admin/crear-usuario"}
              icon={UserPlus}
            />
            {/* La importación masiva es de admin y recepción (POST /usuarios/import). */}
            {!fromEntrenador && (
              <SecondaryButton
                text="Importar usuarios"
                onClick={() => setShowImportModal(true)}
                icon={Upload}
              />
            )}
          </div>
        </div>

        <div className="usuarios-kpi-grid">
          <div className="usuarios-kpi-item">
            <span className="usuarios-kpi-label">Alumnos activos</span>
            <strong>{usuariosStats.activos}</strong>
          </div>
          <div className="usuarios-kpi-item">
            <span className="usuarios-kpi-label">Alumnos inactivos</span>
            <strong>{usuariosStats.inactivos}</strong>
          </div>
          <div className="usuarios-kpi-item warning">
            <span className="usuarios-kpi-label">Sin plan asignado</span>
            <strong>{usuariosStats.sinPlanAsignado}</strong>
            <p>Sin plan no se les generan cuotas.</p>
          </div>
        </div>

        <div className="usuarios-filters-toggle-row">
          <button
            className='toggle-filters-button'
            onClick={() => setShowFilters(prev => !prev)}
          >
            <SlidersHorizontal /> Filtros {showFilters ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {showFilters && (
          <form
            className="filtros-form"
            onSubmit={aplicarFiltros}
          >
            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="tipo">Tipo:</label>
              <CustomDropdown
                id="tipo"
                name="tipo"
                value={draftFiltros.tipo}            // ← FIX
                onChange={handleChangeDraft}
                options={opcionesTipo}
                placeholderOption="— Todos —"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="estado">Estado:</label>
              <CustomDropdown
                id="estado"
                name="estado"
                value={draftFiltros.estado}          // ← FIX
                onChange={handleChangeDraft}
                options={opcionesEstado}
                placeholderOption="— Todos —"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="nombre">Nombre:</label>
              <CustomInput
                type="text"
                id="nombre"
                name="nombre"
                value={draftFiltros.nombre}
                onChange={handleChangeDraft}
                placeholder="Ej: Juan"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="dni">DNI:</label>
              <CustomInput
                type="text"
                id="dni"
                name="dni"
                value={draftFiltros.dni}
                onChange={handleChangeDraft}
                placeholder="Ej: 38444555"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="apellido">Apellido:</label>
              <CustomInput
                type="text"
                id="apellido"
                name="apellido"
                value={draftFiltros.apellido}
                onChange={handleChangeDraft}
                placeholder="Ej: Gonzalez"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="email">Email:</label>
              <CustomInput
                type="text"
                id="email"
                name="email"
                value={draftFiltros.email}
                onChange={handleChangeDraft}
                placeholder="Ej: juan@gmail.com"
              />
            </div>

            <div className='usuarios-filtros-form-inputs-ctn'>
              <label htmlFor="plan">Plan:</label>
              <CustomDropdown
                id="plan"
                name="plan"
                value={draftFiltros.plan}
                onChange={handleChangeDraft}
                options={[
                  { value: SIN_PLAN_FILTER_VALUE, label: 'Sin plan asignado' },
                  ...planesList.map(p => ({ value: String(p.ID_Plan), label: p.nombre })),
                ]}
                placeholderOption="— Todos —"
              />
            </div>

            <div className='usuarios-filtros-form-ctn'>
              <button type="submit" className="primary-button">
                Aplicar filtros
              </button>
              <button type="button" className="secondary-button" onClick={limpiarFiltros}>
                Limpiar filtros
              </button>
            </div>
          </form>
        )}

        {usuarios.length === 0 ? (
          <p>No hay usuarios para mostrar.</p>
        ) : (
          <div className="table-responsive">
            <table className='usuarios-table'>
<thead>
                <tr>
                  <th>Nombre y apellido</th>
                  <th>DNI</th>
                  <th>Tipo</th>
                  <th>Plan</th>
                  <th>Registro</th>
                  <th>Estado</th>
                  <th>WhatsApp</th>
                  {(fromAdmin || fromEntrenador) && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.ID_Usuario}>
                    <td data-label="Nombre y apellido">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {u.avatarUrl && (
                          <div
                            className="usuarios-table-userimage"
                            style={{
                              backgroundImage: `url(${u.avatarUrl})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat',
                              flexShrink: 0
                            }}
                            aria-hidden="true"
                          />
                        )}
                        <div>
                          <div style={{ textTransform: 'capitalize' }}>{u.nombre} {u.apellido}</div>
                          <div style={{ color: '#9ca3af', fontSize: '0.78rem' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td data-label="DNI">{u.dni || '—'}</td>

                    <td data-label="Tipo">{labelDeTipo(u.tipo) || u.tipo}</td>

                    <td data-label="Plan" style={{ textTransform: 'capitalize' }}>
                      {u.plan?.nombre || '—'}
                    </td>

                    <td data-label="Registro">{new Date(u.fechaRegistro).toLocaleDateString()}</td>

                    <td data-label="Estado">
                      <span className={`status-badge ${u.estado ? 'activo' : 'inactivo'}`}>
                        <span className="status-dot" />
                        {u.estado ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td data-label="WhatsApp">
                      {u.tel ? (
                        <a
                          href={`https://wa.me/${u.tel.replace(/[^\d]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="whatsapp-btn-table"
                          title={`Enviar WhatsApp a ${u.nombre}`}
                        >
                          <svg className="whatsapp-svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.906-6.99C16.66 1.876 14.18 1.84 11.54 1.84c-5.436 0-9.86 4.42-9.864 9.864-.001 1.702.461 3.361 1.34 4.816l-.997 3.637 3.73-.978zm11.758-6.84c-.302-.15-1.782-.88-2.06-.98-.277-.1-.479-.15-.68.15-.2.3-.777.98-.952 1.18-.176.2-.351.225-.653.075-.302-.15-1.274-.47-2.427-1.498-.897-.8-1.502-1.79-1.678-2.09-.176-.3-.019-.462.132-.612.135-.135.302-.35.452-.525.15-.175.2-.299.3-.5.1-.2.05-.375-.025-.525-.075-.15-.68-1.64-.932-2.245-.246-.59-.497-.51-.68-.52-.176-.01-.377-.01-.578-.01-.2 0-.526.075-.802.375-.276.3-1.053 1.03-1.053 2.51 0 1.48 1.079 2.91 1.23 3.11.151.2 2.124 3.244 5.145 4.545.718.31 1.278.495 1.714.634.722.23 1.38.197 1.902.12.58-.085 1.782-.73 2.033-1.433.251-.703.251-1.305.176-1.433-.075-.127-.276-.202-.578-.352z"/>
                          </svg>
                          <span>Chat</span>
                        </a>
                      ) : (
                        <span className="whatsapp-disabled" title="Sin número de teléfono">
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.864.002-2.637-1.03-5.115-2.906-6.99C16.66 1.876 14.18 1.84 11.54 1.84c-5.436 0-9.86 4.42-9.864 9.864-.001 1.702.461 3.361 1.34 4.816l-.997 3.637 3.73-.978zm11.758-6.84c-.302-.15-1.782-.88-2.06-.98-.277-.1-.479-.15-.68.15-.2.3-.777.98-.952 1.18-.176.2-.351.225-.653.075-.302-.15-1.274-.47-2.427-1.498-.897-.8-1.502-1.79-1.678-2.09-.176-.3-.019-.462.132-.612.135-.135.302-.35.452-.525.15-.175.2-.299.3-.5.1-.2.05-.375-.025-.525-.075-.15-.68-1.64-.932-2.245-.246-.59-.497-.51-.68-.52-.176-.01-.377-.01-.578-.01-.2 0-.526.075-.802.375-.276.3-1.053 1.03-1.053 2.51 0 1.48 1.079 2.91 1.23 3.11.151.2 2.124 3.244 5.145 4.545.718.31 1.278.495 1.714.634.722.23 1.38.197 1.902.12.58-.085 1.782-.73 2.033-1.433.251-.703.251-1.305.176-1.433-.075-.127-.276-.202-.578-.352z"/>
                          </svg>
                          <span>N/A</span>
                        </span>
                      )}
                    </td>

                    {(fromAdmin || fromEntrenador) && (
                      <td data-label="Acciones" className="usuarios-table-actions">
                        {fromAdmin && (
                          <>
                            <SecondaryButton
                              text="Ver turnos"
                              onClick={() => fetchTurnosHistory(u)}
                            />
                          </>
                        )}
                          {fromAdmin && u.tipo !== 'admin' && (
                            <SecondaryButton
                                text="Cambiar estado"
                                onClick={() => openEstadoPopup(u)}
                              />
                          )}
                        {fromAdmin && puedeGestionar(u) && (
                          <PrimaryButton
                            text="Editar"
                            linkTo={`/admin/editar-usuario/${u.ID_Usuario}`}
                          />
                        )}
                        {fromEntrenador && (
                          <SecondaryButton
                            text="Salud"
                            onClick={() => openHealthModal(u)}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="paginacion-controls">
          <button
            onClick={goPrevPage}
            disabled={page === 1}
            className="btn-page"
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft />
          </button>
          <span>Página {page}</span>
          <button
            onClick={goNextPage}
            disabled={!hasMore}
            className="btn-page"
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            <ChevronRight />
          </button>
        </div>

        {/* ─── Modal cambio de estado (acción única según estado actual) ─── */}
        {fromAdmin && isPopupOpen && selectedUser && (
          <div className="modal-overlay" onClick={closePopup}>
            <div className="modal-content estado-modal" onClick={e => e.stopPropagation()}>
              <div className="estado-modal-header">
                <div>
                  <h3>{selectedUser.estado ? 'Desactivar usuario' : 'Reactivar usuario'}</h3>
                  <span>
                    {selectedUser.nombre} {selectedUser.apellido}{selectedUser.email ? ` · ${selectedUser.email}` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="turnos-history-close"
                  onClick={closePopup}
                  aria-label="Cerrar"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="estado-modal-text">
                {selectedUser.estado
                  ? 'El alumno quedará inactivo y no podrá registrar ingresos. Indicá el motivo de la baja:'
                  : 'El alumno volverá a estar activo. Indicá el motivo de la reactivación:'}
              </p>

              <div className="estado-modal-field">
                <label htmlFor="motivoEstado">
                  {selectedUser.estado ? 'Motivo de la baja' : 'Motivo de reactivación'}
                </label>
                <CustomDropdown
                  id="motivoEstado"
                  options={selectedUser.estado ? MOTIVOS_BAJA : MOTIVOS_ALTA}
                  value={motivoSeleccionado}
                  onChange={e => setMotivoSeleccionado(e.target.value)}
                  placeholderOption="Seleccioná un motivo"
                />
              </div>

              <div className="estado-modal-actions">
                <button type="button" className="estado-modal-cancel" onClick={closePopup}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={`estado-modal-confirm ${selectedUser.estado ? 'danger' : ''}`}
                  disabled={!motivoSeleccionado}
                  onClick={confirmEstadoChange}
                >
                  {selectedUser.estado ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Modal historial de turnos ─── */}
        {showHistoryModal && (
          <div className="modal-overlay" onClick={closeHistoryModal}>
            <div
              className="modal-content turnos-history-modal"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="turnos-history-header">
                <div>
                  <h3 style={{ margin: 0 }}>Historial de turnos</h3>
                  <span style={{ fontSize: '14px', color: 'var(--text-color-distinct)' }}>
                    {historyUser?.nombre} {historyUser?.apellido} · {historyUser?.email}
                  </span>
                </div>
                <button
                  className="turnos-history-close"
                  onClick={closeHistoryModal}
                  aria-label="Cerrar historial de turnos"
                >
                  <X size={24} />
                </button>
              </div>

              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>Cargando turnos...</div>
              ) : (
                <>
                  {/* ─── Resumen de asistencia ─── */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {[
                      { label: 'Total', value: stats.total, color: 'var(--text-color)' },
                      { label: 'Asistidos', value: stats.asistidos, color: '#10b981', pct: stats.porcentaje },
                      { label: 'Ausentes', value: stats.ausentes, color: '#ef4444' },
                      { label: 'Próximos', value: stats.activos, color: '#3b82f6' },
                      { label: 'Cancelados', value: stats.cancelados, color: '#6b7280' },
                    ].map(s => (
                      <div key={s.label} style={{
                        flex: 1, minWidth: '80px', background: 'var(--background-color-distinct)',
                        borderRadius: '10px', padding: '10px 14px', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-color-distinct)' }}>{s.label}</div>
                        {s.pct !== undefined && (
                          <div style={{ fontSize: '13px', fontWeight: 600, color: s.color }}>{s.pct}%</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* ─── Filtros ─── */}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-color-distinct)' }}>Estado</label>
                      <select
                        value={histFiltroEstado}
                        onChange={(e) => setHistFiltroEstado(e.target.value)}
                        style={{
                          padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          background: 'var(--background-color-distinct)', color: 'var(--text-color)', fontSize: '13px'
                        }}
                      >
                        <option value="">Todos</option>
                        <option value="ASISTIDO">Asistidos</option>
                        <option value="AUSENTE">Ausentes</option>
                        <option value="ACTIVO">Activos</option>
                        <option value="CANCELADO">Cancelados</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-color-distinct)' }}>Desde</label>
                      <input
                        type="date"
                        value={histFechaDesde}
                        onChange={(e) => setHistFechaDesde(e.target.value)}
                        style={{
                          padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          background: 'var(--background-color-distinct)', color: 'var(--text-color)', fontSize: '13px'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', color: 'var(--text-color-distinct)' }}>Hasta</label>
                      <input
                        type="date"
                        value={histFechaHasta}
                        onChange={(e) => setHistFechaHasta(e.target.value)}
                        style={{
                          padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          background: 'var(--background-color-distinct)', color: 'var(--text-color)', fontSize: '13px'
                        }}
                      />
                    </div>
                    {(histFiltroEstado || histFechaDesde || histFechaHasta) && (
                      <button
                        onClick={() => { setHistFiltroEstado(''); setHistFechaDesde(''); setHistFechaHasta(''); }}
                        style={{
                          padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--border-color)',
                          background: 'transparent', color: 'var(--text-color-distinct)', cursor: 'pointer', fontSize: '13px'
                        }}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  <div className="turnos-history-tabs" role="tablist" aria-label="Tipo de turnos">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={historyActiveTab === 'past'}
                      className={`turnos-history-tab ${historyActiveTab === 'past' ? 'active' : ''}`}
                      onClick={() => setHistoryActiveTab('past')}
                    >
                      Turnos pasados
                      <span>{historyTabCounts.past}</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={historyActiveTab === 'pending'}
                      className={`turnos-history-tab ${historyActiveTab === 'pending' ? 'active' : ''}`}
                      onClick={() => setHistoryActiveTab('pending')}
                    >
                      Turnos pendientes
                      <span>{historyTabCounts.pending}</span>
                    </button>
                  </div>

                  {historyActiveTab === 'pending' && (
                    <div className="turnos-history-bulk-actions">
                      <button
                        type="button"
                        className="turnos-history-regenerate-fixed"
                        onClick={() => setShowRegenerateFixedPopup(true)}
                        disabled={regenerateFixedLoading}
                      >
                        {regenerateFixedLoading ? 'Regenerando...' : 'Regenerar turnos fijos'}
                      </button>
                      <button
                        type="button"
                        className="turnos-history-cancel-all"
                        onClick={() => setShowCancelPendingPopup(true)}
                        disabled={pendingTurnos.length === 0 || cancelPendingLoading}
                      >
                        {cancelPendingLoading ? 'Cancelando...' : 'Cancelar todos los turnos'}
                      </button>
                    </div>
                  )}

                  {/* ─── Turnos agrupados por mes ─── */}
                  <div className="turnos-history-list">
                    {groupedByMonth.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-color-distinct)', padding: '30px' }}>
                        {historyActiveTab === 'pending'
                          ? 'No se encontraron turnos pendientes.'
                          : 'No se encontraron turnos pasados.'}
                      </p>
                    ) : groupedByMonth.map(([mesKey, turnos]) => (
                      <div key={mesKey} style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '14px', fontWeight: 700, color: 'var(--text-color-distinct)',
                          textTransform: 'capitalize', padding: '6px 0', borderBottom: '1px solid var(--border-color)',
                          marginBottom: '6px'
                        }}>
                          {getMesLabel(mesKey)}
                        </div>
                        {turnos.map(t => {
                          const clase = t.HorarioClase?.Clase?.nombre || '—';
                          const horario = t.HorarioClase;
                          return (
                            <div key={t.id_turno} style={{
                              display: 'flex', gap: '8px', alignItems: 'center', padding: '8px 6px',
                              borderBottom: '1px solid var(--border-color)', fontSize: '13px'
                            }}>
                              <span style={{ minWidth: '85px', fontWeight: 500 }}>
                                {getDiaSemana(t.fecha)} {formatFecha(t.fecha)}
                              </span>
                              <span style={{ minWidth: '50px', color: 'var(--text-color-distinct)' }}>
                                {formatHora(horario?.horaIni)}
                              </span>
                              <span style={{ minWidth: '90px' }}>{clase}</span>
                              <span style={{
                                fontSize: '11px', padding: '2px 8px', borderRadius: '5px',
                                background: t.origen === 'FIJO' ? 'rgba(59,130,246,0.12)' : 'rgba(107,114,128,0.12)',
                                color: t.origen === 'FIJO' ? '#3b82f6' : '#6b7280',
                                fontWeight: 600, minWidth: '46px', textAlign: 'center'
                              }}>
                                {t.origen || '—'}
                              </span>
                              <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                                  background: `${badgeColor(t.estado)}18`,
                                  color: badgeColor(t.estado),
                                }}>
                                  <span style={{
                                    width: '7px', height: '7px', borderRadius: '50%',
                                    background: badgeColor(t.estado), display: 'inline-block'
                                  }} />
                                  {badgeLabel(t.estado)}
                                </span>
                                {fromAdmin && ['AUSENTE', 'CANCELADO'].includes(t.estado) && (
                                  <button
                                    type="button"
                                    onClick={() => setReprogramarData({
                                      user: { id: historyUser.ID_Usuario, nombre: `${historyUser.nombre || ''} ${historyUser.apellido || ''}`.trim() },
                                      turno: { id: t.id_turno, label: `${getDiaSemana(t.fecha)} ${formatFecha(t.fecha)} ${formatHora(horario?.horaIni)} · ${clase}` },
                                    })}
                                    title="Eliminar definitivamente y crear un turno nuevo"
                                    aria-label="Eliminar y reprogramar turno"
                                    style={{
                                      marginLeft: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '28px', height: '28px', border: '1px solid var(--border-color)', borderRadius: '6px',
                                      background: 'transparent', color: 'var(--text-color-distinct)', cursor: 'pointer', verticalAlign: 'middle'
                                    }}
                                  >
                                    <RotateCcw size={14} />
                                  </button>
                                )}
                                {fromAdmin && t.estado !== 'CANCELADO' && (
                                  <button
                                    type="button"
                                    onClick={() => openCancelTurnoPopup(t)}
                                    title="Cancelar turno"
                                    aria-label="Cancelar turno"
                                    style={{
                                      marginLeft: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      width: '28px', height: '28px', border: '1px solid var(--border-color)', borderRadius: '6px',
                                      background: 'transparent', color: '#e5484d', cursor: 'pointer', verticalAlign: 'middle'
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showImportModal && (
          <ImportUsuariosModal
            onClose={() => setShowImportModal(false)}
            onSuccess={() => { setShowImportModal(false); fetchUsuarios(); fetchUsuariosStats(); }}
            planes={planesList}
          />
        )}

        {/* ─── Eliminar y reprogramar turno AUSENTE/CANCELADO ─── */}
        <ReprogramarTurnoModal
          isOpen={!!reprogramarData}
          user={reprogramarData?.user}
          turno={reprogramarData?.turno}
          onClose={() => {
            setReprogramarData(null);
            refreshTurnosHistory();
          }}
          onDeleted={refreshTurnosHistory}
        />

        {showHealthModal && (
          <div className="modal-overlay" onClick={closeHealthModal}>
            <div
              className="modal-content health-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="turnos-history-header">
                <div>
                  <h3 style={{ margin: 0 }}>Datos de salud</h3>
                  <span style={{ fontSize: '14px', color: 'var(--text-color-distinct)' }}>
                    {healthUser?.nombre} {healthUser?.apellido} · {healthUser?.email}
                  </span>
                </div>
                <button
                  className="turnos-history-close"
                  onClick={closeHealthModal}
                  aria-label="Cerrar datos de salud"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <form className="health-modal-form" onSubmit={handleSaveHealth}>
                <label className="health-modal-field" htmlFor="healthFichaMedicaUrl">
                  <span className="health-modal-label-row">
                    Ficha médica
                    {healthForm.fichaMedicaUrl.trim() && (
                      <a
                        className="health-modal-external-link"
                        href={healthForm.fichaMedicaUrl.trim()}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir ficha médica"
                        aria-label="Abrir ficha médica"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </span>
                  <input
                    id="healthFichaMedicaUrl"
                    name="fichaMedicaUrl"
                    type="text"
                    value={healthForm.fichaMedicaUrl}
                    onChange={handleHealthChange}
                    placeholder="URL de la ficha médica"
                  />
                </label>

                <label className="health-modal-field" htmlFor="healthObservacionesSalud">
                  <span>Observaciones de Salud</span>
                  <textarea
                    id="healthObservacionesSalud"
                    name="observacionesSalud"
                    value={healthForm.observacionesSalud}
                    onChange={handleHealthChange}
                    placeholder="Observaciones de salud"
                    rows={7}
                  />
                </label>

                <div className="health-modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={closeHealthModal}
                  >
                    Cancelar
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={healthLoading}
                  >
                    {healthLoading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmationPopup
          isOpen={showCancelPendingPopup}
          onClose={() => {
            if (!cancelPendingLoading) setShowCancelPendingPopup(false);
          }}
          onConfirm={handleCancelPendingTurnos}
          message={`¿Seguro que querés cancelar todos los turnos pendientes de ${historyUser?.nombre || 'este usuario'}?`}
        >
          <p style={{ margin: '8px 0 0', color: 'var(--text-color-distinct)', fontSize: '14px' }}>
            Se cancelarán {pendingTurnos.length} turno(s).
          </p>
        </ConfirmationPopup>

        <ConfirmationPopup
          isOpen={!!turnoCancelData}
          onClose={() => {
            if (!turnoCancelLoading) setTurnoCancelData(null);
          }}
          onConfirm={handleCancelSingleTurno}
          message={`¿Confirmás cancelar este turno de ${historyUser?.nombre || 'este usuario'}?`}
        >
          <p style={{ margin: '8px 0 0', color: 'var(--text-color-distinct)', fontSize: '14px' }}>
            {turnoCancelData?.label}
          </p>
        </ConfirmationPopup>

        <ConfirmationPopup
          isOpen={showRegenerateFixedPopup}
          onClose={() => {
            if (!regenerateFixedLoading) setShowRegenerateFixedPopup(false);
          }}
          onConfirm={handleRegenerateFixedTurnos}
          message={`¿Regenerar los turnos fijos futuros de ${historyUser?.nombre || 'este usuario'}?`}
        >
          <p style={{ margin: '8px 0 0', color: 'var(--text-color-distinct)', fontSize: '14px' }}>
            Se usarán los turnos fijos actuales del perfil y la cuota vigente.
          </p>
        </ConfirmationPopup>
      </div>
    </div>
  );
};

export default UsuariosList;
