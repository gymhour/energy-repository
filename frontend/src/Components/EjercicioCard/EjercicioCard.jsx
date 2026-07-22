import React, { useMemo, useState, useCallback } from 'react';
import './EjercicioCard.css';

const EjercicioCard = ({
  ejercicio,
  defaultImage,
  onClick,
  onEdit,
  onDelete
}) => {
  const { nombre, descripcion, mediaUrl, youtubeUrl } = ejercicio;

  const extractVideoId = useCallback((url) => {
    if (!url) return '';
    try {
      const u = new URL(url);

      // youtu.be/VIDEOID
      if (u.hostname.includes('youtu.be')) {
        return u.pathname.replace('/', '').trim();
      }

      // youtube.com/watch?v=VIDEOID
      const v = u.searchParams.get('v');
      if (v) return v.trim();

      // youtube.com/embed/VIDEOID
      const parts = u.pathname.split('/').filter(Boolean);

      const embedIdx = parts.indexOf('embed');
      if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1].trim();

      // youtube.com/shorts/VIDEOID
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1].trim();

      return '';
    } catch {
      // fallback por si viene algo que no es URL válida
      const reg = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/;
      const m = String(url).match(reg);
      return m ? m[1] : '';
    }
  }, []);

  const videoId = useMemo(() => extractVideoId(youtubeUrl), [youtubeUrl, extractVideoId]);
  const hasYoutube = !!videoId;

  const [isPlaying, setIsPlaying] = useState(false);

  const thumbnail = useMemo(() => {
    if (hasYoutube) return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return mediaUrl || defaultImage;
  }, [hasYoutube, videoId, mediaUrl, defaultImage]);

  const handleView = (e) => {
    e.stopPropagation();
    onClick?.();
  };

  const handlePlay = (e) => {
    e.stopPropagation();
    if (hasYoutube) setIsPlaying(true);
  };

  const handleStop = (e) => {
    e.stopPropagation();
    setIsPlaying(false);
  };

  return (
    <div
      className="exercise-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' ? onClick() : null) : undefined}
    >
      <div className="exercise-card__media">
        {hasYoutube ? (
          isPlaying ? (
            <div className="media__playerWrap" onClick={(e) => e.stopPropagation()}>
              <iframe
                className="media__iframe"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`}
                frameBorder="0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                title={nombre || 'Video de ejercicio'}
              />

              <button
                type="button"
                className="media__closeBtn"
                onClick={handleStop}
                aria-label="Cerrar video"
                title="Cerrar"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="media__thumbBtn"
              onClick={handlePlay}
              aria-label="Reproducir video"
              title="Reproducir"
            >
              <img
                className="media__img"
                src={thumbnail}
                alt={nombre || 'Ejercicio'}
                loading="lazy"
              />
              <span className="media__playBadge" aria-hidden="true">▶</span>
            </button>
          )
        ) : (
          <img
            className="media__img"
            src={thumbnail}
            alt={nombre || 'Ejercicio sin nombre'}
            loading="lazy"
          />
        )}
      </div>

      <div className="exercise-card__info">
        <h3 className="info__title">{nombre || 'Sin nombre'}</h3>
        <p className="info__desc">
          {descripcion || 'Descripción no disponible'}
        </p>
      </div>

      <div className="exercise-card__footer">
        {onClick && (
          <button
            type="button"
            className="action-btn view"
            onClick={handleView}
          >
            Ver
          </button>
        )}

        {(onEdit || onDelete) && (
          <div className="exercise-card__actions">
            {onEdit && (
              <button
                type="button"
                className="action-btn edit"
                onClick={(e) => { e.stopPropagation(); onEdit(ejercicio); }}
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="action-btn delete"
                onClick={(e) => { e.stopPropagation(); onDelete(ejercicio); }}
              >
                Eliminar
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default EjercicioCard;