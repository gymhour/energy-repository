import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Select from 'react-select';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiService from '../../../services/apiService';
import { toast } from 'react-toastify';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import { ChevronDown, ChevronUp, Copy, Edit, Trash2, Video, MoreVertical, FileSpreadsheet, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import '../../Entrenador/RutinasAsignadas/RutinasAsignadas.css';

/* ===================== Helpers ===================== */
const WEEK_ORDER = [
  'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo',
  'Miércoles', 'Sábado'
];

const isDiaN = (k) => /^dia(\d+)$/i.test(k);
const diaNIndex = (k) => {
  const m = /^dia(\d+)$/i.exec(k);
  return m ? parseInt(m[1], 10) : Infinity;
};

const smartSortDiaKeys = (diasObj) => {
  const keys = Object.keys(diasObj || {});
  if (!keys.length) return keys;

  const hasAnyDiaN = keys.some(isDiaN);
  if (hasAnyDiaN) {
    const sinDia = keys.filter(k => k === 'sin_dia');
    const diaNs = keys.filter(isDiaN).sort((a, b) => diaNIndex(a) - diaNIndex(b));
    const others = keys.filter(k => !isDiaN(k) && k !== 'sin_dia').sort((a, b) => a.localeCompare(b));
    return [...diaNs, ...others, ...sinDia];
  }

  const sinDia = keys.filter(k => k === 'sin_dia');
  const week = keys.filter(k => WEEK_ORDER.includes(k))
    .sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b));
  const others = keys.filter(k => !WEEK_ORDER.includes(k) && k !== 'sin_dia').sort((a, b) => a.localeCompare(b));
  return [...week, ...others, ...sinDia];
};

const normalizeDias = (rutina) => {
  const d = rutina?.dias || {};
  const ordered = smartSortDiaKeys(d);
  return ordered.map((key, idx) => ({
    key,
    nombre: d[key]?.nombre || key || `Día ${idx + 1}`,
    descripcion: d[key]?.descripcion || '',
    bloques: Array.isArray(d[key]?.bloques) ? d[key].bloques : []
  }));
};

const getBloqueItems = (b) => Array.isArray(b?.ejercicios) ? b.ejercicios : [];

// —— Etiquetas de bloque (incluye TABATA mejorado)
const formatWorkRest = (str = '') => {
  const s = String(str).trim();
  if (!s) return '';
  const txt = s
    .replace(/on|trabajo/gi, '')
    .replace(/off|descanso/gi, '')
    .replace(/[x×]/g, '/')
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/')
    .trim();
  const [work, rest] = txt.split('/');
  if (work && rest) return `${work.trim()} trabajo × ${rest.trim()} descanso`;
  return s;
};

const blockLabel = (b) => {
  switch (b?.type) {
    case 'ROUNDS':
      return b?.cantRondas ? `${b.cantRondas} rondas de:` : 'Rondas:';
    case 'EMOM':
      return b?.durationMin ? `EMOM ${b.durationMin}min:` : 'EMOM:';
    case 'AMRAP':
      return b?.durationMin ? `AMRAP ${b.durationMin}min:` : 'AMRAP:';
    case 'TABATA': {
      const chips = [];
      if (b?.cantSeries) chips.push(`${b.cantSeries} series`);
      if (b?.tiempoTrabajoDescansoTabata) chips.push(formatWorkRest(b.tiempoTrabajoDescansoTabata));
      if (chips.length) return `Tabata — ${chips.join(' · ')}`;
      if (b?.durationMin) return `Tabata ${b.durationMin}min:`;
      return 'TABATA:';
    }
    case 'LADDER':
      return b?.tipoEscalera || 'Escalera';
    case 'SETS_REPS':
      return ''; // sin header
    default:
      return '';
  }
};

const itemText = (it, tipo) => {
  const name = it?.ejercicio?.nombre || 'Ejercicio';
  const reps = (it?.reps ?? '').toString().trim();
  const extra = (it?.setRepWeight ?? '').toString().trim();
  const showExtra = extra && extra.toLowerCase() !== name.toLowerCase();

  if (tipo === 'LADDER') return showExtra ? `${name} — ${extra}` : name;

  const left = reps ? `${reps} ${name}` : name;
  return showExtra ? `${left} — ${extra}` : left;
};

