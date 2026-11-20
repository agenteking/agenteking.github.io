// Defaults para db.ts. Va en un módulo aparte e importado PRIMERO en index.ts: los imports de ESM se
// evalúan antes que el cuerpo del módulo, y db.ts lee la configuración al cargarse. No se escribe en
// process.env porque en Supabase el entorno es de solo lectura (NotSupported).
(globalThis as { dbDefaults?: Record<string, string> }).dbDefaults = {
  DB_SCHEMA: "selkis",
  DB_POOL_MAX: "3",
};
