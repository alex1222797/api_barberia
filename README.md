# Proyecto Denisse — API Imperium Barber's

Backend Node.js + Express + MySQL Aiven, listo para desplegar en Render.

## 1. Importar base de datos
1. Abre MySQL Workbench y conecta al servidor MySQL de Aiven.
2. Abre `barberia.sql` y ejecútalo completamente.
3. Verifica `USE barberia; SHOW TABLES;` (6 tablas: barberos, servicios, clientes, usuarios, reservas, bloqueos).
4. Si Aiven niega el permiso `CREATE DATABASE`, crea `barberia` desde Aiven con un usuario con permisos y ejecuta el script desde `USE barberia;` quitando la primera instrucción.

> Workbench es un cliente de administración. Los datos corren en Aiven, no dentro de Workbench.

## 2. Render
1. Sube SOLO el contenido de la carpeta `proyecto_denisse_backend` a un repositorio en GitHub.
2. En Render selecciona **New > Web Service**, conecta el repositorio.
3. Runtime Node, Build `npm install`, Start `npm start`; health `/api/health`.
4. En Render > Environment carga las variables de `.env.example` con los valores de tu servicio Aiven. Nunca subas un `.env` real a GitHub.
5. `FRONTEND_URL` es la URL exacta de Netlify sin `/` al final. Para varios dominios sepáralos con comas.
6. `JWT_SECRET`: mínimo 32 caracteres aleatorios; `ADMIN_PASSWORD`: mínimo 12 caracteres.
7. `DB_SSL_CA`: copia el certificado CA PEM de Aiven como una sola línea, sustituyendo saltos por `\n`; si usas una CA confiada por Node, puede quedar vacío. SSL verifica el certificado.
8. El primer arranque crea el usuario `ADMIN_EMAIL` con la contraseña `ADMIN_PASSWORD` solamente cuando la tabla `usuarios` está vacía. Si ya existe no reemplaza contraseñas.
9. Comprueba `https://TU-SERVICIO.onrender.com/api/health`: debe indicar `ok:true`.

## 3. Conectar la web
1. En `proyecto_denisse_frontend/config.js` reemplaza `https://TU-SERVICIO.onrender.com` con la URL exacta de Render.
2. Sube **la carpeta frontend modificada completa** a Netlify, para que cargue `config.js` y `conexion-api.js` además de tus fotos originales.
3. Prueba una reserva desde otro navegador. Se guardará en Aiven; los cambios del panel también.
4. El botón del panel ahora solicita correo y contraseña. La sesión expira después de ocho horas.

## Rutas disponibles
| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/health` | Público |
| GET | `/api/servicios` | Público |
| GET | `/api/barberos` | Público |
| GET | `/api/disponibilidad?fecha=2026-10-19&servicio_id=1&barbero_id=1` | Público |
| POST | `/api/reservas` | Público |
| POST | `/api/auth/login` | Público con limitación de intentos |
| GET | `/api/reservas?barbero_id=1&fecha=2026-10-19` | Bearer Token |
| PATCH | `/api/reservas/IMP-CODIGO` | Bearer Token |
| GET | `/api/bloqueos?barbero_id=1` | Bearer Token |
| POST | `/api/bloqueos` | Bearer Token |
| DELETE | `/api/bloqueos/1` | Bearer Token |
| GET | `/api/estadisticas?barbero_id=1` | Bearer Token |

### Crear reserva
```json
{"service":1,"barber":1,"date":"2026-10-19","time":"10:00","name":"Cliente Ejemplo","phone":"7000-0000"}
```
Se usa zona horaria `America/El_Salvador`, domingo cerrado, 9:00–19:00, turnos de 15 minutos y 14 días de calendario. Se bloquea cada barbero durante la escritura para evitar citas solapadas.

### Advertencias importantes
- No se enviarán notificaciones WhatsApp/SMS por sí solas; requieren proveedor y consentimiento.
- Las reservas en `localStorage` de la versión anterior **no se migran** automáticamente. La web nueva lee/escribe en Aiven.
- Las estadísticas son totales por barbero; no hay facturación fiscal electrónica implementada.
- Los catálogos quedan precargados en SQL; su administración desde la web no está implementada.
- El panel tiene login, pero usa ventanas nativas `prompt` para credenciales. Se recomienda rediseñar un formulario cuando se quiera mejorar la experiencia.
- Mantén las variables privadas solamente en Render.
