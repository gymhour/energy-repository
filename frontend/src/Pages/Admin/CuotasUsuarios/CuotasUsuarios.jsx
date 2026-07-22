import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../../App.css';
import './CuotasUsuarios.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import apiClient from '../../../axiosConfig';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, SlidersHorizontal, Trash2, X } from 'lucide-react';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import Select from 'react-select';

const cuotasSelectStyles = {
  control: (base, state) => ({
    ...base,
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    borderColor: state.isFocused ? 'rgba(218, 70, 50, 0.48)' : 'var(--border-color)',
    backgroundColor: 'var(--background-color-distinct)',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(218, 70, 50, 0.12)' : 'none',
    color: 'var(--text-color)',
    fontSize: 14,
    ':hover': {
      borderColor: 'rgba(218, 70, 50, 0.48)'
    }
  }),
  menu: (base) => ({
    ...base,
    zIndex: 1001,
    overflow: 'hidden',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    backgroundColor: 'var(--background-color)',
    boxShadow: '0 18px 40px rgba(0, 0, 0, 0.12)'
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'var(--background-hover-color)' : 'var(--background-color)',
    color: 'var(--text-color)',
    fontSize: 14
  }),
  singleValue: (base) => ({ ...base, color: 'var(--text-color)' }),
  input: (base) => ({ ...base, color: 'var(--text-color)' }),
  placeholder: (base) => ({ ...base, color: 'var(--text-color-distinct)' })
};

const usuarioToOption = (usuario) => ({
  value: usuario.ID_Usuario,
  label: `${usuario.nombre || ''} ${usuario.apellido || ''}${usuario.dni ? ` - DNI ${usuario.dni}` : usuario.email ? ` (${usuario.email})` : ''}`,
});

const normalizeCuotaEstadoParam = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pagada' || normalized === 'true') return 'true';
  if (normalized === 'pendiente' || normalized === 'pending') return 'pendiente';
  if (normalized === 'vencida') return 'vencida';
  return '';
};

const parseMesDateParam = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;

  return new Date(year, month - 1, 1);
};

const getCuotasFiltersFromSearch = (searchParams) => ({
  estado: normalizeCuotaEstadoParam(searchParams.get('estado')),
  mesDate: parseMesDateParam(searchParams.get('mes')),
});

