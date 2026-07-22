import React, { useEffect, useState, useCallback, useMemo } from "react";
import "../../../App.css";
import "./clasesActividadesForm.css";
import SidebarMenu from "../../../Components/SidebarMenu/SidebarMenu";
import SecondaryButton from "../../../Components/utils/SecondaryButton/SecondaryButton";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from "../../../axiosConfig";
import apiService from "../../../services/apiService";
import CustomDropdown from "../../../Components/utils/CustomDropdown/CustomDropdown";
import { toast } from "react-toastify";
import LoaderFullScreen from "../../../Components/utils/LoaderFullScreen/LoaderFullScreen";
import CustomInput from "../../../Components/utils/CustomInput/CustomInput";

// ——————————————————————————————————————————
// Utils de día/horario (hora “de pared” → ISO Z)
// ——————————————————————————————————————————
const normalizeDay = (d) =>
  (d || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Lunes=0 ... Domingo=6 (semana comienza en lunes)
const dayIndexFromSpanish = (d) => {
  const key = normalizeDay(d);
  const map = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4, sabado: 5, domingo: 6 };
  return map[key] ?? 0;
};

// Devuelve Date local a las 00:00
const startOfDayLocal = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Lunes de la semana actual (local)
const getMondayThisWeek = (ref = new Date()) => {
  const d = startOfDayLocal(ref);
  const jsDay = d.getDay(); // 0=Dom..6=Sab
  const daysSinceMonday = (jsDay + 6) % 7; // Lun=0
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysSinceMonday);
  return monday;
};

// Fecha local de la semana que viene para un índice de día (Lun=0..Dom=6)
const getNextWeekDateForDayIndex = (dayIdx) => {
  const mondayThis = getMondayThisWeek();
  const mondayNext = new Date(mondayThis);
  mondayNext.setDate(mondayThis.getDate() + 7);
  const target = new Date(mondayNext);
  target.setDate(mondayNext.getDate() + (dayIdx || 0));
  return target; // local midnight
};

// Convierte "HH:mm"+día → ISO Z manteniendo la “hora de pared”
const toISOZSameClockTime = (hhmm, diaSemana) => {
  if (!hhmm || !diaSemana) return "";
  const [hh, mm] = (hhmm || "00:00").split(":");
  const idx = dayIndexFromSpanish(diaSemana);
  const base = getNextWeekDateForDayIndex(idx); // fecha (00:00) de la semana próxima para ese día
  return new Date(
    Date.UTC(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      Number(hh) || 0,
      Number(mm) || 0,
      0,
      0
    )
  ).toISOString();
};

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const DURACION_OPTIONS = [30, 45, 60, 90];
const INTERVAL_OPTIONS = [30, 60, 90];
const DEFAULT_INTERVAL_BY_DURATION = { 30: 30, 45: 60, 60: 60, 90: 90 };
const MINUTOS_DIA = 24 * 60;

const hhmmToMinutes = (value) => {
  const [hh = "0", mm = "0"] = String(value || "00:00").split(":");
  return (Number(hh) || 0) * 60 + (Number(mm) || 0);
};

const minutesToHHMM = (minutes) => {
  const normalized = Math.max(0, Math.min(minutes, MINUTOS_DIA));
  const h = String(Math.floor(normalized / 60)).padStart(2, "0");
  const mm = String(normalized % 60).padStart(2, "0");
  return `${h}:${mm}`;
};

const getHoraFinFromDuration = (horaIni, duracionMin) =>
  minutesToHHMM(hhmmToMinutes(horaIni) + Number(duracionMin || 0));

const getDurationFromHorario = (horario) => {
  const diff = hhmmToMinutes(horario?.horaFin) - hhmmToMinutes(horario?.horaIni);
  return DURACION_OPTIONS.includes(diff) ? diff : 60;
};

const horarioVisualKey = (horario) => `${normalizeDay(horario.diaSemana)}-${horario.horaIni}`;

const sortHorariosVisual = (items) =>
  [...items].sort((a, b) => {
    const dayDiff = dayIndexFromSpanish(a.diaSemana) - dayIndexFromSpanish(b.diaSemana);
    if (dayDiff !== 0) return dayDiff;
    return hhmmToMinutes(a.horaIni) - hhmmToMinutes(b.horaIni);
  });

