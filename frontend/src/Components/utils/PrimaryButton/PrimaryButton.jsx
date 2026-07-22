import React from 'react';
import './primaryButton.css';
import { Link } from 'react-router-dom';

const PrimaryButton = ({ text, icon: Icon, linkTo, onClick }) => {
    return (
        <Link to={linkTo} className="primary-button" onClick={onClick}>
            {text}
            {Icon && <Icon className="icon" />}
        </Link>
    );
};

export default PrimaryButton;
