// ============================================================================
//  CONFIGURACION POR CLIENTE
//  Este es el UNICO archivo que hay que tocar en el frontend para un cliente
//  nuevo. Editar los valores de abajo (y, si aplica, reemplazar los logos
//  importados mas abajo) y listo. Por defecto usa el branding de GymHour.
// ============================================================================

// Logo GymHour por defecto (branding del template).
// Para un cliente real, reemplazar estos imports por su logo:
//   - `logo`: version para fondo OSCURO (dark theme)
//   - `logoLight`: version para fondo CLARO (light theme)
// Si el cliente solo tiene una variante, apuntar ambas al mismo archivo.
import logoDark from './assets/gymhour/logo_gymhour_text_right.png';
import logoLight from './assets/gymhour/logo_gymhour_black_text_right.png';

const CLIENT_SETUP = {
  // URL publica de la API del cliente.
  // Si el hosting permite variables de entorno, se puede setear REACT_APP_API_URL
  // y tiene prioridad sobre este valor.
  apiUrl: process.env.REACT_APP_API_URL || 'http://localhost:3000',

  branding: {
    name: 'GymHour',
    logoAlt: 'GymHour',
    // Logos (login + sidebar). Se elige la variante segun el tema activo.
    logo: logoDark,
    logoLight: logoLight,
    // Colores principales. Se inyectan como CSS variables al iniciar la app.
    theme: {
      primaryColor: '#DB4632',
      primaryColorHover: '#E35D4B',
      backgroundHoverColor: '#DB463230',
    },
  },

  payment: {
    // Nombre que se muestra en la pantalla de Cuotas
    accountHolder: 'WELLNESS GYM',
    alias: 'zeus.training.club',
    cbu: '0000003100051208535818',
    cuil: '',
    whatsapp: {
      // WhatsApp con codigo de pais, sin el "+"
      phoneNumber: '5492216783402',
      // Mensaje prearmado para enviar el comprobante
      message: 'Hola Wellness Gym! Les comparto el comprobante de pago de este mes:',
    },
  },
};

export default CLIENT_SETUP;
