export const API_PORT = import.meta.env.PROD 
    ? (import.meta.env.VITE_API_PORT ?? 3000)
    : import.meta.env.DEV 
        ? Number(import.meta.env.VITE_API_PORT) || 5173
        : 4173;

