import React, { useState, useEffect, useMemo } from 'react';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu.jsx';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown.jsx';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput.jsx';
import './CrearRutina.css';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton.jsx';
import apiService from '../../../services/apiService';
import { toast } from "react-toastify";
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { Copy, Dumbbell, Table2, X } from 'lucide-react';
import SecondaryButton from "../../../Components/utils/SecondaryButton/SecondaryButton.jsx";

/* ================= Helpers ================= */
const customStyles = {
  container: (provided) => ({
    ...provided,
    width: '100%',
    minWidth: 0,
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? 'var(--primary-color)'
      : state.isFocused
        ? 'var(--background-hover-color)'
        : 'var(--background-color)',
    color: state.isSelected ? '#fff' : 'var(--text-color)',
    cursor: 'pointer',
    ':active': {
      backgroundColor: 'var(--background-hover-color)',
    },
  }),
  control: (provided, state) => ({
    ...provided,
    backgroundColor: 'var(--background-color-distinct)',
    borderColor: 'var(--border-color)',
    borderRadius: '10px',
    borderWidth: '1px',
    minHeight: '44px',
    padding: '0 4px',
    boxShadow: 'none',
    color: 'var(--text-color)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    ':hover': {
      borderColor: 'var(--border-color)',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--text-color)',
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '4px 8px',
    gap: '4px',
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    minHeight: '42px',
  }),
  dropdownIndicator: (provided) => ({
    ...provided,
    padding: '6px',
    color: 'var(--text-color-distinct)',
  }),
  clearIndicator: (provided) => ({
    ...provided,
    padding: '6px',
    color: 'var(--text-color-distinct)',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--background-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    overflow: 'hidden',
    zIndex: 100
  }),
  input: (provided) => ({
    ...provided,
    color: 'var(--text-color)',
  }),
  placeholder: (provided) => ({
    ...provided,
    color: 'var(--text-color-distinct)',
  }),
  multiValue: (provided) => ({
    ...provided,
    backgroundColor: 'var(--background-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '7px',
    margin: '2px',
  }),
  multiValueLabel: (provided) => ({
    ...provided,
    color: 'var(--text-color)',
    fontSize: '12px',
    padding: '2px 6px',
  }),
  multiValueRemove: (provided) => ({
    ...provided,
    color: 'var(--text-color-distinct)',
    borderRadius: '7px',
    ':hover': {
      backgroundColor: 'var(--background-hover-color)',
      color: 'var(--text-color)',
    },
  })
};

const DISPLAY_TYPES = ["Series y repeticiones", "Rondas", "EMOM", "AMRAP", "Escalera", "TABATA", "DROPSET"];

const apiToDisplayType = {
  SETS_REPS: 'Series y repeticiones',
  ROUNDS: 'Rondas',
  EMOM: 'EMOM',
  AMRAP: 'AMRAP',
  LADDER: 'Escalera',
  TABATA: 'TABATA',
  DROPSET: 'DROPSET',
};

const displayToApiType = (t) => ({
  "Series y repeticiones": "SETS_REPS",
  "Rondas": "ROUNDS",
  "EMOM": "EMOM",
  "AMRAP": "AMRAP",
  "Escalera": "LADDER",
  "TABATA": "TABATA",
  "DROPSET": "DROPSET",
}[t] || "SETS_REPS");

const getRandomExercise = () =>
  [
    "Pecho plano 60kg",
    "Flexiones de brazo",
    "Press de hombro 60kg",
    "Sentadillas con barra 80kg",
    "Remo con mancuerna 40kg",
    "Dominadas",
    "Elevaciones laterales 8kg"
  ][Math.floor(Math.random() * 7)];

const makeEmptyBlock = (selectedType) => {
  const baseSet = {
    series: '',
    exercise: '',
    weight: '',
    placeholderExercise: getRandomExercise(),
    exerciseId: null
  };

  switch (selectedType) {
    case 'Series y repeticiones':
      return { id: Date.now(), type: selectedType, data: { setsReps: [{ ...baseSet }] } };

    case 'Rondas':
      return {
        id: Date.now(),
        type: selectedType,
        data: { rounds: '', descanso: '', setsReps: [{ ...baseSet }] }
      };

    case 'EMOM':
      return {
        id: Date.now(),
        type: selectedType,
        data: { interval: '1', totalMinutes: '', setsReps: [{ ...baseSet }] }
      };

    case 'AMRAP':
      return {
        id: Date.now(),
        type: selectedType,
        data: { duration: '', setsReps: [{ ...baseSet }] }
      };

    case 'Escalera':
      return {
        id: Date.now(),
        type: selectedType,
        data: { escaleraType: '', setsReps: [{ ...baseSet }] }
      };

    case 'TABATA':
      return {
        id: Date.now(),
        type: selectedType,
        data: {
          cantSeries: '',
          descTabata: '',
          tiempoTrabajoDescansoTabata: '',
          setsReps: [{ ...baseSet }]
        }
      };

    case 'DROPSET':
      // Nombre global + filas serie/kilos
      return {
        id: Date.now(),
        type: selectedType,
        data: {
          exerciseName: '',
          exerciseId: null,
          exercisePlaceholder: getRandomExercise(),
          setsReps: [{ series: '', weight: '' }]
        }
      };

    default:
      return {
        id: Date.now(),
        type: 'Series y repeticiones',
        data: { setsReps: [{ ...baseSet }] }
      };
  }
};

/* ==== Helpers para leer bloques desde API (incluye detección de DROPSET) ==== */
const getBlockItemsFromApi = (b) => {
  if (!b) return [];
  if (Array.isArray(b.bloqueEjercicios)) return b.bloqueEjercicios;
  if (Array.isArray(b.ejercicios)) return b.ejercicios;
  return [];
};

const isDropSetBlockFromApi = (b) => {
  if (!b || b.type !== 'SETS_REPS') return false;

  const items = getBlockItemsFromApi(b);
  if (!Array.isArray(items) || items.length < 2) return false;

  const firstId =
    items[0]?.ejercicio?.ID_Ejercicio ??
    items[0]?.ID_Ejercicio ??
    items[0]?.ejercicioId ??
    null;

  const firstName = (
    items[0]?.ejercicio?.nombre ||
    b?.nombreEj ||
    ''
  ).trim().toLowerCase();

  if (!firstId && !firstName) return false;

  return items.every(it => {
    const id =
      it?.ejercicio?.ID_Ejercicio ??
      it?.ID_Ejercicio ??
      it?.ejercicioId ??
      null;
    const name = (it?.ejercicio?.nombre || '').trim().toLowerCase();

    if (firstId != null && id != null) return id === firstId;
    return name && name === firstName;
  });
};

const convertApiBlockData = (b) => {
  const items = getBlockItemsFromApi(b);

  const mappedSets = items.map((e) => {
    const nombreEj =
      e?.ejercicio?.nombre ??
      e?.nombre ??
      b?.nombreEj ??
      '';
    const idEj =
      e.ID_Ejercicio ??
      e?.ejercicio?.ID_Ejercicio ??
      e?.ejercicioId ??
      null;
    const reps = e.reps ?? e.setsReps ?? b?.setsReps ?? '';
    const weight = e.setRepWeight ?? b?.weight ?? '';
    return {
      series: reps,
      exercise: nombreEj,
      weight,
      placeholderExercise: '',
      exerciseId: idEj || null
    };
  });

  // Detectar DROPSET guardado como SETS_REPS con 2+ filas del mismo ejercicio
  if (b.type === 'SETS_REPS' && isDropSetBlockFromApi(b)) {
    const first = items[0] || {};
    const exerciseName =
      b.nombreEj ||
      first?.ejercicio?.nombre ||
      first?.nombre ||
      '';
    const exerciseId =
      first?.ejercicio?.ID_Ejercicio ??
      first?.ID_Ejercicio ??
      first?.ejercicioId ??
      null;

    const setsReps = items.map(it => ({
      series: it.reps ?? b.setsReps ?? '',
      weight: it.setRepWeight ?? ''
    }));

    return {
      __isDropSet: true,
      exerciseName,
      exerciseId,
      exercisePlaceholder: '',
      setsReps
    };
  }

  switch (b.type) {
    case 'SETS_REPS':
      return {
        setsReps: mappedSets.length
          ? mappedSets
          : [{
            series: b.setsReps || '',
            exercise: b.nombreEj || '',
            weight: b.weight || '',
            placeholderExercise: '',
            exerciseId: null
          }]
      };

    case 'ROUNDS':
      return {
        rounds: b.cantRondas ?? '',
        descanso: b.descansoRonda ?? '',
        setsReps: mappedSets
      };

    case 'EMOM':
      return {
        interval: '1',
        totalMinutes: b.durationMin ?? '',
        setsReps: mappedSets
      };

    case 'AMRAP':
      return {
        duration: b.durationMin ?? '',
        setsReps: mappedSets
      };

    case 'LADDER':
      return {
        escaleraType: b.tipoEscalera ?? '',
        setsReps: mappedSets
      };

    case 'TABATA':
      return {
        cantSeries: b.cantSeries ?? '',
        descTabata: b.descTabata ?? '',
        tiempoTrabajoDescansoTabata:
          b.tiempoTrabajoDescansoTabata ??
          (b.durationMin ? `${b.durationMin}m` : ''),
        setsReps: mappedSets
      };

    case 'DROPSET': {
      // Por si en algún momento se guarda explícito como DROPSET
      const rows = items.length ? items : [];
      const first = rows[0] || {};
      return {
        exerciseName:
          b.nombreEj ??
          first?.ejercicio?.nombre ??
          first?.nombre ??
          '',
        exerciseId:
          first?.ejercicio?.ID_Ejercicio ??
          first?.ID_Ejercicio ??
          first?.ejercicioId ??
          null,
        exercisePlaceholder: '',
        setsReps: rows.map(e => ({
          series: e.reps ?? '',
          weight: e.setRepWeight ?? ''
        }))
      };
    }

    default:
      return { setsReps: mappedSets };
  }
};

