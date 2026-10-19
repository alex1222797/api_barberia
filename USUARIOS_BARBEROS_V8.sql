USE barberia;
-- Los valores password_hash son hashes bcrypt; no son contraseñas en texto plano.
-- Solo crea usuarios que no existan; no modifica ni reinicia contraseñas actuales.
INSERT INTO usuarios(nombre,email,password_hash,rol,barbero_id,activo) SELECT 'Brandon Yahir','brandon@imperium.local','$2a$12$eYTIDV6vK3GW7wMhQL3QGO6KKoXKgy1wB3RjwHjogib7PQGsKmlc.','barbero',1,1 WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='brandon@imperium.local');
INSERT INTO usuarios(nombre,email,password_hash,rol,barbero_id,activo) SELECT 'Sergio Edenilson','sergio@imperium.local','$2a$12$I14jfDsFgEKlpVDeUzGBCeAiPktsSFh3SypwVXUo.v2wG3fkfUaC.','barbero',2,1 WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='sergio@imperium.local');
INSERT INTO usuarios(nombre,email,password_hash,rol,barbero_id,activo) SELECT 'Bryan Alexander','bryan@imperium.local','$2a$12$y8DJdRE.6RIjdpxKkUFqHuTydVWCuLNC6QWE/POkShUMqh9rRONkS','barbero',3,1 WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='bryan@imperium.local');
INSERT INTO usuarios(nombre,email,password_hash,rol,barbero_id,activo) SELECT 'Mauricio Alexander','mauricio@imperium.local','$2a$12$SWaCpYoplilZ4wOsEsqPYO//6/nphKxg7pqVNIsFld9ZmXau.J3mS','barbero',4,1 WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='mauricio@imperium.local');
SELECT nombre,email,rol,barbero_id,activo FROM usuarios WHERE rol='barbero' ORDER BY barbero_id;
