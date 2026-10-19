USE barberia;
-- Haz una copia de seguridad y ejecuta la migración una sola vez, con la API detenida.
CREATE TABLE IF NOT EXISTS fidelidad_cuentas (
 cliente_id BIGINT NOT NULL PRIMARY KEY,
 sellos TINYINT UNSIGNED NOT NULL DEFAULT 0,
 actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_fidelidad_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS fidelidad_movimientos (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 cliente_id BIGINT NOT NULL,
 reserva_id BIGINT NULL,
 tipo ENUM('sello','canje') NOT NULL,
 sellos_antes TINYINT UNSIGNED NOT NULL,
 sellos_despues TINYINT UNSIGNED NOT NULL,
 registrado_por INT NULL,
 detalle VARCHAR(160) NOT NULL,
 creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_sello_por_reserva (reserva_id),
 INDEX idx_fidelidad_mov_cliente (cliente_id,creado_en),
 CONSTRAINT fk_fidelidad_mov_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
 CONSTRAINT fk_fidelidad_mov_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id),
 CONSTRAINT fk_fidelidad_mov_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;
-- Preservar los sellos V10 existentes, hasta un máximo de 10.
INSERT IGNORE INTO fidelidad_cuentas (cliente_id,sellos)
SELECT r.cliente_id, LEAST(10, COUNT(*))
FROM asistencias a JOIN reservas r ON r.id=a.reserva_id
WHERE a.resultado='asistio' GROUP BY r.cliente_id;
