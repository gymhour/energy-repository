import React from 'react';
import { Link } from 'react-router-dom';

const ClasesActividadesCard = ({ clase }) => {
    const truncateText = (text, maxLength) => {
        if (text.length > maxLength) {
            return text.substring(0, maxLength) + "...";
        }
        return text;
    };

    return (
        <Link
            key={clase.ID_Clase}
            to={`/alumno/clases-actividades/${clase.ID_Clase}`}
            className="clase-link"
        >
            <div className="clase-item" style={{
                backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${clase.imagenClase != null
                    ? clase.imagenClase
                    : 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fm=jpg&q=60&w=3000&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dGhlJTIwZ3ltfGVufDB8fDB8fHww'})`
            }}>
                <h2>{clase.nombre}</h2>
                <p>{truncateText(clase.descripcion, 80)}</p>
            </div>
        </Link>
    );
};

export default ClasesActividadesCard;
