import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import 'react-toastify/dist/ReactToastify.css';
import CLIENT_SETUP from './setup';

// Aplica los colores del cliente (setup.js) como CSS variables globales,
// sobrescribiendo los valores por defecto de variables.css.
const { primaryColor, primaryColorHover, backgroundHoverColor } = CLIENT_SETUP.branding.theme;
const rootStyle = document.documentElement.style;
rootStyle.setProperty('--primary-color', primaryColor);
rootStyle.setProperty('--primary-color-hover', primaryColorHover);
rootStyle.setProperty('--background-hover-color', backgroundHoverColor);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

