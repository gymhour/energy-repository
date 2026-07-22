import React, { useState, useEffect } from 'react';
import './clasesActividades.css';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import ClasesActividadesCard from '../ClasesActividadesCard/ClasesActividadesCard';
import apiClient from '../../../axiosConfig';
import apiService from '../../../services/apiService';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';

const ClasesActividades = () => {
    const [clases, setClases] = useState([]);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true)
        const fetchClases = async () => {
            try {
                const clases = await apiService.getClases()
                setClases(clases);
                setLoading(false);
            } catch (err) {
                setError("Error al cargar las clases. Intente nuevamente.");
                setLoading(false);
            }
        };

        fetchClases();
    }, []);

    return (
        <div className='page-layout'>
            { loading && <LoaderFullScreen/> }
            <SidebarMenu isAdmin={false} fromEntrenador={true} />
            <div className='content-layout'>
                <h2>Clases y actividades</h2>
                {error ? (
                    <p className="error-message">{error}</p>
                ) : (
                    <div className="clases-list">
                        {clases.length > 0 ? (
                            clases.map((clase) => (
                                <ClasesActividadesCard key={clase.ID_Clase} clase={clase} />
                            ))
                        ) : (
                            <p>No hay clases disponibles.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClasesActividades;