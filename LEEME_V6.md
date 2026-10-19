# Imperium Fidelidad V6

1. **Respaldar MySQL Aiven** y ejecutar `MIGRACION_FIDELIDAD_V6.sql` una sola vez con la API detenida. No se elimina ninguna cita. Se inicializa el saldo de los clientes antiguos hasta 10 sellos.
2. Sustituir `server.js` del repositorio por el de este paquete, subir a GitHub y esperar Render Live. Mantener las variables actuales.
3. Reemplazar `lib/main.dart` de Flutter por el de V6. Conservar `pubspec.yaml`, `assets` y ejecutar `flutter pub get`, `flutter analyze`, `flutter run`.
4. El cliente visualiza sellos y canjes en `/api/clientes/fidelidad`.
5. El barbero asigna asistencia como antes, y solo si hay menos de 10 sellos se incrementa la tarjeta.
6. Para **canjear** desde una herramienta autorizada del personal: `POST /api/panel/fidelidad/canjear` con Authorization: Bearer TOKEN_BARBERO_O_ADMIN y JSON `{"cliente_id":123}`. Solo con 10 sellos; la API devuelve saldo 0. **El botón de canje para el panel web aún no está agregado**: se integrará en la siguiente actualización de la web.
7. Premio configurado en V6: arreglo de barba gratis al completar 10 sellos. No hay premios intermedios ni generación automática de descuentos.

El historial empieza con los movimientos nuevos; los sellos migrados de V10 no generan un movimiento retrospectivo. No confirmamos compilación Flutter ni despliegue real hasta probarlos en tu entorno.
