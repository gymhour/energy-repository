import React, { useEffect, useMemo, useState } from 'react';
import '../../../App.css';
import './MiRutina.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu.jsx';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton.jsx';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown.jsx';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen.jsx';
import { ChevronDown, ChevronUp, Video, SlidersHorizontal } from 'lucide-react';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp.jsx';
import { toast } from 'react-toastify';
import { useNavigate, Link } from 'react-router-dom';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton.jsx';

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

/** texto base del item (sin link) */
const itemText = (it, tipo) => {
  const name = it?.ejercicio?.nombre || 'Ejercicio';
  const reps = (it?.reps ?? '').toString().trim();
  const extra = (it?.setRepWeight ?? '').toString().trim();
  const showExtra = extra && extra.toLowerCase() !== name.toLowerCase();

  if (tipo === 'LADDER') return showExtra ? `${name} — ${extra}` : name;

  const left = reps ? `${reps} ${name}` : name;
  return showExtra ? `${left} — ${extra}` : left;
};

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
          to={`/alumno/ejercicios/${id}`}
          className="ejercicio-link"
          title="Ver detalle del ejercicio"
        >
          {txt}
        </Link>
        <Video className="video-icon" aria-hidden="true" size={16} />
      </span>
    );
  }
  return <span>{txt}</span>;
};

// Si un SETS_REPS no trae ejercicios, mostramos esta línea como item de cuerpo.
const setsRepsFallback = (b) => {
  const parts = [
    b?.setsReps ? `${b.setsReps}` : '',
    b?.nombreEj ? `${b.nombreEj}` : '',
    b?.weight ? `— ${b.weight}` : ''
  ].filter(Boolean);
  const txt = parts.join(' ').trim();
  return txt || null;
};

/* ======== DROPSET helpers (igual que RutinasAsignadas) ======== */
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

