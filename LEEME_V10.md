# IMPERIUM BARBER'S — V10 Fidelidad

## Instalación (importante el orden)
1. **Respalda** la base de datos Aiven `barberia`.
2. Ejecuta `MIGRACION_FIDELIDAD_V10.sql` en Workbench conectado a Aiven. No ejecutes de nuevo barberia.sql.
3. Copia los archivos de `backend` en tu repositorio GitHub `api_barberia`, sin copiar `.env`. Ejecuta `git add .`, `git commit -m "V10 asistencia y fidelidad"`, `git push origin main`.
4. Espera Render **Live** y comprueba `/api/health`.
5. Publica el contenido de `frontend` (la carpeta que contiene index.html) en Netlify y refresca con Ctrl+F5.

## Reglas
- El barbero o admin registra **Asistió** o **No asistió** para citas iniciadas (hora local de El Salvador).
- Una cita = máximo una asistencia (UNIQUE en MySQL). No es posible otorgar dos sellos para una cita.
- No se otorgan sellos por reserva, cancelación ni ausencia.
- Una marca equivocada no se puede corregir desde el panel: requiere revisión administrativa; no edites sellos arbitrariamente.
- La tarjeta calcula los sellos del cliente desde las asistencias en SQL.
- Los premios 3, 5 y 10 sellos son **ejemplos**, todavía sin flujo de canje, vencimiento ni descuento en caja. No prometas beneficios al público sin confirmarlos.
- Esta versión no acredita automáticamente citas pasadas para evitar sellos falsos.

## Prueba
Registra una cita para una fecha/hora transcurrida o espera a que empiece una reserva real. Accede al panel del barbero asignado, marca **Asistió**, entra a Mi cuenta del cliente y comprueba +1 sello. Verifica que marcarla dos veces devuelve error 409. Prueba **No asistió** con otra cita y verifica que no agrega sellos.
