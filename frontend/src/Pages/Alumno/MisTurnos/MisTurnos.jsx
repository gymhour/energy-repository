import React, { useState, useEffect } from 'react';
import '../../../App.css';
import './misTurnos.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import TurnosCard from '../../../Components/TurnosCard/TurnosCard';
import { ReactComponent as AddCircleIcon } from '../../../assets/icons/add-circle.svg';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import { isTurnoInFuture } from '../../../utils/turnoDate';
import { ChevronDown, ChevronUp } from 'lucide-react';
// ToastContainer
import { toast } from 'react-toastify';

const TURNOS_PREVIEW_LIMIT = 3;

const MisTurnos = () => {
    const [turnos, setTurnos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [turnoToCancel, setTurnoToCancel] = useState(null);
    const [showAllProximos, setShowAllProximos] = useState(false);
    const [showAllHistorial, setShowAllHistorial] = useState(false);

    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            const usuarioId = localStorage.getItem("usuarioId");
            try {
                const turnosData = await apiService.getTurnosUsuario(usuarioId); 
                // console.log("Turnos", turnosData);
                setTurnos(turnosData);
                setLoading(false);
            } catch (err) {
                toast.error("Error al cargar los turnos. Intente nuevamente.");
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filtrar los turnos para obtener los próximos turnos
    const proximoTurnos = turnos
        .filter((turno) => isTurnoInFuture(turno.fecha) && turno.estado !== 'CANCELADO')
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Obtener el historial de turnos (todos menos los próximos)
    const historialTurnos = turnos
        .filter((turno) => !isTurnoInFuture(turno.fecha))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const visibleProximoTurnos = showAllProximos
        ? proximoTurnos
        : proximoTurnos.slice(0, TURNOS_PREVIEW_LIMIT);

    const visibleHistorialTurnos = showAllHistorial
        ? historialTurnos
        : historialTurnos.slice(0, TURNOS_PREVIEW_LIMIT);

    const hasMoreProximos = proximoTurnos.length > TURNOS_PREVIEW_LIMIT;
    const hasMoreHistorial = historialTurnos.length > TURNOS_PREVIEW_LIMIT;

    const renderTurnoCard = (turno) => (
        <TurnosCard
            key={turno.id_turno}
            id={turno.id_turno}
            nombreTurno={turno.HorarioClase.Clase.nombre}
            fechaTurno={turno.fecha}
            horaTurno={turno.hora}
            onCancelTurno={() => handleOpenCancelPopup(turno.id_turno)}
        />
    );

    const renderToggleButton = ({ isExpanded, onClick, total, label }) => (
        <button type="button" className="turnos-toggle-button" onClick={onClick}>
            <span>{isExpanded ? `Ver menos ${label}` : `Ver todos (${total})`}</span>
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
    );

    // Función que abre el popup y guarda el turno seleccionado
    const handleOpenCancelPopup = (id) => {
        setTurnoToCancel(id);
        setIsPopupOpen(true);
    };

    // Función que se ejecuta al confirmar la cancelación
    const handleConfirmCancellation = async () => {
        // Cerramos el popup y mostramos el loader
        setIsPopupOpen(false);
        setLoading(true);
        try {
            await apiService.deleteTurno(turnoToCancel);
            setTurnos(prevTurnos =>
                prevTurnos.filter(turno => turno.id_turno !== turnoToCancel)
            );
            toast.success("Turno cancelado exitosamente.");
            setTurnoToCancel(null);
            setLoading(false);
        } catch (error) {
            console.error("Error al cancelar turno:", error);
            toast.error(error?.message || "Error al cancelar turno. Intente nuevamente.");
            setTurnoToCancel(null);
            setLoading(false);
        }
    };

    // Cierra el popup sin cancelar
    const handleClosePopup = () => {
        setIsPopupOpen(false);
        setTurnoToCancel(null);
    };

    return (
        <div className='page-layout'>
            {loading && <LoaderFullScreen />}
            <SidebarMenu isAdmin={false} />
            <div className='content-layout mis-turnos-ctn'>
                <div className="proximos-turnos-ctn">
                    <div className="proximo-turno-title">
                        <div>
                            <h2>Próximos turnos</h2>
                            <span className="turnos-section-count">{proximoTurnos.length} en agenda</span>
                        </div>
                        <SecondaryButton linkTo="/alumno/agendar-turno" text="Agendar nuevo" icon={AddCircleIcon} />
                    </div>
                    <div className="proximo-turno-turnos">
                        {visibleProximoTurnos.length > 0 ? (
                            visibleProximoTurnos.map(renderTurnoCard)
                        ) : (
                            <p>No tienes próximos turnos.</p>
                        )}
                    </div>
                    {hasMoreProximos && renderToggleButton({
                        isExpanded: showAllProximos,
                        onClick: () => setShowAllProximos(prev => !prev),
                        total: proximoTurnos.length,
                        label: 'turnos',
                    })}
                </div>
                <div className="historial-turnos-ctn">
                    <div className="historial-turno-title">
                        <div>
                            <h2>Historial</h2>
                            <span className="turnos-section-count">{historialTurnos.length} turnos registrados</span>
                        </div>
                    </div>
                    <div className="proximo-turno-turnos">
                        {visibleHistorialTurnos.length > 0 ? (
                            visibleHistorialTurnos.map(renderTurnoCard)
                        ) : (
                            <p>No tienes historial de turnos.</p>
                        )}
                    </div>
                    {hasMoreHistorial && renderToggleButton({
                        isExpanded: showAllHistorial,
                        onClick: () => setShowAllHistorial(prev => !prev),
                        total: historialTurnos.length,
                        label: 'historial',
                    })}
                </div>
            </div>
            <ConfirmationPopup
                isOpen={isPopupOpen}
                onClose={handleClosePopup}
                onConfirm={handleConfirmCancellation}
                message="¿Estás seguro de que deseas cancelar este turno?"
            />
            {/* <ToastContainer theme="dark" /> */}
        </div>
    );
};

export default MisTurnos;