// ====== Link a detalle de ejercicio ======
const isLinkableExercise = (it) => {
  const ej = it?.ejercicio;
  return !!(ej?.ID_Ejercicio && ej?.esGenerico === false);
};

const renderEjercicioItem = (it, tipo) => {
  const txt = itemText(it, tipo);
  if (isLinkableExercise(it)) {
    const id = it.ejercicio.ID_Ejercicio;
    return (
      <span className="ejercicio-link-wrap">
        <Link
          to={`/admin/ejercicios/${id}`}
          className="ejercicio-link"
          title="Ver detalle del ejercicio"
        >
          {txt}
        </Link>
        <Video className="video-icon" size={20} aria-hidden="true" />
      </span>
    );
  }
  return <span>{txt}</span>;
};

// Fallback para SETS_REPS sin ejercicios
const setsRepsFallback = (b) => {
  const parts = [
    b?.setsReps ? `${b.setsReps}` : '',
    b?.nombreEj ? `${b.nombreEj}` : '',
    b?.weight ? `— ${b.weight}` : ''
  ].filter(Boolean);
  const txt = parts.join(' ').trim();
  return txt || null;
};

/* ======== DROPSET detection & rendering ======== */
/** true si es bloque SETS_REPS con 2+ items del mismo ejercicio */
const isDropSetBlock = (b) => {
  if (!b || b.type !== 'SETS_REPS') return false;
  const items = getBloqueItems(b);
  if (!Array.isArray(items) || items.length < 2) return false;

  const firstId = items[0]?.ejercicio?.ID_Ejercicio ?? items[0]?.ID_Ejercicio ?? null;
  const firstName = (items[0]?.ejercicio?.nombre || b?.nombreEj || '').trim().toLowerCase();

  return items.every(it => {
    const id = it?.ejercicio?.ID_Ejercicio ?? it?.ID_Ejercicio ?? null;
    const name = (it?.ejercicio?.nombre || '').trim().toLowerCase();
    if (firstId != null && id != null) return id === firstId;
    return name && name === firstName;
  });
};

const repsWeightLine = (it) => {
  const reps = (it?.reps || '').toString().replace(/x/gi, '×').trim();
  const w = (it?.setRepWeight || '').toString().trim();
  if (reps && w) return `${reps} - ${w}`;
  if (reps) return reps;
  if (w) return w;
  return '—';
};

/** Render del bloque dropset */
const renderDropSetBlock = (b) => {
  const items = getBloqueItems(b);
  if (!items || items.length === 0) return null;

  const firstItem = items[0] || {};
  const ej = firstItem.ejercicio || {};
  const nombre = (b?.nombreEj || ej?.nombre || 'Ejercicio').trim();

  // Reutilizamos la misma regla de link que en otros bloques
  const hasLink = isLinkableExercise(firstItem); // usa ej.ID_Ejercicio && !ej.esGenerico

  const titleNode = hasLink ? (
    <span className="ejercicio-link-wrap">
      <Link
        to={`/admin/ejercicios/${ej.ID_Ejercicio}`}
        className="ejercicio-link"
        title="Ver detalle del ejercicio"
      >
        {nombre}
      </Link>
      <Video className="video-icon" size={20} aria-hidden="true" />
    </span>
  ) : (
    <span>{nombre}</span>
  );

  return (
    <div className="bloque-card dropset-card">
      <p className="bloque-header">
        DROPSET — {titleNode}
      </p>
      <ul className="bloque-list dropset-list">
        {items.map((it, idx) => (
          <li key={idx}>{repsWeightLine(it)}</li>
        ))}
      </ul>
    </div>
  );
};

