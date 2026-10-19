# Proyecto Denisse V4 - correo y contraseña propia

1. RESPALDA la base MySQL Aiven y ejecuta SOLO `MIGRACION_CORREO_PASSWORD.sql` en Workbench; no ejecutes `barberia.sql` sobre la base actual.
2. Reemplaza el backend anterior por estos archivos, excepto tu `.env` privado.
3. Git: `git add . && git commit -m "Registro de clientes con correo y contrasena" && git push origin main`.
4. Render conserva variables MySQL, FRONTEND_URL, JWT_SECRET, ADMIN_EMAIL y ADMIN_PASSWORD. Resend y Twilio NO son necesarios.
5. Publica los archivos del frontend en Netlify, incluyendo `config.js`, `conexion-api.js` y `cuentas.js`.
6. Un cliente se registra con correo + contraseña creada solo para Imperium; NUNCA uses la contraseña real de Gmail u Outlook.

Endpoints: POST /api/clientes/auth/registro {nombre,email,password}, POST /api/clientes/auth/login {email,password}; GET /api/clientes/yo y /api/clientes/mis-reservas con Bearer JWT.

Nota: No existe verificación de titularidad de correo ni recuperación automática de contraseña en V4. Antes del uso comercial, integrar recuperación segura y verificación de correo. Las cuentas OTP anteriores sin contraseña necesitarán asistencia del administrador para establecer una nueva contraseña de forma segura.