const renderDropSetBlock = (b) => {
  const items = getBloqueItems(b);
  if (!items || items.length === 0) return null;

  const firstItem = items[0] || {};
  const ej = firstItem.ejercicio || {};
  const nombre = (b?.nombreEj || ej?.nombre || 'Ejercicio').trim();

  const hasLink = isLinkableExercise(firstItem);

  const titleNode = hasLink ? (
    <span className="ejercicio-link-wrap">
      <Link
        to={`/alumno/ejercicios/${ej.ID_Ejercicio}`}
        className="ejercicio-link"
        title="Ver detalle del ejercicio"
      >
        {nombre}
      </Link>
      <Video className="video-icon" aria-hidden="true" size={16} />
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
/* ============================================================= */

/* ======== TABATA helpers ======== */
const formatWorkRest = (str = "") => {
  const s = String(str).trim();
  if (!s) return "";
  const txt = s
    .replace(/on|trabajo/gi, "")
    .replace(/off|descanso/gi, "")
    .replace(/[x×]/g, "/")
    .replace(/\s+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .trim();
  const [work, rest] = txt.split("/");
  if (work && rest) return `${work.trim()} trabajo × ${rest.trim()} descanso`;
  return s;
};

const headerForBlock = (b) => {
  switch (b?.type) {
    case 'SETS_REPS': return '';
    case 'ROUNDS': return b?.cantRondas ? `${b.cantRondas} rondas de:` : 'Rondas:';
    case 'EMOM': return b?.durationMin ? `EMOM ${b.durationMin}min:` : 'EMOM:';
    case 'AMRAP': return b?.durationMin ? `AMRAP ${b.durationMin}min:` : 'AMRAP:';
    case 'LADDER': return b?.tipoEscalera || 'Escalera';
    case 'TABATA': {
      const parts = [];
      if (b?.cantSeries) parts.push(`${b.cantSeries} series`);
      if (b?.tiempoTrabajoDescansoTabata) parts.push(formatWorkRest(b.tiempoTrabajoDescansoTabata));
      if (parts.length) return `Tabata — ${parts.join(' · ')}`;
      return b?.durationMin ? `Tabata ${b.durationMin}min:` : 'Tabata:';
    }
    default: return '';
  }
};

const renderTabataMeta = (b) => {
  const hasNew = !!(b?.cantSeries || b?.tiempoTrabajoDescansoTabata || b?.descTabata);
  if (!hasNew) return null;

  return (
    <div className="bloque-footnote tabata-meta">
      {b?.descTabata && (
        <span className="meta-chip"><b>Pausa entre series:</b> {b.descTabata}</span>
      )}
    </div>
  );
};

const renderBloques = (bloques) => {
  return (bloques || []).map((b, i) => {
    const items = getBloqueItems(b);
    const header = headerForBlock(b);

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

        {b.type === 'TABATA' && renderTabataMeta(b)}

        {b.type === 'ROUNDS' && b.descansoRonda ? (
          <p className='bloque-footnote'>Descanso: {b.descansoRonda}s</p>
        ) : null}
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
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

/* ===================== Component ===================== */
const MiRutina = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [selectedRutinaId, setSelectedRutinaId] = useState(null);
  const navigate = useNavigate();

  // filtros
  const [clasesApi, setClasesApi] = useState([]);
  const [selClase, setSelClase] = useState('');
  const [selGrupo, setSelGrupo] = useState('');
  const [selDia, setSelDia] = useState('');
  const [fClase, setFClase] = useState('');
  const [fGrupo, setFGrupo] = useState('');
  const [fDia, setFDia] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // estado de desplegables: { [ID_Rutina]: { [diaKey]: boolean } }
  const [openState, setOpenState] = useState({});

  useEffect(() => {
    const userId = localStorage.getItem('usuarioId');

    const loadAll = async () => {
      try {
        const [rRes, cRes] = await Promise.allSettled([
          apiService.getUserRutinas(userId),
          apiService.getClases()
        ]);

        if (rRes.status === 'fulfilled') {
          const list = rRes.value?.rutinas || [];
          setRutinas(list);

          const init = {};
          list.forEach(r => {
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
          setOpenState(init);
        } else {
          console.error('Error al obtener rutinas:', rRes.reason);
        }

        if (cRes.status === 'fulfilled') setClasesApi(cRes.value || []);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  const clases = useMemo(() => Array.from(new Set(clasesApi.map(c => c.nombre))), [clasesApi]);
  const grupos = ["Pecho", "Espalda", "Piernas", "Brazos", "Hombros", "Abdominales", "Glúteos", "Tren Superior", "Tren Inferior", "Full Body", "Mixto"];
  const diasSemana = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];

  const filteredRutinas = rutinas.filter(r => {
    let tieneDia = fDia === '';
    if (!tieneDia) {
      if (r.semanas && r.semanas.length > 0) {
        tieneDia = r.semanas.some(sem =>
          sem.dias && Object.keys(sem.dias).some(k => k.toLowerCase() === fDia.toLowerCase())
        );
      } else {
        tieneDia = r?.dias && Object.keys(r.dias).some(k => k.toLowerCase() === fDia.toLowerCase());
      }
    }
    return (
      (fClase === '' || r.claseRutina === fClase) &&
      (fGrupo === '' || r.grupoMuscularRutina === fGrupo) &&
      tieneDia
    );
  });

  const aplicarFiltro = () => { setFClase(selClase); setFGrupo(selGrupo); setFDia(selDia); };
  const limpiarFiltro = () => { setSelClase(''); setSelGrupo(''); setSelDia(''); setFClase(''); setFGrupo(''); setFDia(''); };

  const deleteRutina = async (idRutina) => {
    setLoading(true);
    try {
      await apiService.deleteRutina(idRutina);
      setRutinas(prev => prev.filter(r => r.ID_Rutina !== idRutina));
      toast.success('Rutina eliminada correctamente');
    } catch {
      toast.error('La rutina no se pudo eliminar. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };
  const handlePopUpOpen = id => { setSelectedRutinaId(id); setIsPopupOpen(true); };
  const handlePopupConfirm = () => { setIsPopupOpen(false); if (selectedRutinaId) { deleteRutina(selectedRutinaId); setSelectedRutinaId(null); } };
  const handlePopupClose = () => { setIsPopupOpen(false); setSelectedRutinaId(null); };

  const toggleDia = (rutinaId, diaKey) => {
    setOpenState(prev => ({
      ...prev,
      [rutinaId]: { ...(prev[rutinaId] || {}), [diaKey]: !prev?.[rutinaId]?.[diaKey] }
    }));
  };

  if (loading) return <LoaderFullScreen />;

  return (
    <div className='page-layout'>
      <SidebarMenu isAdmin={false} />
      <div className='content-layout mi-rutina-ctn'>

        <div className='mi-rutina-title'>
          <h2>Mi plan de entrenamiento</h2>
        </div>

        <div style={{ margin: '30px 0px' }}>
          <button className='toggle-filters-button' onClick={() => setShowFilters(prev => !prev)}>
            <SlidersHorizontal size={16} /> Filtros {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFilters &&
          <div className="filtros-section">
            <CustomDropdown
              options={clases}
              value={selClase}
              onChange={e => setSelClase(e.target.value)}
              placeholderOption='Todas las clases'
            />
            <CustomDropdown
              options={grupos}
              value={selGrupo}
              onChange={e => setSelGrupo(e.target.value)}
              placeholderOption='Todos los grupos musculares'
            />
            <CustomDropdown
              options={diasSemana}
              value={selDia}
              onChange={e => setSelDia(e.target.value)}
              placeholderOption='Todos los días'
            />
            <div className='filtros-section-btns'>
              <PrimaryButton onClick={aplicarFiltro} text="Filtrar" />
              <SecondaryButton onClick={limpiarFiltro} text="Limpiar filtros" />
            </div>
          </div>
        }

        {/* —— LISTADO DE RUTINAS —— */}
        <div className='mis-rutinas-list'>
          {filteredRutinas.length === 0 ? (
            <p>No hay rutinas para estos filtros.</p>
          ) : (
            filteredRutinas.map(rutina => {
              const dias = normalizeDias(rutina);

              if (rutina.urlPlanificacion) {
                return (
                  <div key={rutina.ID_Rutina} className='rutina-card rutina-card-premium'>
                    <div className="premium-glow-effect"></div>
                    <div className='rutina-header premium-header'>
                      <div className="premium-badge">
                        <span className="sparkle-icon">✨</span>
                        PLAN DE ENTRENAMIENTO PREMIUM
                      </div>
                      <h3>{rutina.nombre}</h3>
                      {rutina.desc && <p className="premium-desc">{rutina.desc}</p>}
                    </div>

                    <div className='rutina-data premium-data'>
                      <div className="data-item">
                        <span className="label">Clase</span>
                        <span className="value">{rutina.claseRutina || 'General'}</span>
                      </div>
                      <div className="data-item">
                        <span className="label">Enfoque</span>
                        <span className="value">{rutina.grupoMuscularRutina || 'Personalizado'}</span>
                      </div>
                      {rutina.entrenador && (
                        <div className="data-item">
                          <span className="label">Entrenador</span>
                          <span className="value">
                            {[rutina.entrenador.nombre, rutina.entrenador.apellido].filter(Boolean).join(' ')}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="premium-action-zone">
                      <div className="sheets-icon-container">
                        <svg className="sheets-svg-icon" viewBox="0 0 24 24" width="48" height="48">
                          <path fill="#0F9D58" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                          <path fill="#FFF" d="M13 9h5v2h-5V9zm0 4h5v2h-5v-2zm-9 3v2h5v-2H4zm9 1h5v2h-5v-2zM4 12v2h5v-2H4zm0-4v2h5V8H4z"/>
                          <path fill="#E0E0E0" d="M14 2L20 8h-6V2z"/>
                        </svg>
                      </div>
                      <div className="premium-action-text">
                        <h4>Tu Planificación Digital</h4>
                        <p>Hacé click en el botón de abajo para abrir tu planilla interactiva de Google Sheets y registrar tu progreso de hoy.</p>
                      </div>
                      <a 
                        href={rutina.urlPlanificacion} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="premium-cta-btn"
                      >
                        <span>Abrir Planilla de Google Sheets</span>
                        <span className="arrow-icon">→</span>
                      </a>
                    </div>
                    
                    <div className="iframe-collapsible-section">
                      <details className="iframe-details">
                        <summary className="iframe-summary">
                          <span>Visualizar Planilla Embebida (Pantalla Completa)</span>
                        </summary>
                        <div className="iframe-wrapper">
                          <iframe 
                            src={rutina.urlPlanificacion.replace('/edit', '/preview').replace('?usp=sharing', '')} 
                            title="Plan de Entrenamiento"
                            className="premium-iframe"
                            allowFullScreen
                          />
                        </div>
                      </details>
                    </div>
                  </div>
                );
              }

              return (
                <div key={rutina.ID_Rutina} className='rutina-card'>
                  <div className='rutina-header'>
                    <h3>{rutina.nombre}</h3>
                  </div>

                  <div className='rutina-data'>
                    <p>Clase: {rutina.claseRutina || '—'}</p>
                    <p>Grupo muscular: {rutina.grupoMuscularRutina || '—'}</p>
                    <p>
                      {rutina.semanas && rutina.semanas.length > 0
                        ? `Semanas totales: ${rutina.semanas.length}`
                        : `Días totales: ${dias.length}`}
                    </p>
                  </div>

                  {/* ===== SEMANAS o DÍAS ===== */}
                  {rutina.semanas && rutina.semanas.length > 0 ? (
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
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
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

                  <div style={{ marginTop: 12 }}>
                    <button className='rutina-ver-detalle-btn' onClick={() => navigate(`/alumno/rutinas/${rutina.ID_Rutina}`)}>
                      Ver mas detalles
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <ConfirmationPopup
          isOpen={isPopupOpen}
          onClose={handlePopupClose}
          onConfirm={handlePopupConfirm}
          message='¿Estás seguro de que deseas eliminar esta rutina?'
        />
      </div>
    </div>
  );
};

export default MiRutina;