import React, { useState, useEffect } from 'react'
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu'
import apiService from '../../../services/apiService'
import './PlanesAdmin.css'
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton'
import { Copy, Edit, Trash2, X } from 'lucide-react'
import CustomInput from '../../../Components/utils/CustomInput/CustomInput'
import CustomDropdown from '../../../Components/utils/CustomDropdown/CustomDropdown'
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen'
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp'
import { toast } from 'react-toastify'

const PlanesAdmin = () => {
  const [planes, setPlanes] = useState([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoPrecio, setNuevoPrecio] = useState('')
  const [nuevaDesc, setNuevaDesc] = useState('')
  const [duracion, setDuracion] = useState('MENSUAL')
  const [sesionesTotales, setSesionesTotales] = useState('')
  const [sesionesGracia, setSesionesGracia] = useState('')
  const [requiereTurno, setRequiereTurno] = useState(true)
  const [toDelete, setToDelete] = useState(null)
  const [editingPlan, setEditingPlan] = useState(null)

  const fetchPlanes = async () => {
    setLoading(true)
    try {
      const data = await apiService.getPlanes()
      setPlanes(data)
    } catch (error) {
      console.error('Error al obtener planes:', error)
      toast.error('No se pudieron cargar los planes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlanes()
  }, [])

  // Abrir modal para crear
  const handleCreate = () => {
    setEditingPlan(null)
    setNuevoNombre('')
    setNuevoPrecio('')
    setNuevaDesc('')
    setDuracion('MENSUAL')
    setSesionesTotales('')
    setSesionesGracia('')
    setRequiereTurno(true)
    setShowModal(true)
  }

  // Abrir modal para editar
  const handleEdit = (plan) => {
    setEditingPlan(plan)
    setNuevoNombre(plan.nombre)
    setNuevoPrecio(plan.precio)
    setNuevaDesc(plan.desc || '')
    setDuracion(plan.duracion || 'MENSUAL')
    setSesionesTotales(plan.sesionesTotales ?? '')
    setSesionesGracia(plan.sesionesGracia ?? '')
    setRequiereTurno(plan.requiereTurno !== false)
    setShowModal(true)
  }

  // Cerrar modal y reset
  const handleClose = () => {
    setEditingPlan(null)
    setNuevoNombre('')
    setNuevoPrecio('')
    setNuevaDesc('')
    setDuracion('MENSUAL')
    setSesionesTotales('')
    setSesionesGracia('')
    setRequiereTurno(true)
    setShowModal(false)
  }

  // Crear o actualizar plan
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const body = {
      nombre: nuevoNombre,
      precio: Number(nuevoPrecio),
      desc: nuevaDesc,
      duracion,
      sesionesTotales: Number(sesionesTotales || 0),
      sesionesGracia: Number(sesionesGracia || 0),
      requiereTurno
    }
    try {
      if (editingPlan) {
        await apiService.putPlanes(editingPlan.ID_Plan, body)
        toast.success('Plan actualizado correctamente.')
      } else {
        await apiService.postPlanes(body)
        toast.success('Plan creado correctamente.')
      }
      handleClose()
      await fetchPlanes()
    } catch (error) {
      console.error('Error al guardar plan:', error)
      toast.error('Error al guardar plan. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  // Abrir popup de confirmación
  const openDeletePopup = (plan) => setToDelete(plan)
  const closeDeletePopup = () => setToDelete(null)

  // Confirmar eliminación
  const confirmDelete = async () => {
    if (!toDelete) return
    setLoading(true)
    try {
      await apiService.deletePlanes(toDelete.ID_Plan)
      toast.success(`Plan "${toDelete.nombre}" eliminado correctamente.`)
      await fetchPlanes()
    } catch (error) {
      console.error('Error al eliminar plan:', error)
      toast.error('Error al eliminar plan. Intente nuevamente.')
    } finally {
      setLoading(false)
      closeDeletePopup()
    }
  }

  const handleCopyPlanId = async (planId) => {
    try {
      await navigator.clipboard.writeText(String(planId))
      toast.success('ID del plan copiado.')
    } catch (error) {
      console.error('Error al copiar ID del plan:', error)
      toast.error('No se pudo copiar el ID del plan.')
    }
  }

  return (
    <div className="page-layout">
      <SidebarMenu isAdmin={true} />
      {loading && <LoaderFullScreen />}
      <div className="content-layout">
        <div className="planes-header">
          <h2>Administración de Planes</h2>
          <PrimaryButton text='Nuevo plan' onClick={handleCreate} />
        </div>

        {!loading && (
          <div className="planes-grid">
            {planes.map((plan) => (
              <div key={plan.ID_Plan} className="plan-card">
                <div className="plan-card-header">
                  <h2 className="plan-name">{plan.nombre}</h2>
                  <div className="plan-id-wrap">
                    <span className="plan-id">ID: {plan.ID_Plan}</span>
                    <button
                      type="button"
                      className="plan-copy-id"
                      onClick={() => handleCopyPlanId(plan.ID_Plan)}
                      aria-label={`Copiar ID del plan ${plan.nombre}`}
                      title="Copiar ID"
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                </div>
                <p className="plan-desc">{plan.desc || 'Sin descripción'}</p>
                <p className="plan-price">${plan.precio.toLocaleString()}</p>
                <p className="plan-desc">
                  {plan.duracion || 'MENSUAL'} · {plan.sesionesTotales || 0} ses. totales · {plan.sesionesGracia || 0} gracia
                </p>
                <div className="plan-actions">
                  <div onClick={() => handleEdit(plan)} style={{ cursor: 'pointer' }}>
                    <Edit width={20} height={20} />
                  </div>
                  <div onClick={() => openDeletePopup(plan)} style={{ cursor: 'pointer' }}>
                    <Trash2 width={20} height={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de crear/editar */}
        {showModal && (
          <div
            className="plan-modal-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) handleClose()
            }}
          >
            <div className="plan-modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">
              <form onSubmit={handleSubmit} className="plan-form">
                <div className="plan-modal-header">
                  <div>
                    <h2 id="plan-modal-title">{editingPlan ? 'Editar plan' : 'Nuevo plan'}</h2>
                    <span>{editingPlan ? 'Actualizá los datos del plan seleccionado.' : 'Definí el nombre, precio y condiciones del plan.'}</span>
                  </div>
                  <button type="button" className="plan-modal-close" onClick={handleClose} aria-label="Cerrar modal">
                    <X size={18} />
                  </button>
                </div>

                <div className="plan-form-grid">
                  <div className="plan-form-input-container">
                    <label>Nombre</label>
                    <CustomInput
                      type="text"
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      required
                      width="100%"
                    />
                  </div>
                  <div className="plan-form-input-container">
                    <label>Precio</label>
                    <CustomInput
                      type="number"
                      value={nuevoPrecio}
                      onChange={(e) => setNuevoPrecio(e.target.value)}
                      required
                      width="100%"
                    />
                  </div>
                  <div className="plan-form-input-container plan-form-field-wide">
                    <label>Descripción</label>
                    <CustomInput
                      placeholder="Descripción (opcional)"
                      value={nuevaDesc}
                      onChange={(e) => setNuevaDesc(e.target.value)}
                      width="100%"
                    />
                  </div>
                  <div className="plan-form-input-container">
                    <label>Duración</label>
                    <CustomDropdown
                      options={[
                        { value: 'SEMANAL', label: 'Semanal' },
                        { value: 'MENSUAL', label: 'Mensual' },
                        { value: 'TRIMESTRAL', label: 'Trimestral' },
                        { value: 'SEMESTRAL', label: 'Semestral' },
                        { value: 'ANUAL', label: 'Anual' },
                      ]}
                      value={duracion}
                      onChange={(e) => setDuracion(e.target.value)}
                      placeholderOption={null}
                      name="duracion"
                      id="duracion"
                    />
                  </div>
                  <div className="plan-form-input-container">
                    <label>Sesiones totales</label>
                    <CustomInput
                      type="number"
                      min="0"
                      value={sesionesTotales}
                      onChange={(e) => setSesionesTotales(e.target.value)}
                      width="100%"
                    />
                  </div>
                  <div className="plan-form-input-container">
                    <label>Sesiones de gracia</label>
                    <CustomInput
                      type="number"
                      min="0"
                      value={sesionesGracia}
                      onChange={(e) => setSesionesGracia(e.target.value)}
                      width="100%"
                    />
                  </div>
                </div>

                <label className="plan-toggle-row">
                  <span className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={requiereTurno}
                      onChange={(e) => setRequiereTurno(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </span>
                  <span>Requiere turno para asistir</span>
                </label>

                <div className="plan-modal-actions">
                  <button type="button" className="plan-secondary-button" onClick={handleClose}>
                    Cancelar
                  </button>
                  <button type="submit" className="primary-button">
                    {editingPlan ? 'Actualizar' : 'Crear'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Popup de confirmación */}
        {toDelete && (
          <ConfirmationPopup
            isOpen={!!toDelete}
            message={`¿Está seguro que quiere eliminar el plan "${toDelete.nombre}"? Esta acción no se puede deshacer.`}
            onClose={closeDeletePopup}
            onConfirm={confirmDelete}
          />
        )}
      </div>
    </div>
  )
}

export default PlanesAdmin
