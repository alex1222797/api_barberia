USE barberia;
-- Ejecutar una vez después de respaldar la base. No elimina datos existentes.
CREATE TABLE IF NOT EXISTS asistencias (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 reserva_id BIGINT NOT NULL,
 resultado ENUM('asistio','no_asistio') NOT NULL,
 registrado_por INT NOT NULL,
 registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_asistencia_reserva (reserva_id),
 INDEX idx_asistencia_resultado (resultado),
 CONSTRAINT fk_asistencia_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id),
 CONSTRAINT fk_asistencia_usuario FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB;
-- No se crean sellos para citas antiguas automáticamente.
-- Beneficios V10 de demostración: 3, 5 y 10 asistencias (ver README).