const ClasesActividadesForm = ({ isEditing, classId: classIdProp, fromAdmin, fromEntrenador }) => {
  const navigate = useNavigate();
  const { id: classIdParam } = useParams();
  const classId = isEditing ? classIdProp ?? classIdParam : null;

  // ——————————————————————————————————————————
  // Estado local
  // ——————————————————————————————————————————
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  // Solo mostramos horarios activos; mantenemos 'activo' por compatibilidad
  const [horarios, setHorarios] = useState([
    { diaSemana: "", horaIni: "", horaFin: "", cupos: "", idHorarioClase: null, activo: true }
  ]);
  const [selectedDias, setSelectedDias] = useState([]);
  const [duracionMin, setDuracionMin] = useState(60);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("21:00");
  const [intervalMin, setIntervalMin] = useState(60);
  const [baseCupos, setBaseCupos] = useState("");

  // Modal de edición de un horario existente (dos pasos: form → confirmación preserve/instant)
  const [editModal, setEditModal] = useState(null); // { id, diaSemana, horaIni, duracion, cupos, step, original }

  const [entrenadores, setEntrenadores] = useState([]);
  const [initialEntrenadores, setInitialEntrenadores] = useState([]);
  const [selectedEntrenadores, setSelectedEntrenadores] = useState([]);
  const [dropdownValue, setDropdownValue] = useState("");

  const [isLoading, setIsLoading] = useState(false);

  // snapshot de horarios iniciales para detectar cambios pendientes
  const [initialHorariosMap, setInitialHorariosMap] = useState({}); // { [idHorarioClase]: {diaSemana, horaIni, horaFin, cupos, activo} }

  // Opciones de hora cada 30', con 24:00 para cierres de día.
  const generateTimeSlots = () => {
    const slots = [];
    for (let m = 0; m < 24 * 60; m += 30) {
      const h = String(Math.floor(m / 60)).padStart(2, "0");
      const mm = String(m % 60).padStart(2, "0");
      slots.push(`${h}:${mm}`);
    }
    slots.push("24:00");
    return slots;
  };
  const timeSlots = useMemo(() => generateTimeSlots(), []);
  const generatedStartSlots = useMemo(() => {
    const start = hhmmToMinutes(startTime);
    const end = hhmmToMinutes(endTime);
    const duration = Number(duracionMin) || 60;
    const interval = Number(intervalMin) || 60;
    if (end <= start || start + duration > end) return [];

    const slots = [];
    for (let m = start; m + duration <= end; m += interval) {
      slots.push(minutesToHHMM(m));
    }
    return slots;
  }, [duracionMin, endTime, intervalMin, startTime]);

  // ——————————————————————————————————————————
  // 2) Cargar entrenadores
  // ——————————————————————————————————————————
  useEffect(() => {
    apiService
      .getEntrenadores()
      .then((resp) => setEntrenadores(resp.data ?? resp))
      .catch((err) => console.error("Error al obtener entrenadores", err));
  }, []);

  // ——————————————————————————————————————————
  // 3) Si editando, cargar datos de clase (helper reutilizable)
  // ——————————————————————————————————————————
  const fetchClaseDetalle = useCallback(async () => {
    if (!isEditing || !classId) return;
    setIsLoading(true);
    try {
      const { data } = await apiClient.get(`/clase/horario/${classId}`);
      const {
        nombre: nombreAPI,
        descripcion: descripcionAPI,
        imagenClase,
        HorariosClase,
        Entrenadores: entrenadoresIniciales
      } = data;

      setNombre(nombreAPI);
      setDescripcion(descripcionAPI);

      // Solo activos
      const formatted = (HorariosClase ?? [])
        .filter((h) => h.activo !== false)
        .map((h) => ({
          diaSemana: h.diaSemana,
          horaIni: (h.horaIni ?? "").substr(11, 5), // "2025-09-11T07:00:00.000Z" -> "07:00"
          horaFin: (h.horaFin ?? "").substr(11, 5),
          cupos: h.cupos,
          idHorarioClase: h.ID_HorarioClase,
          activo: true
        }));

      setHorarios(
        formatted.length > 0
          ? formatted
          : [{ diaSemana: "", horaIni: "", horaFin: "", cupos: "", idHorarioClase: null, activo: true }]
      );

      if (formatted.length > 0) {
        const sortedFormatted = sortHorariosVisual(formatted);
        const initialDuration = getDurationFromHorario(sortedFormatted[0]);
        const startMinutes = Math.min(...sortedFormatted.map((h) => hhmmToMinutes(h.horaIni)));
        const endMinutes = Math.max(...sortedFormatted.map((h) => hhmmToMinutes(h.horaFin)));

        // El builder arranca sin días seleccionados: es la herramienta para AGREGAR horarios.
        // (Si se preseleccionaran los días cargados, "Guardar horarios" agregaría slots no pedidos.)
        setSelectedDias([]);
        setDuracionMin(initialDuration);
        setIntervalMin(DEFAULT_INTERVAL_BY_DURATION[initialDuration] || 60);
        setStartTime(minutesToHHMM(startMinutes));
        setEndTime(minutesToHHMM(endMinutes));
        setBaseCupos(formatted[0]?.cupos ? String(formatted[0].cupos) : "");
      } else {
        setSelectedDias([]);
        setDuracionMin(60);
        setIntervalMin(60);
        setStartTime("18:00");
        setEndTime("21:00");
        setBaseCupos("");
      }

      const map = {};
      for (const h of formatted) {
        if (h.idHorarioClase) {
          map[h.idHorarioClase] = {
            diaSemana: h.diaSemana,
            horaIni: h.horaIni,
            horaFin: h.horaFin,
            cupos: Number(h.cupos),
            activo: h.activo
          };
        }
      }
      setInitialHorariosMap(map);

      setImagePreview(imagenClase);
      setImage(null);

      const init = (entrenadoresIniciales ?? []);
      setSelectedEntrenadores(init);
      setInitialEntrenadores(init);
    } catch (error) {
      console.error("Error al obtener los detalles de la clase:", error);
      toast.error("Error al obtener información de la clase. Intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  }, [isEditing, classId]);

  useEffect(() => {
    fetchClaseDetalle();
  }, [fetchClaseDetalle]);

  // ——————————————————————————————————————————
  // 4) Entrenadores (UI)
  // ——————————————————————————————————————————
  const handleSelectEntrenador = (nombreCompleto) => {
    const ent = entrenadores.find((e) => `${e.nombre} ${e.apellido}` === nombreCompleto);
    if (!ent) return;
    if (!selectedEntrenadores.some((s) => s.ID_Usuario === ent.ID_Usuario)) {
      setSelectedEntrenadores((prev) => [...prev, ent]);
    }
  };
  const handleRemoveEntrenador = (ID_Usuario) => {
    setSelectedEntrenadores((prev) => prev.filter((e) => e.ID_Usuario !== ID_Usuario));
  };

  // ——————————————————————————————————————————
  // 5) Imagen
  // ——————————————————————————————————————————
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const toggleDia = (dia) => {
    setSelectedDias((prev) =>
      prev.includes(dia) ? prev.filter((item) => item !== dia) : [...prev, dia]
    );
  };

  const handleDurationChange = (value) => {
    const parsed = Number(value);
    const next = DURACION_OPTIONS.includes(parsed) ? parsed : 60;
    setDuracionMin(next);
    setIntervalMin(DEFAULT_INTERVAL_BY_DURATION[next] || 60);
  };

  // Mergea los horarios generados por el builder con la lista actual.
  // ADITIVO: nunca borra ni pisa lo ya cargado; sólo agrega los slots que no existen.
  const mergeBuilderIntoList = (prevList) => {
    const duration = Number(duracionMin) || 30;
    const cleanPrev = prevList.filter((h) => h.diaSemana && h.horaIni);
    const existingKeys = new Set(cleanPrev.map((h) => horarioVisualKey(h)));
    const additions = [];

    selectedDias.forEach((dia) => {
      generatedStartSlots.forEach((horaIni) => {
        const key = `${normalizeDay(dia)}-${horaIni}`;
        if (existingKeys.has(key)) return; // ya está cargado: no duplicar ni pisar cupos
        additions.push({
          diaSemana: dia,
          horaIni,
          horaFin: getHoraFinFromDuration(horaIni, duration),
          cupos: baseCupos,
          idHorarioClase: null,
          activo: true
        });
      });
    });

    return sortHorariosVisual([...cleanPrev, ...additions]);
  };

  // Modo crear: agrega los horarios del builder a la lista (se persisten al crear la clase).
  const handleAgregarHorarios = () => {
    setHorarios((prev) => mergeBuilderIntoList(prev));
  };

  // Modo editar: agrega lo del builder a lo cargado y guarda todo contra la API.
  const handleGuardarHorarios = async () => {
    const merged = mergeBuilderIntoList(horarios);
    setHorarios(merged);
    const ok = await syncHorariosChanges({ items: merged });
    if (ok) setSelectedDias([]);
  };

  const updatePreviewCupos = (targetHorario, value) => {
    const targetKey = targetHorario.idHorarioClase
      ? `id-${targetHorario.idHorarioClase}`
      : horarioVisualKey(targetHorario);

    setHorarios((prev) =>
      prev.map((h) => {
        const currentKey = h.idHorarioClase ? `id-${h.idHorarioClase}` : horarioVisualKey(h);
        return currentKey === targetKey ? { ...h, cupos: value } : h;
      })
    );
  };

  const removePreviewHorario = (targetHorario) => {
    const targetKey = targetHorario.idHorarioClase
      ? `id-${targetHorario.idHorarioClase}`
      : horarioVisualKey(targetHorario);
    setHorarios((prev) =>
      prev.filter((h) => {
        const currentKey = h.idHorarioClase ? `id-${h.idHorarioClase}` : horarioVisualKey(h);
        return currentKey !== targetKey;
      })
    );
  };

  // ——————————————————————————————————————————
  // Edición de un horario existente (modal de dos pasos)
  // ——————————————————————————————————————————
  const openEditHorario = (horario) => {
    setEditModal({
      id: horario.idHorarioClase,
      diaSemana: horario.diaSemana,
      horaIni: horario.horaIni,
      duracion: getDurationFromHorario(horario),
      cupos: String(horario.cupos ?? ""),
      step: "form",
      original: { diaSemana: horario.diaSemana, horaIni: horario.horaIni, horaFin: horario.horaFin, cupos: horario.cupos },
    });
  };

  const closeEditHorario = () => setEditModal(null);

  const editHorarioHoraFin = editModal
    ? getHoraFinFromDuration(editModal.horaIni, editModal.duracion)
    : "";

  // ¿Cambió día u horario? (si sólo cambian cupos, los turnos sacados no se ven afectados)
  const editChangesSchedule = editModal
    ? editModal.diaSemana !== editModal.original.diaSemana ||
      editModal.horaIni !== editModal.original.horaIni ||
      editHorarioHoraFin !== editModal.original.horaFin
    : false;

  const goToEditConfirm = async () => {
    if (!editModal) return;
    if (!editModal.diaSemana || !editModal.horaIni || !Number(editModal.cupos)) {
      toast.error("Completá día, hora de inicio y cupos.");
      return;
    }
    if (!editChangesSchedule) {
      // Sólo cambian cupos: no afecta turnos sacados, se guarda directo.
      applyEditHorario("preserve");
      return;
    }

    // Cambió día/horario: preguntar preserve/instant SOLO si el horario tiene turnos sacados.
    setIsLoading(true);
    try {
      const { data } = await apiClient.get(`/clase/horario/${editModal.id}/turnos-activos`);
      const turnosActivos = Number(data?.turnosActivos || 0);
      if (turnosActivos > 0) {
        setEditModal((prev) => ({ ...prev, step: "confirm", turnosActivos }));
      } else {
        // Sin turnos sacados: actualizar el horario directamente (in-place, sin duplicar registros).
        await applyEditHorario("instant");
      }
    } catch (error) {
      console.error(error);
      // Si el chequeo falla, no bloqueamos: mostramos el popup para que decida el admin.
      setEditModal((prev) => ({ ...prev, step: "confirm" }));
    } finally {
      setIsLoading(false);
    }
  };

  const applyEditHorario = async (updateMode) => {
    if (!editModal) return;
    const horaFin = getHoraFinFromDuration(editModal.horaIni, editModal.duracion);
    setIsLoading(true);
    try {
      await apiClient.post(`/clase/horario/${editModal.id}/modify`, {
        updateMode,
        diaSemana: editModal.diaSemana,
        horaIni: toISOZSameClockTime(editModal.horaIni, editModal.diaSemana),
        horaFin: toISOZSameClockTime(horaFin, editModal.diaSemana),
        cupos: Number(editModal.cupos),
      });
      toast.success(
        updateMode === "preserve"
          ? "Horario actualizado. Los turnos ya sacados se preservaron en su horario original."
          : "Horario actualizado. Los turnos futuros se movieron al nuevo horario."
      );
      setEditModal(null);
      await fetchClaseDetalle();
    } catch (error) {
      console.error(error);
      toast.error("No se pudo actualizar el horario.");
    } finally {
      setIsLoading(false);
    }
  };

  const horariosPreview = useMemo(
    () => sortHorariosVisual(horarios.filter((h) => h.activo !== false && h.diaSemana && h.horaIni && h.horaFin)),
    [horarios]
  );

  const horariosPorDia = useMemo(() => {
    return horariosPreview.reduce((acc, horario) => {
      if (!acc[horario.diaSemana]) acc[horario.diaSemana] = [];
      acc[horario.diaSemana].push(horario);
      return acc;
    }, {});
  }, [horariosPreview]);

  const previewDiasOrdenados = useMemo(
    () => Object.keys(horariosPorDia).sort((a, b) => dayIndexFromSpanish(a) - dayIndexFromSpanish(b)),
    [horariosPorDia]
  );

  const hasHorarioChanges = useMemo(() => {
    if (!isEditing) return false;
    const previewIds = new Set(horariosPreview.map((h) => h.idHorarioClase).filter(Boolean));
    const hasDeletedRows = Object.keys(initialHorariosMap).some((id) => !previewIds.has(Number(id)));
    if (hasDeletedRows) return true;

    return horariosPreview.some((h) => {
      if (!h.idHorarioClase) return true;
      const snap = initialHorariosMap[h.idHorarioClase];
      if (!snap) return false;
      return (
        snap.diaSemana !== h.diaSemana ||
        snap.horaIni !== h.horaIni ||
        snap.horaFin !== h.horaFin ||
        Number(snap.cupos) !== Number(h.cupos)
      );
    });
  }, [horariosPreview, initialHorariosMap, isEditing]);

  const syncHorariosChanges = async ({ silent = false, manageLoading = true, items = null } = {}) => {
    if (!isEditing || !classId) return true;

    // 'items' permite pasar la lista recién mergeada (setState es async y horariosPreview quedaría viejo)
    const lista = items
      ? sortHorariosVisual(items.filter((h) => h.activo !== false && h.diaSemana && h.horaIni && h.horaFin))
      : horariosPreview;

    const previewIds = new Set(lista.map((h) => h.idHorarioClase).filter(Boolean));
    const deletedIds = Object.keys(initialHorariosMap)
      .map(Number)
      .filter((id) => !previewIds.has(id));
    const newRows = lista.filter((h) => !h.idHorarioClase);
    const changedRows = lista.filter((h) => {
      if (!h.idHorarioClase) return false;
      const snap = initialHorariosMap[h.idHorarioClase];
      if (!snap) return false;
      return (
        snap.diaSemana !== h.diaSemana ||
        snap.horaIni !== h.horaIni ||
        snap.horaFin !== h.horaFin ||
        Number(snap.cupos) !== Number(h.cupos)
      );
    });

    if (newRows.length === 0 && changedRows.length === 0 && deletedIds.length === 0) {
      if (!silent) toast.info("No hay cambios de horarios para guardar.");
      return true;
    }

    const invalid = [...newRows, ...changedRows].find((h) => !h.diaSemana || !h.horaIni || !h.horaFin || !Number(h.cupos));
    if (invalid) {
      toast.error("Todos los horarios deben tener día, inicio, fin y cupos.");
      return false;
    }

    if (manageLoading) setIsLoading(true);
    try {
      for (const h of newRows) {
        await apiClient.post(`/clase/${classId}/horarioClase`, {
          diaSemana: h.diaSemana,
          horaIni: toISOZSameClockTime(h.horaIni, h.diaSemana),
          horaFin: toISOZSameClockTime(h.horaFin, h.diaSemana),
          cupos: Number(h.cupos)
        });
      }

      for (const h of changedRows) {
        // Cambios masivos desde la lista (sólo cupos): preserve no toca los turnos ya sacados.
        await apiClient.post(`/clase/horario/${h.idHorarioClase}/modify`, {
          updateMode: 'preserve',
          diaSemana: h.diaSemana,
          horaIni: toISOZSameClockTime(h.horaIni, h.diaSemana),
          horaFin: toISOZSameClockTime(h.horaFin, h.diaSemana),
          cupos: Number(h.cupos)
        });
      }

      for (const id of deletedIds) {
        await apiClient.delete(`/clase/horarioClase/${id}`);
      }

      if (manageLoading) await fetchClaseDetalle();
      if (!silent) toast.success("Horarios actualizados.");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("No se pudieron guardar los cambios de horarios.");
      return false;
    } finally {
      if (manageLoading) setIsLoading(false);
    }
  };

  // ——————————————————————————————————————————
  // 6) Submit (crear/editar CLASE)
  // ——————————————————————————————————————————
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const dataForm = new FormData();
    dataForm.append("nombre", nombre);
    dataForm.append("descripcion", descripcion);
    if (image) dataForm.append("image", image);

    if (isEditing) {
      const horariosSynced = await syncHorariosChanges({ silent: true, manageLoading: false });
      if (!horariosSynced) {
        setIsLoading(false);
        return;
      }

      // ✅ Ahora SOLO nombre/descr/imagen
      apiClient
        .put(`/clase/clase/${classId}`, dataForm, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then(async () => {
          // Sincronizar entrenadores como antes
          const origIds = initialEntrenadores.map((e) => e.ID_Usuario);
          const newIds = selectedEntrenadores.map((e) => e.ID_Usuario);
          const toAdd = newIds.filter((id) => !origIds.includes(id));
          const toRemove = origIds.filter((id) => !newIds.includes(id));

          await Promise.all([
            ...toAdd.map((id) => apiService.addEntrenadorToClase(classId, id)),
            ...toRemove.map((id) => apiService.removeEntrenadorFromClase(classId, id)),
          ]);

          if (fromAdmin) navigate("/admin/clases-actividades");
          else if (fromEntrenador) navigate("/entrenador/clases-actividades");

          toast.success("Clase actualizada.");
        })
        .catch((error) => {
          if (error?.code === "ERR_NETWORK") {
            toast.error("La foto es muy grande o hubo un problema de red.");
          } else {
            toast.error("Error actualizando la clase.");
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      // Crear clase (POST original con horarios embebidos)
      if (horariosPreview.length === 0) {
        toast.error("Agregá al menos un horario.");
        setIsLoading(false);
        return;
      }

      const transformedHorarios = horariosPreview.map((h) => ({
        diaSemana: h.diaSemana,
        horaIni: toISOZSameClockTime(h.horaIni, h.diaSemana),
        horaFin: toISOZSameClockTime(h.horaFin, h.diaSemana),
        cupos: Number(h.cupos)
      }));

      dataForm.append("horarios", JSON.stringify(transformedHorarios));

      const entrenadorIds = selectedEntrenadores.map((e) => e.ID_Usuario);
      dataForm.append("entrenadores", JSON.stringify(entrenadorIds));

      apiClient
        .post("/clase/horario", dataForm, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then(async ({ data }) => {
          const idNuevaClase = data?.clase?.ID_Clase;
          if (idNuevaClase) {
            await Promise.all(
              entrenadorIds.map((id) => apiService.addEntrenadorToClase(idNuevaClase, id))
            );
          }
          if (fromAdmin) navigate("/admin/clases-actividades");
          else if (fromEntrenador) navigate("/entrenador/clases-actividades");

          toast.success("Clase creada y entrenadores asignados exitosamente.");
          resetForm();
        })
        .catch((error) => {
          if (error?.code === "ERR_NETWORK") {
            toast.error("La foto es muy grande o hubo un problema de red.");
          } else {
            toast.error("Error al crear la clase o asignar entrenadores.");
          }
        })
        .finally(() => setIsLoading(false));
    }
  };

  const resetForm = () => {
    setNombre("");
    setDescripcion("");
    setImage(null);
    setImagePreview("");
    setHorarios([{ diaSemana: "", horaIni: "", horaFin: "", cupos: "", idHorarioClase: null, activo: true }]);
    setSelectedDias([]);
    setDuracionMin(60);
    setStartTime("18:00");
    setEndTime("21:00");
    setIntervalMin(60);
    setBaseCupos("");
    setSelectedEntrenadores([]);
    setDropdownValue("");
    setInitialHorariosMap({});
  };

  return (
    <div className="page-layout">
      {isLoading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
      <div className="content-layout">
        <div className="clases-actividades-form-ctn">
          <div className="clases-actividades-form-title">
            <SecondaryButton
              text="Volver atrás"
              linkTo={fromAdmin ? "/admin/clases-actividades" : "/entrenador/clases-actividades"}
              icon={ArrowLeft}
              reversed={true}
            />
            <h2>{isEditing ? "Editar clase o actividad" : "Crear nueva clase o actividad"}</h2>
          </div>

          <div className="create-clase-form">
            <form encType="multipart/form-data" onSubmit={handleSubmit}>
              {/* Nombre */}
              <div className="form-input-ctn">
                <label>Nombre:</label>
                <CustomInput
                  id="nombre"
                  type="text"
                  width="100%"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required={true}
                />
              </div>

              {/* Descripción */}
              <div className="form-input-ctn form-input-ctn--full">
                <label htmlFor="descripcion">Descripción:</label>
                <textarea
                  id="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  required
                />
              </div>

              {/* Imagen */}
              <div className="form-input-ctn form-input-ctn--full">
                <label htmlFor="imagen">Imagen:</label>
                <input type="file" id="imagen" onChange={handleImageChange} />
                {imagePreview && (
                  <div className="preview-container">
                    <img
                      src={imagePreview}
                      alt="Preview clase"
                      className="preview-img"
                      width={300}
                    />
                  </div>
                )}
              </div>

              {/* Entrenadores */}
              <div className="form-input-ctn form-input-ctn--full">
                <label htmlFor="entrenadores">Entrenadores:</label>
                <CustomDropdown
                  id="entrenadores"
                  name="entrenadores"
                  options={entrenadores.filter(e => e.estado).map((e) => `${e.nombre} ${e.apellido}`)}
                  placeholderOption="Seleccionar entrenador"
                  value={dropdownValue}
                  onChange={(e) => {
                    handleSelectEntrenador(e.target.value);
                    setDropdownValue("");
                  }}
                />
                <div className="selected-tags">
                  {selectedEntrenadores.map((ent) => (
                    <div key={ent.ID_Usuario} className="tag">
                      <span>{`${ent.nombre} ${ent.apellido}`}</span>
                      <X
                        className="tag-close"
                        width={20}
                        height={20}
                        onClick={() => handleRemoveEntrenador(ent.ID_Usuario)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Horarios */}
              <div className="form-input-horarios">
                <div className="horarios-builder-header">
                  <div>
                    <label>Horarios</label>
                    <p>Seleccioná días, duración, cupo y horarios de inicio.</p>
                  </div>
                  {isEditing && hasHorarioChanges && (
                    <span className="horarios-pending-badge">Cambios pendientes</span>
                  )}
                </div>

                <div className="horarios-builder">
                  <section className="horario-builder-section">
                    <div className="horario-section-title">
                      <span>Días</span>
                      <div className="quick-pill-actions">
                        <button type="button" onClick={() => setSelectedDias(DIAS_SEMANA)}>Todos</button>
                        <button type="button" onClick={() => setSelectedDias([])}>Limpiar</button>
                      </div>
                    </div>
                    <div className="pill-group dias-pill-group">
                      {DIAS_SEMANA.map((dia) => (
                        <button
                          key={dia}
                          type="button"
                          className={`selector-pill ${selectedDias.includes(dia) ? "selected" : ""}`}
                          onClick={() => toggleDia(dia)}
                        >
                          {dia}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="horario-builder-section horario-settings-grid">
                    <div className="form-input-ctn-horario">
                      <label>Duración</label>
                      <select
                        value={duracionMin}
                        onChange={(e) => handleDurationChange(e.target.value)}
                      >
                        {DURACION_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} minutos
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-input-ctn-horario">
                      <label>Desde</label>
                      <select
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      >
                        {timeSlots.filter((time) => time !== "24:00").map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-input-ctn-horario">
                      <label>Hasta</label>
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      >
                        {timeSlots.map((time) => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-input-ctn-horario">
                      <label>Inicio cada</label>
                      <select
                        value={intervalMin}
                        onChange={(e) => setIntervalMin(Number(e.target.value))}
                      >
                        {INTERVAL_OPTIONS.map((minutes) => (
                          <option key={minutes} value={minutes}>
                            {minutes} minutos
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-input-ctn-horario">
                      <label>Cupo base</label>
                      <input
                        type="number"
                        min={1}
                        value={baseCupos}
                        onChange={(e) => setBaseCupos(e.target.value)}
                        placeholder="Cupos"
                      />
                    </div>

                  </section>

                  <section className="horario-builder-section">
                    <div className="horario-section-title">
                      <span>Inicios calculados</span>
                      <small>
                        {generatedStartSlots.length} por día
                      </small>
                    </div>
                    {generatedStartSlots.length === 0 ? (
                      <div className="generated-empty-state">
                        Ajustá el rango para que entre al menos un turno.
                      </div>
                    ) : (
                      <div className="generated-start-list">
                        {generatedStartSlots.map((time) => (
                          <span key={time} className="generated-start-pill">
                            {time} - {getHoraFinFromDuration(time, duracionMin)}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="horarios-builder-actions">
                    {isEditing ? (
                      <button
                        type="button"
                        className="horarios-action-btn"
                        onClick={handleGuardarHorarios}
                        disabled={isLoading}
                      >
                        Guardar horarios
                      </button>
                    ) : (
                      <button type="button" className="horarios-action-btn" onClick={handleAgregarHorarios}>
                        <Plus size={18} />
                        Agregar horarios
                      </button>
                    )}
                  </div>
                </div>

                <div className="horarios-preview">
                  <div className="horarios-preview-header">
                    <div>
                      <strong>Horarios cargados</strong>
                      <span>{horariosPreview.length} horarios</span>
                    </div>
                  </div>

                  {horariosPreview.length === 0 ? (
                    <div className="horarios-empty-state">
                      No hay horarios cargados todavía.
                    </div>
                  ) : (
                    previewDiasOrdenados.map((dia) => (
                      <div key={dia} className="preview-day-group">
                        <h4>{dia}</h4>
                        <div className="preview-slot-list">
                          {horariosPorDia[dia].map((horario) => {
                            const changed = horario.idHorarioClase
                              ? Number(initialHorariosMap[horario.idHorarioClase]?.cupos) !== Number(horario.cupos)
                              : false;
                            return (
                              <div
                                key={horario.idHorarioClase ?? horarioVisualKey(horario)}
                                className={`preview-slot ${horario.idHorarioClase ? "existing" : "new"} ${changed ? "changed" : ""}`}
                              >
                                <div className="preview-slot-time">
                                  <span>{horario.horaIni} - {horario.horaFin}</span>
                                  <small>{horario.idHorarioClase ? "Existente" : "Nuevo"}</small>
                                </div>
                                <div className="preview-slot-cupos">
                                  <label>Cupos</label>
                                  <div className="preview-cupos-control">
                                    <input
                                      type="number"
                                      min={1}
                                      value={horario.cupos}
                                      onChange={(e) => updatePreviewCupos(horario, e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="preview-slot-actions">
                                  {isEditing && horario.idHorarioClase && (
                                    <button
                                      type="button"
                                      className="preview-slot-edit"
                                      onClick={() => openEditHorario(horario)}
                                      aria-label={`Editar horario ${dia} ${horario.horaIni}`}
                                      title="Editar horario"
                                    >
                                      <Pencil size={17} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="preview-slot-remove"
                                    onClick={() => removePreviewHorario(horario)}
                                    aria-label={`Quitar horario ${dia} ${horario.horaIni}`}
                                    title="Eliminar horario"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Submit (CLASE) */}
              <div className="clase-actividad-form-guardar-btn">
                <button type="submit" className="submit-btn" disabled={isLoading}>
                  {isEditing ? "Guardar cambios" : "Crear Clase"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>

      {/* ─── Modal editar horario existente ─── */}
      {editModal && (
        <div
          className="cuotas-modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeEditHorario();
          }}
        >
          <div className="cuotas-modal cuotas-modal-small" role="dialog" aria-modal="true" aria-labelledby="edit-horario-title">
            <div className="modal-form">
              <div className="cuotas-modal-header">
                <div>
                  <h3 id="edit-horario-title">
                    {editModal.step === "form" ? "Editar horario" : "¿Qué hacemos con los turnos ya sacados?"}
                  </h3>
                  <span>
                    {editModal.step === "form"
                      ? `Horario actual: ${editModal.original.diaSemana} ${editModal.original.horaIni} - ${editModal.original.horaFin}`
                      : `${editModal.original.diaSemana} ${editModal.original.horaIni} → ${editModal.diaSemana} ${editModal.horaIni} - ${editHorarioHoraFin}`}
                  </span>
                </div>
                <button type="button" className="cuotas-modal-close" onClick={closeEditHorario} aria-label="Cerrar modal">
                  <X size={18} />
                </button>
              </div>

              {editModal.step === "form" ? (
                <>
                  <div className="cuotas-modal-grid">
                    <div className="cuotas-modal-field">
                      <label>Día</label>
                      <CustomDropdown
                        options={DIAS_SEMANA}
                        value={editModal.diaSemana}
                        onChange={(e) => setEditModal((prev) => ({ ...prev, diaSemana: e.target.value }))}
                      />
                    </div>

                    <div className="cuotas-modal-field">
                      <label>Hora de inicio</label>
                      <CustomDropdown
                        options={timeSlots.filter((t) => t !== "24:00")}
                        value={editModal.horaIni}
                        onChange={(e) => setEditModal((prev) => ({ ...prev, horaIni: e.target.value }))}
                      />
                    </div>

                    <div className="cuotas-modal-field">
                      <label>Duración</label>
                      <CustomDropdown
                        options={DURACION_OPTIONS.map((m) => ({ value: String(m), label: `${m} minutos` }))}
                        value={String(editModal.duracion)}
                        onChange={(e) => setEditModal((prev) => ({ ...prev, duracion: Number(e.target.value) }))}
                        placeholderOption={null}
                      />
                    </div>

                    <div className="cuotas-modal-field">
                      <label>Cupos</label>
                      <CustomInput
                        type="number"
                        min={1}
                        value={editModal.cupos}
                        onChange={(e) => setEditModal((prev) => ({ ...prev, cupos: e.target.value }))}
                        width="100%"
                      />
                    </div>
                  </div>

                  <p className="edit-horario-resumen">
                    Nuevo horario: <strong>{editModal.diaSemana} {editModal.horaIni} - {editHorarioHoraFin}</strong>
                  </p>

                  <div className="cuotas-modal-actions">
                    <button type="button" className="cuotas-modal-secondary-button" onClick={closeEditHorario}>
                      Cancelar
                    </button>
                    <button type="button" className="cuotas-modal-primary-button" onClick={goToEditConfirm} disabled={isLoading}>
                      Guardar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="edit-horario-confirm-text">
                    {editModal.turnosActivos
                      ? `Este horario tiene ${editModal.turnosActivos} turno${editModal.turnosActivos === 1 ? "" : "s"} ya sacado${editModal.turnosActivos === 1 ? "" : "s"} por alumnos. Elegí cómo proceder:`
                      : "Este horario puede tener turnos ya reservados por alumnos. Elegí cómo proceder:"}
                  </p>

                  <div className="edit-horario-options">
                    <button
                      type="button"
                      className="edit-horario-option"
                      onClick={() => applyEditHorario("preserve")}
                      disabled={isLoading}
                    >
                      <strong>Preservar turnos sacados</strong>
                      <span>
                        Los turnos ya reservados se mantienen en su día y horario original.
                        El horario viejo deja de aceptar nuevas reservas y se crea el nuevo.
                      </span>
                    </button>

                    <button
                      type="button"
                      className="edit-horario-option"
                      onClick={() => applyEditHorario("instant")}
                      disabled={isLoading}
                    >
                      <strong>Mover turnos al nuevo horario</strong>
                      <span>
                        Los turnos futuros se reprograman automáticamente al nuevo día y horario.
                      </span>
                    </button>
                  </div>

                  <div className="cuotas-modal-actions">
                    <button
                      type="button"
                      className="cuotas-modal-secondary-button"
                      onClick={() => setEditModal((prev) => ({ ...prev, step: "form" }))}
                    >
                      Volver
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClasesActividadesForm;
