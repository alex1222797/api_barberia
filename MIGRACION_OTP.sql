USE barberia;
-- Ejecutar UNA sola vez sobre la base existente. Conserva todas las citas y clientes.
ALTER TABLE clientes MODIFY telefono VARCHAR(16) NULL;
ALTER TABLE clientes ADD COLUMN email VARCHAR(160) NULL UNIQUE;
ALTER TABLE clientes ADD COLUMN verificado TINYINT(1) NOT NULL DEFAULT 0;
-- Convertir los teléfonos históricos 7000-0000 al formato internacional.
UPDATE clientes SET telefono=CONCAT('+503',REPLACE(telefono,'-','')) WHERE telefono REGEXP '^[0-9]{4}-[0-9]{4}$';
CREATE TABLE IF NOT EXISTS cliente_otp (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 contacto VARCHAR(160) NOT NULL,
 metodo ENUM('email','sms') NOT NULL,
 accion ENUM('registro','login') NOT NULL,
 nombre VARCHAR(70) NULL,
 hash_codigo CHAR(64) NOT NULL,
 intentos TINYINT NOT NULL DEFAULT 0,
 vence_en DATETIME NOT NULL,
 usado_en DATETIME NULL,
 creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_otp_contacto (contacto,id),
 INDEX idx_otp_limpiar (vence_en)
) ENGINE=InnoDB;
