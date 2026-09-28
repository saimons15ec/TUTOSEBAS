# Seguridad de TUTOSEBAS

## Modelo de acceso

El acceso se protege por capas:

1. Sites mantiene una audiencia personalizada. Solo el propietario y los visitantes autorizados pueden abrir la URL.
2. Sign in with ChatGPT entrega la identidad autenticada al servidor.
3. La aplicación vincula esa identidad por ID estable y correo exacto con un perfil interno.
4. Cada solicitud vuelve a validar estado, rol, grupo, plan y periodo.
5. Los archivos privados se entregan únicamente desde `/api/files`; nunca desde `public/`.

La cédula no es una contraseña. Solo se conservan, si se registran, sus últimos cuatro dígitos como dato de referencia.

## Controles implementados

- El rol administrativo efectivo se deriva en cada solicitud de `ADMIN_EMAILS`; un rol antiguo guardado en la base no conserva privilegios.
- Las mutaciones rechazan orígenes cruzados y cuerpos JSON incorrectos o mayores de 1 MiB.
- Las cargas tienen límite de 25 MiB, extensión permitida, firma binaria, nombre normalizado y tipo MIME calculado por el servidor.
- Se rechazan ejecutables, documentos Office con macros/objetos activos y PDF con acciones o adjuntos activos detectables.
- Las descargas de estudiantes exigen una referencia exacta en D1 y coincidencia exacta de grupo, además del plan aplicable.
- Los comprobantes de pago y sus archivos solo se entregan al administrador o al coordinador del grupo.
- Las acciones de estudiante rechazan explícitamente cuentas administrativas, incluso si el perfil conservó una asociación histórica con un grupo.
- Los valores de pago se limitan a USD 10.000 y un máximo de dos decimales antes de registrar el comprobante.
- Las respuestas autenticadas y las descargas privadas usan `Cache-Control: private, no-store` para evitar que datos académicos o financieros permanezcan en cachés compartidas.
- Las respuestas de sesión vencida o no JSON se convierten en mensajes controlados y ofrecen volver a iniciar sesión sin mostrar errores técnicos.
- Cada archivo nuevo se registra en D1 con propietario, grupo, tamaño, tipo y huella SHA-256; si el registro falla, la carga R2 se revierte.
- Las descargas exigen que ese registro D1 exista, permanezca activo y coincida exactamente con tipo y grupo; los objetos huérfanos o inválidos quedan fuera del acceso.
- Los documentos académicos privados se mantienen fuera del repositorio de código y se conservan únicamente en almacenamientos autorizados.
- Las rutas sensibles usan límites distribuidos almacenados en D1, por cuenta, acción y ventana de tiempo.
- Las acciones críticas se registran en `security_audit`; los triggers de D1 impiden editar eventos y protegen su eliminación durante 365 días.
- El administrador puede descargar un respaldo lógico de D1 y del inventario R2 desde Configuración. La descarga está limitada y auditada.
- Las respuestas incluyen CSP, HSTS, protección contra MIME sniffing, framing y permisos innecesarios del navegador.
- Los errores internos se registran en el servidor y se reemplazan por mensajes públicos controlados.
- Las dependencias con avisos conocidos se fijan mediante `overrides` y se revisan con `pnpm audit --prod`.

## Ciclo obligatorio

Todo cambio sigue **ANALIZA → CONFIGURA → TESTEA**. Si una prueba falla, el bloque vuelve a comenzar desde el análisis de la causa antes de publicar.

Comandos mínimos:

```bash
pnpm test:security
pnpm lint
pnpm exec tsc --noEmit
pnpm build
pnpm audit --prod
```

## Retención

- Auditoría de seguridad: 365 días, sin edición y sin eliminación anticipada.
- Contadores de frecuencia: limpieza después de 7 días.
- Perfiles, pagos, entregas, revisiones e intentos: no se eliminan automáticamente, para evitar pérdida académica o financiera.
- Archivos R2: no se eliminan automáticamente hasta aprobar una política institucional de retención.

La limpieza técnica se ejecuta de forma probabilística y ligera durante solicitudes autenticadas; nunca toca datos académicos ni archivos.

## Respaldo y recuperación

El respaldo de Configuración contiene perfiles, registros, inventario de archivos, huellas y hasta 5.000 eventos recientes de auditoría. La copia privada autorizada en Google Drive complementa ese respaldo lógico con los 11 binarios vigentes de R2; sus huellas SHA-256 y la lectura del paquete ya fueron verificadas.

Para cerrar la recuperación de producción todavía se necesita:

1. restaurar una copia en un Site separado, nunca sobre producción;
2. documentar responsable, frecuencia y tiempo máximo de recuperación;
3. repetir periódicamente la verificación de inventario y huellas.

Hasta completar el ensayo aislado de restauración, el sistema debe mantenerse como piloto controlado con audiencia personalizada.

## Reporte de incidentes

Ante una sospecha de acceso indebido: retirar primero al visitante de la audiencia del Site, suspender su perfil interno, preservar los registros, descargar el respaldo lógico y rotar cualquier secreto afectado. Seguir `OPERATIONS.md`. No publicar datos personales, tokens ni archivos de usuarios en incidencias o capturas.
