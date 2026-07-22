import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Check, ChevronDown, Edit, Eye, EyeOff, Plus, Search, Trash2, Users, X } from 'lucide-react';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import ConfirmationPopup from '../../../Components/utils/ConfirmationPopUp/ConfirmationPopUp';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiService from '../../../services/apiService';
import './GruposUsuarios.css';

const emptyForm = {
  ID_GrupoUsuario: null,
  nombre: '',
  descripcion: '',
  estado: true,
  miembros: []
};

const usuarioToMember = (usuario) => ({
  ID_Usuario: usuario.ID_Usuario,
  nombre: usuario.nombre || '',
  apellido: usuario.apellido || '',
  dni: usuario.dni || ''
});

const GruposUsuarios = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState([]);
  const [usuarioOptions, setUsuarioOptions] = useState([]);
  const [usuarioSearch, setUsuarioSearch] = useState('');
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const [selectedMemberSearch, setSelectedMemberSearch] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [assignedMembersOpen, setAssignedMembersOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const gruposResp = await apiService.getGruposUsuarios();
      setGrupos(Array.isArray(gruposResp?.grupos) ? gruposResp.grupos : []);
    } catch (error) {
      toast.error('No se pudieron cargar los grupos de usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const term = usuarioSearch.trim();
    let isCurrentRequest = true;

    if (term.length < 2) {
      setUsuarioOptions([]);
      setUsuariosLoading(false);
      return () => { isCurrentRequest = false; };
    }

    setUsuariosLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await apiService.getAllUsuarios({
          page: 1,
          take: 20,
          tipo: 'cliente',
          estado: true,
          search: term
        });

        if (!isCurrentRequest) return;
        const usuarios = Array.isArray(response?.data)
          ? response.data.map(usuarioToMember)
          : [];
        setUsuarioOptions(usuarios);
      } catch (error) {
        if (isCurrentRequest) {
          setUsuarioOptions([]);
          toast.error('No se pudieron buscar usuarios');
        }
      } finally {
        if (isCurrentRequest) setUsuariosLoading(false);
      }
    }, 300);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timeoutId);
    };
  }, [usuarioSearch]);

  const selectedMemberIds = useMemo(() => (
    new Set(form.miembros.map(miembro => Number(miembro.ID_Usuario)))
  ), [form.miembros]);

  const filteredSelectedMembers = useMemo(() => {
    const term = selectedMemberSearch.trim().toLowerCase();
    if (!term) return form.miembros;

    return form.miembros.filter(miembro => (
      `${miembro.nombre} ${miembro.apellido} ${miembro.dni}`.toLowerCase().includes(term)
    ));
  }, [form.miembros, selectedMemberSearch]);

  const availableSearchResults = useMemo(() => (
    usuarioOptions.filter(usuario => !selectedMemberIds.has(Number(usuario.ID_Usuario)))
  ), [selectedMemberIds, usuarioOptions]);

  const resetForm = () => {
    setForm(emptyForm);
    setSelectedMemberSearch('');
    setUsuarioSearch('');
    setUsuarioOptions([]);
    setAssignedMembersOpen(false);
  };

  const openCreateGrupo = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const editGrupo = (grupo) => {
    setForm({
      ID_GrupoUsuario: grupo.ID_GrupoUsuario,
      nombre: grupo.nombre || '',
      descripcion: grupo.descripcion || '',
      estado: grupo.estado !== false,
      miembros: (grupo.miembros || []).map(m => {
        const usuario = m.usuario || m;
        return usuarioToMember(usuario);
      }).filter(m => m.ID_Usuario)
    });
    setSelectedMemberSearch('');
    setUsuarioSearch('');
    setUsuarioOptions([]);
    setAssignedMembersOpen(false);
    setIsFormOpen(true);
  };

  const addMember = (usuario) => {
    if (!usuario?.ID_Usuario || selectedMemberIds.has(Number(usuario.ID_Usuario))) return;
    setForm(prev => ({
      ...prev,
      miembros: [...prev.miembros, usuario]
    }));
  };

  const addVisibleMembers = () => {
    if (availableSearchResults.length === 0) return;
    setForm(prev => {
      const currentIds = new Set(prev.miembros.map(miembro => Number(miembro.ID_Usuario)));
      const newMembers = availableSearchResults.filter(usuario => !currentIds.has(Number(usuario.ID_Usuario)));
      return {
        ...prev,
        miembros: [...prev.miembros, ...newMembers]
      };
    });
  };

  const removeMember = (usuarioId) => {
    setForm(prev => ({
      ...prev,
      miembros: prev.miembros.filter(miembro => Number(miembro.ID_Usuario) !== Number(usuarioId))
    }));
  };

  const clearMembers = () => {
    setForm(prev => ({
      ...prev,
      miembros: []
    }));
    setSelectedMemberSearch('');
  };

  const toggleExpandedGroup = (grupoId) => {
    setExpandedGroupId(prev => (prev === grupoId ? null : grupoId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.nombre.trim()) {
      toast.error('Ingresá un nombre para el grupo');
      return;
    }

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      estado: form.estado,
      miembrosIds: form.miembros.map(m => Number(m.ID_Usuario)).filter(Boolean)
    };

    setSaving(true);
    try {
      if (form.ID_GrupoUsuario) {
        await apiService.updateGrupoUsuario(form.ID_GrupoUsuario, payload);
        toast.success('Grupo actualizado correctamente');
      } else {
        await apiService.createGrupoUsuario(payload);
        toast.success('Grupo creado correctamente');
      }
      closeFormModal();
      await loadData();
    } catch (error) {
      toast.error(error.message || 'No se pudo guardar el grupo');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await apiService.deleteGrupoUsuario(deleteId);
      toast.success('Grupo eliminado correctamente');
      setDeleteId(null);
      await loadData();
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar el grupo');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoaderFullScreen />;

  return (
    <div className="page-layout">
      <SidebarMenu isAdmin={true} isEntrenador={false} />
      <main className="content-layout grupos-usuarios-page">
        <header className="grupos-page-header">
          <h1>Grupos de usuarios</h1>
          <button type="button" className="primary-button grupos-new-button" onClick={openCreateGrupo}>
            Nuevo grupo
            <Plus size={16} />
          </button>
        </header>

        <section className="grupos-list-section">
          <div className="grupos-list-header">
            <h2>Grupos creados</h2>
            <span>{grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'}</span>
          </div>

          <div className="grupos-list">
            {grupos.length === 0 ? (
              <p className="grupos-empty">No hay grupos creados.</p>
            ) : grupos.map(grupo => (
              <article className="grupo-card" key={grupo.ID_GrupoUsuario}>
                <div className="grupo-card-header">
                  <div className="grupo-card-title">
                    <h3>{grupo.nombre}</h3>
                    {grupo.descripcion && <p>{grupo.descripcion}</p>}
                  </div>
                  <div className="grupo-actions">
                    <button type="button" onClick={() => editGrupo(grupo)} title="Editar grupo" aria-label={`Editar ${grupo.nombre}`}><Edit size={18} /></button>
                    <button type="button" onClick={() => toggleExpandedGroup(grupo.ID_GrupoUsuario)} title={expandedGroupId === grupo.ID_GrupoUsuario ? 'Ocultar usuarios' : 'Ver usuarios'} aria-label={`${expandedGroupId === grupo.ID_GrupoUsuario ? 'Ocultar' : 'Ver'} usuarios de ${grupo.nombre}`}>
                      {expandedGroupId === grupo.ID_GrupoUsuario ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                    <button type="button" onClick={() => setDeleteId(grupo.ID_GrupoUsuario)} title="Eliminar grupo" aria-label={`Eliminar ${grupo.nombre}`}><Trash2 size={18} /></button>
                  </div>
                </div>
                <div className="grupo-meta">
                  <span className={grupo.estado ? 'grupo-status active' : 'grupo-status inactive'}>
                    {grupo.estado ? 'Activo' : 'Inactivo'}
                  </span>
                  <span><Users size={16} /> {grupo.miembros?.length || 0} miembros</span>
                  <span>{grupo.rutinas?.length || 0} rutinas asignadas</span>
                </div>
                {expandedGroupId === grupo.ID_GrupoUsuario && (
                  <div className="grupo-roster">
                    {(grupo.miembros || []).length === 0 ? (
                      <p className="grupo-list-state">Este grupo no tiene usuarios asignados.</p>
                    ) : (
                      (grupo.miembros || []).map(m => {
                        const usuario = m.usuario || m;
                        return (
                          <div className="grupo-roster-row" key={usuario.ID_Usuario}>
                            <span>{usuario.nombre} {usuario.apellido}</span>
                            {usuario.dni && <small>DNI {usuario.dni}</small>}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>

      {isFormOpen && (
        <div
          className="grupo-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) closeFormModal();
          }}
        >
          <div className="grupo-modal" role="dialog" aria-modal="true" aria-labelledby="grupo-modal-title">
            <form className="grupo-form" onSubmit={handleSubmit}>
              <div className="grupo-form-header">
                <div>
                  <h2 id="grupo-modal-title">{form.ID_GrupoUsuario ? 'Editar grupo' : 'Nuevo grupo'}</h2>
                  <span>{form.miembros.length} {form.miembros.length === 1 ? 'usuario asignado' : 'usuarios asignados'}</span>
                </div>
                <button type="button" className="grupo-modal-close" onClick={closeFormModal} aria-label="Cerrar formulario">
                  <X size={18} />
                </button>
              </div>

              <div className="grupo-form-grid">
                <label className="grupo-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre del grupo"
                  />
                </label>

                <label className="grupo-field">
                  <span>Descripción</span>
                  <input
                    type="text"
                    value={form.descripcion}
                    onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Opcional"
                  />
                </label>

                <label className="grupo-toggle">
                  <input
                    type="checkbox"
                    checked={form.estado}
                    onChange={e => setForm(prev => ({ ...prev, estado: e.target.checked }))}
                  />
                  <span className="grupo-toggle-control" aria-hidden="true" />
                  <span>Activo</span>
                </label>
              </div>

              <section className="grupo-members-manager" aria-label="Asignación de usuarios">
                <div className="grupo-member-panel">
                  <div className="grupo-panel-header">
                    <div>
                      <h3>Agregar usuarios</h3>
                      <span>{usuarioSearch.trim().length >= 2 ? `${usuarioOptions.length} resultados` : 'Buscá por nombre, apellido o DNI'}</span>
                    </div>
                    {usuarioOptions.length > 0 && (
                      <button
                        type="button"
                        className="grupo-panel-action"
                        onClick={addVisibleMembers}
                        disabled={availableSearchResults.length === 0}
                      >
                        Agregar resultados
                      </button>
                    )}
                  </div>

                  <label className="grupo-search">
                    <Search size={16} />
                    <input
                      type="search"
                      value={usuarioSearch}
                      onChange={e => setUsuarioSearch(e.target.value)}
                      placeholder="Buscar usuarios"
                    />
                  </label>

                  <div className="grupo-user-list">
                    {usuariosLoading ? (
                      <p className="grupo-list-state">Buscando usuarios...</p>
                    ) : usuarioSearch.trim().length < 2 ? (
                      <p className="grupo-list-state">Ingresá al menos 2 caracteres.</p>
                    ) : usuarioOptions.length === 0 ? (
                      <p className="grupo-list-state">No se encontraron usuarios.</p>
                    ) : usuarioOptions.map(usuario => {
                      const isSelected = selectedMemberIds.has(Number(usuario.ID_Usuario));
                      return (
                        <div className="grupo-user-row" key={usuario.ID_Usuario}>
                          <div className="grupo-user-info">
                            <strong>{usuario.nombre} {usuario.apellido}</strong>
                            {usuario.dni && <span>DNI {usuario.dni}</span>}
                          </div>
                          <button
                            type="button"
                            className={isSelected ? 'grupo-user-added' : 'grupo-user-add'}
                            onClick={() => addMember(usuario)}
                            disabled={isSelected}
                            aria-label={isSelected ? `${usuario.nombre} ya pertenece al grupo` : `Agregar ${usuario.nombre} al grupo`}
                          >
                            {isSelected ? <Check size={16} /> : <Plus size={16} />}
                            {isSelected ? 'Agregado' : 'Agregar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grupo-assigned-dropdown">
                  <button
                    type="button"
                    className="grupo-assigned-trigger"
                    onClick={() => setAssignedMembersOpen(prev => !prev)}
                    aria-expanded={assignedMembersOpen}
                  >
                    <span>
                      <strong>Usuarios asignados</strong>
                      <small>{form.miembros.length} {form.miembros.length === 1 ? 'usuario' : 'usuarios'}</small>
                    </span>
                    <ChevronDown size={18} className={assignedMembersOpen ? 'open' : ''} />
                  </button>

                  {assignedMembersOpen && (
                    <div className="grupo-assigned-content">
                      <div className="grupo-assigned-toolbar">
                        <label className="grupo-search">
                          <Search size={16} />
                          <input
                            type="search"
                            value={selectedMemberSearch}
                            onChange={e => setSelectedMemberSearch(e.target.value)}
                            placeholder="Filtrar asignados"
                            disabled={form.miembros.length === 0}
                          />
                        </label>
                        {form.miembros.length > 0 && (
                          <button
                            type="button"
                            className="grupo-panel-action subtle"
                            onClick={clearMembers}
                          >
                            Vaciar
                          </button>
                        )}
                      </div>

                      <div className="grupo-user-list selected">
                        {form.miembros.length === 0 ? (
                          <p className="grupo-list-state">Todavía no hay usuarios asignados.</p>
                        ) : filteredSelectedMembers.length === 0 ? (
                          <p className="grupo-list-state">No hay coincidencias en asignados.</p>
                        ) : filteredSelectedMembers.map(usuario => (
                          <div className="grupo-user-row" key={usuario.ID_Usuario}>
                            <div className="grupo-user-info">
                              <strong>{usuario.nombre} {usuario.apellido}</strong>
                              {usuario.dni && <span>DNI {usuario.dni}</span>}
                            </div>
                            <button
                              type="button"
                              className="grupo-user-remove"
                              onClick={() => removeMember(usuario.ID_Usuario)}
                              aria-label={`Quitar ${usuario.nombre} del grupo`}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="grupo-form-actions">
                <button type="button" className="grupo-secondary-action" onClick={closeFormModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Guardando...' : form.ID_GrupoUsuario ? 'Actualizar grupo' : 'Crear grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationPopup
        isOpen={Boolean(deleteId)}
        message="¿Estás seguro que deseas eliminar este grupo?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
};

export default GruposUsuarios;
