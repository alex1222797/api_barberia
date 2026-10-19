USE barberia;
-- Ejecutar una vez después de MIGRACION_CORREO_PASSWORD.sql; no borra clientes ni reservas.
ALTER TABLE clientes ADD COLUMN foto_perfil MEDIUMBLOB NULL;
ALTER TABLE clientes ADD COLUMN foto_mime VARCHAR(32) NULL;
