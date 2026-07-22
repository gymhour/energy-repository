import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import { ReactComponent as ArrowLeftIcon } from '../../../assets/icons/arrow-left.svg';
import './EjercicioDetail.css';
import apiService from '../../../services/apiService';

// Extrae el ID de YouTube de cualquier formato (watch?v=, youtu.be, shorts, embed).
const extractVideoId = (url) => {
    if (!url) return '';
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtu.be')) return u.pathname.replace('/', '').trim();
        const v = u.searchParams.get('v');
        if (v) return v.trim();
        const parts = u.pathname.split('/').filter(Boolean);
        const embedIdx = parts.indexOf('embed');
        if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1].trim();
        const shortsIdx = parts.indexOf('shorts');
        if (shortsIdx !== -1 && parts[shortsIdx + 1]) return parts[shortsIdx + 1].trim();
        return '';
    } catch {
        const reg = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]+)/;
        const m = String(url).match(reg);
        return m ? m[1] : '';
    }
};

const EjercicioDetail = ({ fromAdmin, fromEntrenador, fromAlumno }) => {
    const { id } = useParams();
    const [ejercicio, setEjercicio] = useState(null);

    useEffect(() => {
        const fetchEjercicio = async () => {
            try {
                const { data } = await apiService.getEjercicioById(id);
                setEjercicio(data);
            } catch (error) {
                console.error("Error al cargar el ejercicio:", error);
            }
        };
        fetchEjercicio();
    }, [id]);

    if (!ejercicio) {
        return (
            <div className="page-layout">
                <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} isAlumno={fromAlumno} />
                <div className="content-layout">
                    <p>Cargando ejercicio...</p>
                </div>
            </div>
        );
    }

    const backLink = fromAdmin
        ? "/admin/ejercicios"
        : fromEntrenador
            ? "/entrenador/ejercicios"
            : "/alumno/ejercicios";

    const videoId = extractVideoId(ejercicio.youtubeUrl);

    return (
        <div className="page-layout">
            <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} isAlumno={fromAlumno} />
            <div className="content-layout ejercicio-detail">
                {/* Botón de regreso */}
                <SecondaryButton
                    text="Ejercicios"
                    linkTo={backLink}
                    icon={ArrowLeftIcon}
                    reversed
                />

                {/* Video / Media */}
                {videoId ? (
                    <div className="ejercicio-detail__media video">
                        <iframe
                            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                            title={ejercicio.nombre}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>
                ) : (
                    <div
                        className="ejercicio-detail__media foto"
                        style={{ backgroundImage: `url(${ejercicio.mediaUrl})` }}
                    />
                )}

                {/* Datos principales */}
                <div className="ejercicio-detail__header">
                    <h1 className="header__title">{ejercicio.nombre}</h1>
                </div>

                {/* Descripción */}
                <section className="ejercicio-detail__section">
                    <h2>Descripción</h2>
                    <p>
                        {ejercicio.descripcion || 'No hay descripción disponible.'}
                    </p>
                </section>

                <section className="ejercicio-detail__section">
                    <h2>Instrucciones</h2>
                    {ejercicio.instrucciones ? (
                        <ol className='ejercicio-instrucciones-ol'>
                            {ejercicio.instrucciones.split('\n').map((line, i) => (
                                <li key={i}>{line}</li>
                            ))}
                        </ol>
                    ) : (
                        <p>No hay instrucciones disponibles.</p>
                    )}
                </section>

                <section className="ejercicio-detail__section">
                    <h2>Músculos</h2>
                    <div className="chip-list">
                        {ejercicio.musculos && ejercicio.musculos.split('-').filter(m => m.trim()).length > 0 ? (
                            ejercicio.musculos
                                .split('-')
                                .filter(m => m.trim())
                                .map((m, i) => (
                                    <span key={i} className="chip">{m.trim()}</span>
                                ))
                        ) : (
                            <p>No hay músculos listados.</p>
                        )}
                    </div>
                </section>

                {/* Equipamiento */}
                <section className="ejercicio-detail__section">
                    <h2>Equipamiento</h2>
                    {ejercicio.equipamiento ? (
                        <div className="chip-list">
                            {ejercicio.equipamiento
                                .split('-')
                                .filter(item => item.trim())
                                .map((e, i) => (
                                    <span key={i} className="chip">{e.trim()}</span>
                                ))}
                        </div>
                    ) : (
                        <p>No hay equipamiento listado.</p>
                    )}
                </section>

            </div>
        </div>
    );
};

export default EjercicioDetail;