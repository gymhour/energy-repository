import React, { useState, useEffect, useMemo } from 'react';
import '../../../App.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu.jsx';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown.jsx';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput.jsx';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton.jsx';
import apiService, { fetchAllClientsActive } from '../../../services/apiService.js';
import { toast } from "react-toastify";
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen.jsx';
import { useParams, useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { X } from 'lucide-react';
import SecondaryButton from "../../../Components/utils/SecondaryButton/SecondaryButton.jsx";

/* ================= Helpers ================= */
// Agregamos DROPSET
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
  ["Pecho plano 60kg", "Flexiones de brazo", "Press de hombro 60kg", "Sentadillas con barra 80kg", "Remo con mancuerna 40kg", "Dominadas", "Elevaciones laterales 8kg"][Math.floor(Math.random() * 7)];

const makeEmptyBlock = (selectedType) => {
  const baseSet = { series: '', exercise: '', weight: '', placeholderExercise: getRandomExercise(), exerciseId: null };

  switch (selectedType) {
    case 'Series y repeticiones':
      return { id: Date.now(), type: selectedType, data: { setsReps: [{ ...baseSet }] } };
    case 'Rondas':
      return { id: Date.now(), type: selectedType, data: { rounds: '', descanso: '', setsReps: [{ ...baseSet }] } };
    case 'EMOM':
      return { id: Date.now(), type: selectedType, data: { interval: '1', totalMinutes: '', setsReps: [{ ...baseSet }] } };
    case 'AMRAP':
      return { id: Date.now(), type: selectedType, data: { duration: '', setsReps: [{ ...baseSet }] } };
    case 'Escalera':
      return { id: Date.now(), type: selectedType, data: { escaleraType: '', setsReps: [{ ...baseSet }] } };
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
      return { id: Date.now(), type: 'Series y repeticiones', data: { setsReps: [{ ...baseSet }] } };
  }
};

const convertApiBlockData = (b) => {
  const items = Array.isArray(b.bloqueEjercicios)
    ? b.bloqueEjercicios
    : Array.isArray(b.ejercicios)
      ? b.ejercicios
      : [];

  const mappedSets = items.map((e) => {
    const nombreEj = e?.ejercicio?.nombre ?? e?.nombre ?? '';
    const idEj = e.ID_Ejercicio ?? e?.ejercicio?.ID_Ejercicio ?? e?.ejercicioId ?? null;
    const reps = e.reps ?? e.setsReps ?? '';
    const weight = e.setRepWeight ?? '';
    return {
      series: reps,
      exercise: nombreEj,
      weight,
      placeholderExercise: '',
      exerciseId: idEj || null
    };
  });

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
      return { rounds: b.cantRondas ?? '', descanso: b.descansoRonda ?? '', setsReps: mappedSets };
    case 'EMOM':
      return { interval: '1', totalMinutes: b.durationMin ?? '', setsReps: mappedSets };
    case 'AMRAP':
      return { duration: b.durationMin ?? '', setsReps: mappedSets };
    case 'LADDER':
      return { escaleraType: b.tipoEscalera ?? '', setsReps: mappedSets };
    case 'TABATA':
      return {
        cantSeries: b.cantSeries ?? '',
        descTabata: b.descTabata ?? '',
        tiempoTrabajoDescansoTabata: b.tiempoTrabajoDescansoTabata ?? (b.durationMin ? `${b.durationMin}m` : ''),
        setsReps: mappedSets
      };
    case 'DROPSET':
      // Si alguna vez viene como DROPSET desde la API
      return {
        exerciseName: b.nombreEj ?? b?.ejercicio?.nombre ?? '',
        exerciseId: b?.ejercicioId ?? b?.ejercicio?.ID_Ejercicio ?? null,
        exercisePlaceholder: '',
        setsReps: items.map((e) => ({
          series: e.reps ?? '',
          weight: e.setRepWeight ?? ''
        }))
      };
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

/* ================= Component ================= */
const CrearRutinaRecomendada = ({ fromAdmin, fromEntrenador }) => {
  const { rutinaId } = useParams();
  const isEditing = Boolean(rutinaId);
  const navigate = useNavigate();

  const canAssign = !!fromEntrenador;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
  const [clases, setClases] = useState([]);
  const [selectedClase, setSelectedClase] = useState("");
  const [selectedGrupoMuscular, setSelectedGrupoMuscular] = useState("");
  const gruposMusculares = ["Pecho", "Espalda", "Piernas", "Brazos", "Hombros", "Abdominales", "Glúteos", "Tren Superior", "Tren Inferior", "Full Body", "Mixto"];

  const [users, setUsers] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const [allExercises, setAllExercises] = useState([]);
  const [suggestions, setSuggestions] = useState({});

  const [infoOpen, setInfoOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !window.matchMedia('(max-width: 720px)').matches;
  });
  const [infoTab, setInfoTab] = useState('ejercicios');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [userMetrics, setUserMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const [days, setDays] = useState([{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

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
          const clientes = await fetchAllClientsActive(apiService, { take: 100 });
          setUsers(clientes);
        } catch {
          toast.error('No se pudieron cargar todos los usuarios');
        }
      })();
    }
  }, [canAssign]);

  useEffect(() => {
    if (isEditing && (!canAssign || users.length > 0)) {
      fetchRoutine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, canAssign, users]);

  const selectedUserId = useMemo(() => {
    if (!canAssign) return Number(localStorage.getItem("usuarioId"));
    const u = users.find(u => u.email === selectedEmail);
    return u?.ID_Usuario ?? null;
  }, [canAssign, users, selectedEmail]);

  useEffect(() => {
    if (!canAssign) return;
    if (!selectedUserId) { setUserMetrics(null); return; }
    if (!(step === 2 && infoTab === 'usuario')) return;

    (async () => {
      try {
        setLoadingMetrics(true);
        const resp = await apiService.getEjerciciosResultadosUsuario(selectedUserId);
        const normalized = normalizeUserMetrics(resp);
        setUserMetrics(normalized);
      } catch {
        setUserMetrics({ ejercicios: [] });
        toast.error('No se pudieron cargar las mediciones del usuario');
      } finally {
        setLoadingMetrics(false);
      }
    })();
  }, [canAssign, selectedUserId, step, infoTab]);

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

      setFormData({ nombre: r.nombre || '', descripcion: r.desc || '' });
      setSelectedClase(r.claseRutina || "");
      setSelectedGrupoMuscular(r.grupoMuscularRutina || "");

      if (canAssign) {
        const alumnoEmail = r?.alumno?.email ?? r?.alumnoEmail ?? null;
        const alumnoId = r?.ID_Usuario ?? r?.alumno?.ID_Usuario ?? null;
        let selected = null;
        if (alumnoEmail) selected = alumnoEmail;
        else if (alumnoId) {
          const u = users.find(u => u.ID_Usuario === alumnoId);
          selected = u?.email ?? null;
        }
        setSelectedEmail(selected);
      }

      if (r?.dias && typeof r.dias === 'object') {
        const keys = Object.keys(r.dias).sort();
        const loaded = keys.map((k) => {
          const d = r.dias[k] || {};
          const blocks = Array.isArray(d.bloques)
            ? d.bloques.map(b => ({
              id: cryptoRandomId(),
              type: apiToDisplayType[b.type] || b.type,
              data: convertApiBlockData(b)
            }))
            : [];
          return { key: k, nombre: d.nombre || '', descripcion: d.descripcion || '', blocks };
        });
        setDays(loaded.length ? loaded : [{ key: 'dia1', nombre: '', descripcion: '', blocks: [] }]);
        setActiveDayIndex(0);
      } else {
        const blocks = Array.isArray(r.Bloques)
          ? r.Bloques.map(b => ({
            id: cryptoRandomId(),
            type: apiToDisplayType[b.type] || b.type,
            data: convertApiBlockData(b)
          }))
          : [];
        setDays([{ key: 'dia1', nombre: '', descripcion: '', blocks }]);
        setActiveDayIndex(0);
      }
    } catch {
      toast.error('No se pudo cargar la rutina para editar');
    } finally { setLoading(false); }
  };

  const handleContinue = (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast.error("Ingresá un nombre para la rutina");
    if (!days.length) return toast.error("Agregá al menos un día");

    if (fromEntrenador && !selectedEmail) {
      return toast.error("Seleccioná un usuario para asignar la rutina");
    }

    setStep(2);
  };

  // Tabs días
  const addDay = () => {
    const nextIndex = days.length + 1;
    const newKey = `dia${nextIndex}`;
    setDays([...days, { key: newKey, nombre: '', descripcion: '', blocks: [] }]);
    setActiveDayIndex(days.length);
  };
  const removeDay = (idx) => {
    if (days.length === 1) return toast.info("Debe existir al menos un día");
    const newDays = days
      .filter((_, i) => i !== idx)
      .map((d, i) => ({ ...d, key: `dia${i + 1}` }));
    setDays(newDays);
    setActiveDayIndex(Math.max(0, idx - 1));
  };

  const activeDay = days[activeDayIndex];
  const setActiveDayBlocks = (newBlocks) => {
    setDays(days.map((d, i) => (i === activeDayIndex ? { ...d, blocks: newBlocks } : d)));
  };

  // Blocks CRUD
  const handleAddBlock = (e) => {
    const selectedType = e.target.value;
    if (!selectedType) return;
    setActiveDayBlocks([...(activeDay?.blocks || []), makeEmptyBlock(selectedType)]);
  };
  const handleDeleteBlock = (blockId) => {
    setActiveDayBlocks((activeDay?.blocks || []).filter(b => b.id !== blockId));
  };
  const handleBlockFieldChange = (blockId, field, value) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block =>
      block.id === blockId
        ? { ...block, data: { ...block.data, [field]: value } }
        : block
    ));
  };
  const handleSetRepChange = (blockId, index, field, value) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block => {
      if (block.id === blockId) {
        const newSetsReps = block.data.setsReps.map((sr, i) =>
          i === index ? { ...sr, [field]: value } : sr
        );
        return { ...block, data: { ...block.data, setsReps: newSetsReps } };
      }
      return block;
    }));
  };
  const handleAddSetRep = (blockId) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block =>
      block.id === blockId
        ? {
          ...block,
          data: {
            ...block.data,
            setsReps: [
              ...block.data.setsReps,
              block.type === "DROPSET"
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
    ));
  };
  const handleDeleteSetRep = (blockId, index) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block =>
      block.id === blockId
        ? {
          ...block,
          data: {
            ...block.data,
            setsReps: block.data.setsReps.filter((_, i) => i !== index)
          }
        }
        : block
    ));
  };

  // Autocomplete ejercicios por fila
  const handleExerciseInputChange = (blockId, idx, value) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block => {
      if (block.id === blockId) {
        const newSets = block.data.setsReps.map((sr, i) =>
          i === idx ? { ...sr, exercise: value, exerciseId: null } : sr
        );
        return { ...block, data: { ...block.data, setsReps: newSets } };
      }
      return block;
    }));

    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e => e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase()))
      .slice(0, 5);

    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectSuggestion = (blockId, idx, exerciseObj) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block => {
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
        return { ...block, data: { ...block.data, setsReps: newSets } };
      }
      return block;
    }));

    const key = `${activeDay?.key || 'dia'}-${blockId}-${idx}`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Autocomplete para nombre del ejercicio del DROPSET
  const handleDropsetNameChange = (blockId, value) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block =>
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
    ));

    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    if (value.trim() === '') {
      setSuggestions(prev => ({ ...prev, [key]: [] }));
      return;
    }

    const lista = Array.isArray(allExercises) ? allExercises : [];
    const filtered = lista
      .filter(e => e.nombre?.toLowerCase?.().includes(value.trim().toLowerCase()))
      .slice(0, 5);

    setSuggestions(prev => ({ ...prev, [key]: filtered }));
  };

  const handleSelectDropsetName = (blockId, exerciseObj) => {
    setActiveDayBlocks((activeDay?.blocks || []).map(block =>
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
    ));

    const key = `${activeDay?.key || 'dia'}-${blockId}-dropsetname`;
    setSuggestions(prev => ({ ...prev, [key]: [] }));
  };

  // Drag & drop por bloque
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

  // Payload (incluye transformación DROPSET -> SETS_REPS)
  const buildPayload = () => {
    const userId = canAssign
      ? (users.find(u => u.email === selectedEmail)?.ID_Usuario ?? null)
      : Number(localStorage.getItem("usuarioId"));

    const entrenadorId = fromEntrenador ? Number(localStorage.getItem("usuarioId")) : null;

    const diasObj = {};

    days.forEach((d, i) => {
      const key = `dia${i + 1}`;
      const bloques = [];

      (d.blocks || []).forEach(block => {
        const type = displayToApiType(block.type);

        // DROPSET -> un solo bloque SETS_REPS con múltiples bloqueEjercicios
        if (type === 'DROPSET') {
          const name = (block?.data?.exerciseName || '').trim();
          const ejId = block?.data?.exerciseId ?? null;
          const rows = Array.isArray(block?.data?.setsReps) ? block.data.setsReps : [];

          const bloqueEjercicios = rows.map(sr => {
            const reps = sr?.series || '';
            const weightNorm = (sr?.weight || '').trim();
            return ejId
              ? {
                ejercicioId: ejId,
                reps,
                setRepWeight: weightNorm || undefined
              }
              : {
                nuevoEjercicio: { nombre: name },
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

          return; // siguiente bloque
        }

        const sets = Array.isArray(block?.data?.setsReps)
          ? block.data.setsReps
          : [];

        const bloqueEjercicios = sets.map(setRep => {
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
              weight: (block.data.setsReps[0]?.weight || '').trim() || null,
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

      diasObj[key] = {
        nombre: d.nombre || `Día ${i + 1}`,
        descripcion: d.descripcion || '',
        bloques
      };
    });

    return {
      ID_Usuario: userId,
      ID_Entrenador: entrenadorId,
      nombre: formData.nombre,
      desc: formData.descripcion,
      claseRutina: selectedClase || "Combinada",
      grupoMuscularRutina: selectedGrupoMuscular || "Mixto",
      dias: diasObj
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = buildPayload();

      if (isEditing) {
        await apiService.editRutina(rutinaId, payload);
        toast.success('Rutina actualizada correctamente');
        if (fromEntrenador) navigate('/entrenador/rutinas-asignadas');
      } else {
        await apiService.createRutina(payload);
        toast.success('Rutina creada correctamente');
      }

      navigate('/admin/rutinas');
    } catch {
      toast.error(isEditing ? 'Error actualizando rutina' : 'Error creando rutina');
    } finally {
      setLoading(false);
    }
  };

  // Responsive listeners
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 720px)');
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    try { mql.addEventListener('change', handler); } catch { mql.addListener(handler); }
    return () => {
      try { mql.removeEventListener('change', handler); } catch { mql.removeListener(handler); }
    };
  }, []);

  useEffect(() => {
    if (!(isMobile && infoOpen)) return;
    const onKey = (e) => { if (e.key === 'Escape') setInfoOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, infoOpen]);

  useEffect(() => {
    if (isMobile && infoOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isMobile, infoOpen]);

  /* ================ Derivados UI ================ */
  const filteredExercises = useMemo(() => {
    const term = exerciseSearch.trim().toLowerCase();
    if (!term) return allExercises;
    return (allExercises || []).filter(e => e?.nombre?.toLowerCase?.().includes(term));
  }, [exerciseSearch, allExercises]);

  const selectedUser = useMemo(() => {
    if (!canAssign) return null;
    return users.find(u => u.ID_Usuario === selectedUserId) || null;
  }, [canAssign, users, selectedUserId]);

  /* ================ UI ================ */
  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />

      <div className='content-layout mi-rutina-ctn layout-with-info' style={{ display: 'flex', gap: 16 }}>
        {canAssign && step === 2 && isMobile && !infoOpen && (
          <button
            className="fab-info"
            onClick={() => setInfoOpen(true)}
            aria-label="Abrir información"
            aria-controls="info-panel"
            aria-expanded={infoOpen}
          >
            Información útil
          </button>
        )}

        {/* Contenido principal */}
        <div className="main-col" style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div className="mi-rutina-title header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h2>{isEditing ? 'Editar Rutina' : 'Crear Rutina'}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 'auto' }}>
              {step === 2 && (
                <PrimaryButton
                  text={isEditing ? "Guardar cambios" : "Crear rutina"}
                  linkTo="#"
                  onClick={handleSubmit}
                />
              )}
            </div>
          </div>

          {/* ===== Step 1 ===== */}
          {step === 1 && (
            <div className="crear-rutina-step1">
              <div className="crear-rutina-step-1-form">
                <CustomInput
                  placeholder="Nombre de la rutina"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                />

                <CustomDropdown
                  id="claseRutina"
                  name="claseRutina"
                  placeholderOption="Seleccionar clase (opcional)"
                  options={clases.map(c => c.nombre)}
                  value={selectedClase}
                  onChange={e => setSelectedClase(e.target.value)}
                />

                <CustomDropdown
                  id="grupoMuscular"
                  name="grupoMuscular"
                  placeholderOption="Seleccionar grupo muscular (opcional)"
                  options={gruposMusculares}
                  value={selectedGrupoMuscular}
                  onChange={e => setSelectedGrupoMuscular(e.target.value)}
                />

                <CustomInput
                  placeholder="Descripción (opcional)"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                />

                {canAssign && (
                  <Select
                    options={users.map(u => ({
                      label: `${u.nombre} ${u.apellido} (${u.email})`,
                      value: u.email
                    }))}
                    value={
                      selectedEmail
                        ? {
                          label: `${users.find(u => u.email === selectedEmail)?.nombre || ''} ${users.find(u => u.email === selectedEmail)?.apellido || ''} (${selectedEmail})`,
                          value: selectedEmail
                        }
                        : null
                    }
                    onChange={option => setSelectedEmail(option.value)}
                    placeholder="Seleccioná un usuario"
                    isSearchable
                    required={!!fromEntrenador}
                  />
                )}

                <div className='crearRutina-s1-continuar-btn-ctn'>
                  <PrimaryButton text="Continuar" linkTo="#" onClick={handleContinue} />
                </div>
              </div>
            </div>
          )}

          {/* ===== Step 2 ===== */}
          {step === 2 && (
            <div className="crear-rutina-step2">
              <div className="crear-rutina-step-2-form">

                <SecondaryButton
                  text="← Volver"
                  linkTo="#"
                  onClick={() => setStep(1)}
                  style={{ marginBottom: '16px' }}
                />

                {/* Tabs de días */}
                <div className="days-tabs">
                  {days.map((d, idx) => (
                    <div
                      key={d.key}
                      className={`day-tab ${idx === activeDayIndex ? 'active' : ''}`}
                      onClick={() => setActiveDayIndex(idx)}
                    >
                      {`Día ${idx + 1}`}
                      <button
                        className="day-tab-close"
                        title="Eliminar día"
                        onClick={(e) => { e.stopPropagation(); removeDay(idx); }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button className="day-tab add" onClick={addDay}>+ Añadir día</button>
                </div>

                {/* Meta del día */}
                <div className="day-meta">
                  <CustomInput
                    placeholder="Nombre del día (ej. Fuerza - Día 1)"
                    value={activeDay?.nombre || ''}
                    onChange={(e) =>
                      setDays(days.map((d, i) =>
                        i === activeDayIndex ? { ...d, nombre: e.target.value } : d
                      ))
                    }
                  />
                  <CustomInput
                    placeholder="Descripción del día (opcional)"
                    value={activeDay?.descripcion || ''}
                    onChange={(e) =>
                      setDays(days.map((d, i) =>
                        i === activeDayIndex ? { ...d, descripcion: e.target.value } : d
                      ))
                    }
                  />
                </div>

                {/* Agregar bloque */}
                <div className='agregar-bloque-ctn'>
                  <p> Agregar bloque: </p>
                  <CustomDropdown
                    placeholderOption="Tipo de serie"
                    options={DISPLAY_TYPES}
                    value=""
                    onChange={handleAddBlock}
                  />
                </div>

                {/* Bloques */}
                {(activeDay?.blocks || []).map((block, idxBlock) => {
                  const isDragging = draggingBlockId === block.id;
                  const isOver = dragOverBlockId === block.id;
                  const sugKeyPrefix = `${activeDay?.key || 'dia'}-${block.id}-`;

                  return (
                    <div
                      key={block.id ?? idxBlock}
                      className={`block-container ${isDragging ? 'block--dragging' : ''} ${isOver ? 'block--over' : ''}`}
                      onDragOver={(e) => onDragOver(e, block.id)}
                      onDrop={(e) => onDrop(e, block.id)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="block-actions">
                        <button
                          className="drag-handle"
                          draggable
                          onDragStart={(e) => onDragStart(e, block.id)}
                          aria-label="Reordenar bloque"
                          title="Arrastrar para reordenar"
                        >
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M4 7h16v2H4zM4 11h16v2H4zM4 15h16v2H4z"></path>
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteBlock(block.id)}
                          className="delete-block-btn"
                          title="Eliminar bloque"
                        >
                          <X width={24} height={24} />
                        </button>
                      </div>

                      <h4 className="block-title">{block.type}</h4>

                      {/* SERIES Y REPETICIONES */}
                      {block.type === "Series y repeticiones" && (
                        <div className="sets-reps-ctn">
                          {block.data.setsReps.map((setRep, idx) => (
                            <div key={idx} className="sets-row">
                              <input
                                type="text"
                                className="series-input"
                                placeholder="ej. 5x5"
                                value={setRep.series}
                                onChange={e => handleSetRepChange(block.id, idx, 'series', e.target.value)}
                              />
                              <div className="exercise-cell">
                                <input
                                  type="text"
                                  className="exercise-input"
                                  placeholder={setRep.placeholderExercise}
                                  value={setRep.exercise}
                                  onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                />
                                {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                  <ul className="suggestions-list">
                                    {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                      <li
                                        key={ex.ID_Ejercicio}
                                        onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                      >
                                        {ex.nombre}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              <input
                                type="text"
                                className="weight-input"
                                placeholder="ej. 30kg"
                                value={setRep.weight}
                                onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                aria-label="Peso"
                              />
                              <button
                                onClick={() => handleDeleteSetRep(block.id, idx)}
                                className="delete-set-btn"
                                title="Eliminar este set"
                              >
                                –
                              </button>
                            </div>
                          ))}
                          <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                        </div>
                      )}

                      {/* RONDAS */}
                      {block.type === "Rondas" && (
                        <div className="rondas-ctn">
                          <div className="cantidad-rondas-descanso">
                            <div className='cant-rondas-subctn'>
                              <input
                                className='cant-rondas-subctn-input-chico'
                                placeholder="3"
                                value={block.data.rounds}
                                onChange={(e) => handleBlockFieldChange(block.id, 'rounds', e.target.value)}
                              />
                              <span> rondas con </span>
                            </div>
                            <div className='cant-rondas-subctn'>
                              <input
                                className='cant-rondas-subctn-input-chico'
                                placeholder="90"
                                value={block.data.descanso}
                                onChange={(e) => handleBlockFieldChange(block.id, 'descanso', e.target.value)}
                              />
                              <span> segundos de descanso </span>
                            </div>
                          </div>

                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((setRep, idx) => (
                              <div key={idx} className="sets-row">
                                <input
                                  type="text"
                                  className="series-input"
                                  placeholder="ej. 3x12"
                                  value={setRep.series}
                                  onChange={e => handleSetRepChange(block.id, idx, 'series', e.target.value)}
                                />
                                <div className="exercise-cell">
                                  <input
                                    type="text"
                                    className="exercise-input"
                                    placeholder={setRep.placeholderExercise}
                                    value={setRep.exercise}
                                    onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                  />
                                  {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                        <li
                                          key={ex.ID_Ejercicio}
                                          onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                        >
                                          {ex.nombre}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="weight-input"
                                  placeholder="-"
                                  value={setRep.weight}
                                  onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                  aria-label="Peso"
                                />
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar este set"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                          </div>
                        </div>
                      )}

                      {/* EMOM */}
                      {block.type === "EMOM" && (
                        <div className="emom-ctn">
                          <div className="cantidad-emom-ctn">
                            <div className='cant-rondas-subctn'>
                              <span> Cada </span>
                              <input
                                className='cant-rondas-subctn-input-chico'
                                placeholder="1"
                                value={block.data.interval}
                                onChange={(e) => handleBlockFieldChange(block.id, 'interval', e.target.value)}
                              />
                              <input
                                className='cant-rondas-subctn-input-grande'
                                placeholder="minuto"
                                disabled
                              />
                            </div>
                            <div className='cant-rondas-subctn'>
                              <span> por </span>
                              <input
                                className='cant-rondas-subctn-input-chico'
                                placeholder="20"
                                value={block.data.totalMinutes}
                                onChange={(e) => handleBlockFieldChange(block.id, 'totalMinutes', e.target.value)}
                              />
                              <input
                                className='cant-rondas-subctn-input-grande'
                                placeholder="minutos"
                                disabled
                              />
                            </div>
                          </div>

                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((setRep, idx) => (
                              <div key={idx} className="sets-row">
                                <input
                                  type="text"
                                  className="series-input"
                                  placeholder="ej. 10"
                                  value={setRep.series}
                                  onChange={e => handleSetRepChange(block.id, idx, 'series', e.target.value)}
                                />
                                <div className="exercise-cell">
                                  <input
                                    type="text"
                                    className="exercise-input"
                                    placeholder={setRep.placeholderExercise}
                                    value={setRep.exercise}
                                    onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                  />
                                  {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                        <li
                                          key={ex.ID_Ejercicio}
                                          onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                        >
                                          {ex.nombre}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="weight-input"
                                  placeholder="-"
                                  value={setRep.weight}
                                  onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                  aria-label="Peso"
                                />
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar este set"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                          </div>
                        </div>
                      )}

                      {/* AMRAP */}
                      {block.type === "AMRAP" && (
                        <div className="amrap-ctn">
                          <div className="cantidad-amrap-ctn">
                            <span> AMRAP de </span>
                            <input
                              className='cant-rondas-subctn-input-chico'
                              placeholder="20"
                              value={block.data.duration}
                              onChange={(e) => handleBlockFieldChange(block.id, 'duration', e.target.value)}
                            />
                            <input
                              className='cant-rondas-subctn-input-grande'
                              placeholder="minutos"
                              disabled
                            />
                          </div>

                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((setRep, idx) => (
                              <div key={idx} className="sets-row">
                                <input
                                  type="text"
                                  className="series-input"
                                  placeholder="ej. 12"
                                  value={setRep.series}
                                  onChange={e => handleSetRepChange(block.id, idx, 'series', e.target.value)}
                                />
                                <div className="exercise-cell">
                                  <input
                                    type="text"
                                    className="exercise-input"
                                    placeholder={setRep.placeholderExercise}
                                    value={setRep.exercise}
                                    onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                  />
                                  {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                        <li
                                          key={ex.ID_Ejercicio}
                                          onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                        >
                                          {ex.nombre}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="weight-input"
                                  placeholder="-"
                                  value={setRep.weight}
                                  onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                  aria-label="Peso"
                                />
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar este set"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                          </div>
                        </div>
                      )}

                      {/* ESCALERA */}
                      {block.type === "Escalera" && (
                        <div className="escalera-ctn">
                          <div className="cantidad-escalera-ctn">
                            <input
                              className='cant-rondas-subctn-input-grande'
                              placeholder="Ej. 21-15-9"
                              value={block.data.escaleraType}
                              onChange={(e) => handleBlockFieldChange(block.id, 'escaleraType', e.target.value)}
                            />
                          </div>

                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((setRep, idx) => (
                              <div
                                key={idx}
                                className="sets-ladder sets-row--no-series"
                              >
                                <div className="exercise-cell" style={{ width: '100%' }}>
                                  <input
                                    style={{ width: '100%' }}
                                    type="text"
                                    className="exercise-input"
                                    placeholder={setRep.placeholderExercise}
                                    value={setRep.exercise}
                                    onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                  />
                                  {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                        <li
                                          key={ex.ID_Ejercicio}
                                          onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                        >
                                          {ex.nombre}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="weight-input"
                                  placeholder="ej. 24kg"
                                  value={setRep.weight}
                                  onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                  aria-label="Peso"
                                />
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar este set"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                          </div>
                        </div>
                      )}

                      {/* TABATA */}
                      {block.type === "TABATA" && (
                        <div className="tabata-ctn">
                          <div
                            className="cantidad-tabata-ctn"
                            style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
                          >
                            <div className='cant-rondas-subctn'>
                              <span>Series: </span>
                              <input
                                className='cant-rondas-subctn-input-chico'
                                placeholder="4"
                                value={block.data.cantSeries}
                                onChange={(e) => handleBlockFieldChange(block.id, 'cantSeries', e.target.value)}
                              />
                            </div>
                            <div className='cant-rondas-subctn'>
                              <span>Trabajo/descanso: </span>
                              <input
                                className='cant-rondas-subctn-input-grande'
                                placeholder='ej. 20s x 10s'
                                value={block.data.tiempoTrabajoDescansoTabata}
                                onChange={(e) => handleBlockFieldChange(block.id, 'tiempoTrabajoDescansoTabata', e.target.value)}
                              />
                            </div>
                            <div className='cant-rondas-subctn'>
                              <span>Descanso entre series: </span>
                              <input
                                className='cant-rondas-subctn-input-grande'
                                placeholder='ej. 1 minuto'
                                value={block.data.descTabata}
                                onChange={(e) => handleBlockFieldChange(block.id, 'descTabata', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((setRep, idx) => (
                              <div
                                key={idx}
                                className="sets-row sets-row--no-series"
                              >
                                <div className="exercise-cell" style={{ width: '100%' }}>
                                  <input
                                    type="text"
                                    className="exercise-input"
                                    style={{ width: '100%' }}
                                    placeholder={setRep.placeholderExercise}
                                    value={setRep.exercise}
                                    onChange={e => handleExerciseInputChange(block.id, idx, e.target.value)}
                                  />
                                  {(suggestions[`${sugKeyPrefix}${idx}`] || []).length > 0 && (
                                    <ul className="suggestions-list">
                                      {suggestions[`${sugKeyPrefix}${idx}`].map(ex => (
                                        <li
                                          key={ex.ID_Ejercicio}
                                          onClick={() => handleSelectSuggestion(block.id, idx, ex)}
                                        >
                                          {ex.nombre}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="weight-input"
                                  placeholder="ej. 16kg"
                                  value={setRep.weight}
                                  onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                  aria-label="Peso"
                                />
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar este ejercicio"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton text="+" linkTo="#" onClick={() => handleAddSetRep(block.id)} />
                          </div>
                        </div>
                      )}

                      {/* DROPSET */}
                      {block.type === "DROPSET" && (
                        <div className="dropset-ctn">
                          {/* Nombre ejercicio con autocomplete */}
                          <div className="exercise-cell" style={{ width: '100%', marginBottom: 12 }}>
                            <input
                              type="text"
                              className="exercise-input"
                              style={{ width: '100%' }}
                              placeholder={block.data.exercisePlaceholder || 'Nombre ejercicio'}
                              value={block.data.exerciseName || ''}
                              onChange={(e) => handleDropsetNameChange(block.id, e.target.value)}
                            />
                            {(suggestions[`${activeDay?.key || 'dia'}-${block.id}-dropsetname`] || []).length > 0 && (
                              <ul className="suggestions-list">
                                {suggestions[`${activeDay?.key || 'dia'}-${block.id}-dropsetname`].map(ex => (
                                  <li
                                    key={ex.ID_Ejercicio}
                                    onClick={() => handleSelectDropsetName(block.id, ex)}
                                  >
                                    {ex.nombre}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* Filas serie + kilos */}
                          <div className="sets-reps-ctn">
                            {block.data.setsReps.map((sr, idx) => (
                              <div
                                key={idx}
                                className="sets-row sets-row--dropset"
                              >
                                <div
                                  className="series-group"
                                  style={{ display: 'flex', gap: 8, width: '100%' }}
                                >
                                  <div style={{ flex: 1 }}>
                                    <label className="mini-label">Serie y reps</label>
                                    <input
                                      type="text"
                                      className="series-input"
                                      placeholder="Ej. 2×20"
                                      value={sr.series}
                                      onChange={e => handleSetRepChange(block.id, idx, 'series', e.target.value)}
                                    />
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <label className="mini-label">Kilos</label>
                                    <input
                                      type="text"
                                      className="weight-input"
                                      placeholder="Ej. 50kg"
                                      value={sr.weight}
                                      onChange={e => handleSetRepChange(block.id, idx, 'weight', e.target.value)}
                                    />
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleDeleteSetRep(block.id, idx)}
                                  className="delete-set-btn"
                                  title="Eliminar fila"
                                >
                                  –
                                </button>
                              </div>
                            ))}
                            <PrimaryButton
                              text="+"
                              linkTo="#"
                              onClick={() => handleAddSetRep(block.id)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral Información */}
        {canAssign && step === 2 && (
          <>
            <div
              className={`info-backdrop ${isMobile && infoOpen ? 'show' : ''}`}
              onClick={() => setInfoOpen(false)}
              aria-hidden={!isMobile || !infoOpen}
            />

            <aside
              id="info-panel"
              className={`info-panel ${isMobile ? 'drawer' : ''} ${infoOpen ? 'open' : ''}`}
              role={isMobile ? 'dialog' : undefined}
              aria-modal={isMobile ? 'true' : undefined}
              aria-label="Información contextual"
            >
              <div className="info-panel__header">
                <h3>Información</h3>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
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
                    className={`info-tab ${infoTab === 'ejercicios' ? 'active' : ''}`}
                    onClick={() => setInfoTab('ejercicios')}
                  >
                    Ejercicios
                  </button>
                  <button
                    className={`info-tab ${infoTab === 'usuario' ? 'active' : ''}`}
                    onClick={() => setInfoTab('usuario')}
                  >
                    Información del usuario
                  </button>
                </div>

                {infoTab === 'ejercicios' && (
                  <div>
                    <input
                      type="text"
                      className="info-search"
                      placeholder="Buscar ejercicio..."
                      value={exerciseSearch}
                      onChange={(e) => setExerciseSearch(e.target.value)}
                    />
                    <div className="info-list">
                      {(filteredExercises || []).map((ej) => (
                        <div key={ej.ID_Ejercicio} className="info-card">
                          <div className="info-card__row">
                            <strong className="info-card__title">{ej.nombre}</strong>
                            {ej.youtubeUrl && (
                              <a
                                href={ej.youtubeUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="info-card__link"
                              >
                                YouTube
                              </a>
                            )}
                          </div>
                          {ej.descripcion && (
                            <p className="info-card__desc">{ej.descripcion}</p>
                          )}
                          <div className="info-card__meta">
                            {ej.musculos && (
                              <small><b>Músculos:</b> {ej.musculos}</small>
                            )}
                            {ej.equipamiento && (
                              <small><b>Equipo:</b> {ej.equipamiento}</small>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!filteredExercises ||
                        filteredExercises.length === 0) && (
                          <p className="info-empty">No se encontraron ejercicios.</p>
                        )}
                    </div>
                  </div>
                )}

                {infoTab === 'usuario' && (
                  <div>
                    <div className="user-meta">
                      <div className="user-meta__line">
                        <b>Usuario asignado:</b>{' '}
                        {selectedUserId
                          ? `${selectedUser?.nombre || ''} ${selectedUser?.apellido || ''}`
                          : '— seleccioná un usuario'}
                      </div>
                    </div>

                    {!selectedUserId && (
                      <p className="info-empty">
                        Para ver mediciones, primero seleccioná un usuario
                        en el desplegable de la izquierda.
                      </p>
                    )}

                    {selectedUserId && (
                      <>
                        {loadingMetrics && (
                          <p className="info-loading">
                            Cargando mediciones...
                          </p>
                        )}

                        {!loadingMetrics &&
                          (!userMetrics ||
                            !Array.isArray(userMetrics.ejercicios) ||
                            userMetrics.ejercicios.length === 0) && (
                            <p className="info-empty">Sin datos de mediciones.</p>
                          )}

                        {!loadingMetrics &&
                          Array.isArray(userMetrics?.ejercicios) &&
                          userMetrics.ejercicios.length > 0 && (
                            <div className="metrics-list">
                              {userMetrics.ejercicios.map((e) => {
                                const historico = Array.isArray(e.HistoricoEjercicios)
                                  ? [...e.HistoricoEjercicios]
                                  : [];
                                historico.sort(
                                  (a, b) =>
                                    new Date(b.Fecha) - new Date(a.Fecha)
                                );
                                const last3 = historico.slice(0, 3);

                                let pr = null;
                                for (const h of historico) {
                                  if (!pr || h.Cantidad > pr.Cantidad) {
                                    pr = h;
                                  }
                                }

                                return (
                                  <div
                                    key={e.ID_EjercicioMedicion}
                                    className="info-card"
                                  >
                                    <div className="info-card__row">
                                      <strong className="info-card__title">
                                        {e.nombre}
                                      </strong>
                                      <small className="info-card__badge">
                                        {e.tipoMedicion}
                                      </small>
                                    </div>

                                    {last3.length > 0 ? (
                                      <div className="metric-block">
                                        <div className="metric-block__title">
                                          Últimos 3 registros
                                        </div>
                                        <ul className="metric-history">
                                          {last3.map((h) => (
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
                                                {h.Cantidad}
                                              </span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : (
                                      <div className="metric-block metric-block--empty">
                                        Sin registros
                                      </div>
                                    )}

                                    <div className="metric-block metric-block--pr">
                                      <span className="metric-pr-label">
                                        PR histórico:
                                      </span>
                                      {pr ? (
                                        <span className="metric-pr-value">
                                          {pr.Cantidad}{' '}
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
                              })}
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

export default CrearRutinaRecomendada;