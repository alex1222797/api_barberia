USE barberia;
-- Ejecutar sobre barberia existente. NO borra reservas ni clientes.
-- Compatible tanto con la base original como con la migración OTP anterior.
DELIMITER $$
DROP PROCEDURE IF EXISTS migrar_clientes_password$$
CREATE PROCEDURE migrar_clientes_password()
BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clientes' AND COLUMN_NAME='email') THEN
  ALTER TABLE clientes ADD COLUMN email VARCHAR(160) NULL UNIQUE;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clientes' AND COLUMN_NAME='verificado') THEN
  ALTER TABLE clientes ADD COLUMN verificado TINYINT(1) NOT NULL DEFAULT 0;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clientes' AND COLUMN_NAME='password_hash') THEN
  ALTER TABLE clientes ADD COLUMN password_hash VARCHAR(255) NULL;
 END IF;
 -- El teléfono deja de ser obligatorio para permitir registro solo por email.
 ALTER TABLE clientes MODIFY COLUMN telefono VARCHAR(16) NULL;
END$$
DELIMITER ;
CALL migrar_clientes_password();
DROP PROCEDURE migrar_clientes_password;
-- Las reservas existentes siguen relacionadas con sus clientes originales.
-- Usuarios de cuentas OTP existentes: no se convierten automáticamente a contraseña.
