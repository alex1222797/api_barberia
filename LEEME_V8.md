# Proyecto Denisse V8 — paneles por barbero

1. Respalda `barberia` en Workbench. Ejecuta **USUARIOS_BARBEROS_V8.sql** una sola vez en la conexión Aiven. No ejecuta DROP ni elimina reservas.
2. Guarda fuera de GitHub el TXT **CREDENCIALES_BARBEROS_V8_PRIVADO.txt**. Es privado y NO está dentro del ZIP del backend. Los correos `@imperium.local` son nombres de usuario, no reciben mensajes.
3. Sustituye el backend anterior por este, conserva variables de Render (`DB_SSL_CA`, `JWT_SECRET`, etc.), y ejecuta git add/commit/push. Espera Render Live y prueba /api/health.
4. Publica el frontend V8 completo en Netlify y presiona Ctrl+F5.
5. Cada barbero ingresa en Panel barbero usando su propio usuario y clave. Solo ve sus citas y descansos. La cuenta admin puede seguir alternando barberos.
6. Para bloquear viernes de 8:00 a 12:00, en Bloquear horarios elige esa fecha, hora 08:00 y duración 4 h. Si se cruza con una cita existente, la API rechaza el descanso (no cancela citas de clientes). Los horarios bloqueados se marcan ocupados en rojo para clientes.
7. Este bloqueo es **por fecha**, no recurrente para todos los viernes; elige otra fecha para repetirlo. Las horas de reserva actuales empiezan a las 9:00, de modo que 8:00–9:00 ya no eran reservables.
8. Cambia las contraseñas temporales con un mecanismo de rotación antes de usar en producción. No compartas el TXT.

Limitación: la versión actual usa un formulario de inicio de sesión con `prompt`; el panel visual se mantiene como ya estaba. Las cuentas son administradas por SQL y los descansos se guardan en la tabla `bloqueos`.
