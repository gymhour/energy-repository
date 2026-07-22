import React, { useEffect, useMemo, useState } from 'react';
import '../../../App.css';
import '../MiRutina/MiRutina.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu.jsx';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton.jsx';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton.jsx';
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown.jsx';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen.jsx';
import { Link, useNavigate } from 'react-router-dom';
import { Video, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';


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

/* ===== Etiquetas por tipo (incluye TABATA mejorado) ===== */
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
    case 'SETS_REPS': return '';
    case 'ROUNDS': return b?.cantRondas ? `${b.cantRondas} rondas de:` : 'Rondas:';
    case 'EMOM': return b?.durationMin ? `EMOM ${b.durationMin}min:` : 'EMOM:';
    case 'AMRAP': return b?.durationMin ? `AMRAP ${b.durationMin}min:` : 'AMRAP:';
    case 'TABATA': {
      const chips = [];
      if (b?.cantSeries) chips.push(`${b.cantSeries} series`);
      if (b?.tiempoTrabajoDescansoTabata) chips.push(formatWorkRest(b.tiempoTrabajoDescansoTabata));
      if (chips.length) return `Tabata — ${chips.join(' · ')}`;
      if (b?.durationMin) return `Tabata ${b.durationMin}min:`;
      return 'TABATA:';
    }
    case 'LADDER': return b?.tipoEscalera || 'Escalera';
    default: return '';
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

// Link + icono video
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

/* ======== DROPSET helpers (mismo criterio que RutinasAsignadas/MiRutina) ======== */
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

  // Reutilizamos la misma regla de link que en otros bloques
  const hasLink = isLinkableExercise(firstItem); // usa ej.ID_Ejercicio && !ej.esGenerico

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

/* ================================================================== */

const RutinasRecomendadas = () => {
  const [rutinas, setRutinas] = useState([]);
  const [loading, setLoading] = useState(true);

  // dropdown selections
  const [selClase, setSelClase] = useState('');
  const [selGrupo, setSelGrupo] = useState('');
  const [selDia, setSelDia] = useState('');
  // applied filters
  const [fClase, setFClase] = useState('');
  const [fGrupo, setFGrupo] = useState('');
  const [fDia, setFDia] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // estado de desplegables por rutina/día
  const [openState, setOpenState] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const fetchRutinas = async () => {
      setLoading(true);
      try {
        const resp = await apiService.getRutinasAdmins();
        const list = Array.isArray(resp?.rutinas) ? resp.rutinas : [];

        // abrir primer día por defecto en cada rutina
        const init = {};
        list.forEach(r => {
          const dias = normalizeDias(r);
          init[r.ID_Rutina] = {};
          dias.forEach((d, i) => { init[r.ID_Rutina][d.key] = (i === 0); });
        });

        if (!cancelled) {
          setRutinas(list);
          setOpenState(init);
        }
      } catch (error) {
        console.error('Error al obtener rutinas:', error);
        if (!cancelled) setRutinas([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRutinas();
    return () => { cancelled = true; };
  }, []);

  // opciones de filtros
  const clases = useMemo(
    () => Array.from(new Set(rutinas.map(r => r?.claseRutina).filter(Boolean))),
    [rutinas]
  );
  const grupos = useMemo(
    () => Array.from(new Set(rutinas.map(r => r?.grupoMuscularRutina).filter(Boolean))),
    [rutinas]
  );
  const diasOptions = useMemo(() => {
    const all = new Set();
    for (const r of rutinas) {
      const keys = Object.keys(r?.dias || {});
      keys.forEach(k => all.add(k));
    }
    return Array.from(all);
  }, [rutinas]);

  // filtros aplicados
  const filteredRutinas = useMemo(() => {
    return rutinas.filter(r => {
      const tieneDia =
        fDia === '' ||
        (r?.dias && Object.keys(r.dias).some(k => k.toLowerCase() === fDia.toLowerCase()));

      return (
        (fClase === '' || r.claseRutina === fClase) &&
        (fGrupo === '' || r.grupoMuscularRutina === fGrupo) &&
        tieneDia
      );
    });
  }, [rutinas, fClase, fGrupo, fDia]);

  const aplicarFiltro = () => { setFClase(selClase); setFGrupo(selGrupo); setFDia(selDia); };
  const limpiarFiltro = () => { setSelClase(''); setSelGrupo(''); setSelDia(''); setFClase(''); setFGrupo(''); setFDia(''); };

  const toggleDia = (rutinaId, diaKey) => {
    setOpenState(prev => ({
      ...prev,
      [rutinaId]: { ...(prev[rutinaId] || {}), [diaKey]: !prev?.[rutinaId]?.[diaKey] }
    }));
  };

  return (
    <div className='page-layout'>
      {loading && <LoaderFullScreen />}
      <SidebarMenu isAdmin={false} />
      <div className='content-layout mi-rutina-ctn'>

        <div className="mi-rutina-title">
          <h2>Rutinas Recomendadas</h2>
        </div>

        <div style={{ margin: '20px 0' }}>
          <button
            className='toggle-filters-button'
            onClick={() => setShowFilters(prev => !prev)}
          >
            <SlidersHorizontal size={16} /> Filtros {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showFilters && (
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
              options={diasOptions}
              value={selDia}
              onChange={e => setSelDia(e.target.value)}
              placeholderOption='Todos los días'
            />
            <div className='filtros-section-btns'>
              <PrimaryButton onClick={aplicarFiltro} text="Filtrar" />
              <SecondaryButton onClick={limpiarFiltro} text="Limpiar filtros" />
            </div>
          </div>
        )}

        <div className="mis-rutinas-list">
          {filteredRutinas.length === 0 ? (
            <p>No hay rutinas para estos filtros.</p>
          ) : (
            filteredRutinas.map(rutina => {
              const dias = normalizeDias(rutina);

              return (
                <div key={rutina.ID_Rutina} className="rutina-card">
                  <div className='rutina-header'>
                    <h3>{rutina.nombre}</h3>
                  </div>

                  <div className="rutina-data">
                    <p>Clase: {rutina.claseRutina || '—'}</p>
                    <p>Grupo muscular: {rutina.grupoMuscularRutina || '—'}</p>
                    <p>Días totales: {dias.length}</p>
                  </div>

                  {/* ===== DÍAS ===== */}
                  {dias.length <= 1 ? (
                    <div className='rutina-dia'>
                      {dias[0] && <h4>{dias[0].nombre}</h4>}
                      {dias[0]?.descripcion && <p className='dia-desc'>{dias[0].descripcion}</p>}

                      {(dias[0]?.bloques || []).map((b, i) => {
                        const items = getBloqueItems(b);
                        const header = blockLabel(b);

                        if (b.type === 'SETS_REPS') {
                          // DROPSET → card especial
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
                                {b?.descTabata ? <><b>Pausa entre series:</b> {b.descTabata}</> : null}
                              </p>
                            )}

                            {b.type === 'ROUNDS' && b?.descansoRonda != null && (
                              <p className='bloque-footnote'>Descanso: {b.descansoRonda}s</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='rutina-dias-accordion'>
                      {dias.map((d, idx) => {
                        const isOpen = !!openState?.[rutina.ID_Rutina]?.[d.key];
                        return (
                          <div key={d.key} className={`accordion-item ${isOpen ? 'open' : ''}`}>
                            <button
                              className='accordion-trigger'
                              onClick={() => toggleDia(rutina.ID_Rutina, d.key)}
                              aria-expanded={isOpen}
                            >
                              <span>{d.nombre || `Día ${idx + 1}`}</span>
                              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {isOpen && (
                              <div className='accordion-content'>
                                {d.descripcion && <p className='dia-desc'>{d.descripcion}</p>}

                                {(d.bloques || []).map((b, i) => {
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
                                          {b?.cantSeries ? <><b>Series:</b> {b.cantSeries} · </> : null}
                                          {b?.tiempoTrabajoDescansoTabata
                                            ? <><b>Trabajo/Descanso:</b> {formatWorkRest(b.tiempoTrabajoDescansoTabata)} · </>
                                            : null}
                                          {b?.descTabata ? <><b>Pausa entre series:</b> {b.descTabata}</> : null}
                                        </p>
                                      )}

                                      {b.type === 'ROUNDS' && b?.descansoRonda != null && (
                                        <p className='bloque-footnote'>Descanso: {b.descansoRonda}s</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ marginTop: 12 }}>
                    <button
                      className='rutina-ver-detalle-btn'
                      onClick={() => navigate(`/alumno/rutinas/${rutina.ID_Rutina}`)}
                    >
                      Ver mas detalles
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default RutinasRecomendadas;