// ====== Component rendering helper for blocks ======
const renderBloques = (bloques) => {
  return (bloques || []).map((b, i) => {
    const items = getBloqueItems(b);
    const header = blockLabel(b);

    if (b.type === 'SETS_REPS') {
      if (isDropSetBlock(b)) {
        return <React.Fragment key={i}>{renderDropSetBlock(b)}</React.Fragment>;
      }
      const fallback = items.length === 0 ? setsRepsFallback(b) : null;
      return (
        <div key={i} className='bloque-card'>
          {(items.length > 0) ? (
            <ul className='bloque-list'>
              {items.map((it, j) => (
                <li key={j}>{renderEjercicioItem(it, b.type)}</li>
              ))}
            </ul>
          ) : (
            fallback && (
              <ul className='bloque-list'>
                <li>{fallback}</li>
              </ul>
            )
          )}
        </div>
      );
    }

    return (
      <div key={i} className='bloque-card'>
        {header && <p className='bloque-header'>{header}</p>}
        {items.length > 0 && (
          <ul className='bloque-list'>
            {items.map((it, j) => (
              <li key={j}>{renderEjercicioItem(it, b.type)}</li>
            ))}
          </ul>
        )}

        {b.type === 'TABATA' && (b?.cantSeries || b?.tiempoTrabajoDescansoTabata || b?.descTabata) && (
          <p className='bloque-footnote'>
            {b?.cantSeries ? <><b>Series:</b> {b.cantSeries} &middot; </> : null}
            {b?.tiempoTrabajoDescansoTabata
              ? <><b>Trabajo/Descanso:</b> {formatWorkRest(b.tiempoTrabajoDescansoTabata)} &middot; </>
              : null}
            {b?.descTabata ? <><b>Pausa entre series:</b> {b.descTabata}</> : null}
          </p>
        )}

        {b.type === 'ROUNDS' && b.descansoRonda != null && (
          <p className='bloque-footnote'>Descanso: {b.descansoRonda}s</p>
        )}
      </div>
    );
  });
};

