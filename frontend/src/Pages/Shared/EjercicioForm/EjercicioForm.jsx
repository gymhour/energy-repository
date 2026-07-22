import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiClient from '../../../axiosConfig';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import SecondaryButton from '../../../Components/utils/SecondaryButton/SecondaryButton';
import './EjercicioForm.css';

const YT_REGEX = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i;

const EjercicioForm = ({ fromAdmin, fromEntrenador }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Nuevos campos
  const [musculosText, setMusculosText] = useState('');      // textarea con líneas "- Piernas"
  const [equipamientoText, setEquipamientoText] = useState(''); // textarea con líneas "- Rack"

  // Helpers para convertir entre textarea (líneas con "- ") y string separado por " -"
  const textareaToDashSeparated = (text) => {
    // Cada línea comienza opcionalmente con "- "
    const items = text
      .split('\n')
      .map(l => l.trim().replace(/^-\s?/, '').trim())
      .filter(Boolean);
    // Devuelve " -Item1 -Item2"
    return items.length ? `-${items.join(' -')}` : '';
  };

  const dashSeparatedToTextarea = (str) => {
    // Ej: "- Piernas -Gemelos" -> ["Piernas","Gemelos"] -> "- Piernas\n- Gemelos"
    if (!str) return '';
    const items = str
      .split('-')
      .map(s => s.trim())
      .filter(Boolean);
    return items.map(i => `- ${i}`).join('\n');
  };

  // Si es edición, cargar datos
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get(`/ejercicios/${id}`);
        setNombre(data.nombre || '');
        setDescripcion(data.descripcion || '');
        setYoutubeUrl(data.youtubeUrl || '');
        setInstrucciones(data.instrucciones || '');

        // Normalizar a textarea
        setMusculosText(dashSeparatedToTextarea(data.musculos || ''));
        setEquipamientoText(dashSeparatedToTextarea(data.equipamiento || ''));

        setImagePreview(data.mediaUrl || null);
      } catch (err) {
        console.error(err);
        toast.error('No se pudo cargar el ejercicio.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEditing]);


  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const youtubeId = useMemo(() => {
    const match = youtubeUrl.match(YT_REGEX);
    return match ? match[1] : null;
  }, [youtubeUrl]);

  const isYouTubeValid = useMemo(() => {
    if (!youtubeUrl.trim()) return true; // opcional
    return YT_REGEX.test(youtubeUrl.trim());
  }, [youtubeUrl]);

  const basePath = useMemo(() => {
    return fromAdmin
      ? '/admin/ejercicios'
      : fromEntrenador
        ? '/entrenador/ejercicios'
        : '/ejercicios';
  }, [fromAdmin, fromEntrenador]);

  const handleSubmit = async (evt) => {
    evt.preventDefault();

    // Validaciones mínimas
    if (!nombre.trim()) {
      toast.error('El nombre es requerido.');
      return;
    }
    if (!isYouTubeValid) {
      toast.error('La URL de YouTube no es válida.');
      return;
    }

    setLoading(true);
    try {
      const payload = new FormData();
      payload.append('nombre', nombre);
      payload.append('descripcion', descripcion);
      payload.append('youtubeUrl', youtubeUrl);
      payload.append('instrucciones', instrucciones);

      // nuevas propiedades mapeadas al formato que espera el backend
      payload.append('musculos', textareaToDashSeparated(musculosText));
      payload.append('equipamiento', textareaToDashSeparated(equipamientoText));

      if (imageFile) payload.append('imagen', imageFile);

      if (isEditing) {
        await apiClient.put(`/ejercicios/${id}`, payload);
        toast.success('Ejercicio actualizado correctamente.');
      } else {
        await apiClient.post('/ejercicios', payload);
        toast.success('Ejercicio creado correctamente.');
      }
      navigate(basePath);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar ejercicio. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='page-layout'>
      <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
      {loading && <LoaderFullScreen />}
      <div className='content-layout'>
        <div className='ejercicio-form-page'>
          <div className='ejercicio-form-header'>
            <h2 className='ejercicio-form-title'>
              {isEditing ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
            </h2>
          </div>

          <form className='exercise-form' encType="multipart/form-data" onSubmit={handleSubmit}>
          <div className='form-input-ctn exercise-field'>
            <label>Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
            <CustomInput
              type='text'
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder='Nombre del ejercicio'
              required
              disabled={loading}
            />
          </div>

          <div className='form-input-ctn exercise-field'>
            <label>Descripción</label>
            <CustomInput
              type='text'
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder='Descripción (opcional)'
              disabled={loading}
            />
          </div>

          <div className='form-input-ctn exercise-field exercise-field-full'>
            <label>URL de YouTube</label>
            <CustomInput
              type='text'
              value={youtubeUrl}
              onChange={e => setYoutubeUrl(e.target.value)}
              placeholder='https://www.youtube.com/watch?v=...'
              disabled={loading}
            />
            {!isYouTubeValid && (
              <small className="field-error">Pegá un enlace de YouTube válido.</small>
            )}
          </div>

          {youtubeId && (
            <div className='youtube-preview exercise-field-full'>
              <iframe
                title='YouTube preview'
                width='560'
                height='315'
                src={`https://www.youtube.com/embed/${youtubeId}`}
                frameBorder='0'
                allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                allowFullScreen
              />
            </div>
          )}

          <div className='form-input-ctn exercise-field exercise-field-full'>
            <label>Instrucciones</label>
            <textarea
              value={instrucciones}
              onChange={e => setInstrucciones(e.target.value)}
              placeholder='- Mantener la espalda recta
- Bajar hasta que los muslos estén paralelos al suelo
- Subir controlado'
              className='custom-textarea'
              rows={5}
              disabled={loading}
            />
            <small className="field-hint">Sugerencia: una instrucción por línea, podés empezar con “- ”.</small>
          </div>

          <div className='form-input-ctn exercise-field'>
            <label>Músculos trabajados</label>
            <textarea
              value={musculosText}
              onChange={e => setMusculosText(e.target.value)}
              placeholder='- Piernas
- Gemelos'
              className='custom-textarea'
              rows={4}
              disabled={loading}
            />
            <small className="field-hint">Una línea por músculo (se guardan como “- Músculo1 -Músculo2”).</small>
          </div>

          <div className='form-input-ctn exercise-field'>
            <label>Equipamiento</label>
            <textarea
              value={equipamientoText}
              onChange={e => setEquipamientoText(e.target.value)}
              placeholder='- Rack
- Mancuernas'
              className='custom-textarea'
              rows={3}
              disabled={loading}
            />
            <small className="field-hint">Una línea por ítem (se guarda como “- Rack -Mancuernas”).</small>
          </div>

          <div className='form-input-ctn exercise-field exercise-field-full'>
            <label>Imagen</label>
            <input
              type='file'
              accept='image/*'
              onChange={handleFileChange}
              disabled={loading}
            />
            {imagePreview && (
              <div className='image-preview-ctn'>
                <img src={imagePreview} alt='preview' className='image-preview' />
                <SecondaryButton onClick={clearImage} text="Quitar imagen"/>
              </div>
            )}
          </div>

          <div className='ejercicio-form-actions'>
            <SecondaryButton
              text='Cancelar'
              linkTo={basePath}
              disabled={loading}
            />
            <PrimaryButton
              type='submit'
              text={isEditing ? 'Actualizar ejercicio' : 'Crear ejercicio'}
              disabled={loading}
              onClick={handleSubmit}
            />
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default EjercicioForm;