// Normalizador de métricas
const normalizeUserMetrics = (resp) => {
  const ejercicios =
    (resp && Array.isArray(resp.ejercicios) && resp.ejercicios) ||
    (resp && resp.data && Array.isArray(resp.data.ejercicios) && resp.data.ejercicios) ||
    (Array.isArray(resp) && resp) ||
    [];
  return { ejercicios };
};

const usuarioToOption = (usuario) => ({
  label: `${usuario.nombre || ''} ${usuario.apellido || ''}${usuario.dni ? ` - DNI ${usuario.dni}` : usuario.email ? ` (${usuario.email})` : ''}`,
  value: usuario.ID_Usuario,
  usuario
});

/* ================= Component ================= */
const CrearRutina = ({ fromAdmin, fromEntrenador, fromAlumno }) => {
  const { rutinaId } = useParams();
  const isEditing = Boolean(rutinaId);
  const navigate = useNavigate();

  const canAssign = !!(fromEntrenador || fromAdmin);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(isEditing);

  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [clases, setClases] = useState([]);
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedGrupoMuscular, setSelectedGrupoMuscular] = useState("");
  const [tipoRutina, setTipoRutina] = useState("clasica"); // "clasica" | "simple"
  const [urlPlanificacion, setUrlPlanificacion] = useState("");
  const gruposMusculares = [
    "Pecho", "Espalda", "Piernas", "Brazos", "Hombros",
    "Abdominales", "Glúteos", "Tren Superior", "Tren Inferior",
    "Full Body", "Mixto"
  ];

  const [userOptions, setUserOptions] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserOptions, setSelectedUserOptions] = useState([]);
  const [gruposUsuarios, setGruposUsuarios] = useState([]);
  const [selectedGroupOptions, setSelectedGroupOptions] = useState([]);

  const [allExercises, setAllExercises] = useState([]);

  // Panel de información
  const [infoOpen, setInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 720px)').matches;
  });
  const [infoTab, setInfoTab] = useState('ejercicios');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [userMetrics, setUserMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [selectedInfoUserId, setSelectedInfoUserId] = useState(null);

  // Días
  const [days, setDays] = useState([
    { key: 'dia1', nombre: '', descripcion: '', blocks: [] }
  ]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Semanas
  const [isWeekly, setIsWeekly] = useState(false);
  const [weeks, setWeeks] = useState([
    { key: 'semana1', nombre: 'Semana 1', numero: 1, days: [] }
  ]);
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);

  // Helper para actualizar días y sincronizar con la semana actual si corresponde
  const handleSetDays = (newDays) => {
    setDays(newDays);
    if (isWeekly) {
      setWeeks(prevWeeks => {
        const updated = [...prevWeeks];
        if (updated[activeWeekIndex]) {
          updated[activeWeekIndex] = { ...updated[activeWeekIndex], days: newDays };
        }
        return updated;
      });
    }
  };

  // Responsive
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    apiService.getEjercicios()
      .then(setAllExercises)
      .catch(() => toast.error('No se pudieron cargar los ejercicios'));

    apiService.getClases()
      .then(setClases)
      .catch(() => toast.error('No se pudieron cargar las clases'));
  }, []);

  useEffect(() => {
    if (step === 2) setInfoOpen(!isMobile);
  }, [step, isMobile]);

  useEffect(() => {
    if (canAssign) {
      (async () => {
        try {
          const gruposResp = await apiService.getGruposUsuarios();
          setGruposUsuarios(Array.isArray(gruposResp?.grupos) ? gruposResp.grupos : []);
        } catch {
          toast.error('No se pudieron cargar los grupos de usuarios');
        }
      })();
    }
  }, [canAssign]);

  useEffect(() => {
    if (!canAssign) return;

    const term = userSearch.trim();
    let isCurrentRequest = true;

    if (term.length < 2) {
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
      } catch {
        if (isCurrentRequest) {
          setUserOptions([]);
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
  }, [canAssign, userSearch]);

  const mergedUserOptions = useMemo(() => {
    const optionsById = new Map();
    [...selectedUserOptions, ...userOptions].forEach(option => {
      if (option?.value) optionsById.set(option.value, option);
    });
    return Array.from(optionsById.values());
  }, [selectedUserOptions, userOptions]);

  const assignedInfoUserOptions = useMemo(() => {
    const optionsById = new Map();

    selectedUserOptions.forEach(option => {
      if (option?.value) optionsById.set(Number(option.value), option);
    });

    selectedGroupOptions.forEach(groupOption => {
      const group = gruposUsuarios.find(g => Number(g.ID_GrupoUsuario) === Number(groupOption.value));
      const members = group?.miembros || group?.usuarios || group?.Usuarios || [];

      members.forEach(member => {
        const usuario = member?.usuario || member?.Usuario || member;
        const id = Number(usuario?.ID_Usuario || usuario?.id || usuario?.value);
        if (!id || optionsById.has(id)) return;
        optionsById.set(id, usuarioToOption({ ...usuario, ID_Usuario: id }));
      });
    });

    return Array.from(optionsById.values());
  }, [gruposUsuarios, selectedGroupOptions, selectedUserOptions]);

  useEffect(() => {
    if (!canAssign) return;

    const selectedStillAvailable = assignedInfoUserOptions.some(
      option => Number(option.value) === Number(selectedInfoUserId)
    );

    if (!selectedStillAvailable) {
      setSelectedInfoUserId(assignedInfoUserOptions[0]?.value ?? null);
    }
  }, [assignedInfoUserOptions, canAssign, selectedInfoUserId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.exercise-cell')) {
        setSuggestions({});
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (isEditing) {
      fetchRoutine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, canAssign]);

  /* Restoring selectedUserId for JSX usage */
  const selectedUserId = useMemo(() => {
    if (!canAssign) return Number(localStorage.getItem("usuarioId"));
    return selectedInfoUserId ?? assignedInfoUserOptions?.[0]?.value ?? null;
  }, [assignedInfoUserOptions, canAssign, selectedInfoUserId]);

  useEffect(() => {
    if (!canAssign) return;
    const uid = selectedUserId; // Use the value from scope
    if (!uid) { setUserMetrics(null); return; }
    if (!(step === 2 && infoTab === 'usuario')) return;

    (async () => {
      try {
        setLoadingMetrics(true);
        setUserMetrics(null);
        const resp = await apiService.getEjerciciosResultadosUsuario(uid);
        const normalized = normalizeUserMetrics(resp);
        setUserMetrics(normalized);
      } catch {
        setUserMetrics({ ejercicios: [] });
        toast.error('No se pudieron cargar las mediciones del usuario');
      } finally {
        setLoadingMetrics(false);
      }
    })();
  }, [canAssign, selectedUserId, step, infoTab]); // Added selectedUserId back to deps

  const afterPaint = () =>
    new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

  const cryptoRandomId = () => {
    try {
      return Number((crypto.getRandomValues(new Uint32Array(1))[0]).toString());
    } catch {
      return Date.now();
    }
  };

  const fetchRoutine = async () => {
    setLoading(true);
    try {
      const resp = await apiService.getRutinaById(rutinaId);
      const r = resp?.rutina ?? resp;

      setFormData({
        nombre: r.nombre || '',
        descripcion: r.desc || ''
      });
      setSelectedClase(r.claseRutina || "");
      setSelectedGrupoMuscular(r.grupoMuscularRutina || "");
      if (r.urlPlanificacion) {
        setTipoRutina("simple");
        setUrlPlanificacion(r.urlPlanificacion);
      } else {
        setTipoRutina("clasica");
        setUrlPlanificacion("");
      }

      if (canAssign) {
        const asignacionesUsuarios = Array.isArray(r?.asignacionesUsuarios)
          ? r.asignacionesUsuarios
          : (r?.alumno ? [r.alumno] : []);
        const selectedUsers = asignacionesUsuarios
          .map(a => {
            const id = Number(a.ID_Usuario);
            return id ? usuarioToOption({ ...a, ID_Usuario: id }) : null;
          })
          .filter(Boolean);
        setSelectedUserOptions(selectedUsers);
        const selectedGroups = (Array.isArray(r?.asignacionesGrupos) ? r.asignacionesGrupos : [])
          .map(g => ({
            label: g.nombre,
            value: g.ID_GrupoUsuario
          }))
          .filter(g => g.value);
        setSelectedGroupOptions(selectedGroups);
      }

      const mapBloques = (bloquesApi = []) =>
        bloquesApi.map(b => {
          const converted = convertApiBlockData(b);
          const isDrop = converted.__isDropSet === true;
          const blockType = isDrop
            ? 'DROPSET'
            : (apiToDisplayType[b.type] || b.type);

          const data = isDrop
            ? {
              exerciseName: converted.exerciseName,
              exerciseId: converted.exerciseId,
              exercisePlaceholder: converted.exercisePlaceholder,
              setsReps: converted.setsReps
            }
            : converted;

          return {
            id: cryptoRandomId(),
            type: blockType,
            data
          };
        });

      const parseDays = (diasApi = {}) => {
        if (!diasApi || typeof diasApi !== 'object') return [];
        const keys = Object.keys(diasApi).sort();
        return keys.map((k, idx) => {
          const d = diasApi[k] || {};
          const blocks = Array.isArray(d.bloques)
            ? mapBloques(d.bloques)
            : [];
          return {
            key: `dia${idx + 1}`,
            nombre: d.nombre || '',
            descripcion: d.descripcion || '',
            blocks
          };
        });
      };

      if (r?.semanas && typeof r.semanas === 'object' && Object.keys(r.semanas).length > 0) {
        setIsWeekly(true);
        const sKeys = Object.keys(r.semanas).sort();
        const loadedWeeks = sKeys.map((k, idx) => {
          const s = r.semanas[k];
          const daysList = parseDays(s.dias);
          return {
            key: `semana${idx + 1}`,
            id: s.id, // Capture existing ID
            nombre: s.nombre || `Semana ${idx + 1}`,
            numero: s.numero || (idx + 1),
            days: daysList.length ? daysList : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
          };
        });

        const validWeeks = loadedWeeks.length ? loadedWeeks : [{ key: 'semana1', nombre: 'Semana 1', numero: 1, days: [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }] }];
        setWeeks(validWeeks);
        setDays(validWeeks[0].days);
        setActiveWeekIndex(0);
        setActiveDayIndex(0);

      } else if (r?.dias && typeof r.dias === 'object' && Object.keys(r.dias).length > 0) {
        setIsWeekly(false);
        const loaded = parseDays(r.dias);
        setDays(
          loaded.length
            ? loaded
            : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
        );
        setActiveDayIndex(0);
        // Populate default week in case user toggles
        setWeeks([{ key: 'semana1', nombre: 'Semana 1', numero: 1, days: loaded }]);

      } else {
        setIsWeekly(false);
        const blocks = Array.isArray(r.Bloques)
          ? mapBloques(r.Bloques)
          : [];
        const loaded = [{
          key: 'dia1',
          nombre: '',
          descripcion: '',
          blocks
        }];
        setDays(loaded);
        setActiveDayIndex(0);
        setWeeks([{ key: 'semana1', nombre: 'Semana 1', numero: 1, days: loaded }]);
      }

      await afterPaint();

    } catch (err) {
      console.error(err);
      toast.error('No se pudo cargar la rutina para editar');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim())
      return toast.error("Ingresá un nombre para la rutina");
    if (!days.length)
      return toast.error("Agregá al menos un día");
    if (canAssign && selectedUserOptions.length === 0 && selectedGroupOptions.length === 0)
      return toast.error("Seleccioná al menos un usuario o grupo para asignar la rutina");
    setStep(2);
  };

  // Tabs días
  const addDay = () => {
    const nextIndex = days.length + 1;
    const newKey = `dia${nextIndex}`;
    handleSetDays([
      ...days,
      { key: newKey, nombre: '', descripcion: '', blocks: [] }
    ]);
    setActiveDayIndex(days.length);
  };

  const removeDay = (idx) => {
    if (days.length === 1)
      return toast.info("Debe existir al menos un día");
    const newDays = days
      .filter((_, i) => i !== idx)
      .map((d, i) => ({ ...d, key: `dia${i + 1}` }));
    handleSetDays(newDays);
    setActiveDayIndex(Math.max(0, idx - 1));
  };

  const duplicateDay = (idx) => {
    const original = days[idx];
    if (!original) return;

    const clonedBlocks = (original.blocks || []).map(block => ({
      ...block,
      id: cryptoRandomId(),
      data: JSON.parse(JSON.stringify(block.data || {}))
    }));

    const duplicatedDay = {
      ...original,
      key: 'tmp',
      nombre: original.nombre ? `${original.nombre} (copia)` : '',
      descripcion: original.descripcion || '',
      blocks: clonedBlocks
    };

    const newDays = [
      ...days.slice(0, idx + 1),
      duplicatedDay,
      ...days.slice(idx + 1)
    ].map((d, i) => ({ ...d, key: `dia${i + 1}` }));

    handleSetDays(newDays);
    setActiveDayIndex(idx + 1);
  };

  const activeDay = days[activeDayIndex];

  const setActiveDayBlocks = (newBlocks) => {
    handleSetDays(days.map((d, i) =>
      i === activeDayIndex ? { ...d, blocks: newBlocks } : d
    ));
  };

  const addExerciseIntoBuildingBlock = (exerciseObj) => {
    const ejName = exerciseObj?.nombre || '';
    const ejId = exerciseObj?.ID_Ejercicio || null;

    if (!activeDay?.blocks || activeDay.blocks.length === 0) {
      const newBlock = makeEmptyBlock('Series y repeticiones');
      newBlock.data.setsReps = [{
        series: '',
        exercise: ejName,
        weight: '',
        placeholderExercise: getRandomExercise(),
        exerciseId: ejId
      }];
      setActiveDayBlocks([newBlock]);
      toast.success(`Agregado "${ejName}" en un nuevo bloque`);
      return;
    }

    const lastIndex = activeDay.blocks.length - 1;
    const lastBlock = activeDay.blocks[lastIndex];

    if (lastBlock?.type === 'DROPSET') {
      const updated = {
        ...lastBlock,
        data: {
          ...lastBlock.data,
          exerciseName: ejName,
          exerciseId: ejId ?? null
        }
      };
      const newBlocks = activeDay.blocks.map((b, i) =>
        i === lastIndex ? updated : b
      );
      setActiveDayBlocks(newBlocks);
      toast.success(`Asignado "${ejName}" al DROPSET`);
      return;
    }

    const currentSets = Array.isArray(lastBlock?.data?.setsReps)
      ? lastBlock.data.setsReps
      : [];
    const updatedLastBlock = {
      ...lastBlock,
      data: {
        ...lastBlock.data,
        setsReps: [
          ...currentSets,
          {
            series: '',
            exercise: ejName,
            weight: '',
            placeholderExercise: getRandomExercise(),
            exerciseId: ejId
          }
        ]
      }
    };

    const newBlocks = activeDay.blocks.map((b, i) =>
      i === lastIndex ? updatedLastBlock : b
    );
    setActiveDayBlocks(newBlocks);
    toast.success(`Agregado "${ejName}" al último bloque`);
  };

  // Blocks CRUD
  const handleAddBlock = (e) => {
    const selectedType = e.target.value;
    if (!selectedType) return;
    setActiveDayBlocks([
      ...(activeDay?.blocks || []),
      makeEmptyBlock(selectedType)
    ]);
  };

  const handleDeleteBlock = (blockId) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).filter(b => b.id !== blockId)
    );
  };

  const handleBlockFieldChange = (blockId, field, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? { ...block, data: { ...block.data, [field]: value } }
          : block
      )
    );
  };

  const handleSetRepChange = (blockId, index, field, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSetsReps = block.data.setsReps.map((sr, i) =>
            i === index ? { ...sr, [field]: value } : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSetsReps }
          };
        }
        return block;
      })
    );
  };

  const handleAddSetRep = (blockId) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              setsReps: [
                ...block.data.setsReps,
                block.type === 'DROPSET'
                  ? { series: '', weight: '' }
                  : {
                    series: '',
                    exercise: '',
                    weight: '',
                    placeholderExercise: getRandomExercise(),
                    exerciseId: null
                  }
              ]
            }
          }
          : block
      )
    );
  };

  const handleDeleteSetRep = (blockId, index) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              setsReps: block.data.setsReps.filter((_, i) => i !== index)
            }
          }
          : block
      )
    );
  };

  // Autocomplete helpers
  const [suggestions, setSuggestionsState] = useState({});
  const setSuggestions = setSuggestionsState;

  const handleExerciseInputChange = (blockId, idx, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSets = block.data.setsReps.map((sr, i) =>
            i === idx
              ? { ...sr, exercise: value, exerciseId: null }
              : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSets }
          };
        }
        return block;
      })
    );

    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e =>
        e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase())
      )
      .slice(0, 5);
    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectSuggestion = (blockId, idx, exerciseObj) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block => {
        if (block.id === blockId) {
          const newSets = block.data.setsReps.map((sr, i) =>
            i === idx
              ? {
                ...sr,
                exercise: exerciseObj.nombre,
                exerciseId: exerciseObj.ID_Ejercicio
              }
              : sr
          );
          return {
            ...block,
            data: { ...block.data, setsReps: newSets }
          };
        }
        return block;
      })
    );
    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Autocomplete para nombre en DROPSET
  const handleDropsetNameChange = (blockId, value) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              exerciseName: value,
              exerciseId: null
            }
          }
          : block
      )
    );

    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e =>
        e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase())
      )
      .slice(0, 5);
    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectDropsetName = (blockId, exerciseObj) => {
    setActiveDayBlocks(
      (activeDay?.blocks || []).map(block =>
        block.id === blockId
          ? {
            ...block,
            data: {
              ...block.data,
              exerciseName: exerciseObj.nombre,
              exerciseId: exerciseObj.ID_Ejercicio
            }
          }
          : block
      )
    );
    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Drag & drop de bloques
  const [draggingBlockId, setDraggingBlockId] = useState(null);
  const [dragOverBlockId, setDragOverBlockId] = useState(null);

  const onDragStart = (e, blockId) => {
    setDraggingBlockId(blockId);
    e.dataTransfer.setData('text/plain', String(blockId));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e, overId) => {
    e.preventDefault();
    setDragOverBlockId(overId);
  };
  const onDrop = (e, toId) => {
    e.preventDefault();
    const fromId = Number(e.dataTransfer.getData('text/plain'));
    if (!fromId || fromId === toId) {
      setDraggingBlockId(null);
      setDragOverBlockId(null);
      return;
    }
    const list = activeDay?.blocks || [];
    const fromIndex = list.findIndex(b => b.id === fromId);
    const toIndex = list.findIndex(b => b.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const newOrder = [...list];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setActiveDayBlocks(newOrder);
    setDraggingBlockId(null);
    setDragOverBlockId(null);
  };
  const onDragEnd = () => {
    setDraggingBlockId(null);
    setDragOverBlockId(null);
  };

  // Drag & drop de DÍAS (tabs) - con drop "entre" tabs
  const [draggingDayKey, setDraggingDayKey] = useState(null);
  const [dayDropIndex, setDayDropIndex] = useState(null); // 0..days.length

  const onDayDragStart = (e, dayKey) => {
    setDraggingDayKey(dayKey);
    setDayDropIndex(null);
    e.dataTransfer.setData('text/plain', String(dayKey));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDayDragOverTab = (e, overIndex) => {
    e.preventDefault();
    if (!draggingDayKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = e.clientX < rect.left + rect.width / 2;
    setDayDropIndex(isBefore ? overIndex : overIndex + 1);
  };

  const onDayDragOverContainer = (e) => {
    e.preventDefault();
    if (!draggingDayKey) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const nearRight = e.clientX > rect.right - 12;
    if (nearRight) setDayDropIndex(days.length);
  };

  const onDayDrop = (e) => {
    e.preventDefault();

    const fromKey = e.dataTransfer.getData('text/plain');
    if (!fromKey) return;

    const dropIndexRaw = typeof dayDropIndex === 'number' ? dayDropIndex : null;
    if (dropIndexRaw == null) {
      setDraggingDayKey(null);
      setDayDropIndex(null);
      return;
    }

    const fromIndex = days.findIndex(d => d.key === fromKey);
    if (fromIndex === -1) return;

    const dropIndexClamped = Math.max(0, Math.min(dropIndexRaw, days.length));

    const list = [...days];
    const activeKey = days[activeDayIndex]?.key;

    const [moved] = list.splice(fromIndex, 1);

    let insertIndex = dropIndexClamped;
    if (fromIndex < insertIndex) insertIndex -= 1;

    insertIndex = Math.max(0, Math.min(insertIndex, list.length));
    list.splice(insertIndex, 0, moved);

    const newActiveIndex =
      activeKey === fromKey
        ? insertIndex
        : Math.max(0, list.findIndex(d => d.key === activeKey));

    const renumbered = list.map((d, i) => ({ ...d, key: `dia${i + 1}` }));

    handleSetDays(renumbered);
    setActiveDayIndex(newActiveIndex);

    setDraggingDayKey(null);
    setDayDropIndex(null);
  };

  const onDayDragEnd = () => {
    setDraggingDayKey(null);
    setDayDropIndex(null);
  };

  // --- Week Logic ---
  const toggleWeeklyMode = (e) => {
    const newVal = e.target.checked;
    setIsWeekly(newVal);

    if (newVal) {
      // Activar semanas: metemos los days actuales en la semana 1
      setWeeks([
        { key: 'semana1', nombre: 'Semana 1', numero: 1, days: days }
      ]);
      setActiveWeekIndex(0);
    } else {
      // Desactivar semanas: aplanamos todo en una lista de días
      const allDays = [];
      weeks.forEach(w => {
        (w.days || []).forEach(d => {
          allDays.push(d);
        });
      });
      // Renombrar keys para evitar colisiones
      const renumbered = allDays.map((d, i) => ({ ...d, key: `dia${i + 1}` }));
      setDays(renumbered);
      setActiveDayIndex(0);
    }
  };

  const addWeek = () => {
    const nextNum = weeks.length + 1;
    const newWeek = {
      key: `semana${Date.now()}`,
      nombre: `Semana ${nextNum}`,
      numero: nextNum,
      days: [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
    };
    const newWeeks = [...weeks, newWeek];
    setWeeks(newWeeks);
    setActiveWeekIndex(newWeeks.length - 1);
    setDays(newWeek.days);
    setActiveDayIndex(0);
  };

  const removeWeek = (idx) => {
    if (weeks.length === 1) return toast.info("Debe existir al menos una semana");
    const newWeeks = weeks.filter((_, i) => i !== idx);
    setWeeks(newWeeks);

    // Si borramos la semana que estábamos viendo, mostramos la anterior (o la 0)
    let newActiveIndex = activeWeekIndex;
    if (idx === activeWeekIndex) {
      newActiveIndex = Math.max(0, idx - 1);
    } else if (idx < activeWeekIndex) {
      newActiveIndex -= 1;
    }

    setActiveWeekIndex(newActiveIndex);
    setDays(newWeeks[newActiveIndex].days);
    setActiveDayIndex(0);
  };

  const duplicateWeek = (idx) => {
    const original = weeks[idx];
    if (!original) return;

    const clonedDays = (original.days || []).map((day, dayIdx) => ({
      ...day,
      key: `dia${dayIdx + 1}`,
      blocks: (day.blocks || []).map(block => ({
        ...block,
        id: cryptoRandomId(),
        data: JSON.parse(JSON.stringify(block.data || {}))
      }))
    }));

    const nextNum = weeks.length + 1;
    const duplicatedWeek = {
      key: `semana${Date.now()}`,
      nombre: `Semana ${nextNum}`,
      numero: nextNum,
      days: clonedDays.length
        ? clonedDays
        : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]
    };

    const newWeeks = [
      ...weeks.slice(0, idx + 1),
      duplicatedWeek,
      ...weeks.slice(idx + 1)
    ].map((week, weekIdx) => ({
      ...week,
      numero: weekIdx + 1,
      nombre: week.nombre.startsWith('Semana ')
        ? `Semana ${weekIdx + 1}`
        : week.nombre
    }));

    const newActiveIndex = idx + 1;
    setWeeks(newWeeks);
    setActiveWeekIndex(newActiveIndex);
    setDays(newWeeks[newActiveIndex].days);
    setActiveDayIndex(0);
  };

  const handleWeekNameChange = (idx, newName) => {
    const updated = [...weeks];
    updated[idx].nombre = newName;
    setWeeks(updated);
  };

  const selectWeek = (idx) => {
    setActiveWeekIndex(idx);
    setDays(weeks[idx].days);
    setActiveDayIndex(0);
  };

  // Drag & drop semanas
  const [draggingWeekKey, setDraggingWeekKey] = useState(null);
  const [weekDropIndex, setWeekDropIndex] = useState(null);

  const onWeekDragStart = (e, key) => {
    setDraggingWeekKey(key);
    setWeekDropIndex(null);
    e.dataTransfer.setData('text/plain', String(key));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onWeekDragOverTab = (e, overIndex) => {
    e.preventDefault();
    if (!draggingWeekKey) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isBefore = e.clientX < rect.left + rect.width / 2;
    setWeekDropIndex(isBefore ? overIndex : overIndex + 1);
  };

  const onWeekDragOverContainer = (e) => {
    e.preventDefault();
    if (!draggingWeekKey) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX > rect.right - 12) setWeekDropIndex(weeks.length);
  };

  const onWeekDrop = (e) => {
    e.preventDefault();
    const fromKey = e.dataTransfer.getData('text/plain');
    if (!fromKey) return;
    if (weekDropIndex === null) {
      setDraggingWeekKey(null); setWeekDropIndex(null); return;
    }

    const fromIndex = weeks.findIndex(w => w.key === fromKey);
    if (fromIndex === -1) return;

    const list = [...weeks];
    const [moved] = list.splice(fromIndex, 1);

    // Clamping logic logic similar to days
    let insertIndex = weekDropIndex;
    if (fromIndex < insertIndex) insertIndex -= 1;
    insertIndex = Math.max(0, Math.min(insertIndex, list.length));

    list.splice(insertIndex, 0, moved);

    // RENUMBER WEEKS
    const renumbered = list.map((w, i) => ({
      ...w,
      nombre: w.nombre.startsWith('Semana ') ? `Semana ${i + 1}` : w.nombre,
      numero: i + 1,
      key: w.key // preserve key
    }));

    setWeeks(renumbered);

    // Ajustar active week index
    const activeKey = weeks[activeWeekIndex]?.key;
    const newActiveIndex = renumbered.findIndex(w => w.key === activeKey);
    if (newActiveIndex !== -1) setActiveWeekIndex(newActiveIndex);

    setDraggingWeekKey(null);
    setWeekDropIndex(null);
  };

  const onWeekDragEnd = () => {
    setDraggingWeekKey(null); setWeekDropIndex(null);
  };


  // Payload
  const buildPayload = () => {
    const usuariosAsignados = canAssign
      ? selectedUserOptions.map(option => Number(option.value)).filter(Boolean)
      : [Number(localStorage.getItem("usuarioId"))].filter(Boolean);
    const gruposAsignados = canAssign
      ? selectedGroupOptions.map(option => Number(option.value)).filter(Boolean)
      : [];
    const currentUserId = Number(localStorage.getItem("usuarioId"));
    const userId = usuariosAsignados[0] || currentUserId;

    const entrenadorId = canAssign
      ? currentUserId
      : null;

    const transformBlocks = (blocksList) => {
      const bloques = [];
      (blocksList || []).forEach(block => {
        const type = displayToApiType(block.type);

        // DROPSET
        if (type === 'DROPSET') {
          const name = (block?.data?.exerciseName || '').trim();
          const ejId = block?.data?.exerciseId ?? null;
          const rows = Array.isArray(block?.data?.setsReps)
            ? block.data.setsReps
            : [];

          const bloqueEjercicios = rows.map(sr => {
            const reps = sr?.series || '';
            const weightNorm = (sr?.weight || '').trim();
            if (ejId) {
              return {
                ejercicioId: ejId,
                reps,
                setRepWeight: weightNorm || undefined
              };
            }
            return {
              nuevoEjercicio: { nombre: name || 'Ejercicio' },
              reps,
              setRepWeight: weightNorm || undefined
            };
          });

          const first = rows[0] || {};
          const firstReps = first.series || null;
          const firstWeight = (first.weight || '').trim() || null;

          bloques.push({
            type: 'SETS_REPS',
            setsReps: firstReps,
            nombreEj: name || null,
            weight: firstWeight,
            descansoRonda: null,
            bloqueEjercicios
          });
          return;
        }

        // Resto de tipos
        const bloqueEjercicios = (block.data.setsReps || []).map(setRep => {
          const normWeight = (setRep.weight || '').trim();
          if (setRep.exerciseId) {
            return {
              ejercicioId: setRep.exerciseId,
              reps: setRep.series,
              setRepWeight: normWeight || undefined
            };
          }
          return {
            nuevoEjercicio: { nombre: setRep.exercise },
            reps: setRep.series,
            setRepWeight: normWeight || undefined
          };
        });

        switch (type) {
          case 'SETS_REPS':
            bloques.push({
              type,
              setsReps: block.data.setsReps[0]?.series || null,
              nombreEj: block.data.setsReps[0]?.exercise || null,
              weight:
                (block.data.setsReps[0]?.weight || '').trim() || null,
              descansoRonda: block.data.descanso || null,
              bloqueEjercicios
            });
            break;

          case 'ROUNDS':
            bloques.push({
              type,
              cantRondas: parseInt(block.data.rounds || 0, 10) || null,
              descansoRonda: parseInt(block.data.descanso || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'EMOM':
            bloques.push({
              type,
              durationMin: parseInt(block.data.totalMinutes || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'AMRAP':
            bloques.push({
              type,
              durationMin: parseInt(block.data.duration || 0, 10) || null,
              bloqueEjercicios
            });
            break;

          case 'LADDER':
            bloques.push({
              type,
              tipoEscalera: (block.data.escaleraType || '').trim() || null,
              bloqueEjercicios
            });
            break;

          case 'TABATA':
            bloques.push({
              type,
              cantSeries: Number.isFinite(parseInt(block.data.cantSeries, 10))
                ? parseInt(block.data.cantSeries, 10)
                : null,
              descTabata: (block.data.descTabata || '').trim() || null,
              tiempoTrabajoDescansoTabata: (block.data.tiempoTrabajoDescansoTabata || '').trim() || null,
              bloqueEjercicios
            });
            break;

          default:
            bloques.push({ type, bloqueEjercicios });
        }
      });
      return bloques;
    };

    const buildDaysObject = (daysList) => {
      const diasObj = {};
      daysList.forEach((d, i) => {
        const key = `dia${i + 1}`;
        diasObj[key] = {
          nombre: d.nombre || `Día ${i + 1}`,
          descripcion: d.descripcion || '',
          bloques: transformBlocks(d.blocks)
        };
      });
      return diasObj;
    };

    const payload = {
      ID_Usuario: userId,
      ID_Entrenador: entrenadorId,
      usuariosAsignados,
      gruposAsignados,
      nombre: formData.nombre,
      desc: formData.descripcion,
      claseRutina: selectedClase,
      grupoMuscularRutina: selectedGrupoMuscular,
    };

    if (isWeekly) {
      const semanasObj = {};
      weeks.forEach((w, i) => {
        const key = `semana${i + 1}`;
        semanasObj[key] = {
          // id: w.id, // Send back ID if exists
          nombre: w.nombre || `Semana ${i + 1}`,
          numero: i + 1,
          dias: buildDaysObject(w.days)
        };
      });
      payload.semanas = semanasObj;
    } else {
      payload.dias = buildDaysObject(days);
    }

    console.log('Payload:', payload);
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let payload;
      if (tipoRutina === 'simple') {
        if (!urlPlanificacion.trim()) {
          toast.error("Ingresá la URL de Google Sheets");
          setLoading(false);
          return;
        }

        const usuariosAsignadosIds = canAssign
          ? selectedUserOptions.map(option => Number(option.value)).filter(Boolean)
          : [Number(localStorage.getItem("usuarioId"))].filter(Boolean);
        const gruposAsignadosIds = canAssign
          ? selectedGroupOptions.map(option => Number(option.value)).filter(Boolean)
          : [];
        const currentUserId = Number(localStorage.getItem("usuarioId"));
        const userId = usuariosAsignadosIds[0] || currentUserId;
        const entrenadorId = canAssign ? currentUserId : null;

        payload = {
          ID_Usuario: userId,
          ID_Entrenador: entrenadorId,
          usuariosAsignados: usuariosAsignadosIds,
          gruposAsignados: gruposAsignadosIds,
          nombre: formData.nombre,
          desc: formData.descripcion,
          claseRutina: selectedClase,
          grupoMuscularRutina: selectedGrupoMuscular,
          urlPlanificacion: urlPlanificacion.trim()
        };
      } else {
        payload = buildPayload();
      }

      if (isEditing) {
        await apiService.editRutina(rutinaId, payload);
        toast.success('Rutina actualizada correctamente');
      } else {
        if (tipoRutina === 'simple') {
          await apiService.createRutinaSimple(payload);
        } else {
          await apiService.createRutina(payload);
        }
        toast.success('Rutina creada correctamente');
      }

      if (fromAdmin) navigate('/admin/rutinas-asignadas');
      if (fromEntrenador) navigate('/entrenador/rutinas-asignadas');
      if (fromAlumno) navigate('/alumno/mi-rutina');
    } catch {
      toast.error(
        isEditing
          ? 'Error actualizando rutina'
          : 'Error creando rutina'
      );
    } finally {
      setLoading(false);
    }
  };

  // Responsive / panel info
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    try {
      mql.addEventListener('change', handler);
    } catch {
      mql.addListener(handler);
    }
    return () => {
      try {
        mql.removeEventListener('change', handler);
      } catch {
        mql.removeListener(handler);
      }
    };
  }, []);

  useEffect(() => {
    if (!(isMobile && infoOpen)) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setInfoOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, infoOpen]);

  useEffect(() => {
    if (isMobile && infoOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isMobile, infoOpen]);

  // Derivados UI
  const filteredExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    if (!term) return allExercises;
    return (allExercises || []).filter(e =>
      e?.nombre?.toLowerCase?.().includes(term)
    );
  }, [exerciseSearch, allExercises]);

  const selectedUser = useMemo(() => {
    if (!canAssign) return null;
    return assignedInfoUserOptions.find(option => Number(option.value) === Number(selectedUserId))?.usuario || null;
  }, [assignedInfoUserOptions, canAssign, selectedUserId]);

  /* ================= Render ================= */
  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu
        isAdmin={fromAdmin}
        isEntrenador={fromEntrenador}
      />

      <div className='content-layout mi-rutina-ctn layout-with-info crear-rutina-layout'>
        {/* FAB abrir info en mobile y desktop cuando cerrado */}
        {canAssign && step === 2 && !infoOpen && (
          <button
            className="fab-info"
            onClick={() => setInfoOpen(true)}
            aria-label="Abrir información"
            aria-controls="info-panel"
            aria-expanded={infoOpen}
            title="Ver información"
          >
            {isMobile ? 'Información útil' : '+'}
          </button>
        )}

        {/* Columna principal */}
        <div className="main-col crear-rutina-main">
          <div className="mi-rutina-title header-row crear-rutina-header">
            <h2>
              {isEditing ? 'Editar Rutina' : 'Crear Rutina'}
            </h2>

            {/* {step === 2 && canAssign && !infoOpen && !isMobile && (
              <SecondaryButton
                text="Ver información"
                onClick={() => setInfoOpen(true)}
                style={{ marginLeft: 'auto', marginRight: 8 }}
              />
            )} */}

            {step === 2 && (
              <PrimaryButton
                text={
                  isEditing
                    ? "Guardar cambios"
                    : "Crear rutina"
                }
                linkTo="#"
                onClick={handleSubmit}
              />
            )}
          </div>

          {/* STEP 1 */}
          {step === 1 && (
            <div className="crear-rutina-step1">
              <div className="crear-rutina-step-1-form">
                <h3 className="crear-rutina-section-title">Información de la rutina</h3>

                <CustomInput
                  placeholder="Nombre de la rutina"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      nombre: e.target.value
                    })
                  }
                />

                <CustomDropdown
                  id="claseRutina"
                  name="claseRutina"
                  placeholderOption="Seleccionar clase (opcional)"
                  options={clases.map(c => c.nombre)}
                  value={selectedClase}
                  onChange={e =>
                    setSelectedClase(e.target.value)
                  }
                />

                <CustomDropdown
                  id="grupoMuscular"
                  name="grupoMuscular"
                  placeholderOption="Seleccionar grupo muscular (opcional)"
                  options={gruposMusculares}
                  value={selectedGrupoMuscular}
                  onChange={e =>
                    setSelectedGrupoMuscular(
                      e.target.value
                    )
                  }
                />

                <CustomInput
                  placeholder="Descripción (opcional)"
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      descripcion: e.target.value
                    })
                  }
                />

                {/* Selector de Tipo de Rutina */}
                <h3 className="crear-rutina-section-title">Tipo de carga de entrenamiento</h3>

                <div className="tipo-rutina-selector-container">
                  {/* <label className="tipo-rutina-label">Tipo de entrenamiento</label> */}
                  <div className="tipo-rutina-selector">
                    <button
                      type="button"
                      className={`tipo-rutina-btn ${tipoRutina === 'clasica' ? 'active' : ''}`}
                      onClick={() => setTipoRutina('clasica')}
                    >
                      <Dumbbell className="icon" aria-hidden="true" />
                      <div className="text-wrapper">
                        <span className="title">Clásica</span>
                        <span className="subtitle">Bloques estructurados</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`tipo-rutina-btn ${tipoRutina === 'simple' ? 'active' : ''}`}
                      onClick={() => setTipoRutina('simple')}
                    >
                      <Table2 className="icon" aria-hidden="true" />
                      <div className="text-wrapper">
                        <span className="title">Planilla Digital</span>
                        <span className="subtitle">Google Sheets</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Campo URL Planificación si es simple */}
                {tipoRutina === 'simple' && (
                  <div className="url-planificacion-container premium-glow-border">
                    <CustomInput
                      placeholder="Pegá el enlace a la planilla de Google Sheets"
                      value={urlPlanificacion}
                      onChange={(e) => setUrlPlanificacion(e.target.value)}
                    />
                    <div className="url-planificacion-help">
                      <span className="help-icon">💡</span>
                      <p>Asegurate de que el enlace de Google Sheets tenga permisos de lectura para que el alumno pueda visualizarlo.</p>
                    </div>
                  </div>
                )}

                {canAssign && (
                  <>
                    <h3 className="crear-rutina-section-title">Asignación de usuario/s</h3>

                    <Select
                      options={mergedUserOptions}
                      value={selectedUserOptions}
                      onChange={options => setSelectedUserOptions(options || [])}
                      onInputChange={(value, meta) => {
                        if (meta.action === 'input-change') setUserSearch(value);
                      }}
                      placeholder="Usuarios asignados"
                      noOptionsMessage={() => userSearch.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'No se encontraron usuarios'}
                      loadingMessage={() => 'Buscando usuarios...'}
                      isMulti
                      isSearchable
                      isLoading={usersLoading}
                      filterOption={null}
                      styles={customStyles}
                    />

                    <Select
                      options={gruposUsuarios
                        .filter(g => g.estado !== false)
                        .map(g => ({
                          label: `${g.nombre} (${g.miembros?.length || 0} usuarios)`,
                          value: g.ID_GrupoUsuario
                        }))}
                      value={selectedGroupOptions}
                      onChange={options => setSelectedGroupOptions(options || [])}
                      placeholder="Grupos asignados"
                      isMulti
                      isSearchable
                      styles={customStyles}
                    />
                  </>
                )}

                <div className='crearRutina-s1-continuar-btn-ctn'>
                  {tipoRutina === 'simple' ? (
                    <PrimaryButton
                      text={isEditing ? "Guardar cambios" : "Crear rutina"}
                      linkTo="#"
                      onClick={handleSubmit}
                    />
                  ) : (
                    <PrimaryButton
                      text="Continuar"
                      linkTo="#"
                      onClick={handleContinue}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="crear-rutina-step2">
              <div className="crear-rutina-step-2-form">
                <SecondaryButton
                  text="← Volver"
                  linkTo="#"
                  onClick={() => setStep(1)}
                  style={{ marginBottom: '16px' }}
                />

                {/* CHECKBOX SEMANAS */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--text-color)' }}>
                    <input
                      type="checkbox"
                      checked={isWeekly}
                      onChange={toggleWeeklyMode}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    Organizar por semana
                  </label>
                </div>

                {/* TABS SEMANAS */}
                {isWeekly && (
                  <div
                    className="days-tabs weeks-tabs"
                    onDragOver={onWeekDragOverContainer}
                    onDrop={onWeekDrop}
                  >
                    {weeks.map((w, idx) => {
                      const isDragging = draggingWeekKey === w.key;
                      return (
                        <React.Fragment key={w.key}>
                          {draggingWeekKey && weekDropIndex === idx && (
                            <div className="day-drop-indicator week-drop" />
                          )}
                          <div
                            className={`day-tab week-tab ${idx === activeWeekIndex ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
                            onClick={() => selectWeek(idx)}
                            draggable
                            onDragStart={(e) => onWeekDragStart(e, w.key)}
                            onDragOver={(e) => onWeekDragOverTab(e, idx)}
                            onDrop={onWeekDrop}
                            onDragEnd={onWeekDragEnd}
                            style={{
                              backgroundColor: idx === activeWeekIndex ? 'var(--primary-color)' : 'var(--background-color-distinct)',
                              color: idx === activeWeekIndex ? '#fff' : 'var(--text-color)',
                            }}
                          >
                            <button
                              className="day-drag-handle"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                              type="button"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                              </svg>
                            </button>

                            <span className="day-tab-label">{w.nombre}</span>

                            <button
                              className="day-tab-action"
                              title="Duplicar semana"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                duplicateWeek(idx);
                              }}
                            >
                              <Copy width={13} height={13} />
                            </button>

                            <button
                              className="day-tab-close"
                              onClick={(e) => { e.stopPropagation(); removeWeek(idx); }}
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    {draggingWeekKey && weekDropIndex === weeks.length && (
                      <div className="day-drop-indicator week-drop" />
                    )}
                    <button className="day-tab add" onClick={addWeek} type="button">
                      + Sem
                    </button>
                  </div>
                )}

                {/* Week Name Input */}
                {/* {isWeekly && (
                  <div className="day-meta" style={{ marginBottom: 16 }}>
                    <CustomInput
                      placeholder="Nombre de la semana"
                      value={weeks[activeWeekIndex]?.nombre || ''}
                      onChange={(e) => handleWeekNameChange(activeWeekIndex, e.target.value)}
                    />
                  </div>
                )} */}

                {/* Tabs días (reordenables) */}
                <div
                  className="days-tabs"
                  onDragOver={onDayDragOverContainer}
                  onDrop={onDayDrop}
                >
                  {days.map((d, idx) => {
                    const isDragging = draggingDayKey === d.key;

                    return (
                      <React.Fragment key={d.key}>
                        {draggingDayKey && dayDropIndex === idx && (
                          <div className="day-drop-indicator" />
                        )}

                        <div
                          className={`day-tab ${idx === activeDayIndex ? 'active' : ''} ${isDragging ? 'day-tab--dragging' : ''}`}
                          onClick={() => setActiveDayIndex(idx)}
                          onDragOver={(e) => onDayDragOverTab(e, idx)}
                          onDrop={onDayDrop}
                          onDragEnd={onDayDragEnd}
                        >
                          <button
                            className="day-drag-handle"
                            draggable
                            onDragStart={(e) => onDayDragStart(e, d.key)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="Reordenar día"
                            title="Arrastrar para reordenar"
                            type="button"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                            </svg>
                          </button>

                          <span className="day-tab-label">{`Día ${idx + 1}`}</span>

                          <button
                            className="day-tab-action"
                            title="Duplicar día"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateDay(idx);
                            }}
                          >
                            <Copy width={13} height={13} />
                          </button>

                          <button
                            className="day-tab-close"
                            title="Eliminar día"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeDay(idx);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </React.Fragment>
                    );
                  })}

                  {draggingDayKey && dayDropIndex === days.length && (
                    <div className="day-drop-indicator" />
                  )}

                  <button className="day-tab add" onClick={addDay} type="button">
                    + Añadir día
                  </button>
                </div>

                {/* Meta día */}
                <div className="day-meta">
                  <CustomInput
                    placeholder="Nombre del día (ej. Fuerza - Día 1)"
                    value={activeDay?.nombre || ''}
                    onChange={(e) =>
                      handleSetDays(
                        days.map((d, i) =>
                          i === activeDayIndex
                            ? {
                              ...d,
                              nombre: e.target.value
                            }
                            : d
                        )
                      )
                    }
                  />
                  <CustomInput
                    placeholder="Descripción del día (opcional)"
                    value={activeDay?.descripcion || ''}
                    onChange={(e) =>
                      handleSetDays(
                        days.map((d, i) =>
                          i === activeDayIndex
                            ? {
                              ...d,
                              descripcion:
                                e.target.value
                            }
                            : d
                        )
                      )
                    }
                  />
                </div>

                {/* Agregar bloque */}
                <div className='agregar-bloque-ctn'>
                  <p>Agregar bloque:</p>
                  <CustomDropdown
                    placeholderOption="Tipo de serie"
                    options={DISPLAY_TYPES}
                    value=""
                    onChange={handleAddBlock}
                  />
                </div>

                {/* Bloques */}
                {(activeDay?.blocks || []).map(
                  (block, idxBlock) => {
                    const isDragging =
                      draggingBlockId === block.id;
                    const isOver =
                      dragOverBlockId === block.id;
                    const sugKeyPrefix = `${activeDay?.key || 'dia'
                      }-${block.id}-`;

                    return (
                      <div
                        key={block.id ?? idxBlock}
                        className={`block-container ${isDragging
                          ? 'block--dragging'
                          : ''
                          } ${isOver ? 'block--over' : ''
                          }`}
                        onDragOver={(e) =>
                          onDragOver(e, block.id)
                        }
                        onDrop={(e) =>
                          onDrop(e, block.id)
                        }
                        onDragEnd={onDragEnd}
                      >
                        <div className="block-actions">
                          <button
                            className="drag-handle"
                            draggable
                            onDragStart={(e) =>
                              onDragStart(e, block.id)
                            }
                            aria-label="Reordenar bloque"
                            title="Arrastrar para reordenar"
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                            </svg>
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteBlock(block.id)
                            }
                            className="delete-block-btn"
                            title="Eliminar bloque"
                          >
                            <X
                              width={24}
                              height={24}
                            />
                          </button>
                        </div>

                        <h4 className="block-title">
                          {block.type}
                        </h4>

                        {/* SERIES Y REPETICIONES */}
                        {block.type ===
                          "Series y repeticiones" && (
                            <div className="sets-reps-ctn">
                              {block.data.setsReps.map(
                                (setRep, idx) => (
                                  <div
                                    key={idx}
                                    className="sets-row"
                                  >
                                    <input
                                      type="text"
                                      className="series-input"
                                      placeholder="ej. 5x5"
                                      value={
                                        setRep.series
                                      }
                                      onChange={e =>
                                        handleSetRepChange(
                                          block.id,
                                          idx,
                                          'series',
                                          e.target.value
                                        )
                                      }
                                    />
                                    <div className="exercise-cell">
                                      <input
                                        type="text"
                                        className="exercise-input"
                                        placeholder={
                                          setRep.placeholderExercise
                                        }
                                        value={
                                          setRep.exercise
                                        }
                                        onChange={e =>
                                          handleExerciseInputChange(
                                            block.id,
                                            idx,
                                            e.target.value
                                          )
                                        }
                                      />
                                      {(suggestions[
                                        `${sugKeyPrefix}${idx}`
                                      ] || [])
                                        .length >
                                        0 && (
                                          <ul className="suggestions-list">
                                            {suggestions[
                                              `${sugKeyPrefix}${idx}`
                                            ].map(
                                              ex => (
                                                <li
                                                  key={
                                                    ex.ID_Ejercicio
                                                  }
                                                  onClick={() =>
                                                    handleSelectSuggestion(
                                                      block.id,
                                                      idx,
                                                      ex
                                                    )
                                                  }
                                                >
                                                  {
                                                    ex.nombre
                                                  }
                                                </li>
                                              )
                                            )}
                                          </ul>
                                        )}
                                    </div>
                                    <input
                                      type="text"
                                      className="weight-input"
                                      placeholder="ej. 30kg"
                                      value={
                                        setRep.weight
                                      }
                                      onChange={e =>
                                        handleSetRepChange(
                                          block.id,
                                          idx,
                                          'weight',
                                          e.target.value
                                        )
                                      }
                                      aria-label="Peso"
                                    />
                                    <button
                                      onClick={() =>
                                        handleDeleteSetRep(
                                          block.id,
                                          idx
                                        )
                                      }
                                      className="delete-set-btn"
                                      title="Eliminar este set"
                                    >
                                      –
                                    </button>
                                  </div>
                                )
                              )}
                              <PrimaryButton
                                text="+"
                                linkTo="#"
                                onClick={() =>
                                  handleAddSetRep(
                                    block.id
                                  )
                                }
                              />
                            </div>
                          )}

                        {/* RONDAS */}
                        {block.type ===
                          "Rondas" && (
                            <div className="rondas-ctn">
                              <div className="cantidad-rondas-descanso">
                                <div className='cant-rondas-subctn'>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="3"
                                    value={
                                      block.data
                                        .rounds
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'rounds',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span>
                                    {' '}
                                    rondas con{' '}
                                  </span>
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="90"
                                    value={
                                      block.data
                                        .descanso
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'descanso',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <span>
                                    {' '}
                                    segundos de
                                    descanso{' '}
                                  </span>
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 3x12"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* EMOM */}
                        {block.type ===
                          "EMOM" && (
                            <div className="emom-ctn">
                              <div className="cantidad-emom-ctn">
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    {' '}
                                    Cada{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="1"
                                    value={
                                      block.data
                                        .interval
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'interval',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder="minuto"
                                    disabled
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    {' '}
                                    por{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="20"
                                    value={
                                      block.data
                                        .totalMinutes
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'totalMinutes',
                                        e.target.value
                                      )
                                    }
                                  />
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder="minutos"
                                    disabled
                                  />
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 10"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* AMRAP */}
                        {block.type ===
                          "AMRAP" && (
                            <div className="amrap-ctn">
                              <div className="cantidad-amrap-ctn">
                                <span>
                                  {' '}
                                  AMRAP de{' '}
                                </span>
                                <input
                                  className='cant-rondas-subctn-input-chico'
                                  placeholder="20"
                                  value={
                                    block.data
                                      .duration
                                  }
                                  onChange={(e) =>
                                    handleBlockFieldChange(
                                      block.id,
                                      'duration',
                                      e.target.value
                                    )
                                  }
                                />
                                <input
                                  className='cant-rondas-subctn-input-grande'
                                  placeholder="minutos"
                                  disabled
                                />
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row"
                                    >
                                      <input
                                        type="text"
                                        className="series-input"
                                        placeholder="ej. 12"
                                        value={
                                          setRep.series
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'series',
                                            e.target.value
                                          )
                                        }
                                      />
                                      <div className="exercise-cell">
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="-"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* ESCALERA */}
                        {block.type ===
                          "Escalera" && (
                            <div className="escalera-ctn">
                              <div className="cantidad-escalera-ctn">
                                <input
                                  className='cant-rondas-subctn-input-grande'
                                  placeholder="Ej. 21-15-9"
                                  value={
                                    block.data
                                      .escaleraType
                                  }
                                  onChange={(e) =>
                                    handleBlockFieldChange(
                                      block.id,
                                      'escaleraType',
                                      e.target.value
                                    )
                                  }
                                />
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-ladder sets-row--no-series"
                                    >
                                      <div
                                        className="exercise-cell"
                                        style={{
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <input
                                          style={{
                                            width:
                                              '100%'
                                          }}
                                          type="text"
                                          className="exercise-input"
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="ej. 24kg"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este set"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* TABATA */}
                        {block.type ===
                          "TABATA" && (
                            <div className="tabata-ctn">
                              <div
                                className="cantidad-tabata-ctn"
                                style={{
                                  display: 'flex',
                                  gap: 12,
                                  flexWrap:
                                    'wrap',
                                  alignItems:
                                    'center'
                                }}
                              >
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Series:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-chico'
                                    placeholder="4"
                                    value={
                                      block.data
                                        .cantSeries
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'cantSeries',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Trabajo/descanso:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder='ej. 20s x 10s'
                                    value={
                                      block.data
                                        .tiempoTrabajoDescansoTabata
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'tiempoTrabajoDescansoTabata',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                                <div className='cant-rondas-subctn'>
                                  <span>
                                    Descanso entre
                                    series:{' '}
                                  </span>
                                  <input
                                    className='cant-rondas-subctn-input-grande'
                                    placeholder='ej. 1 minuto'
                                    value={
                                      block.data
                                        .descTabata
                                    }
                                    onChange={(e) =>
                                      handleBlockFieldChange(
                                        block.id,
                                        'descTabata',
                                        e.target.value
                                      )
                                    }
                                  />
                                </div>
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (setRep, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row sets-row--no-series"
                                    >
                                      <div
                                        className="exercise-cell"
                                        style={{
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <input
                                          type="text"
                                          className="exercise-input"
                                          style={{
                                            width:
                                              '100%'
                                          }}
                                          placeholder={
                                            setRep.placeholderExercise
                                          }
                                          value={
                                            setRep.exercise
                                          }
                                          onChange={e =>
                                            handleExerciseInputChange(
                                              block.id,
                                              idx,
                                              e.target.value
                                            )
                                          }
                                        />
                                        {(suggestions[
                                          `${sugKeyPrefix}${idx}`
                                        ] || [])
                                          .length >
                                          0 && (
                                            <ul className="suggestions-list">
                                              {suggestions[
                                                `${sugKeyPrefix}${idx}`
                                              ].map(
                                                ex => (
                                                  <li
                                                    key={
                                                      ex.ID_Ejercicio
                                                    }
                                                    onClick={() =>
                                                      handleSelectSuggestion(
                                                        block.id,
                                                        idx,
                                                        ex
                                                      )
                                                    }
                                                  >
                                                    {
                                                      ex.nombre
                                                    }
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          )}
                                      </div>
                                      <input
                                        type="text"
                                        className="weight-input"
                                        placeholder="ej. 16kg"
                                        value={
                                          setRep.weight
                                        }
                                        onChange={e =>
                                          handleSetRepChange(
                                            block.id,
                                            idx,
                                            'weight',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Peso"
                                      />
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar este ejercicio"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}

                        {/* DROPSET */}
                        {block.type ===
                          "DROPSET" && (
                            <div className="dropset-ctn">
                              <div
                                className="exercise-cell"
                                style={{
                                  width:
                                    '100%',
                                  marginBottom: 12
                                }}
                              >
                                <input
                                  type="text"
                                  className="exercise-input"
                                  style={{
                                    width:
                                      '100%'
                                  }}
                                  placeholder={
                                    block.data
                                      .exercisePlaceholder ||
                                    'Nombre ejercicio'
                                  }
                                  value={
                                    block.data
                                      .exerciseName ||
                                    ''
                                  }
                                  onChange={(e) =>
                                    handleDropsetNameChange(
                                      block.id,
                                      e.target.value
                                    )
                                  }
                                />
                                {(suggestions[
                                  `${activeDay?.key || 'dia'}-${block.id}-dropsetname`
                                ] || []).length >
                                  0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[
                                        `${activeDay?.key || 'dia'}-${block.id}-dropsetname`
                                      ].map(
                                        ex => (
                                          <li
                                            key={
                                              ex.ID_Ejercicio
                                            }
                                            onClick={() =>
                                              handleSelectDropsetName(
                                                block.id,
                                                ex
                                              )
                                            }
                                          >
                                            {
                                              ex.nombre
                                            }
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  )}
                              </div>

                              <div className="sets-reps-ctn">
                                {block.data.setsReps.map(
                                  (sr, idx) => (
                                    <div
                                      key={idx}
                                      className="sets-row sets-row--dropset"
                                    >
                                      <div
                                        className="series-group"
                                        style={{
                                          display:
                                            'flex',
                                          gap: 8,
                                          width:
                                            '100%'
                                        }}
                                      >
                                        <div
                                          style={{
                                            flex: 1
                                          }}
                                        >
                                          <label className="mini-label">
                                            Serie y
                                            reps
                                          </label>
                                          <input
                                            type="text"
                                            className="series-input"
                                            placeholder="Ej. 2×20"
                                            value={
                                              sr.series
                                            }
                                            onChange={e =>
                                              handleSetRepChange(
                                                block.id,
                                                idx,
                                                'series',
                                                e.target.value
                                              )
                                            }
                                          />
                                        </div>
                                        <div
                                          style={{
                                            flex: 1
                                          }}
                                        >
                                          <label className="mini-label">
                                            Kilos
                                          </label>
                                          <input
                                            type="text"
                                            className="weight-input"
                                            placeholder="Ej. 50kg"
                                            value={
                                              sr.weight
                                            }
                                            onChange={e =>
                                              handleSetRepChange(
                                                block.id,
                                                idx,
                                                'weight',
                                                e.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() =>
                                          handleDeleteSetRep(
                                            block.id,
                                            idx
                                          )
                                        }
                                        className="delete-set-btn"
                                        title="Eliminar fila"
                                      >
                                        –
                                      </button>
                                    </div>
                                  )
                                )}
                                <PrimaryButton
                                  text="+"
                                  linkTo="#"
                                  onClick={() =>
                                    handleAddSetRep(
                                      block.id
                                    )
                                  }
                                />
                              </div>
                            </div>
                          )}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral info */}
        {canAssign && step === 2 && (
          <>
            <div
              className={`info-backdrop ${isMobile && infoOpen
                ? 'show'
                : ''
                }`}
              onClick={() =>
                setInfoOpen(false)
              }
              aria-hidden={!isMobile || !infoOpen}
            />
            <aside
              id="info-panel"
              className={`info-panel ${isMobile ? 'drawer' : ''
                } ${infoOpen ? 'open' : ''}`}
              role={isMobile ? 'dialog' : undefined}
              aria-modal={isMobile ? 'true' : undefined}
              aria-label="Información contextual"
            >
              <div className="info-panel__header">
                <h3>Información</h3>
                <button
                  type="button"
                  onClick={() =>
                    setInfoOpen(false)
                  }
                  className="info-panel__close"
                  title="Cerrar panel"
                  aria-label="Cerrar panel"
                >
                  ×
                </button>
              </div>

              <div className="info-panel__content">
                <div className="info-tabs">
                  <button
                    className={`info-tab ${infoTab ===
                      'ejercicios'
                      ? 'active'
                      : ''
                      }`}
                    onClick={() =>
                      setInfoTab('ejercicios')
                    }
                  >
                    Ejercicios
                  </button>
                  <button
                    className={`info-tab ${infoTab ===
                      'usuario'
                      ? 'active'
                      : ''
                      }`}
                    onClick={() =>
                      setInfoTab('usuario')
                    }
                  >
                    Información del
                    usuario
                  </button>
                </div>

                {infoTab ===
                  'ejercicios' && (
                    <div>
                      <input
                        type="text"
                        className="info-search"
                        placeholder="Buscar ejercicio..."
                        value={
                          exerciseSearch
                        }
                        onChange={(e) =>
                          setExerciseSearch(
                            e.target.value
                          )
                        }
                      />
                      <div className="info-list">
                        {(filteredExercises ||
                          []).map(
                            (ej) => (
                              <div
                                key={
                                  ej.ID_Ejercicio
                                }
                                className="info-card"
                              >
                                <div className="info-card__row">
                                  <strong className="info-card__title">
                                    {
                                      ej.nombre
                                    }
                                  </strong>
                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      gap: 8,
                                      alignItems:
                                        'center'
                                    }}
                                  >
                                    <PrimaryButton
                                      className="info-card__add"
                                      onClick={() =>
                                        addExerciseIntoBuildingBlock(
                                          ej
                                        )
                                      }
                                      text="Agregar"
                                    />
                                  </div>
                                </div>
                                {ej.descripcion && (
                                  <p className="info-card__desc">
                                    {
                                      ej.descripcion
                                    }
                                  </p>
                                )}
                                <div className="info-card__meta">
                                  {ej.musculos && (
                                    <small>
                                      <b>
                                        Músculos:
                                      </b>{' '}
                                      {
                                        ej.musculos
                                      }
                                    </small>
                                  )}
                                  {ej.equipamiento && (
                                    <small>
                                      <b>
                                        Equipo:
                                      </b>{' '}
                                      {
                                        ej.equipamiento
                                      }
                                    </small>
                                  )}
                                  {ej.youtubeUrl && (
                                    <a
                                      href={
                                        ej.youtubeUrl
                                      }
                                      target="_blank"
                                      rel="noreferrer"
                                      className="info-card__link"
                                    >
                                      YouTube
                                    </a>
                                  )}
                                </div>
                              </div>
                            )
                          )}
                        {(!filteredExercises ||
                          filteredExercises.length ===
                          0) && (
                            <p className="info-empty">
                              No se
                              encontraron
                              ejercicios.
                            </p>
                          )}
                      </div>
                    </div>
                  )}

                {infoTab ===
                  'usuario' && (
                    <div>
                      <div className="info-user-select">
                        <label className="info-user-select__label">
                          Usuario para consultar
                        </label>
                        <Select
                          options={assignedInfoUserOptions}
                          value={assignedInfoUserOptions.find(option => Number(option.value) === Number(selectedUserId)) || null}
                          onChange={option => setSelectedInfoUserId(option?.value ?? null)}
                          placeholder="Seleccionar usuario"
                          noOptionsMessage={() => 'No hay usuarios asignados'}
                          isSearchable
                          styles={customStyles}
                        />
                      </div>

                      <div className="user-meta">
                        <div className="user-meta__line">
                          <b>
                            Usuario
                            asignado:
                          </b>{' '}
                          {selectedUserId
                            ? `${selectedUser?.nombre || ''} ${selectedUser?.apellido || ''}`
                            : '— seleccioná un usuario'}
                        </div>
                      </div>

                      {!selectedUserId && (
                        <p className="info-empty">
                          Para ver
                          mediciones, primero
                          seleccioná un
                          usuario asignado.
                        </p>
                      )}

                      {selectedUserId && (
                        <>
                          <div className="user-health">
                            <div className="user-health__section">
                              <strong>Observaciones de Salud</strong>
                              <p className="user-health__text">
                                {selectedUser?.observacionesSalud || 'Sin observaciones cargadas.'}
                              </p>
                            </div>
                            <div className="user-health__section">
                              <strong>Ficha médica</strong>
                              {selectedUser?.fichaMedicaUrl ? (
                                <a
                                  className="user-health__link"
                                  href={selectedUser.fichaMedicaUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Ver ficha médica
                                </a>
                              ) : (
                                <p className="user-health__text">Sin ficha médica cargada.</p>
                              )}
                            </div>
                          </div>

                          {loadingMetrics && (
                            <p className="info-loading">
                              Cargando
                              mediciones...
                            </p>
                          )}

                          {!loadingMetrics &&
                            (!userMetrics ||
                              !Array.isArray(
                                userMetrics.ejercicios
                              ) ||
                              userMetrics
                                .ejercicios
                                .length ===
                              0) && (
                              <p className="info-empty">
                                Sin datos de
                                mediciones.
                              </p>
                            )}

                          {!loadingMetrics &&
                            Array.isArray(
                              userMetrics?.ejercicios
                            ) &&
                            userMetrics
                              .ejercicios
                              .length >
                            0 && (
                              <div className="metrics-list">
                                {userMetrics.ejercicios.map(
                                  (e) => {
                                    const historico =
                                      Array.isArray(
                                        e.HistoricoEjercicios
                                      )
                                        ? [
                                          ...e.HistoricoEjercicios
                                        ]
                                        : [];
                                    historico.sort(
                                      (a, b) =>
                                        new Date(
                                          b.Fecha
                                        ) -
                                        new Date(
                                          a.Fecha
                                        )
                                    );
                                    const last3 =
                                      historico.slice(
                                        0,
                                        3
                                      );

                                    let pr =
                                      null;
                                    for (const h of historico) {
                                      if (
                                        !pr ||
                                        h.Cantidad >
                                        pr.Cantidad
                                      ) {
                                        pr =
                                          h;
                                      }
                                    }

                                    return (
                                      <div
                                        key={
                                          e.ID_EjercicioMedicion
                                        }
                                        className="info-card"
                                      >
                                        <div className="info-card__row">
                                          <strong className="info-card__title">
                                            {
                                              e.nombre
                                            }
                                          </strong>
                                          <small className="info-card__badge">
                                            {
                                              e.tipoMedicion
                                            }
                                          </small>
                                        </div>

                                        {last3.length >
                                          0 ? (
                                          <div className="metric-block">
                                            <div className="metric-block__title">
                                              Últimos 3
                                              registros
                                            </div>
                                            <ul className="metric-history">
                                              {last3.map(
                                                h => (
                                                  <li
                                                    key={
                                                      h.ID_HistoricoEjercicio
                                                    }
                                                  >
                                                    <span className="metric-date">
                                                      {new Date(
                                                        h.Fecha
                                                      ).toLocaleDateString()}
                                                    </span>
                                                    <span className="metric-sep">
                                                      —
                                                    </span>
                                                    <span className="metric-value">
                                                      {
                                                        h.Cantidad
                                                      }
                                                    </span>
                                                  </li>
                                                )
                                              )}
                                            </ul>
                                          </div>
                                        ) : (
                                          <div className="metric-block metric-block--empty">
                                            Sin
                                            registros
                                          </div>
                                        )}

                                        <div className="metric-block metric-block--pr">
                                          <span className="metric-pr-label">
                                            PR
                                            histórico:
                                          </span>
                                          {pr ? (
                                            <span className="metric-pr-value">
                                              {
                                                pr.Cantidad
                                              }{' '}
                                              <span className="metric-pr-date">
                                                (
                                                {new Date(
                                                  pr.Fecha
                                                ).toLocaleDateString()}
                                                )
                                              </span>
                                            </span>
                                          ) : (
                                            <span className="metric-pr-value">
                                              —
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                )}
                              </div>
                            )}
                        </>
                      )}
                    </div>
                  )}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
};

export default CrearRutina;
