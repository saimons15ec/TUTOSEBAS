# Traspaso de TUTOSEBAS a la cuenta personal

Usa este texto al iniciar el trabajo desde la cuenta personal con acceso al repositorio privado:

> Este es TUTOSEBAS, plataforma UIC con panel de profesor y estudiante. Mi cuenta personal principal es saimons15ec; el repositorio es privado. Continúa el proyecto existente sin reconstruirlo ni perder sus IDs, archivos o historiales.
>
> Antes de modificar, lee README.md, PROJECT_CONTEXT.md, ARCHITECTURE.md, MIGRATION_PLAN.md, AUDITORIA_FINAL.md, LANZAMIENTO_6_PASOS.md y DEVELOPMENT_RULES.md. La instrucción maestra original se conserva, pero la autorización posterior del 6 de octubre de 2026 permite la auditoría y preparación del lanzamiento. Aclara cualquier diferencia de estado con evidencia actual.
>
> El stack es React/TypeScript/Vinext sobre Cloudflare Workers, D1 y R2. Hay 288 pruebas aprobadas, un respaldo privado completo y un restaurador aislado. El nuevo acceso por correo/contraseña está implementado y probado con proveedor simulado: solo fichas registradas y habilitadas, contraseña temporal del profesor, cambio obligatorio, sesiones seguras y revocables. Comprueba si el proveedor real y el hosting ya fueron conectados; no lo asumas.
>
> Sites sigue como piloto privado y debe preservarse hasta verificar el destino. En instalación propia APP_DEPLOYMENT=independent y APP_AUTH_MODE=password son obligatorios; nunca confíes en cabeceras Sites enviadas por visitantes. Conserva profiles.auth_id y todos los IDs académicos. Las contraseñas se gestionan en Supabase Auth; D1 no debe contenerlas.
>
> El código va a GitHub. Perfiles, datos, archivos y ZIP/SQL de respaldo van a almacenamiento privado. No incluyas secretos ni contraseñas en código, documentos, logs o chat. No se necesita API de OpenAI para importar preguntas por bloques. No programes envíos a alumnos sin instrucción explícita.
>
> Aplica siempre ANALIZA → CONFIGURA → TESTEA; ante un error repite los tres pasos. Primero comprueba arquitectura, dependencias, servicios, respaldo real, contenido de apertura y pendientes. Dame un resumen y continúa con trabajo autorizado; pídeme solo accesos o decisiones imprescindibles. No declares un despliegue real o una restauración de producción a partir de pruebas sintéticas.
>
> Antes de abrir estudiantes, verifica en un entorno propio el proveedor real, las cuentas, la copia de D1/R2, grupos/planes, prácticas, simuladores finales, trabajos, privacidad y dominio/HTTPS. La revisión académica sigue pendiente del profesor. Hay un aviso sin parche en braces de herramientas; mantenlo documentado y usa compilaciones confiables, sin servidores de desarrollo públicos.
