// src/components/SidebarMenu/SidebarMenu.js
import React, { useState } from "react";
// Css
import "./sidebarmenu.css";
// Assets
import CLIENT_SETUP from "../../setup";
// Iconos sidebar
import {
  Home,
  Calendar,
  CalendarPlus,
  Settings,
  LogOut,
  Activity,
  Notebook,
  CalendarCheck,
  Star,
  Users,
  Menu,
  X,
  DollarSign,
  UserCog,
  FileText,
  Dumbbell,
  FilePenLine,
  ClipboardCheck,
  ScanLine,
  AlertTriangle,
  TrendingDown,
  UserPlus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';


// Routing
import { useNavigate, useLocation, Link } from "react-router-dom";
// Componentes
import ConfirmationPopup from "../utils/ConfirmationPopUp/ConfirmationPopUp";
import ThemeToggle from "../utils/ThemeToggle/ThemeToggle";
import { esRecepcion } from "../../utils/roles";

const SidebarMenu = ({ isAdmin, isEntrenador }) => {
  // Recepción navega las mismas páginas que el admin (llegan con isAdmin={true}), así que
  // el rol real se lee del token en vez de agregar un prop a las ~18 páginas que lo montan.
  const esRecep = esRecepcion();
  const inicioAdminPath = esRecep ? "/recepcion/inicio" : "/admin/inicio";
  const navigate = useNavigate();
  const location = useLocation();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === 'true');

  // Theme state
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Listen for theme changes on body attribute
  React.useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const newTheme = document.body.getAttribute('data-theme');
          setCurrentTheme(newTheme || 'dark');
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Initial check in case it changed before observe
    const initialTheme = document.body.getAttribute('data-theme');
    if (initialTheme) {
      setCurrentTheme(initialTheme);
    }

    return () => observer.disconnect();
  }, []);

  const logoSrc = currentTheme === 'light'
    ? (CLIENT_SETUP.branding.logoLight || CLIENT_SETUP.branding.logo)
    : CLIENT_SETUP.branding.logo;

  const handleLogoutClick = () => setIsPopupOpen(true);
  const handleLogoutConfirm = () => {
    setIsPopupOpen(false);
    localStorage.removeItem("token");
    navigate("/");
  };
  const handleLogoutCancel = () => setIsPopupOpen(false);

  const changePasswordPath = isAdmin ? "/admin/cambiar-contrasena" : (isEntrenador ? "/entrenador/cambiar-contrasena" : "/alumno/cambiar-contrasena");

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  return (
    <>
      {/* Botón “Abrir” en mobile */}
      {/* <button
        className="hamburger-btn"
        onClick={() => setIsSidebarOpen(true)}
      >
        <MenuHamburguesaIcon
            className="icon"
            fill="#000000"
        />{" "}
      </button> */}

      {/* MOBILE NAVBAR: hamburguesa a la izquierda + logo centrado */}
      <header className="mobile-navbar">
        <button
          className="hamburger-btn"
          onClick={() => setIsSidebarOpen(prev => !prev)}
        >
          {isSidebarOpen
            ? <X size={35} className="svg-icon" />
            : <Menu size={20} className="svg-icon" />
          }
        </button>
        <img
          src={logoSrc}
          alt={CLIENT_SETUP.branding.logoAlt}
          className="mobile-logo"
        />
      </header>

      {/* Overlay semitransparente */}
      {isSidebarOpen && (
        <div
          className="overlay"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${isSidebarOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
        <button
          type="button"
          className="sidebar-collapse-button"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Expandir menú" : "Colapsar menú"}
          title={isCollapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
        {/* Botón “Cerrar” en mobile */}
        {/* <button
          className="close-btn"
          onClick={() => setIsSidebarOpen(false)}
        >
          <CloseIcon width={40} height={40} fill="#FAFAFA" />
        </button> */}

        {/* Logo cliente */}
        <div className="sidebar-logo">
          <img
            src={logoSrc}
            alt={CLIENT_SETUP.branding.logoAlt}
            className="logo"
          />
          <div className="menu-divider" />
        </div>

        {/* Menú */}
        <nav className="sidebar-menu">
          <h3 className="menu-title">MENÚ</h3>
          <ul className="menu-list">
            {
              // SIDEBAR ADMIN
              isAdmin ? (
                <>
                  <Link
                    to={inicioAdminPath}
                    className={`menu-link ${location.pathname === inicioAdminPath
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item" title="Inicio">
                      <Home className="icon" />{" "}
                      Inicio
                    </li>
                  </Link>
                  <Link
                    to="/admin/turnos"
                    className={`menu-link ${location.pathname ===
                      "/admin/turnos"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item" title="Turnos">
                      <Calendar className="icon" />{" "}
                      Turnos
                    </li>
                  </Link>
                  <Link
                    to="/admin/clases-actividades"
                    className={`menu-link ${location.pathname ===
                      "/admin/clases-actividades"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item" title="Clases y Actividades">
                      <Activity className="icon" />{" "}
                      Clases y Actividades
                    </li>
                  </Link>
                  <Link
                    to="/admin/usuarios"
                    className={`menu-link ${location.pathname === "/admin/usuarios"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item" title="Usuarios">
                      <Users className="icon" />{" "}
                      Usuarios
                    </li>
                  </Link>
                  <Link
                    to="/admin/grupos-usuarios"
                    className={`menu-link ${location.pathname === "/admin/grupos-usuarios"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <UserCog className="icon" />{" "}
                      Grupos de Usuarios
                    </li>
                  </Link>
                  <Link
                    to="/admin/ejercicios"
                    className={`menu-link ${location.pathname === "/admin/ejercicios"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <Dumbbell className="icon" />{" "}
                      Ejercicios
                    </li>
                  </Link>
                  <Link
                    to="/admin/asignar-rutinas"
                    className={`menu-link ${location.pathname === "/admin/asignar-rutinas" ? "active" : ""
                      }`}
                  >
                    <li className="menu-item">
                      <FilePenLine className="icon" /> Asignar Rutinas
                    </li>
                  </Link>
                  <Link
                    to="/admin/rutinas-asignadas"
                    className={`menu-link ${location.pathname === "/admin/rutinas-asignadas" ? "active" : ""
                      }`}
                  >
                    <li className="menu-item">
                      <FilePenLine className="icon" /> Rutinas Asignadas
                    </li>
                  </Link>
                  <Link
                    to="/admin/rutinas"
                    className={`menu-link ${location.pathname === "/admin/rutinas"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <Notebook className="icon" />{" "}
                      Rutinas Recomendadas
                    </li>
                  </Link>
                  <Link
                    to="/admin/planes"
                    className={`menu-link ${location.pathname === "/admin/planes"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <FileText className="icon" />{" "}
                      Planes
                    </li>
                  </Link>
                  <Link
                    to="/admin/cuotas"
                    className={`menu-link ${location.pathname === "/admin/cuotas"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <DollarSign className="icon" />{" "}
                      Cuotas
                    </li>
                  </Link>
                  {/* Salidas de dinero: información financiera del negocio, sólo admin. */}
                  {!esRecep && (
                    <Link
                      to="/admin/salidas-dinero"
                      className={`menu-link ${location.pathname === "/admin/salidas-dinero"
                        ? "active"
                        : ""
                        }`}
                    >
                      <li className="menu-item">
                        <TrendingDown className="icon" />{" "}
                        Salidas de dinero
                      </li>
                    </Link>
                  )}
                  <Link
                    to="/admin/ingreso"
                    className={`menu-link ${location.pathname === "/admin/ingreso"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <ScanLine className="icon" />{" "}
                      Ingreso
                    </li>
                  </Link>
                  <Link
                    to="/admin/asistencias"
                    className={`menu-link ${location.pathname === "/admin/asistencias"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <ClipboardCheck className="icon" />{" "}
                      Asistencias
                    </li>
                  </Link>
                  <Link
                    to="/admin/predictor-bajas"
                    className={`menu-link ${location.pathname === "/admin/predictor-bajas"
                      ? "active"
                      : ""
                      }`}
                  >
                    <li className="menu-item">
                      <AlertTriangle className="icon" />{" "}
                      Riesgo de baja
                    </li>
                  </Link>
                </>
              )
                // SIDEBAR ENTRENADOR 
                : isEntrenador ? (
                  <>
                    <Link
                      to="/entrenador/inicio"
                      className={`menu-link ${location.pathname === "/entrenador/inicio" ? "active" : ""
                        }`}
                    >
                      <li className="menu-item">
                        <Home className="icon" /> Inicio
                      </li>
                    </Link>
                    {/* <Link
                      to="/entrenador/turnos"
                      className={`menu-link ${location.pathname === "/entrenador/turnos"
                        ? "active"
                        : ""
                        }`}
                    >
                      <li className="menu-item">
                        <CalendarCheck className="icon" /> Mis turnos
                      </li>
                    </Link> */}
                    <Link
                      to="/entrenador/turnos"
                      className={`menu-link ${location.pathname === "/entrenador/turnos"
                        ? "active"
                        : ""
                        }`}
                    >
                      <li className="menu-item">
                        <CalendarCheck className="icon" /> Turnos
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/asignar-rutinas"
                      className={`menu-link ${location.pathname === "/entrenador/asignar-rutinas" ? "active" : ""
                        }`}
                    >
                      <li className="menu-item">
                        <FilePenLine className="icon" /> Asignar Rutinas
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/rutinas-asignadas"
                      className={`menu-link ${location.pathname === "/entrenador/rutinas-asignadas" ? "active" : ""
                        }`}
                    >
                      <li className="menu-item">
                        <Notebook className="icon" /> Rutinas asignadas
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/ejercicios"
                      className={`menu-link ${location.pathname === "/entrenador/ejercicios"
                        ? "active"
                        : ""
                        }`}
                    >
                      <li className="menu-item">
                        <Dumbbell className="icon" />{" "}
                        Ejercicios
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/crear-usuario"
                      className={`menu-link ${location.pathname === "/admin/crear-usuario"
                        ? "active"
                        : ""
                        }`}
                    >
                      <li className="menu-item">
                        <UserPlus className="icon" />{" "}
                        Crear usuario
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/usuarios"
                      className={`menu-link ${location.pathname === "/entrenador/usuarios" ? "active" : ""
                        }`}
                    >
                      <li className="menu-item">
                        <Users className="icon" /> Usuarios
                      </li>
                    </Link>
                    <Link
                      to="/entrenador/clases-actividades"
                      className={`menu-link ${location.pathname === "/entrenador/clases-actividades" ? "active" : ""
                        }`}
                    >
                      <li className="menu-item">
                        <Activity className="icon" /> Clases y actividades
                      </li>
                    </Link>
                  </>
                )
                  // SIDEBAR ALUMNO
                  : (
                    <>
                      <Link
                        to="/alumno/inicio"
                        className={`menu-link ${location.pathname === "/alumno/inicio"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Home className="icon" />{" "}
                          Inicio
                        </li>
                      </Link>
                      <Link
                        to="/alumno/turnos"
                        className={`menu-link ${location.pathname === "/alumno/turnos"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <CalendarCheck className="icon" /> Mis turnos
                        </li>
                      </Link>
                      <Link
                        to="/alumno/agendar-turno"
                        className={`menu-link ${location.pathname ===
                          "/alumno/agendar-turno"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <CalendarPlus className="icon" /> Agendar turno
                        </li>
                      </Link>
                      <Link
                        to="/alumno/clases-actividades"
                        className={`menu-link ${location.pathname ===
                          "/alumno/clases-actividades"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Activity className="icon" />{" "}
                          Clases y actividades
                        </li>
                      </Link>
                      <Link
                        to="/alumno/mi-rutina"
                        className={`menu-link ${location.pathname === "/alumno/mi-rutina"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Notebook className="icon" /> Mi plan de entrenamiento
                        </li>
                      </Link>
                      <Link
                        to="/alumno/ejercicios"
                        className={`menu-link ${location.pathname === "/alumno/ejercicios"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Dumbbell className="icon" />{" "}
                          Ejercicios
                        </li>
                      </Link>
                      <Link
                        to="/alumno/medicion-resultados"
                        className={`menu-link ${location.pathname ===
                          "/alumno/medicion-resultados"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Activity className="icon" /> Medición
                          de ejercicios
                        </li>
                      </Link>
                      <Link
                        to="/alumno/rutinas-recomendadas"
                        className={`menu-link ${location.pathname ===
                          "/alumno/rutinas-recomendadas"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <Star className="icon" /> Rutinas
                          recomendadas
                        </li>
                      </Link>
                      <Link
                        to="/alumno/cuotas"
                        className={`menu-link ${location.pathname ===
                          "/alumno/cuotas"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <DollarSign className="icon" /> Cuotas
                        </li>
                      </Link>
                      <Link
                        to="/alumno/mis-asistencias"
                        className={`menu-link ${location.pathname === "/mis-asistencias" || location.pathname === "/alumno/mis-asistencias"
                          ? "active"
                          : ""
                          }`}
                      >
                        <li className="menu-item">
                          <ClipboardCheck className="icon" /> Mis asistencias
                        </li>
                      </Link>
                    </>
                  )}
          </ul>

          <div className="profile-section">
            <h3 className="profile-title">PERFIL</h3>
            <ul className="menu-list">
              <Link
                to={changePasswordPath}
                className={`menu-link ${location.pathname === changePasswordPath ? "active" : ""
                  }`}
              >
                <li className="menu-item">
                  <Settings className="icon" /> Cambiar contraseña
                </li>
              </Link>

              <li className="menu-item">
                <ThemeToggle />
              </li>

              <li className="menu-item logout" onClick={handleLogoutClick}>
                <LogOut className="icon" /> Cerrar sesión
              </li>
            </ul>
          </div>

          <div className="sidebar-footer">
            <img
              src={logoSrc}
              alt={CLIENT_SETUP.branding.logoAlt}
              className="logo"
            />
          </div>
        </nav>

        <ConfirmationPopup
          isOpen={isPopupOpen}
          onClose={handleLogoutCancel}
          onConfirm={handleLogoutConfirm}
          message="¿Estás seguro de que desea cerrar sesión?"
        />
      </aside >
    </>
  );
};

export default SidebarMenu;
