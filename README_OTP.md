# Proyecto Denisse - registro e inicio de sesión OTP

## Orden obligatorio
1. Respaldar la base de datos de Aiven. Ejecutar MIGRACION_OTP.sql **una sola vez** con MySQL Workbench; no volver a ejecutar barberia.sql.
2. Subir los archivos de backend actualizados a GitHub (mantener .env privado).
3. En Render → Environment agregar RESEND_API_KEY y OTP_EMAIL_FROM (remitente autorizado en Resend), TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER; conservar DB_SSL_CA y demás variables anteriores.
4. En el panel de Twilio habilitar SMS a El Salvador, comprobar capacidad SMS del número emisor y verificar destinos si la cuenta es de prueba; pueden generarse cargos.
5. Deploy latest commit en Render y publicar carpeta frontend en Netlify (contiene config.js).
6. Registrar cliente por email y teléfono, confirmar OTP y guardar cita. Los usuarios del panel barbero siguen usando login por contraseña.

## Seguridad
- Los códigos no se guardan en texto plano; expiración 5 minutos, 5 intentos, reenvíos separados 60 s y limitación por IP.
- Las reservas nuevas requieren token cliente. Las reservas previas no se borran; sus clientes quedan sin verificar hasta que prueben posesión de su correo/teléfono.
- No exponer secretos en frontend ni GitHub. En Resend puede requerirse verificar dominio; en Twilio validar permisos internacionales.
- La cuenta admin permanece separada de las cuentas cliente.
