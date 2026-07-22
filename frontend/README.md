# Proyecto Gym - Frontend

El frontend del proyecto está programado en React y utiliza las siguientes librerías.

1. Axios: sirve para el manejo de peticiones HTTP. Cabe destacar que en el root del proyecto se encuentra el archivo axiosConfig.js donde se específica la baseURL de las llamadas a la API.

2. Jwt-decode: sirve para decodificar tokens JWT y acceder a los valores del mismo.

# Estructura pagina nueva

1. Importar SidebarMenu.

2. Copiar y pegar
<div className='page-layout'>
    <SidebarMenu isAdmin={false}/>
    <div className='content-layout'> </div>
</div>