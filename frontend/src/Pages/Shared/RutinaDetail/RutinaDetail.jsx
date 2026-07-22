import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import apiService from '../../../services/apiService';
import './RutinaDetail.css';

// ==== PDF ====
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';

const TYPE_LABELS = {
  SETS_REPS: 'Series y repeticiones',
  ROUNDS: 'Rondas',
  EMOM: 'EMOM',
  AMRAP: 'AMRAP',
  TABATA: 'Tabata',
  LADDER: 'Escalera',
  FOR_TIME: 'For time',
};

const pretty = (v, fallback = '—') =>
  v === null || v === undefined || v === '' ? fallback : v;

const formatNombreCompleto = (persona) =>
  `${persona?.nombre || ''} ${persona?.apellido || ''}`.trim();

const getUsuariosAsignados = (rutina) => {
  if (Array.isArray(rutina?.asignacionesUsuarios)) {
    return rutina.asignacionesUsuarios;
  }

  return rutina?.alumno ? [rutina.alumno] : [];
};

const getGruposAsignados = (rutina) =>
  Array.isArray(rutina?.asignacionesGrupos) ? rutina.asignacionesGrupos : [];

/* ===================== DÍAS ===================== */
// Normaliza y ordena dia1, dia2, ...
const normalizeDias = (diasObj) => {
  if (!diasObj || typeof diasObj !== 'object') return [];
  const keys = Object.keys(diasObj).sort((a, b) => {
    const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });
  return keys.map((key) => ({ key, ...diasObj[key] }));
};

/* ===================== HELPERS RUTINA ===================== */
const deriveReps = (ejItem, bloque) => ejItem?.reps || bloque?.setsReps || '';
const derivePeso = (ejItem, bloque) => ejItem?.setRepWeight || bloque?.weight || '';

/* ===================== TABATA ===================== */
// Normaliza "30s / 20off", "30s x 20s", "30 on / 20 off", etc.
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

// Etiqueta de bloque (con TABATA nuevo)
const typeLabel = (type, b) => {
  if (type === 'ROUNDS' && b?.cantRondas) return `${b.cantRondas} Rondas`;
  if (type === 'EMOM' && b?.durationMin) return `EMOM ${b.durationMin}min`;
  if (type === 'AMRAP' && b?.durationMin) return `AMRAP ${b.durationMin}min`;
  if (type === 'LADDER' && b?.tipoEscalera) return `Escalera: ${b.tipoEscalera}`;

  if (type === 'TABATA') {
    const parts = [];
    if (b?.cantSeries) parts.push(`${b.cantSeries} series`);
    if (b?.tiempoTrabajoDescansoTabata)
      parts.push(formatWorkRest(b.tiempoTrabajoDescansoTabata));
    if (parts.length) return `Tabata — ${parts.join(' · ')}`;
    if (b?.durationMin) return `Tabata ${b.durationMin}min`;
    return 'Tabata';
  }

  return TYPE_LABELS[type] || pretty(type, 'Bloque');
};

/* ===================== MEDIA EJERCICIO ===================== */
const getYouTubeId = (url) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return id;
      const m = u.pathname.match(/\/embed\/([A-Za-z0-9_-]{6,})/);
      if (m) return m[1];
    }
  } catch {
    // ignore
  }
  return null;
};

const isVideoFile = (url) => /\.(mp4|webm|ogg)$/i.test(url || '');