// Tamaño de lote para la generación masiva: cada request crea las cuotas+turnos de N alumnos.
// 25 mantiene cada request corta (sin riesgo de timeout en Vercel) y da progreso fluido.
const BULK_CHUNK_SIZE = 25;
const SINGLE_TURNO_CHUNK_SIZE = 50;
const BULK_DELETE_CHUNK_SIZE = 50;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Los turnos se guardan como wall-clock en UTC, así que se lee con getUTC* para mostrar la hora real.
const formatConflictFecha = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}hs`;
};

const CuotasUsuarios = ({fromAdmin, fromEntrenador}) => {
  const [searchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const initialUrlFilters = useMemo(
    () => getCuotasFiltersFromSearch(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );

  // — Estados de datos y carga —
  const [cuotas, setCuotas] = useState([]);
  const [planOptions, setPlanOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // — Estados de popup de crear/eliminar/pagar cuota —
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [actionType, setActionType] = useState(''); // 'pay' | 'delete' | 'bulk-delete'
  const [selectedCuota, setSelectedCuota] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editImporte, setEditImporte] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // — Estados del formulario “Nueva cuota” —
  const [selectedUserOpt, setSelectedUserOpt] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [mesDate, setMesDate] = useState(null);
  const [importe, setImporte] = useState('');
  const [venceDate, setVenceDate] = useState(null);
  const [manualPreview, setManualPreview] = useState(null);
  const [manualPreviewLoading, setManualPreviewLoading] = useState(false);

  // — Estados para carga masiva —
  const [bulkMesDate, setBulkMesDate] = useState(null);
  const [bulkVenceDate, setBulkVenceDate] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteMesDate, setBulkDeleteMesDate] = useState(null);
  const [validationResult, setValidationResult] = useState(null);

  // — Estado de la barra de progreso real de la generación masiva por lotes —
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ total: 0, procesados: 0, cuotas: 0, turnos: 0 });
  const [singleRunning, setSingleRunning] = useState(false);
  const [singleProgress, setSingleProgress] = useState({ total: 0, procesados: 0, cuotas: 0, turnos: 0 });
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ total: 0, procesados: 0, cuotas: 0, turnos: 0 });

  // — Estados de filtros (inputs) —
  const [inputEmail, setInputEmail] = useState('');
  const [inputDni, setInputDni] = useState('');
  const [inputStudentName, setInputStudentName] = useState('');
  const [inputEstado, setInputEstado] = useState(initialUrlFilters.estado); // '' | 'true' | 'false' | 'vencida'
  const [inputMesDate, setInputMesDate] = useState(initialUrlFilters.mesDate);
  const [inputPlan, setInputPlan] = useState('');

  // — Filtros aplicados + paginación —
  const [filterEmail, setFilterEmail] = useState('');
  const [filterDni, setFilterDni] = useState('');
  const [filterStudentName, setFilterStudentName] = useState('');
  const [filterEstado, setFilterEstado] = useState(initialUrlFilters.estado);
  const [filterMesDate, setFilterMesDate] = useState(initialUrlFilters.mesDate);
  const [filterPlan, setFilterPlan] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(Boolean(searchParamsString));

  // Pagar
  const [formaPago, setFormaPago] = useState('Efectivo');

  const opcionesFiltroEstado = ['Todos —', 'Pendiente', 'Pagada', 'Vencida'];
  const labelToEstado = label => {
    if (label === 'Pagada') return 'true';
    if (label === 'Pendiente') return 'pendiente';
    if (label === 'Vencida') return 'vencida';
    return '';
  };
  const estadoToLabel = estado => {
    if (estado === 'true') return 'Pagada';
    if (estado === 'pendiente') return 'Pendiente';
    if (estado === 'vencida') return 'Vencida';
    return 'Todos —';
  };

  const buildMesString = (dateObj) => {
    if (!dateObj) return '';
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    return `${year}-${month < 10 ? '0' + month : month}`;
  };

  const getLocalDayTime = (dateObj) => (
    dateObj ? new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime() : 0
  );

  const buildCuotaStartDate = (dateObj) => (
    dateObj ? new Date(dateObj.getFullYear(), dateObj.getMonth(), 1) : null
  );

  const fetchPlanes = async () => {
    try {
      const planesRes = await apiService.getPlanes();
      setPlanOptions(planesRes || []);
    } catch (err) {
      console.error('Error obteniendo planes:', err);
    }
  };

  const fetchCuotas = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterEmail) params.email = filterEmail;
      if (filterDni) params.dni = filterDni;
      if (filterStudentName) params.studentName = filterStudentName;

      if (filterEstado === 'vencida') {
        params.vencida = true;
      } else if (filterEstado) {
        params.estado = filterEstado;
      }

      if (filterPlan) params.plan = filterPlan;
      if (filterMesDate) params.mes = buildMesString(filterMesDate);
      params.page = page;

      const response = await apiClient.get('/cuotas', { params });
      const lista = response.data.data || [];

      lista.sort((a, b) =>
        new Date(b.mes + '-01') - new Date(a.mes + '-01')
      );

      setCuotas(lista);
      setHasMore(lista.length > 0);
      setError(null);
    } catch (err) {
      console.error('Error al obtener cuotas:', err);
      setError(err);
      setCuotas([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const resetManualForm = () => {
    setSelectedUserOpt(null);
    setUserSearch('');
    setUserOptions([]);
    setMesDate(null);
    setVenceDate(null);
    setImporte('');
    setManualPreview(null);
    setManualPreviewLoading(false);
  };

  const closeManualModal = () => {
    setShowModal(false);
    resetManualForm();
  };

  useEffect(() => {
    fetchPlanes();
  }, []);

  useEffect(() => {
    setInputEmail('');
    setInputDni('');
    setInputStudentName('');
    setInputEstado(initialUrlFilters.estado);
    setInputMesDate(initialUrlFilters.mesDate);
    setInputPlan('');
    setFilterEmail('');
    setFilterDni('');
    setFilterStudentName('');
    setFilterEstado(initialUrlFilters.estado);
    setFilterMesDate(initialUrlFilters.mesDate);
    setFilterPlan('');
    setPage(1);
    if (searchParamsString) setShowFilters(true);
  }, [initialUrlFilters, searchParamsString]);

  useEffect(() => {
    const term = userSearch.trim();
    let isCurrentRequest = true;

    if (!showModal || term.length < 2) {
      setUserOptions([]);
      setUsersLoading(false);
      return () => { isCurrentRequest = false; };
    }

    setUsersLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await apiService.getAllUsuarios({
          page: 1,
          take: 20,
          tipo: 'cliente',
          estado: true,
          search: term
        });

        if (!isCurrentRequest) return;
        const options = Array.isArray(response?.data)
          ? response.data.map(usuarioToOption)
          : [];
        setUserOptions(options);
      } catch (err) {
        if (isCurrentRequest) {
          setUserOptions([]);
          console.error('Error buscando usuarios:', err);
          toast.error('No se pudieron buscar usuarios');
        }
      } finally {
        if (isCurrentRequest) setUsersLoading(false);
      }
    }, 300);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeoutId);
    };
  }, [showModal, userSearch]);

  useEffect(() => {
    fetchCuotas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterEmail, filterDni, filterStudentName, filterEstado, filterMesDate, filterPlan]);

  useEffect(() => {
    let isCurrentRequest = true;
    const mes = buildMesString(mesDate);

    if (!showModal || !selectedUserOpt?.value || !mes) {
      setManualPreview(null);
      setManualPreviewLoading(false);
      setImporte('');
      return () => { isCurrentRequest = false; };
    }

    setManualPreviewLoading(true);
    setManualPreview(null);
    const loadPreview = async () => {
      try {
        const preview = await apiService.getCuotaManualPreview(selectedUserOpt.value, mes);
        if (!isCurrentRequest) return;
        setManualPreview(preview);
        setImporte(
          preview?.importeSugerido !== null && preview?.importeSugerido !== undefined
            ? String(preview.importeSugerido)
            : ''
        );
      } catch (err) {
        if (!isCurrentRequest) return;
        setManualPreview(null);
        setImporte('');
        const msg = err?.response?.data?.message || 'No se pudo obtener el plan del usuario.';
        toast.error(msg);
      } finally {
        if (isCurrentRequest) setManualPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      isCurrentRequest = false;
    };
  }, [showModal, selectedUserOpt?.value, mesDate]);

  const openConfirmation = (type, cuota) => {
    setActionType(type);
    setSelectedCuota(cuota);
    if (type === 'pay') setFormaPago('Efectivo');
    setPopupOpen(true);
  };

  const closeConfirmation = () => {
    setPopupOpen(false);
    setActionType('');
    setSelectedCuota(null);
  };

  const openEditModal = (cuota) => {
    if (!cuota || cuota.pagada) {
      toast.error('Solo se pueden editar cuotas pendientes o vencidas.');
      return;
    }

    setSelectedCuota(cuota);
    setEditImporte(String(cuota.importe ?? ''));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedCuota(null);
    setEditImporte('');
    setSavingEdit(false);
  };

  const openBulkDeleteConfirmation = () => {
    if (!bulkDeleteMesDate) {
      toast.error('Seleccioná un mes válido.');
      return;
    }

    setActionType('bulk-delete');
    setSelectedCuota(null);
    setShowBulkDeleteModal(false);
    setPopupOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    const mes = buildMesString(bulkDeleteMesDate);
    if (!mes) {
      toast.error('Seleccioná un mes válido.');
      return;
    }

    let prep;
    try {
      setLoading(true);
      prep = await apiService.prepararEliminacionCuotasByMes({ mes });
    } catch (err) {
      console.error('Error preparando eliminación de cuotas por mes:', err);
      const msg = err?.response?.data?.message || 'No se pudo preparar la eliminación de cuotas del mes.';
      toast.error(msg);
      return;
    } finally {
      setLoading(false);
    }

    const ids = Array.isArray(prep?.ids) ? prep.ids : [];
    const total = Number(prep?.total || ids.length || 0);
    const cuotasPagadasOmitidas = Number(prep?.cuotasPagadasOmitidas || 0);

    if (!total || ids.length === 0) {
      toast.info(prep?.message || `No habia cuotas no pagadas para eliminar en ${formatMonth(mes)}.`);
      if (cuotasPagadasOmitidas > 0) {
        toast.warning(
          `Se conservaron ${cuotasPagadasOmitidas} cuota(s) pagada(s) de ${formatMonth(mes)}.`,
          { autoClose: 8000 }
        );
      }
      setBulkDeleteMesDate(null);
      closeConfirmation();
      setPage(1);
      fetchCuotas();
      return;
    }

    closeConfirmation();
    setDeleteProgress({ total, procesados: 0, cuotas: 0, turnos: 0 });
    setDeleteRunning(true);

    const chunks = [];
    for (let i = 0; i < ids.length; i += BULK_DELETE_CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + BULK_DELETE_CHUNK_SIZE));
    }

    let procesados = 0;
    let cuotasEliminadas = 0;
    let turnosEliminados = 0;

    for (const chunk of chunks) {
      let ok = false;
      let lastErr = null;

      for (let intento = 0; intento < 2 && !ok; intento++) {
        try {
          const result = await apiService.eliminarCuotasByMesLote({ mes, ids: chunk });
          cuotasEliminadas += Number(result?.cuotasEliminadas || 0);
          turnosEliminados += Number(result?.turnosEliminados || 0);
          ok = true;
        } catch (err) {
          lastErr = err;
          if (intento === 0) await sleep(800);
        }
      }

      if (!ok) {
        setDeleteRunning(false);
        const msg = lastErr?.response?.data?.message || 'No se pudo eliminar un lote de cuotas.';
        toast.error(
          `${msg} Se procesaron ${procesados} de ${total} cuota(s). Podés volver a ejecutar el borrado para completar las restantes.`,
          { autoClose: 9000 }
        );
        setPage(1);
        fetchCuotas();
        return;
      }

      procesados += chunk.length;
      setDeleteProgress({ total, procesados, cuotas: cuotasEliminadas, turnos: turnosEliminados });
    }

    setDeleteRunning(false);
    setBulkDeleteMesDate(null);
    setPage(1);
    await fetchCuotas();

    toast.success(
      `Se eliminaron ${cuotasEliminadas} cuota(s) y ${turnosEliminados} turno(s) de ${formatMonth(mes)}.`
    );
    if (cuotasPagadasOmitidas > 0) {
      toast.warning(
        `Se conservaron ${cuotasPagadasOmitidas} cuota(s) pagada(s) de ${formatMonth(mes)}.`,
        { autoClose: 8000 }
      );
    }
  };

  const handleConfirm = async () => {
    if (actionType === 'bulk-delete') {
      await handleBulkDeleteConfirm();
      return;
    }

    if (!selectedCuota) return;
    setLoading(true);
    try {
      if (actionType === 'pay') {
        await apiClient.put(`/cuotas/${selectedCuota.ID_Cuota}/pay`, { formaPago });
        toast.success(
          `Cuota pagada: cuota #${selectedCuota.ID_Cuota} por ${formatCurrency(selectedCuota.importe)} · ${formaPago}`
        );
      } else if (actionType === 'delete') {
        await apiClient.delete(`/cuotas/${selectedCuota.ID_Cuota}`);
        toast.success(`Cuota eliminada correctamente.`);
      }
      closeConfirmation();
      fetchCuotas();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message
        || (actionType === 'pay'
          ? 'No se pudo registrar el pago.'
          : 'No se pudo eliminar la cuota.');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!selectedCuota) return;
    if (selectedCuota.pagada) {
      toast.error('Solo se pueden editar cuotas pendientes o vencidas.');
      closeEditModal();
      return;
    }

    const importeText = String(editImporte).trim();
    const importeNumber = Number(importeText);
    if (!importeText || !Number.isFinite(importeNumber) || importeNumber <= 0) {
      toast.error('Ingresá un importe válido mayor a 0.');
      return;
    }

    setSavingEdit(true);
    try {
      await apiClient.put(`/cuotas/${selectedCuota.ID_Cuota}`, { importe: importeNumber });
      toast.success(`Importe actualizado: cuota #${selectedCuota.ID_Cuota} por ${formatCurrency(importeNumber)}.`);
      closeEditModal();
      fetchCuotas();
    } catch (err) {
      console.error('Error al editar cuota:', err);
      const msg = err?.response?.data?.message || 'No se pudo editar la cuota.';
      toast.error(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  // Helper: ISO UTC fin de día (evita drift por TZ)
  const toIsoUtcEndOfDay = (localDate) => {
    if (!localDate) return null;
    const y = localDate.getFullYear();
    const m = localDate.getMonth();
    const d = localDate.getDate();
    return new Date(Date.UTC(y, m, d, 23, 59, 59, 0)).toISOString();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedUserOpt?.value) {
      alert('Seleccioná un usuario válido.');
      return;
    }
    if (!mesDate) {
      alert('Seleccioná un mes válido.');
      return;
    }
    if (!venceDate) {
      alert('Seleccioná una fecha de vencimiento.');
      return;
    }
    const importeText = String(importe).trim();
    const importeNumber = Number(importeText);
    if (!importeText || !Number.isFinite(importeNumber)) {
      toast.error('Completá un importe válido para crear la cuota.');
      return;
    }
    const cuotaStartDate = buildCuotaStartDate(mesDate);
    if (getLocalDayTime(venceDate) <= getLocalDayTime(cuotaStartDate)) {
      toast.error('La fecha de vencimiento debe ser posterior a la fecha de inicio de la cuota.');
      return;
    }

    const mesString = buildMesString(mesDate);
    const venceIso = toIsoUtcEndOfDay(venceDate);

    const payload = { mes: mesString, importe: importeNumber, vence: venceIso };
    let prep;

    try {
      setLoading(true);
      prep = await apiService.prepararCuotaUsuarioLotes(selectedUserOpt.value, payload);
    } catch (err) {
      console.error('Error al preparar cuota:', err);
      const data = err?.response?.data;
      if (err?.response?.status === 409 && Array.isArray(data?.conflictosCupo)) {
        setValidationResult(data);
      } else {
        toast.error(data?.message || 'No se pudo crear la cuota.');
      }
      return;
    } finally {
      setLoading(false);
    }

    const totalTurnos = Number(prep?.totalTurnosEstimados || 0);
    const cuotaId = prep?.cuotaId;

    setPage(1);
    setShowModal(false);

    if (!cuotaId || totalTurnos === 0) {
      resetManualForm();
      await fetchCuotas();
      toast.success(prep?.message || 'Cuota creada correctamente.');
      return;
    }

    setSingleProgress({ total: totalTurnos, procesados: 0, cuotas: 1, turnos: 0 });
    setSingleRunning(true);

    let procesados = 0;
    let turnosGenerados = 0;

    while (procesados < totalTurnos) {
      const limit = Math.min(SINGLE_TURNO_CHUNK_SIZE, totalTurnos - procesados);
      let ok = false;
      let lastErr = null;

      for (let intento = 0; intento < 2 && !ok; intento++) {
        try {
          const r = await apiService.generarTurnosCuotaUsuarioLote(selectedUserOpt.value, {
            cuotaId,
            offset: procesados,
            limit
          });
          turnosGenerados += r?.turnosGenerados || 0;
          ok = true;
        } catch (err) {
          lastErr = err;
          if (err?.response?.status === 409) break;
          if (intento === 0) await sleep(800);
        }
      }

      if (!ok) {
        setSingleRunning(false);
        const data = lastErr?.response?.data;
        if (lastErr?.response?.status === 409 && Array.isArray(data?.conflictosCupo)) {
          setValidationResult(data);
        } else {
          toast.error(
            `La cuota quedó creada, pero se generaron ${turnosGenerados} turno(s) de ${totalTurnos}. Volvé a crear la cuota para completar los faltantes (no se duplican).`,
            { autoClose: 9000 }
          );
        }
        fetchCuotas();
        return;
      }

      procesados += limit;
      setSingleProgress({ total: totalTurnos, procesados, cuotas: 1, turnos: turnosGenerados });
    }

    setSingleRunning(false);
    resetManualForm();
    await fetchCuotas();
    toast.success(`Listo: cuota creada y ${turnosGenerados} turno(s) generados.`);
  };

  // Generación masiva orquestada por lotes con progreso REAL.
  // Paso 1 (preparar): valida cupos globales y trae los IDs pendientes. Paso 2: procesa por lotes.
  const handleBulkGenerate = async () => {
    if (!bulkMesDate) { toast.error('Seleccioná un mes válido.'); return; }
    if (!bulkVenceDate) { toast.error('Seleccioná fecha de vencimiento.'); return; }
    const bulkCuotaStartDate = buildCuotaStartDate(bulkMesDate);
    if (getLocalDayTime(bulkVenceDate) <= getLocalDayTime(bulkCuotaStartDate)) {
      toast.error('La fecha de vencimiento debe ser posterior a la fecha de inicio de la cuota.');
      return;
    }

    const mes = buildMesString(bulkMesDate);
    const vence = toIsoUtcEndOfDay(bulkVenceDate);
    setShowBulkModal(false);

    // — Paso 1: preparar —
    let prep;
    try {
      setLoading(true);
      prep = await apiService.prepararCuotasMasivas({ mes, vence });
    } catch (err) {
      console.error('Error al preparar cuotas masivas:', err);
      const data = err?.response?.data;
      if (err?.response?.status === 409 && Array.isArray(data?.conflictosCupo)) {
        setValidationResult(data);
      } else {
        toast.error(data?.message || 'No se pudo preparar la generación de cuotas.');
      }
      return;
    } finally {
      setLoading(false);
    }

    if (!prep?.total) {
      toast.info(prep?.message || 'No hay cuotas nuevas para generar (ya estaban generadas).');
      return;
    }

    // — Paso 2: procesar por lotes con barra real —
    const ids = Array.isArray(prep.ids) ? prep.ids : [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += BULK_CHUNK_SIZE) {
      chunks.push(ids.slice(i, i + BULK_CHUNK_SIZE));
    }

    setBulkProgress({ total: prep.total, procesados: 0, cuotas: 0, turnos: 0 });
    setBulkRunning(true);

    let procesados = 0;
    let cuotasCreadas = 0;
    let turnosGenerados = 0;

    for (const chunk of chunks) {
      let ok = false;
      let lastErr = null;

      // Reintentar 1 vez ante un fallo transitorio (no ante 409 de cupo: no se resuelve reintentando).
      for (let intento = 0; intento < 2 && !ok; intento++) {
        try {
          const r = await apiService.generarCuotasLote({ mes, vence, ids: chunk });
          cuotasCreadas += r?.cuotasCreadas || 0;
          turnosGenerados += r?.turnosGenerados || 0;
          ok = true;
        } catch (e) {
          lastErr = e;
          if (e?.response?.status === 409) break;
          if (intento === 0) await sleep(800);
        }
      }

      if (!ok) {
        setBulkRunning(false);
        const data = lastErr?.response?.data;
        if (lastErr?.response?.status === 409 && Array.isArray(data?.conflictosCupo)) {
          setValidationResult(data);
        } else {
          toast.error(
            `Se generaron ${procesados} de ${prep.total} alumno(s). Volvé a tocar "Generar cuotas de este mes" para completar el resto (no se duplican).`,
            { autoClose: 9000 }
          );
        }
        setPage(1);
        fetchCuotas();
        return;
      }

      procesados += chunk.length;
      setBulkProgress({ total: prep.total, procesados, cuotas: cuotasCreadas, turnos: turnosGenerados });
    }

    setBulkRunning(false);
    setPage(1);
    fetchCuotas();
    toast.success(`Listo: ${cuotasCreadas} cuota(s) y ${turnosGenerados} turno(s) generados.`);
  };

  const applyFilters = () => {
    setPage(1);
    setFilterEmail(inputEmail.trim());
    setFilterDni(inputDni.trim());
    setFilterStudentName(inputStudentName.trim());
    setFilterEstado(inputEstado);
    setFilterPlan(inputPlan);
    setFilterMesDate(inputMesDate);
  };

  const clearFilters = () => {
    setInputEmail('');
    setInputDni('');
    setInputStudentName('');
    setInputEstado('');
    setInputPlan('');
    setInputMesDate(null);

    setPage(1);
    setFilterEmail('');
    setFilterDni('');
    setFilterStudentName('');
    setFilterEstado('');
    setFilterPlan('');
    setFilterMesDate(null);
  };

  const goPrevPage = () => { if (page > 1) setPage(prev => prev - 1); };
  const goNextPage = () => { if (hasMore) setPage(prev => prev + 1); };

  const formatMonth = (m) => {
    if (!m) return '–';
    const [year, month] = m.split('-').map(Number);
    return new Date(year, month - 1, 1)
      .toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  };
  const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '–');
  const formatCurrency = (val) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(val);

  const datePickerClass = 'custom-datepicker custom-datepicker-mes';

  const mergedUserOptions = useMemo(() => {
    const optionsById = new Map();
    [selectedUserOpt, ...userOptions].forEach(option => {
      if (option?.value) optionsById.set(option.value, option);
    });
    return Array.from(optionsById.values());
  }, [selectedUserOpt, userOptions]);

  const runningProgress = deleteRunning
    ? {
      title: 'Borrando cuotas y turnos…',
      text: `No cierres esta pantalla. Procesando ${deleteProgress.procesados} de ${deleteProgress.total} cuota(s).`,
      progress: deleteProgress,
    }
    : singleRunning
    ? {
      title: 'Generando cuota y turnos…',
      text: `No cierres esta pantalla. Procesando ${singleProgress.procesados} de ${singleProgress.total} turno(s).`,
      progress: singleProgress,
    }
    : {
      title: 'Generando cuotas y turnos…',
      text: `No cierres esta pantalla. Procesando ${bulkProgress.procesados} de ${bulkProgress.total} alumno(s).`,
      progress: bulkProgress,
    };
  const progressPct = runningProgress.progress.total
    ? Math.round((runningProgress.progress.procesados / runningProgress.progress.total) * 100)
    : 0;

  return (
    <div className="page-layout">
      {loading && <LoaderFullScreen />}

      {(bulkRunning || singleRunning || deleteRunning) && (
        <div className="cuotas-bulk-progress-overlay" role="alert" aria-busy="true">
          <div className="cuotas-bulk-progress-card">
            <h3>{runningProgress.title}</h3>
            <p className="cuotas-bulk-progress-text">
              {runningProgress.text}
            </p>
            <div className="cuotas-bulk-progress-track">
              <div
                className="cuotas-bulk-progress-fill"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="cuotas-bulk-progress-pct">
              {progressPct}%
              {' · '}{runningProgress.progress.cuotas} cuota(s) · {runningProgress.progress.turnos} turno(s)
            </span>
          </div>
        </div>
      )}

      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />

      <div className="content-layout">
        <div className="header-actions cuotas-usuarios" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Cuotas de Usuarios</h2>
          <div className='generate-cuotas-btns'>
            <SecondaryButton text="Cuota manual" onClick={() => setShowModal(true)} />
            <PrimaryButton text="Generar cuotas de este mes" onClick={() => setShowBulkModal(true)} />
            <button
              type="button"
              className="cuotas-danger-outline-button"
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <Trash2 size={18} />
              Borrar cuotas por mes
            </button>
          </div>
        </div>

        <div className="cuotas-filters-toggle-row">
          <button
            className='toggle-filters-button'
            onClick={() => setShowFilters(prev => !prev)}
          >
            <SlidersHorizontal /> Filtros {showFilters ? <ChevronUp /> : <ChevronDown />}
          </button>
        </div>

        {showFilters && (
          <form
            className="cuotas-filtros-form"
            onSubmit={event => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="cuotas-filtros-form-inputs-ctn">
              <label htmlFor="inputEmail">Email:</label>
              <CustomInput
                id="inputEmail"
                type="text"
                placeholder="Ej: valen@example.com"
                value={inputEmail}
                onChange={e => setInputEmail(e.target.value)}
              />
            </div>

            <div className="cuotas-filtros-form-inputs-ctn">
              <label htmlFor="inputDni">DNI:</label>
              <CustomInput
                id="inputDni"
                type="text"
                placeholder="Ej: 38444555"
                value={inputDni}
                onChange={e => setInputDni(e.target.value)}
              />
            </div>

            <div className="cuotas-filtros-form-inputs-ctn">
              <label htmlFor="inputStudentName">Alumno:</label>
              <CustomInput
                id="inputStudentName"
                type="text"
                placeholder="Buscar por nombre o apellido"
                value={inputStudentName}
                onChange={e => setInputStudentName(e.target.value)}
              />
            </div>

            <div className="cuotas-filtros-form-inputs-ctn">
              <label htmlFor="inputEstado">Estado:</label>
              <CustomDropdown
                id="inputEstado"
                options={opcionesFiltroEstado}
                value={estadoToLabel(inputEstado)}
                onChange={e => setInputEstado(labelToEstado(e.target.value))}
              />
            </div>

            <div className="cuotas-filtros-form-inputs-ctn">
              <label>Mes:</label>
              <ReactDatePicker
                selected={inputMesDate}
                onChange={date => setInputMesDate(date)}
                dateFormat="MM/yyyy"
                showMonthYearPicker
                placeholderText="MM/AAAA"
                className={datePickerClass}
                popperClassName="notranslate"
              />
            </div>

            <div className="cuotas-filtros-form-inputs-ctn">
              <label htmlFor="inputPlan">Plan:</label>
              <CustomDropdown
                id="inputPlan"
                options={planOptions.map(p => p.nombre)}
                placeholderOption="— Todos —"
                value={inputPlan}
                onChange={e => setInputPlan(e.target.value)}
              />
            </div>

            <div className="cuotas-filtros-form-actions">
              <button type="submit" className="primary-button">
                Aplicar filtros
              </button>
              <button type="button" className="secondary-button" onClick={clearFilters}>
                Limpiar filtros
              </button>
            </div>
          </form>
        )}

        {/* —— Tabla responsive —— */}
        {loading ? (
          <p>Cargando cuotas...</p>
        ) : error ? (
          <p className="text-error">Error cargando datos.</p>
        ) : cuotas.length === 0 ? (
          <p>No hay cuotas para mostrar.</p>
        ) : (
          <div className="table-responsive">
            <table className="cuotas-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Mes</th>
                  <th>Importe</th>
                  <th>Vence</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Forma de Pago</th>
                  <th>Fecha Pago</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cuotas.map(c => (
                  <tr key={c.ID_Cuota}>
                    <td data-label="Usuario">
                      {c.User ? `${c.User.nombre} ${c.User.apellido}` : '–'}
                    </td>
                    <td data-label="Mes" className='cuotas-usuario-mes-col'>{formatMonth(c.mes)}</td>
                    <td data-label="Importe">{formatCurrency(c.importe)}</td>
                    <td data-label="Vence">{formatDate(c.vence)}</td>
                    <td data-label="Plan">{c.planNombreSnapshot ?? '–'}</td>
                    <td data-label="Estado">
                      <span
                        className={`badge ${c.vencida ? 'expired' : c.pagada ? 'paid' : 'pending'}`}
                      >
                        {c.vencida ? 'Vencida' : c.pagada ? 'Pagada' : 'Pendiente'}
                      </span>
                    </td>
                    <td data-label="Forma de Pago">{c.formaPago ? c.formaPago : '-'}</td>
                    <td data-label="Fecha Pago">{formatDate(c.fechaPago)}</td>
                    <td data-label="Acciones" className="acciones-cell">
                      {!c.pagada && (
                        <button
                          className="accion-button edit"
                          onClick={() => openEditModal(c)}
                          aria-label={`Editar importe de cuota ${c.ID_Cuota}`}
                          title="Editar importe"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>
                      )}
                      <button
                        className="accion-button pay"
                        onClick={() => openConfirmation('pay', c)}
                        disabled={c.pagada}
                        aria-label={`Pagar cuota ${c.ID_Cuota}`}
                        title="Pagar"
                      >
                        Pagar
                      </button>
                      <button
                        className="accion-button delete"
                        onClick={() => openConfirmation('delete', c)}
                        aria-label={`Eliminar cuota ${c.ID_Cuota}`}
                        title="Eliminar"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* — Paginación — */}
        <div className="paginacion-controls" style={{ marginTop: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={goPrevPage} disabled={page === 1} className="btn-page" aria-label="Página anterior" title="Página anterior">
            <ChevronLeft />
          </button>
          <span>Página {page}</span>
          <button onClick={goNextPage} disabled={!hasMore} className="btn-page" aria-label="Página siguiente" title="Página siguiente">
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* — Modal Nueva cuota — */}
      {showModal && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeManualModal();
          }}
        >
          <div className="cuotas-modal" role="dialog" aria-modal="true" aria-labelledby="cuotas-modal-title">
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="cuotas-modal-title">Nueva cuota</h3>
                  <span>Cargá una cuota individual para un usuario activo.</span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={closeManualModal} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="cuotas-modal-grid">
                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Usuario</label>
                  <Select
                    className="cuotas-select"
                    classNamePrefix="cuotas-select"
                    options={mergedUserOptions}
                    value={selectedUserOpt}
                    onChange={setSelectedUserOpt}
                    onInputChange={(value, meta) => {
                      if (meta.action === 'input-change') setUserSearch(value);
                    }}
                    placeholder="Seleccioná un usuario"
                    noOptionsMessage={() => userSearch.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'No se encontraron usuarios'}
                    loadingMessage={() => 'Buscando usuarios...'}
                    isClearable
                    isSearchable
                    isLoading={usersLoading}
                    filterOption={null}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                    styles={cuotasSelectStyles}
                  />
                </div>

                <div className="cuotas-modal-field">
                  <label>Mes</label>
                  <ReactDatePicker
                    selected={mesDate}
                    onChange={date => setMesDate(date)}
                    dateFormat="MM/yyyy"
                    showMonthYearPicker
                    placeholderText="Seleccioná mes y año"
                    className={datePickerClass}
                    popperClassName="notranslate"
                    required
                  />
                </div>

                <div className="cuotas-modal-field">
                  <label>Vence</label>
                  <ReactDatePicker
                    selected={venceDate}
                    onChange={date => setVenceDate(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Seleccioná fecha de vencimiento"
                    className="custom-datepicker"
                    required
                  />
                </div>

                <div className="cuotas-modal-note cuotas-modal-field-wide">
                  El proporcional se calcula por el mes de la cuota seleccionado. La fecha de vencimiento solo indica hasta cuándo puede pagarse.
                </div>

                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Plan</label>
                  <div className="cuotas-plan-preview">
                    {manualPreviewLoading ? (
                      <span>Consultando plan...</span>
                    ) : !selectedUserOpt?.value ? (
                      <span>Seleccioná un usuario para ver el plan vigente.</span>
                    ) : !mesDate ? (
                      <span>Seleccioná el mes de la cuota para calcular el proporcional.</span>
                    ) : manualPreview?.plan ? (
                      <>
                        <strong>{manualPreview.plan.nombre}</strong>
                        <span>
                          {formatCurrency(manualPreview.plan.precio)}
                          {manualPreview.diasCubiertos && manualPreview.diasDelMes
                            ? ` · ${manualPreview.diasCubiertos} de ${manualPreview.diasDelMes} día(s)`
                            : ''}
                        </span>
                      </>
                    ) : (
                      <span>El usuario no tiene plan asignado.</span>
                    )}
                  </div>
                </div>

                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Importe proporcional (editable)</label>
                  <CustomInput
                    type="number"
                    placeholder="50000"
                    value={importe}
                    onChange={e => setImporte(e.target.value)}
                    required
                    width="100%"
                  />
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={closeManualModal}>
                  Cancelar
                </button>
                <button type="submit" className="cuotas-modal-primary-button">
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* — Modal Editar importe — */}
      {showEditModal && selectedCuota && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditModal();
          }}
        >
          <div className="cuotas-modal cuotas-modal-small" role="dialog" aria-modal="true" aria-labelledby="cuotas-edit-modal-title">
            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="cuotas-edit-modal-title">Editar importe</h3>
                  <span>
                    {selectedCuota.User ? `${selectedCuota.User.nombre || ''} ${selectedCuota.User.apellido || ''}`.trim() : 'Usuario'}
                    {' · '}
                    {formatMonth(selectedCuota.mes)}
                  </span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={closeEditModal} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="cuotas-modal-grid">
                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Importe</label>
                  <CustomInput
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="50000"
                    value={editImporte}
                    onChange={event => setEditImporte(event.target.value)}
                    required
                    width="100%"
                    autoFocus
                  />
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={closeEditModal} disabled={savingEdit}>
                  Cancelar
                </button>
                <button type="submit" className="cuotas-modal-primary-button" disabled={savingEdit}>
                  {savingEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* — Modal Cuotas masivas — */}
      {showBulkModal && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowBulkModal(false);
          }}
        >
          <div className="cuotas-modal cuotas-modal-small" role="dialog" aria-modal="true" aria-labelledby="cuotas-bulk-modal-title">
            <div className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="cuotas-bulk-modal-title">Generar cuotas masivas</h3>
                  <span>Creá las cuotas del período para usuarios con turnos fijos.</span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={() => setShowBulkModal(false)} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="cuotas-modal-grid">
                <div className="cuotas-modal-field">
                  <label>Mes</label>
                  <ReactDatePicker
                    selected={bulkMesDate}
                    onChange={date => setBulkMesDate(date)}
                    dateFormat="MM/yyyy"
                    showMonthYearPicker
                    placeholderText="MM/AAAA"
                    className={datePickerClass}
                    popperClassName="notranslate"
                  />
                </div>
                <div className="cuotas-modal-field">
                  <label>Vence</label>
                  <ReactDatePicker
                    selected={bulkVenceDate}
                    onChange={date => setBulkVenceDate(date)}
                    dateFormat="dd/MM/yyyy"
                    placeholderText="Seleccione fecha de vencimiento"
                    className="custom-datepicker"
                  />
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={() => setShowBulkModal(false)}>
                  Cancelar
                </button>
                <button type="button" className="cuotas-modal-primary-button" onClick={handleBulkGenerate}>
                  Generar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* — Modal Borrar cuotas por mes — */}
      {showBulkDeleteModal && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowBulkDeleteModal(false);
          }}
        >
          <div className="cuotas-modal cuotas-modal-small" role="dialog" aria-modal="true" aria-labelledby="cuotas-bulk-delete-modal-title">
            <div className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="cuotas-bulk-delete-modal-title">Borrar cuotas por mes</h3>
                  <span>Eliminá cuotas no pagadas y sus turnos asociados para volver atrás una generación masiva.</span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={() => setShowBulkDeleteModal(false)} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              <div className="cuotas-modal-grid">
                <div className="cuotas-modal-field cuotas-modal-field-wide">
                  <label>Mes</label>
                  <ReactDatePicker
                    selected={bulkDeleteMesDate}
                    onChange={date => setBulkDeleteMesDate(date)}
                    dateFormat="MM/yyyy"
                    showMonthYearPicker
                    placeholderText="MM/AAAA"
                    className={datePickerClass}
                    popperClassName="notranslate"
                  />
                </div>
                <div className="cuotas-modal-note cuotas-modal-field-wide">
                  Esta acción borra las cuotas no pagadas del mes seleccionado. Las cuotas pagadas se conservan.
                </div>
              </div>

              <div className="cuotas-modal-actions">
                <button type="button" className="cuotas-modal-secondary-button" onClick={() => setShowBulkDeleteModal(false)}>
                  Cancelar
                </button>
                <button type="button" className="cuotas-modal-danger-button" onClick={openBulkDeleteConfirmation}>
                  Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* — Popup confirmar — */}
      <ConfirmationPopup
        isOpen={popupOpen}
        onClose={closeConfirmation}
        onConfirm={handleConfirm}
        message={
          actionType === 'bulk-delete'
            ? `¿Confirmás borrar las cuotas no pagadas de ${formatMonth(buildMesString(bulkDeleteMesDate))}? También se eliminarán los turnos asociados a esas cuotas.`
            : actionType === 'pay'
            ? `¿Confirmar pago de la cuota ${selectedCuota?.ID_Cuota}?`
            : `¿Estas seguro de eliminar la cuota? Si la cuota tiene turnos fijos asociados se eliminaran también.`
        }
      >
        {actionType === 'pay' && (
          <div className='form-input-ctn' style={{ margin: '1rem 0' }}>
            <label htmlFor="formaPago">Forma de pago</label>
            <CustomDropdown
              id="formaPago"
              value={formaPago}
              onChange={e => setFormaPago(e.target.value)}
              options={["Efectivo", "Tarjeta de crédito", "Tarjeta de débito", "Transferencia"]}
            />
          </div>
        )}
      </ConfirmationPopup>

      {validationResult && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setValidationResult(null);
          }}
        >
          <div className="cuotas-modal validation-modal" role="dialog" aria-modal="true" aria-labelledby="cuotas-validation-modal-title">
            <div className="cuotas-modal-header">
              <div>
                <h3 id="cuotas-validation-modal-title">Horarios sin cupo suficiente</h3>
                <span>No se generó ninguna cuota. Resolvé estos horarios y volvé a generar.</span>
              </div>
              <button type="button" className="cuotas-modal-close" onClick={() => setValidationResult(null)} aria-label="Cerrar modal">
                <X size={18} />
              </button>
            </div>
            <p className="validation-summary">
              Hay <strong>{validationResult.conflictosCupo?.length || 0}</strong> horario(s) donde los turnos fijos
              superan el cupo disponible. Liberá lugar o ajustá los turnos fijos de los alumnos afectados:
            </p>
            <div className="validation-problems-list">
              {(validationResult.conflictosCupo || []).map((c, i) => (
                <div key={i} className="validation-problem-card">
                  <strong>{c.clase || 'Clase'} · {c.diaSemana} {formatConflictFecha(c.fecha)}</strong>
                  <span>
                    Cupo {c.cupos} · ocupados {c.turnosExistentes} · solicitados {c.turnosSolicitados}
                    {Number(c.reservasFijasPendientes || 0) > 0 && (
                      <> · reservados fijos {c.reservasFijasPendientes}</>
                    )}
                    {' · '}exceso {c.exceso}
                  </span>
                  {Array.isArray(c.usuariosAfectados) && c.usuariosAfectados.length > 0 && (
                    <ul>
                      {c.usuariosAfectados.map(u => (
                        <li key={u.ID_Usuario}>{u.nombre}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="cuotas-modal-actions">
              <button
                type="button"
                className="cuotas-modal-primary-button"
                onClick={() => setValidationResult(null)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuotasUsuarios;
