import React, { useState } from 'react'
import '../../../App.css';
import './ChangePassword.css'
import SidebarMenu from '../../../Components/SidebarMenu/SidebarMenu';
import LoaderFullScreen from '../../../Components/utils/LoaderFullScreen/LoaderFullScreen';
import apiService from '../../../services/apiService';
import CustomInput from '../../../Components/utils/CustomInput/CustomInput';
import PrimaryButton from '../../../Components/utils/PrimaryButton/PrimaryButton';
import { toast } from 'react-toastify';

const ChangePassword = ({fromAdmin, fromEntrenador}) => {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        oldPassword: '',
        newPassword: '',
        repeatNewPassword: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.oldPassword || !formData.newPassword || !formData.repeatNewPassword) {
            console.log("Campos incompletos")
            return toast.error('Por favor, completa todos los campos.');
        }
        if (formData.newPassword !== formData.repeatNewPassword) {
            console.log("Las contraseñas no coinciden.")
            return toast.error('Las contraseñas nuevas no coinciden');
        }

        try {
            setLoading(true);
            await apiService.changePassword({
                currentPassword: formData.oldPassword,
                newPassword: formData.newPassword
            });
            toast.success('Contraseña actualizada con éxito');
            setFormData({ oldPassword: '', newPassword: '', repeatNewPassword: '' });
        } catch (err) {
            toast.error(err.message || 'Ocurrió un error al cambiar la contraseña');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className='page-layout'>
            {loading && <LoaderFullScreen />}
            <SidebarMenu isAdmin={fromAdmin} isEntrenador={fromEntrenador} />
            <div className='content-layout'>
                <div className="mi-rutina-title">
                    <h2>Cambiar contraseña</h2>
                </div>
                <div className="cambiar-contrasena-campos">
                    <CustomInput
                        type='password'
                        placeholder="Contraseña anterior"
                        value={formData.oldPassword}
                        onChange={(e) =>
                            setFormData({ ...formData, oldPassword: e.target.value })
                        }
                    />
                    <CustomInput
                        type='password'
                        placeholder="Contraseña nueva"
                        value={formData.newPassword}
                        onChange={(e) =>
                            setFormData({ ...formData, newPassword: e.target.value })
                        }
                    />
                    <CustomInput
                        type='password'
                        placeholder="Repetir la contraseña nueva"
                        value={formData.repeatNewPassword}
                        onChange={(e) =>
                            setFormData({ ...formData, repeatNewPassword: e.target.value })
                        }
                    />
                    <PrimaryButton
                        text="Cambiar contraseña"
                        linkTo="#"
                        onClick={(e) => handleSubmit(e)}
                    />
                </div>
            </div>
        </div>
    )
}

export default ChangePassword