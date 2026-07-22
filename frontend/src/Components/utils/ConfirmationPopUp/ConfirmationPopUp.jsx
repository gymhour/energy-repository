import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import "./ConfirmationPopup.css";
import CustomDropdown from "../CustomDropdown/CustomDropdown";

const ConfirmationPopup = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  options = [],
  placeholderOption = "Selecciona una opción",
  children,
}) => {
  const [selectedOption, setSelectedOption] = useState("");

  useEffect(() => {
    if (!isOpen) setSelectedOption("");
  }, [isOpen]);

  // Cerrar con ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const estadoBool = selectedOption === "Activar";
    onConfirm?.(estadoBool);
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains("confirmation-popup-overlay")) {
      onClose?.();
    }
  };

  return ReactDOM.createPortal(
    <div className="confirmation-popup-overlay" onClick={handleOverlayClick}>
      <div className="confirmation-popup" role="dialog" aria-modal="true">
        <p>{message}</p>

        {options.length > 0 && (
          <div className="confirmation-popup-dropdown" style={{ margin: "16px 0px" }}>
            <CustomDropdown
              options={options}
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
              placeholderOption={placeholderOption}
            />
          </div>
        )}

        {children}

        <div className="confirmation-popup-buttons">
          <div className="popup-btns-ctn">
            <button onClick={onClose} className="popup-cancel-button">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              className="popup-confirm-button"
              disabled={options.length > 0 && !selectedOption}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmationPopup;