const renderDiasContent = (dias, rutinaId, openState, toggleDia, prefix = '') => {
  if (!dias || dias.length === 0) return null;

  if (dias.length <= 1 && !prefix) {
    const d = dias[0];
    return (
      <div className='rutina-dia'>
        {d && <h4>{d.nombre}</h4>}
        {d?.descripcion && <p className='dia-desc'>{d.descripcion}</p>}
        {renderBloques(d.bloques)}
      </div>
    );
  }

  return (
    <div className='rutina-dias-accordion'>
      {dias.map((d, idx) => {
        const key = `${prefix}${d.key}`;
        const isOpen = !!openState?.[rutinaId]?.[key];
        return (
          <div key={key} className={`accordion-item ${isOpen ? 'open' : ''}`}>
            <button
              className='accordion-trigger'
              onClick={() => toggleDia(rutinaId, key)}
              aria-expanded={isOpen}
            >
              <span>{d.nombre || `Día ${idx + 1}`}</span>
              {isOpen ? <ChevronUp /> : <ChevronDown />}
            </button>
            {isOpen && (
              <div className='accordion-content'>
                {d.descripcion && <p className='dia-desc'>{d.descripcion}</p>}
                {renderBloques(d.bloques)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ==================================================== */

const customStyles = {
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
  control: (provided) => ({
    ...provided,
    minHeight: '42px',
    backgroundColor: 'var(--background-color)',
    borderColor: 'var(--border-color)',
    borderRadius: '8px',
    padding: '2px',
    boxShadow: 'none',
    color: 'var(--text-color)',
    width: '100%',
    ':hover': {
      borderColor: 'var(--primary-color)',
    },
  }),
  singleValue: (provided) => ({
    ...provided,
    color: 'var(--text-color)',
  }),
  menu: (provided) => ({
    ...provided,
    backgroundColor: 'var(--background-color)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
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
  })
};

const usuarioToOption = (usuario) => ({
  label: `${usuario.nombre || ''} ${usuario.apellido || ''}${usuario.dni ? ` - DNI ${usuario.dni}` : usuario.email ? ` (${usuario.email})` : ''}`,
  value: usuario.ID_Usuario
});

const formatNombreCompleto = (persona) =>
  `${persona?.nombre || ''} ${persona?.apellido || ''}`.trim();

const resumenAsignaciones = (items, formatter, limit = 2) => {
  const values = (Array.isArray(items) ? items : [])
    .map(formatter)
    .filter(Boolean);

  if (!values.length) {
    return {
      hasItems: false,
      text: '',
      fullText: '',
      isTruncated: false
    };
  }

  return {
    hasItems: true,
    text: values.length > limit ? `${values.slice(0, limit).join(', ')}, ...` : values.join(', '),
    fullText: values.join(', '),
    isTruncated: values.length > limit
  };
};

const RutinasAsignadas = () => {
  const [loading, setLoading] = useState(false);
  const [rutinas, setRutinas] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [asignadasPorMi, setAsignadasPorMi] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedRutinaId, setSelectedRutinaId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [openActionsId, setOpenActionsId] = useState(null);
  const navigate = useNavigate();

  // estado de desplegables: { [ID_Rutina]: { [diaKey]: boolean } }
  const [openState, setOpenState] = useState({});

  useEffect(() => {
    fetchGrupos();
    fetchRutinas(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
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
      } catch (error) {
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
  }, [userSearch]);

  const mergedUserOptions = useMemo(() => {
    const optionsById = new Map();
    [selectedUser, ...userOptions].forEach(option => {
      if (option?.value) optionsById.set(option.value, option);
    });
    return Array.from(optionsById.values());
  }, [selectedUser, userOptions]);

  const fetchGrupos = async () => {
    try {
      const data = await apiService.getGruposUsuarios();
      setGrupos(Array.isArray(data) ? data : (data?.grupos || data?.data || []));
    } catch (error) {
      console.error('Error cargando grupos:', error);
      toast.error('No se pudieron cargar los grupos para el filtro.');
    }
  };

  const buildOpenState = (lista) => {
    const init = {};
    lista.forEach(r => {
      init[r.ID_Rutina] = {};
      if (r.semanas && r.semanas.length > 0) {
        const firstSem = r.semanas[0];
        const semKey = `sem_${firstSem.id || 0}`;
        init[r.ID_Rutina][semKey] = true;
        const semDias = normalizeDias({ dias: firstSem.dias });
        if (semDias.length > 0) {
          init[r.ID_Rutina][`${semKey}_${semDias[0].key}`] = true;
        }
      } else {
        const dias = normalizeDias(r);
        if (dias.length > 0) {
          init[r.ID_Rutina][dias[0].key] = true;
        }
      }
    });
    return init;
  };

  const fetchRutinas = async (targetPage = 1, filtros = {}) => {
    setLoading(true);
    try {
      const {
        grupoId = selectedGrupo?.value,
        usuarioId = selectedUser?.value,
        soloMias = asignadasPorMi,
      } = filtros;
      const { rutinas: lista = [], meta } = await apiService.getRutinasAsignadas({
        page: targetPage,
        grupoId,
        usuarioId,
        asignadasPorMi: soloMias,
      });
      setRutinas(lista);
      setOpenState(buildOpenState(lista));
      setPage(meta?.page || targetPage);
      setTotalPages(meta?.totalPages || 1);
    } catch (error) {
      console.error('Error cargando rutinas:', error);
      toast.error('Error al cargar las rutinas. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchRutinas(1);
  };

  const limpiarFiltros = () => {
    setSelectedUser(null);
    setSelectedGrupo(null);
    setAsignadasPorMi(false);
    fetchRutinas(1, { grupoId: null, usuarioId: null, soloMias: false });
  };

  const openDeletePopup = id => {
    setOpenActionsId(null);
    setSelectedRutinaId(id);
    setIsPopupOpen(true);
  };

  const closePopup = () => {
    setIsPopupOpen(false);
    setSelectedRutinaId(null);
  };

  const handleConfirmDelete = async () => {
    if (!selectedRutinaId) return;
    setLoading(true);
    try {
      await apiService.deleteRutina(selectedRutinaId);
      toast.success('Rutina eliminada correctamente.');
      closePopup();
      await fetchRutinas(page);
    } catch (error) {
      toast.error('Error al eliminar la rutina');
      console.error('Error al eliminar rutina', error);
      setLoading(false);
      closePopup();
    }
  };

  const toggleDia = (rutinaId, diaKey) => {
    setOpenState(prev => ({
      ...prev,
      [rutinaId]: { ...(prev[rutinaId] || {}), [diaKey]: !prev?.[rutinaId]?.[diaKey] }
    }));
  };

  // ====== Duplicar rutina (incluye campos TABATA y urlPlanificacion) ======
  const buildDuplicatePayload = (rutina) => {
    const entrenadorId = Number(localStorage.getItem('usuarioId')) || null;
    const alumnoId = rutina?.alumno?.ID_Usuario || null;

    if (rutina?.urlPlanificacion) {
      return {
        ID_Usuario: alumnoId,
        ID_Entrenador: entrenadorId,
        nombre: `${rutina?.nombre || 'Rutina'} (1)`,
        desc: rutina?.desc || '',
        claseRutina: rutina?.claseRutina || 'Combinada',
        grupoMuscularRutina: rutina?.grupoMuscularRutina || 'Mixto',
        urlPlanificacion: rutina.urlPlanificacion,
      };
    }

    const parseBloques = (bloquesArr) => {
      const bloques = Array.isArray(bloquesArr) ? bloquesArr : [];
      return bloques.map((b) => {
        const ejercicios = Array.isArray(b?.ejercicios) ? b.ejercicios : [];
        const bloqueEjercicios = ejercicios.map((it) => {
          const ejercicioId = it?.ejercicio?.ID_Ejercicio ?? it?.ID_Ejercicio ?? null;
          return {
            ejercicioId,
            reps: it?.reps ?? '',
            setRepWeight: (it?.setRepWeight ?? '').toString().trim() || undefined,
          };
        });

        return {
          type: b?.type || 'SETS_REPS',
          setsReps: b?.setsReps ?? null,
          nombreEj: b?.nombreEj ?? null,
          weight: b?.weight ?? null,
          descansoRonda: b?.descansoRonda ?? null,
          cantRondas: b?.cantRondas ?? null,
          durationMin: b?.durationMin ?? null,
          tipoEscalera: b?.tipoEscalera ?? null,
          cantSeries: b?.cantSeries ?? null,
          descTabata: b?.descTabata ?? null,
          tiempoTrabajoDescansoTabata: b?.tiempoTrabajoDescansoTabata ?? null,
          bloqueEjercicios,
        };
      });
    };

    const parseDias = (diasObj) => {
      const resultObj = {};
      Object.keys(diasObj || {}).forEach((diaKey, idx) => {
        const d = diasObj[diaKey] || {};
        resultObj[diaKey] = {
          nombre: d?.nombre || `Día ${idx + 1}`,
          descripcion: d?.descripcion || '',
          bloques: parseBloques(d.bloques)
        };
      });
      return resultObj;
    };

    const semanasPayload = {};
    if (Array.isArray(rutina?.semanas)) {
      rutina.semanas.forEach((s, idx) => {
        const key = `semana${idx + 1}`;
        semanasPayload[key] = {
          numero: s.numero || (idx + 1),
          nombre: s.nombre || `Semana ${idx + 1}`,
          dias: parseDias(s.dias),
        };
      });
    }

    return {
      ID_Usuario: alumnoId,
      ID_Entrenador: entrenadorId,
      nombre: `${rutina?.nombre || 'Rutina'} (1)`,
      desc: rutina?.desc || '',
      claseRutina: rutina?.claseRutina || 'Combinada',
      grupoMuscularRutina: rutina?.grupoMuscularRutina || 'Mixto',
      dias: parseDias(rutina?.dias),
      semanas: semanasPayload,
    };
  };

  const handleDuplicate = async (rutina) => {
    try {
      setOpenActionsId(null);
      setLoading(true);
      const payload = buildDuplicatePayload(rutina);
      if (rutina?.urlPlanificacion) {
        await apiService.createRutinaSimple(payload);
      } else {
        await apiService.createRutina(payload);
      }
      toast.success('Rutina duplicada correctamente.');
      await fetchRutinas(page);
    } catch (error) {
      console.error('Error al duplicar rutina:', error);
      toast.error('No se pudo duplicar la rutina. Intente nuevamente.');
      setLoading(false);
    }
  };

  if (loading) return <LoaderFullScreen />;

  return (
    <div className='page-layout'>
      <SidebarMenu isAdmin={true} isEntrenador={false} />
      <div className='content-layout mi-rutina-ctn rutinas-asignadas-page'>

        <div className='mi-rutina-title rutinas-asignadas-title'>
          <h2>Rutinas asignadas</h2>
        </div>

        <div className="rutinas-asignadas-filter-shell">
          <button
            type="button"
            className="rutinas-asignadas-filter-trigger"
            onClick={() => setShowFilters(prev => !prev)}
            aria-expanded={showFilters}
          >
            <span>Filtros</span>
            <span className="rutinas-asignadas-filter-meta">
              {showFilters ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
          </button>

          {showFilters && (
            <div className='rutinas-asignadas-filtro-ctn'>
              <label className="rutinas-asignadas-filter-field">
                <span>Usuario</span>
                <Select
                  options={mergedUserOptions}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  onInputChange={(value, meta) => {
                    if (meta.action === 'input-change') setUserSearch(value);
                  }}
                  placeholder='Seleccioná un usuario'
                  noOptionsMessage={() => userSearch.trim().length < 2 ? 'Escribí al menos 2 caracteres' : 'No se encontraron usuarios'}
                  loadingMessage={() => 'Buscando usuarios...'}
                  isClearable
                  isSearchable
                  isLoading={usersLoading}
                  filterOption={null}
                  styles={customStyles}
                />
              </label>

              <label className="rutinas-asignadas-filter-field">
                <span>Grupo</span>
                <Select
                  options={grupos.map(g => ({
                    label: g.nombre,
                    value: g.ID_GrupoUsuario
                  }))}
                  value={selectedGrupo}
                  onChange={setSelectedGrupo}
                  placeholder='Filtrar por grupo'
                  isClearable
                  isSearchable
                  styles={customStyles}
                />
              </label>

              <div className="rutinas-asignadas-checkbox-ctn">
                <input
                  type="checkbox"
                  id="asignadasPorMi"
                  checked={asignadasPorMi}
                  onChange={(e) => setAsignadasPorMi(e.target.checked)}
                />
                <label htmlFor="asignadasPorMi">Asignadas por mi</label>
              </div>

              <div className="rutinas-asignadas-filtros-btns">
                <PrimaryButton onClick={handleSearch} text="Buscar" />
                <SecondaryButton onClick={limpiarFiltros} text="Limpiar" />
              </div>
            </div>
          )}
        </div>

        {/* ——— Listado de rutinas ——— */}
        <div className='mis-rutinas-list'>
          {rutinas.length === 0 ? (
            <p>No tienes rutinas asignadas en este momento.</p>
          ) : rutinas.map(rutina => {
            const dias = normalizeDias(rutina);
            const usuariosResumen = resumenAsignaciones(
              Array.isArray(rutina?.asignacionesUsuarios)
                ? rutina.asignacionesUsuarios
                : rutina?.alumno
                  ? [rutina.alumno]
                  : [],
              formatNombreCompleto
            );
            const gruposResumen = resumenAsignaciones(rutina?.asignacionesGrupos, g => g?.nombre);

            return (
              <div key={rutina.ID_Rutina} className='rutina-card'>
                <div className='rutina-header'>
                  <h3>
                    {rutina.nombre}
                    {/* {rutina.urlPlanificacion && (
                      <span className="routine-badge sheet-badge">
                        <FileSpreadsheet size={13} />
                        Planilla Digital
                      </span>
                    )} */}
                  </h3>
                  <div className="rutina-header-acciones">
                    <button
                      type="button"
                      onClick={() => setOpenActionsId(prev => prev === rutina.ID_Rutina ? null : rutina.ID_Rutina)}
                      className='rutina-actions-trigger'
                      title='Opciones de rutina'
                      aria-expanded={openActionsId === rutina.ID_Rutina}
                    >
                      <MoreVertical size={19} />
                    </button>
                    {openActionsId === rutina.ID_Rutina && (
                      <div className="rutina-actions-menu">
                        <button type="button" onClick={() => handleDuplicate(rutina)}>
                          <Copy size={16} />
                          Duplicar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionsId(null);
                            navigate(`/admin/editar-rutina/${rutina.ID_Rutina}`);
                          }}
                        >
                          <Edit size={16} />
                          Editar
                        </button>
                        <button type="button" className="danger" onClick={() => openDeletePopup(rutina.ID_Rutina)}>
                          <Trash2 size={16} />
                          Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* <div className='rutina-data'>
                  <p>Clase: {rutina.claseRutina || '—'}</p>
                  <p>Grupo muscular: {rutina.grupoMuscularRutina || '—'}</p>
                  {rutina.urlPlanificacion ? (
                    <p>Modalidad: Planificación Digital</p>
                  ) : (
                    <p>
                      {rutina.semanas && rutina.semanas.length > 0
                        ? `Semanas totales: ${rutina.semanas.length}`
                        : `Días totales: ${dias.length}`}
                    </p>
                  )}
                </div> */}

                {/* ===== SEMANAS o DÍAS ===== */}
                {rutina.urlPlanificacion ? (
                  <div className="sheet-quick-access">
                    <div className="sheet-quick-copy">
                      <span className="sheet-quick-icon">
                        <FileSpreadsheet size={18} />
                      </span>
                      <div>
                        <p className="sheet-quick-title">Planilla digital</p>
                        <span>Google Sheets vinculado a esta rutina.</span>
                      </div>
                    </div>
                    <a
                      href={rutina.urlPlanificacion}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sheet-quick-btn"
                    >
                      <span>Abrir planilla</span>
                      <ExternalLink size={15} />
                    </a>
                  </div>
                ) : rutina.semanas && rutina.semanas.length > 0 ? (
                  <div className='rutina-semanas-accordion'>
                    {rutina.semanas.map((s, idx) => {
                      const key = `sem_${s.id || idx}`;
                      const isOpen = !!openState?.[rutina.ID_Rutina]?.[key];
                      const diasSemanales = normalizeDias({ dias: s.dias });

                      return (
                        <div key={key} className={`accordion-item semana-accordion ${isOpen ? 'open' : ''}`}>
                          <button
                            className='accordion-trigger semana-trigger'
                            onClick={() => toggleDia(rutina.ID_Rutina, key)}
                            aria-expanded={isOpen}
                            style={isOpen ? { borderLeft: '4px solid var(--primary-color)' } : {}}
                          >
                            <span>{s.nombre || `Semana ${s.numero || idx + 1}`}</span>
                            {isOpen ? <ChevronUp /> : <ChevronDown />}
                          </button>
                          {isOpen && (
                            <div className='accordion-content semana-content' style={{ padding: '10px' }}>
                              {renderDiasContent(diasSemanales, rutina.ID_Rutina, openState, toggleDia, `${key}_`)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  renderDiasContent(dias, rutina.ID_Rutina, openState, toggleDia)
                )}

                <div className="rutina-asignada">
                  <div
                    className={`rutina-asignada-row ${!usuariosResumen.hasItems ? 'empty' : ''}`}
                    title={usuariosResumen.isTruncated ? usuariosResumen.fullText : undefined}
                  >
                    {usuariosResumen.hasItems && (
                      <>
                        <strong>Usuarios:</strong> {usuariosResumen.text}
                      </>
                    )}
                  </div>

                  <div
                    className={`rutina-asignada-row ${!gruposResumen.hasItems ? 'empty' : ''}`}
                    title={gruposResumen.isTruncated ? gruposResumen.fullText : undefined}
                  >
                    {gruposResumen.hasItems && (
                      <>
                        <strong>Grupos:</strong> {gruposResumen.text}
                      </>
                    )}
                  </div>

                  <div className="rutina-asignada-row">
                    <strong>Por:</strong> {`${rutina?.entrenador?.nombre || ''} ${rutina?.entrenador?.apellido || ''}`.trim() || '—'}
                  </div>
                </div>

                <div className="rutina-card-footer">
                  <button className='rutina-ver-detalle-btn' onClick={() => navigate(`/admin/rutinas/${rutina.ID_Rutina}`)}>
                    Ver mas detalles
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="rutinas-paginacion">
            <button
              type="button"
              className="rutinas-pagination-btn"
              onClick={() => fetchRutinas(page - 1)}
              disabled={page <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft size={18} />
              <span>Anterior</span>
            </button>
            <span className="rutinas-pagination-status">
              Página <strong>{page}</strong> de {totalPages}
            </span>
            <button
              type="button"
              className="rutinas-pagination-btn"
              onClick={() => fetchRutinas(page + 1)}
              disabled={page >= totalPages}
              aria-label="Página siguiente"
            >
              <span>Siguiente</span>
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <ConfirmationPopup
          isOpen={isPopupOpen}
          message="¿Estás seguro que deseas eliminar esta rutina?"
          onClose={closePopup}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </div>
  );
};

export default RutinasAsignadas;
