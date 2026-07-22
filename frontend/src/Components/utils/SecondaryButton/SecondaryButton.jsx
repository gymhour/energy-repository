import React from 'react';
import './secondaryButton.css';
import { Link } from 'react-router-dom';

const SecondaryButton = ({ text, icon: Icon, iconClassName = "", linkTo, reversed=false, onClick }) => {
    return (
        <Link 
            to={linkTo} 
            className={`secondary-button ${reversed ? 'reversed' : ''}`} 
            onClick={onClick}
        >
            {text}
            {Icon && <Icon className={`icon secondary-btn-icon ${iconClassName}`} />}
        </Link>
    );
};

export default SecondaryButton;