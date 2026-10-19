CREATE DATABASE IF NOT EXISTS barberia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barberia;

CREATE TABLE IF NOT EXISTS barberos (
 id INT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(90) NOT NULL,
 especialidad VARCHAR(100) NOT NULL DEFAULT 'Barbero profesional',
 foto VARCHAR(200) DEFAULT NULL,
 activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS servicios (
 id INT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(100) NOT NULL,
 descripcion VARCHAR(255) NOT NULL,
 duracion_min INT NOT NULL,
 precio DECIMAL(10,2) NOT NULL,
 activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clientes (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(70) NOT NULL,
 telefono CHAR(9) NOT NULL UNIQUE,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
 id INT AUTO_INCREMENT PRIMARY KEY,
 nombre VARCHAR(100) NOT NULL,
 email VARCHAR(160) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 rol ENUM('admin','barbero') NOT NULL DEFAULT 'admin',
 barbero_id INT DEFAULT NULL,
 activo TINYINT(1) NOT NULL DEFAULT 1,
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (barbero_id) REFERENCES barberos(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reservas (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 codigo VARCHAR(32) NOT NULL UNIQUE,
 cliente_id BIGINT NOT NULL,
 servicio_id INT NOT NULL,
 barbero_id INT NOT NULL,
 fecha DATE NOT NULL,
 hora TIME NOT NULL,
 duracion_min INT NOT NULL,
 precio DECIMAL(10,2) NOT NULL,
 estado ENUM('pendiente','confirmada','finalizada','cancelada') NOT NULL DEFAULT 'pendiente',
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_agenda (barbero_id,fecha,hora,estado),
 FOREIGN KEY (cliente_id) REFERENCES clientes(id),
 FOREIGN KEY (servicio_id) REFERENCES servicios(id),
 FOREIGN KEY (barbero_id) REFERENCES barberos(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bloqueos (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 barbero_id INT NOT NULL,
 fecha DATE NOT NULL,
 hora TIME NOT NULL,
 duracion_min INT NOT NULL,
 motivo VARCHAR(140) DEFAULT 'No disponible',
 creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_bloqueos (barbero_id,fecha,hora),
 FOREIGN KEY (barbero_id) REFERENCES barberos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO barberos (id,nombre,especialidad,foto) VALUES
(1,'BRANDON YAHIR','Barbero profesional','assets/brandon-yahir.webp'),
(2,'SERGIO EDENILSON','Barbero profesional','assets/sergio-edenilson.webp'),
(3,'BRYAN ALEXANDER','Barbero profesional','assets/bryan-alexander.webp'),
(4,'MAURICIO ALEXANDER','Barbero profesional','assets/mauricio-alexander.webp')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),especialidad=VALUES(especialidad),foto=VALUES(foto);

INSERT INTO servicios (id,nombre,descripcion,duracion_min,precio) VALUES
(1,'CORTE CLÁSICO','Corte con máquina o tijera, acabado impecable.',40,8.00),
(2,'BARBA PREMIUM','Perfilado, arreglo de barba y acabado profesional.',25,5.00),
(3,'CORTE + BARBA','La experiencia completa en una sola visita.',60,12.00),
(4,'FADE / DEGRADADO','Degradado moderno y líneas definidas.',45,10.00),
(5,'DISEÑO DE CABELLO','Corte con diseño y detalles personalizados.',55,12.00),
(6,'CORTE INFANTIL','Un estilo especial para los pequeños.',35,7.00)
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),descripcion=VALUES(descripcion),duracion_min=VALUES(duracion_min),precio=VALUES(precio);
