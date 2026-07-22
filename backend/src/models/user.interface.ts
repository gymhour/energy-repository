export interface User {
    email: string;
    password: string;
    nombre: string | null;
    apellido: string | null;
    direc: string | null;
    tel: string | null;
    tipo: string | null;
    fechaRegistro: Date | null;
    fechaBaja: Date | null;
    ID_Usuario: number;
};