export const API_PORT = import.meta.env.PROD 
    ? import.meta.env.VITE_API_PORT
    : import.meta.env.DEV 
        ? 5173 
        : 4173;