const RenderMedia = ({ ej }) => {
  const ytId = getYouTubeId(ej?.youtubeUrl || '');
  if (ytId) {
    const ytUrl = ej?.youtubeUrl?.startsWith('http')
      ? ej.youtubeUrl
      : `https://www.youtube.com/watch?v=${ytId}`;
    const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

    return (
      <a
        href={ytUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="gh-ej-ytlink"
        title={`Ver en YouTube: ${ej?.nombre || 'ejercicio'}`}
        aria-label={`Ver ${ej?.nombre || 'ejercicio'} en YouTube`}
      >
        <img
          className="gh-ej-thumb"
          src={thumb}
          alt=""
          onError={(ev) => {
            ev.currentTarget.style.display = 'none';
          }}
        />
        <span className="gh-ej-ytbadge">YouTube</span>
      </a>
    );
  }

  if (isVideoFile(ej?.mediaUrl)) {
    return (
      <video className="gh-ej-media video" controls preload="metadata">
        <source src={ej.mediaUrl} />
      </video>
    );
  }

  if (ej?.mediaUrl) {
    return (
      <>
        <img
          className="gh-ej-thumb"
          src={ej.mediaUrl}
          alt={ej?.nombre || 'Ejercicio'}
          onError={(ev) => {
            ev.currentTarget.style.display = 'none';
            const sib = ev.currentTarget.nextElementSibling;
            if (sib && sib.classList.contains('gh-ej-thumb-placeholder')) {
              sib.classList.add('show');
            }
          }}
        />
        <div className="gh-ej-thumb-placeholder" aria-label="Sin imagen o video">
          <span className="gh-ej-placeholder-mark" aria-hidden="true" />
        </div>
      </>
    );
  }

  return (
    <div className="gh-ej-thumb-placeholder show" aria-label="Sin imagen o video">
      <span className="gh-ej-placeholder-mark" aria-hidden="true" />
    </div>
  );
};

/* ===================== DROPSET (COMPARTIDO) ===================== */
const getBloqueItems = (b) =>
  Array.isArray(b?.ejercicios) ? b.ejercicios : [];

/** true si es bloque SETS_REPS con 2+ items del mismo ejercicio */
const isDropSetBlock = (b) => {
  if (!b || b.type !== 'SETS_REPS') return false;
  const items = getBloqueItems(b);
  if (!Array.isArray(items) || items.length < 2) return false;

  const firstId =
    items[0]?.ejercicio?.ID_Ejercicio ?? items[0]?.ID_Ejercicio ?? null;
  const firstName = (
    items[0]?.ejercicio?.nombre ||
    b?.nombreEj ||
    ''
  )
    .trim()
    .toLowerCase();

  return items.every((it) => {
    const id =
      it?.ejercicio?.ID_Ejercicio ?? it?.ID_Ejercicio ?? null;
    const name = (it?.ejercicio?.nombre || '').trim().toLowerCase();
    if (firstId != null && id != null) return id === firstId;
    return name && name === firstName;
  });
};

/** "reps -- peso" usando × para la vista detalle */
const repsWeightLine = (it) => {
  const reps = (it?.reps || '').toString().replace(/x/gi, '×').trim();
  const w = (it?.setRepWeight || '').toString().trim();
  if (reps && w) return `${reps} -- ${w}`;
  if (reps) return reps;
  if (w) return w;
  return '—';
};

/** Vista DROPSET en la UI (card) */
const DropSetDetail = ({ bloque }) => {
  const items = getBloqueItems(bloque);
  const ejFirst = items[0]?.ejercicio || {};
  const nombre = (bloque?.nombreEj || ejFirst?.nombre || 'Ejercicio').trim();

  return (
    <div className="gh-surface dropset-surface" style={{ display: 'grid', gap: 8 }}>
      <h4 className="gh-feature-title" style={{ margin: 0 }}>
        {`DROPSET — ${nombre}`}
      </h4>

      <div className="gh-list-item gh-ej-row">
        <div className="gh-media-slot">
          <RenderMedia ej={ejFirst} />
        </div>

        <div className="gh-ej-main">
          <ul className="dropset-lines">
            {items.map((it, idx) => (
              <li key={idx}>{repsWeightLine(it)}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

/* ===================== DROPSET PDF ===================== */
/** misma lógica de detección, reutilizando isDropSetBlock */
const isDropSetBlockPDF = isDropSetBlock;

/**
 * Render compacto del bloque DROPSET en PDF.
 * Mantiene la estructura:
 *  - título "DROPSET — Nombre"
 *  - celda grande con el ejercicio
 *  - por cada item: columna chica (sets) + columna con reps/peso dividida
 * pero con alturas/ancho/fuente reducidos para que se vea más prolijo.
 */
const renderDropSetPDF = (doc, { M, pageW, title, items, startY }) => {
  // Tamaños base (más chicos que antes)
  const rowH = 34;
  const nameW = 220;
  const setsW = 22;
  const valW = 54;

  // Escalamos en ancho si hace falta
  const neededW = nameW + items.length * (setsW + valW);
  const usableW = pageW - M * 2;
  const scale = neededW > usableW ? usableW / neededW : 1;

  const h = rowH;
  const wName = nameW * scale;
  const wSets = setsW * scale;
  const wVal = valW * scale;

  let y = startY;

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(title, M, y);
  y += 6;

  const rowY = y + 6;
  let x = M;

  const centerText = (txt, cx, cy, size = 8, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(String(txt), cx, cy, {
      align: 'center',
      baseline: 'middle',
    });
  };

  doc.setDrawColor(0);

  // Celda de nombre
  const nombre =
    items[0]?.ejercicio?.nombre || 'Ejercicio';
  doc.rect(x, rowY, wName, h);
  centerText(nombre, x + wName / 2, rowY + h / 2, 9);
  x += wName;

  // Columnas por cada tramo del dropset
  items.forEach((it) => {
    const raw = String(it?.reps || '')
      .replace(/×/g, 'x')
      .trim();
    let sets = '';
    let reps = '';
    if (/^\d+\s*[xX]\s*\d+$/i.test(raw)) {
      const [s1, s2] = raw.toLowerCase().split('x').map((s) => s.trim());
      sets = s1;
      reps = s2;
    } else if (/^\d+$/.test(raw)) {
      sets = '1';
      reps = raw;
    } else {
      reps = raw;
    }
    const peso = (it?.setRepWeight || '').toString().trim();

    // Columna sets (estrecha)
    doc.rect(x, rowY, wSets, h);
    centerText(sets || '—', x + wSets / 2, rowY + h / 2, 8);
    x += wSets;

    // Columna reps/peso
    doc.rect(x, rowY, wVal, h);
    // línea horizontal al medio
    doc.line(x, rowY + h / 2, x + wVal, rowY + h / 2);
    centerText(reps || '—', x + wVal / 2, rowY + h / 4, 8, true);
    centerText(peso || '—', x + wVal / 2, rowY + (3 * h) / 4, 7, false);
    x += wVal;
  });

  // devolvemos la Y final del bloque (parte baja de la fila)
  return rowY + h;
};

/* ===================== FILENAME ===================== */
const safeFileName = (titulo, alumnoObj) => {
  const alumnoName = alumnoObj
    ? `${pretty(alumnoObj?.nombre, '')} ${pretty(
      alumnoObj?.apellido,
      ''
    )}`.trim()
    : 'alumno';
  const today = new Date().toISOString().slice(0, 10);
  const raw = `Rutina_${alumnoName || 'alumno'}_${titulo || 'detalle'}_${today}.pdf`;
  return raw.replace(/[^\w\s.-]/g, '_');
};

/* =========================
 *      COMPONENTE
 * ========================= */
const RutinaDetail = ({ fromAdmin, fromEntrenador, fromAlumno }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rutina, setRutina] = useState(null);
  const [activeDiaKey, setActiveDiaKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAsignadosModal, setShowAsignadosModal] = useState(false);

  const [activeSemanaId, setActiveSemanaId] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const data = await apiService.getRutinaById(id);
        if (!mounted) return;
        setRutina(data);

        // Init tabs
        if (data?.semanas && data.semanas.length > 0) {
          setActiveSemanaId(data.semanas[0].id || data.semanas[0].numero || 0);
          const firstSemDias = normalizeDias(data.semanas[0].dias);
          setActiveDiaKey(firstSemDias[0]?.key || null);
        } else {
          const diasArr = normalizeDias(data?.dias);
          setActiveDiaKey(diasArr[0]?.key || null);
        }
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError('No se pudo cargar la rutina. Intentá nuevamente.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const dias = useMemo(() => normalizeDias(rutina?.dias), [rutina]);
  const semanas = useMemo(() => rutina?.semanas || [], [rutina]);
  const usuariosAsignados = useMemo(() => getUsuariosAsignados(rutina), [rutina]);
  const gruposAsignados = useMemo(() => getGruposAsignados(rutina), [rutina]);
  const asignadosCount = usuariosAsignados.length + gruposAsignados.length;
  const hasMultipleAsignados = asignadosCount > 1;

  const headerSubtitle = useMemo(() => {
    if (!rutina) return '';
    const parts = [];
    if (rutina.claseRutina) parts.push(rutina.claseRutina);
    if (rutina.grupoMuscularRutina) parts.push(rutina.grupoMuscularRutina);
    return parts.join(' • ');
  }, [rutina]);

  /* =========================
   *      EXPORTAR A PDF
   * ========================= */
  const handleExportPDF = () => {
    if (!rutina) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const M = 48;
    let cursorY = M;

    const ensureSpace = (minSpace = 120) => {
      if (cursorY + minSpace > pageH - M) {
        doc.addPage();
        cursorY = M;
      }
    };

    const addSectionTitle = (text) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(50);
      doc.text(text, M, cursorY);
      cursorY += 12;
      doc.setDrawColor(220);
      doc.line(M, cursorY, pageW - M, cursorY);
      cursorY += 18;
    };

    // Header doc
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(20);
    const titulo = pretty(rutina.nombre, 'Rutina');
    doc.text(titulo, M, cursorY);
    cursorY += 28;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const alumno = rutina?.alumno
      ? `${pretty(rutina.alumno.nombre, '')} ${pretty(
        rutina.alumno.apellido,
        ''
      )}`.trim()
      : '';
    const entrenador = rutina?.entrenador
      ? `${pretty(rutina.entrenador.nombre, '')} ${pretty(
        rutina.entrenador.apellido,
        ''
      )}`.trim()
      : '—';
    const creada = rutina?.createdAt
      ? new Date(rutina.createdAt).toLocaleDateString()
      : '';

    const headerLines = [
      alumno ? `Alumno: ${alumno}` : '',
      `Entrenador: ${entrenador}`,
      creada ? `Creada: ${creada}` : '',
      headerSubtitle ? `Detalle: ${headerSubtitle}` : '',
    ].filter(Boolean);

    headerLines.forEach((line) => {
      doc.text(line, M, cursorY);
      cursorY += 16;
    });

    if (pretty(rutina.desc, '')) {
      const descLines = doc.splitTextToSize(
        String(rutina.desc),
        pageW - M * 2
      );
      descLines.forEach((l) => {
        doc.text(l, M, cursorY);
        cursorY += 14;
      });
    }

    cursorY += 12;
    doc.setDrawColor(220);
    doc.line(M, cursorY, pageW - M, cursorY);
    cursorY += 24;

    const exportDias = (diasArr, prefix = '') => {
      if (diasArr.length === 0 && !prefix) {
        doc.setFont('helvetica', 'italic');
        doc.text('Esta rutina no tiene días cargados.', M, cursorY);
        return;
      }

      diasArr.forEach((d, idxDia) => {
        ensureSpace(80);
        const nombreDia = pretty(
          d?.nombre,
          d?.key?.replace('dia', 'Día ') || `Día ${idxDia + 1}`
        );
        addSectionTitle(`${prefix ? prefix + ' - ' : ''}${nombreDia}`);

        const bloques = Array.isArray(d?.bloques) ? d.bloques : [];
        if (bloques.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(11);
          doc.text('Este día no tiene bloques cargados.', M, cursorY);
          cursorY += 18;
          return;
        }

        bloques.forEach((b, iB) => {
          ensureSpace(70);

          // —— DROPSET PDF
          if (b?.type === 'SETS_REPS' && isDropSetBlockPDF(b)) {
            const items = getBloqueItems(b);
            const nombre =
              (b?.nombreEj ||
                items[0]?.ejercicio?.nombre ||
                'Ejercicio').trim();
            const title = `DROPSET — ${nombre}`;

            const endY = renderDropSetPDF(doc, {
              M,
              pageW,
              title,
              items,
              startY: cursorY,
            });

            cursorY = endY + 10;

            if (iB !== bloques.length - 1) {
              doc.setDrawColor(230);
              doc.line(M, cursorY, pageW - M, cursorY);
              cursorY += 10;
            }
            return;
          }

          // —— Resto de bloques
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(50);
          const tituloBloque = typeLabel(b?.type, b);
          if (tituloBloque) {
            doc.text(tituloBloque, M, cursorY);
            cursorY += 10;
          }

          const rows = (b?.ejercicios || []).map((e) => {
            const ej = e?.ejercicio || {};
            const nombre = pretty(ej?.nombre, 'Ejercicio');
            const reps = deriveReps(e, b);
            const peso = derivePeso(e, b);
            return {
              ejercicio: nombre,
              reps: reps || '',
              peso: peso || '',
            };
          });

          if (rows.length === 0) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.text('Este bloque no tiene ejercicios.', M, cursorY + 16);
            cursorY += 32;
          } else {
            autoTable(doc, {
              startY: cursorY + 8,
              margin: { left: M, right: M },
              theme: 'grid',
              styles: {
                font: 'helvetica',
                fontSize: 9,
                cellPadding: 6,
                overflow: 'linebreak',
                textColor: 60,
                lineColor: [230, 230, 230],
                lineWidth: 0.5,
              },
              headStyles: {
                fillColor: [248, 248, 248],
                textColor: 40,
                fontStyle: 'bold',
              },
              head: [['Ejercicio', 'Series / Reps', 'Peso']],
              body: rows.map((r) => [r.ejercicio, r.reps, r.peso]),
            });
            cursorY = (doc.lastAutoTable?.finalY || cursorY) + 14;
          }

          if (
            b?.type === 'TABATA' &&
            (b?.cantSeries ||
              b?.tiempoTrabajoDescansoTabata ||
              b?.descTabata)
          ) {
            ensureSpace(18);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const meta = [];
            if (b?.descTabata)
              meta.push(`Pausa entre series: ${b.descTabata}`);
            if (meta.length) {
              doc.text(meta.join('   ·   '), M, cursorY);
              cursorY += 12;
            }
          }

          if (pretty(b?.descansoRonda, '')) {
            ensureSpace(16);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(`Descanso entre rondas: ${b.descansoRonda}`, M, cursorY);
            cursorY += 12;
          }

          if (iB !== bloques.length - 1) {
            doc.setDrawColor(230);
            doc.line(M, cursorY, pageW - M, cursorY);
            cursorY += 16;
          }
        });

        if (idxDia !== diasArr.length - 1) {
          ensureSpace(30);
          doc.setDrawColor(210);
          doc.line(M, cursorY, pageW - M, cursorY);
          cursorY += 22;
        }
      });
    };

    if (rutina.semanas && rutina.semanas.length > 0) {
      rutina.semanas.forEach((s, sIdx) => {
        ensureSpace(60);
        if (sIdx > 0) cursorY += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(30);
        doc.text(s.nombre || `Semana ${s.numero || sIdx + 1}`, M, cursorY);
        cursorY += 24;

        const diasSemanales = normalizeDias(s.dias);
        exportDias(diasSemanales);

        if (sIdx !== rutina.semanas.length - 1) {
          ensureSpace(40);
          cursorY += 30;
        }
      });
    } else {
      const diasArr = normalizeDias(rutina?.dias);
      exportDias(diasArr);
    }

    doc.save(safeFileName(titulo, rutina?.alumno));
  };

  /* ========================= RENDER ========================= */
  return (
    <div className="page-layout">
      <SidebarMenu
        isAdmin={fromAdmin}
        isEntrenador={fromEntrenador}
        isAlumno={fromAlumno}
      />
      <div className="content-layout">
        {loading && (
          <div className="gh-card gh-muted">Cargando rutina…</div>
        )}
        {!loading && error && <div className="gh-error">{error}</div>}

        {!loading && !error && rutina && (
          <>
            {/* Header rutina */}
            <div
              className="header-rutina"
              style={{ display: 'grid', gap: 12 }}
            >
              <div className="rutina-detail-headerbar">
                <div style={{ display: 'grid', gap: 6 }}>
                  <button
                    type="button"
                    className="rutina-detail-back-btn"
                    onClick={() => navigate(-1)}
                  >
                    <span aria-hidden="true">←</span>
                    Volver
                  </button>
                  <h2
                    className="gh-title"
                    style={{ margin: 0 }}
                  >
                    {pretty(rutina.nombre, 'Rutina sin nombre')}
                  </h2>
                  {headerSubtitle && (
                    <p
                      className="gh-muted sm"
                      style={{ margin: 0 }}
                    >
                      {headerSubtitle}
                    </p>
                  )}
                </div>

                {!rutina.urlPlanificacion && (
                  <PrimaryButton
                    text="Exportar como PDF"
                    onClick={handleExportPDF}
                  />
                )}
              </div>

              <div className="rutina-detail-datos">
                <div className="gh-surface">
                  <div className="gh-label xs">Asignados</div>
                  <div className="rutina-asignados-preview">
                    {hasMultipleAsignados ? (
                      <button
                        type="button"
                        className="rutina-asignados-modal-btn"
                        onClick={() => setShowAsignadosModal(true)}
                      >
                        Ver personas y grupos asignados
                      </button>
                    ) : usuariosAsignados.length === 1 ? (
                      <div className="gh-text">
                        <strong>Usuario:</strong> {formatNombreCompleto(usuariosAsignados[0]) || 'Sin nombre'}
                      </div>
                    ) : gruposAsignados.length === 1 ? (
                      <div className="gh-text">
                        <strong>Grupo:</strong> {gruposAsignados[0]?.nombre || 'Sin nombre'}
                      </div>
                    ) : (
                      <div className="gh-text">Sin asignados</div>
                    )}
                  </div>
                </div>
                <div className="gh-surface">
                  <div className="gh-label xs">Entrenador</div>
                  <div className="gh-text">
                    {pretty(
                      rutina?.entrenador
                        ? `${pretty(
                          rutina.entrenador.nombre,
                          ''
                        )} ${pretty(
                          rutina.entrenador.apellido,
                          ''
                        )}`.trim()
                        : '—'
                    )}
                  </div>
                </div>
                <div className="gh-surface">
                  <div className="gh-label xs">Creada</div>
                  <div className="gh-text">
                    {pretty(
                      rutina?.createdAt
                        ? new Date(
                          rutina.createdAt
                        ).toLocaleDateString()
                        : ''
                    )}
                  </div>
                </div>
              </div>

              {pretty(rutina.desc, '') && (
                <div className="gh-surface">
                  <p
                    className="gh-text"
                    style={{ margin: 0 }}
                  >
                    {rutina.desc}
                  </p>
                </div>
              )}
            </div>

            {showAsignadosModal && (
              <div
                className="rutina-asignados-modal-overlay"
                onClick={() => setShowAsignadosModal(false)}
              >
                <div
                  className="rutina-asignados-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="rutina-asignados-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="rutina-asignados-modal-header">
                    <div>
                      <span className="gh-label xs">Rutina</span>
                      <h3 id="rutina-asignados-modal-title">Asignados</h3>
                    </div>
                    <button
                      type="button"
                      className="rutina-asignados-modal-close"
                      onClick={() => setShowAsignadosModal(false)}
                      aria-label="Cerrar listado de asignados"
                    >
                      ×
                    </button>
                  </div>

                  <div className="rutina-asignados-modal-content">
                    <section>
                      <h4>Usuarios</h4>
                      {usuariosAsignados.length > 0 ? (
                        <ul>
                          {usuariosAsignados.map((usuario, index) => (
                            <li key={usuario?.ID_Usuario || index}>
                              {formatNombreCompleto(usuario) || 'Sin nombre'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No hay usuarios asignados.</p>
                      )}
                    </section>

                    <section>
                      <h4>Grupos</h4>
                      {gruposAsignados.length > 0 ? (
                        <ul>
                          {gruposAsignados.map((grupo, index) => (
                            <li key={grupo?.ID_GrupoUsuario || index}>
                              {grupo?.nombre || 'Sin nombre'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No hay grupos asignados.</p>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}

            {/* Google Sheets View */}
            {rutina.urlPlanificacion && (
              <div className="sheets-detail-wrapper">
                <section className="sheets-detail-card">
                  <div className="sheets-detail-header">
                    <div>
                      <div className="gh-label xs">Planilla digital</div>
                      <h3>Google Sheets</h3>
                    </div>
                    <a 
                      href={rutina.urlPlanificacion} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="primary-button sheets-detail-link"
                    >
                      Abrir planilla
                    </a>
                  </div>

                  <div className="sheets-detail-frame">
                    <iframe
                      src={rutina.urlPlanificacion.replace('/edit', '/preview').replace('?usp=sharing', '')}
                      title="Plan de Entrenamiento"
                      className="sheets-detail-iframe"
                      allowFullScreen
                    />
                  </div>
                </section>
              </div>
            )}

            {/* Semanas TABS */}
            {!rutina.urlPlanificacion && semanas.length > 0 && (
              <div
                className="tab-dias"
                style={{ display: 'grid', gap: 12, marginBottom: '20px' }}
              >
                <div className="gh-tabs">
                  <div
                    className="gh-tabs-list"
                    role="tablist"
                    aria-label="Semanas de la rutina"
                  >
                    {semanas.map((s, idx) => {
                      const idNum = s.id || s.numero || idx;
                      return (
                        <button
                          key={idNum}
                          role="tab"
                          aria-selected={activeSemanaId === idNum}
                          className={`gh-tab ${activeSemanaId === idNum ? 'active' : ''}`}
                          onClick={() => {
                            setActiveSemanaId(idNum);
                            const semDias = normalizeDias(s.dias);
                            setActiveDiaKey(semDias[0]?.key || null);
                          }}
                        >
                          {s.nombre || `Semana ${s.numero || idx + 1}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Obtener dias de la semana activa o dias nativos */}
            {!rutina.urlPlanificacion && (() => {
              let currentDias = dias;
              if (semanas.length > 0) {
                const activeWeek = semanas.find(s => (s.id || s.numero) === activeSemanaId) || semanas[0];
                currentDias = activeWeek ? normalizeDias(activeWeek.dias) : [];
              }

              return (
                <div
                  className="tab-dias"
                  style={{ display: 'grid', gap: 12 }}
                >
                  <div className="gh-tabs">
                    <div
                      className="gh-tabs-list"
                      role="tablist"
                      aria-label="Días de la rutina"
                    >
                      {currentDias.length === 0 && (
                        <span className="gh-muted sm">
                          Esta configuración no tiene días cargados.
                        </span>
                      )}
                      {currentDias.map((d) => (
                        <button
                          key={d.key}
                          role="tab"
                          aria-selected={activeDiaKey === d.key}
                          className={`gh-tab ${activeDiaKey === d.key ? 'active' : ''}`}
                          onClick={() => setActiveDiaKey(d.key)}
                        >
                          {pretty(d?.nombre, d.key.replace('dia', 'Día '))}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Panel del día activo */}
                  {currentDias.map((d) => {
                    const isActive = d.key === activeDiaKey;
                    if (!isActive) return null;

                    const bloques = Array.isArray(d?.bloques) ? d.bloques : [];

                    return (
                      <div key={`${d.key}-panel`} role="tabpanel">
                        {bloques.length === 0 ? (
                          <div className="gh-muted">
                            Este día no tiene bloques cargados.
                          </div>
                        ) : (
                          <div className="gh-grid-2 gh-grid-fullwidth">
                            {bloques.map((b) => {
                              if (
                                b?.type ===
                                'SETS_REPS' &&
                                isDropSetBlock(b)
                              ) {
                                return (
                                  <DropSetDetail
                                    key={
                                      b.ID_Bloque
                                    }
                                    bloque={b}
                                  />
                                );
                              }

                              return (
                                <div
                                  className="gh-surface"
                                  key={b.ID_Bloque}
                                  style={{
                                    display:
                                      'grid',
                                    gap: 12,
                                  }}
                                >
                                  {/* header del bloque */}
                                  <div
                                    style={{
                                      display:
                                        'flex',
                                      justifyContent:
                                        'space-between',
                                      alignItems:
                                        'center',
                                      gap: 8,
                                      flexWrap:
                                        'wrap',
                                    }}
                                  >
                                    <h4
                                      className="gh-feature-title"
                                      style={{
                                        margin: 0,
                                      }}
                                    >
                                      {typeLabel(
                                        b?.type,
                                        b
                                      )}
                                    </h4>
                                  </div>

                                  {/* lista de ejercicios */}
                                  <div
                                    style={{
                                      display:
                                        'grid',
                                      gap: 10,
                                    }}
                                  >
                                    {(b.ejercicios ||
                                      [])
                                      .length ===
                                      0 ? (
                                      <div className="gh-muted sm">
                                        Este
                                        bloque no
                                        tiene
                                        ejercicios.
                                      </div>
                                    ) : (
                                      b.ejercicios.map(
                                        (
                                          e,
                                          idx
                                        ) => {
                                          const ej =
                                            e?.ejercicio ||
                                            {};
                                          const nombre =
                                            pretty(
                                              ej?.nombre,
                                              'Ejercicio'
                                            );
                                          const reps =
                                            deriveReps(
                                              e,
                                              b
                                            );
                                          const peso =
                                            derivePeso(
                                              e,
                                              b
                                            );
                                          const title =
                                            peso &&
                                              String(
                                                peso
                                              )
                                                .trim()
                                                .length >
                                              0
                                              ? `${nombre} - ${peso}`
                                              : nombre;

                                          return (
                                            <div
                                              key={`${b.ID_Bloque}-${e.ID_Ejercicio}-${idx}`}
                                              className="gh-list-item gh-ej-row"
                                            >
                                              <div className="gh-media-slot">
                                                <RenderMedia
                                                  ej={
                                                    ej
                                                  }
                                                />
                                              </div>

                                              <div className="gh-ej-main">
                                                <div className="gh-ej-title">
                                                  <span className="gh-text bold">
                                                    {
                                                      title
                                                    }
                                                  </span>
                                                </div>
                                                <div className="gh-ej-info">
                                                  {reps && (
                                                    <span className="gh-muted sm">
                                                      {
                                                        reps
                                                      }
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        }
                                      )
                                    )}
                                  </div>

                                  {/* Meta TABATA */}
                                  {b?.type ===
                                    'TABATA' &&
                                    (b?.cantSeries ||
                                      b?.tiempoTrabajoDescansoTabata ||
                                      b?.descTabata) && (
                                      <div className="bloque-footnote tabata-meta">
                                        {b?.descTabata && (
                                          <span className="meta-chip">
                                            <b>
                                              Pausa
                                              entre
                                              series:
                                            </b>{' '}
                                            {
                                              b.descTabata
                                            }
                                          </span>
                                        )}
                                      </div>
                                    )}

                                  {/* Meta Rounds */}
                                  {b?.type ===
                                    'ROUNDS' &&
                                    pretty(
                                      b.descansoRonda,
                                      ''
                                    ) && (
                                      <div className="gh-inline">
                                        <span>{`Descanso entre rondas: ${b.descansoRonda}`}</span>
                                      </div>
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
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default RutinaDetail;
