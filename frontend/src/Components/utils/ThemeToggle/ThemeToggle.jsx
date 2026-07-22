import './ThemeToggle.css';
import { Moon } from 'lucide-react';

const ThemeToggle = () => {
    // This assumes window.toggleTheme is defined in App.js
    const handleClick = () => {
        if (window.toggleTheme) {
            window.toggleTheme();
        }
    };

    return (
        <div className="theme-toggle-wrapper" onClick={handleClick} title="Toggle Theme">
            <Moon width={16} height={16} />
            <span className="theme-toggle-text">Cambiar Tema</span>
        </div>
    );
};

export default ThemeToggle;
