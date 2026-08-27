import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './bloqueAccordion.css';

/**
 * Card de bloque plegable, con el mismo comportamiento que los acordeones de
 * días y semanas: arranca cerrada y cada bloque maneja su propio estado.
 * Así una rutina larga de un solo día se ve compacta.
 *
 * El trigger es un div y no un button porque el header de un DROPSET puede
 * contener el link al detalle del ejercicio (un <a> dentro de un <button> no
 * es válido); el link corta la propagación para no togglear al navegar.
 */
const BloqueAccordion = ({
    titulo,
    header,
    defaultOpen = false,
    className = '',
    children
}) => {
    const [open, setOpen] = useState(defaultOpen);
    const toggle = () => setOpen(o => !o);

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
        }
    };

    return (
        <div className={`bloque-card bloque-collapsible ${open ? 'open' : ''} ${className}`}>
            <div
                className='bloque-trigger'
                role='button'
                tabIndex={0}
                aria-expanded={open}
                onClick={toggle}
                onKeyDown={onKeyDown}
            >
                <div className='bloque-trigger-text'>
                    {titulo && <span className='bloque-titulo'>{titulo}</span>}
                    <span className='bloque-header'>{header || 'Bloque'}</span>
                </div>

                <div className='bloque-trigger-meta'>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {open && <div className='bloque-content'>{children}</div>}
        </div>
    );
};

export default BloqueAccordion;
