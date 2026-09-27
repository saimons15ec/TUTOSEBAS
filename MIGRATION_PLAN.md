# TUTOSEBAS — Plan de migración y traspaso

Estado: plan documentado, no iniciado.

Documento rector: `INSTRUCCION_MAESTRA_TUTOSEBAS.md`. Ese archivo conserva de forma literal la instrucción maestra entregada por el propietario. Este plan la resume para el trabajo cotidiano, pero no la reemplaza.

No existe autorización actual para exportar, conectar GitHub personal, crear un repositorio externo o migrar. Este documento conserva el procedimiento que deberá seguirse cuando V1 esté lista.

## Secuencia obligatoria

TUTOSEBAS en Work/Sites
→ V1 estable
→ auditoría
→ aprobación
→ preparación de exportación
→ verificación
→ conexión temporal de GitHub personal
→ confirmación de identidad
→ repositorio privado
→ verificación del repositorio
→ posible desconexión de GitHub de la cuenta empresarial
→ apertura desde ChatGPT personal
→ verificación
→ entorno externo
→ hosting e infraestructura
→ dominio
→ producción.

## Reglas mientras V1 no esté lista

- No exportar.
- No conectar GitHub personal.
- No crear repositorios externos.
- No migrar.
- No desmontar ni reconstruir TUTOSEBAS.
- No borrar código, datos, archivos, servicios o configuración.
- No cambiar la arquitectura solo para anticipar la migración.
- Continuar desde el Site y el código existentes.
- Mantener documentación y portabilidad.
- Registrar qué depende de Sites/Work y cómo sustituirlo.

## Fase 0 — Desarrollo hacia V1

Mantener actualizados:

- README.md;
- PROJECT_CONTEXT.md;
- ARCHITECTURE.md;
- DEVELOPMENT_RULES.md;
- MIGRATION_PLAN.md;
- esquema y migraciones;
- lista de módulos y estado;
- pendientes, errores y riesgos.

Antes de cerrar V1 comprobar:

- flujo profesor;
- flujo estudiante;
- autenticación;
- autorización;
- navegación;
- materias;
- banco de preguntas;
- simuladores;
- resultados;
- historial;
- archivos;
- persistencia;
- alcance de IA definido para V1;
- escritorio;
- móvil;
- manejo de errores;
- ausencia de errores críticos conocidos.

Si una función pasa a V1.1 o V2, registrar la decisión.

## Punto de detención — candidata a V1

Cuando el proyecto parezca cumplir los criterios, detenerse antes de iniciar otra función importante y mostrar:

========================================================

TUTOSEBAS — CANDIDATA A V1

El proyecto parece cumplir los criterios definidos para V1.

ANTES DE CONTINUAR:

1. Recomiendo iniciar la AUDITORÍA PREVIA A EXPORTACIÓN.

2. Recuerda que tu GitHub personal puede estar DESCONECTADO actualmente de esta cuenta empresarial.

3. NO necesitas conectarlo todavía.

4. Primero debemos realizar la auditoría.

¿Deseas iniciar la AUDITORÍA V1?

========================================================

No exportar automáticamente. Esperar autorización.

## Fase 1 — Auditoría V1

Después de una respuesta afirmativa, auditar:

1. arquitectura;
2. código;
3. frontend;
4. backend;
5. framework;
6. dependencias;
7. base de datos;
8. almacenamiento;
9. autenticación;
10. autorización;
11. usuarios;
12. datos persistentes;
13. archivos;
14. IA;
15. APIs;
16. variables de entorno;
17. Sites;
18. Work;
19. servicios externos;
20. seguridad;
21. errores conocidos;
22. funciones terminadas;
23. funciones pendientes;
24. dependencias específicas del entorno;
25. riesgos de migración;
26. clasificación A/B/C/D de archivos relevantes.

El informe termina con:

- SE MIGRA;
- NO NECESITA MIGRAR;
- OPCIONAL;
- REQUIERE ADAPTACIÓN.

### Seguridad de la auditoría

Revisar como mínimo:

- autenticación y sesiones;
- autorización por rol, grupo, plan y propiedad;
- separación profesor/estudiante;
- protección de rutas y archivos;
- validación de entrada;
- exposición de datos;
- claves, tokens y variables;
- mensajes de error;
- datos personales;
- dependencias y vulnerabilidades;
- copias de seguridad.

No declarar que la aplicación es totalmente segura. Registrar alcance, pruebas y limitaciones.

### Inventario de datos

Identificar ubicación, volumen, propietario lógico, relaciones y estrategia de exportación para:

- perfiles y administradores;
- estudiantes;
- grupos;
- materias;
- preguntas;
- respuestas;
- simuladores;
- intentos;
- calificaciones;
- resultados;
- historial;
- estadísticas;
- pagos;
- planes;
- periodos;
- trabajos;
- revisiones;
- recursos;
- archivos;
- notificaciones;
- configuraciones;
- contenido generado;
- datos usados por IA.

Ubicaciones posibles:

- código;
- D1;
- R2;
- Sites;
- Work;
- servicio externo;
- otro.

### Clasificación de archivos

Para cada archivo relevante:

| Categoría | Significado |
| --- | --- |
| A — Referencia | solo ayudó a comprender requisitos, diseño o contenido |
| B — Información ya incorporada | la parte necesaria ya está en código, datos o configuración |
| C — Dependencia operativa | la aplicación lo necesita para funcionar |
| D — Recurso futuro | conviene conservarlo para contenido, IA o versiones futuras |

Registrar nombre, categoría, uso, ubicación, necesidad de migración y consecuencia de no migrarlo.

Clasificación preliminar, no sustitutiva de la auditoría:

- app/data/quiz.json: C para una instalación nueva y B respecto a preguntas ya sembradas en el D1 vivo;
- objetos cargados en R2 y referenciados desde D1: C;
- migraciones de drizzle: C;
- recursos DOCX en public/downloads: categoría por confirmar, actualmente no referenciados;
- adjuntos históricos de conversaciones: clasificar solo si pueden localizarse y su uso es demostrable.

## Punto de detención — aprobación de auditoría

Después del informe preguntar exactamente:

¿Apruebas la auditoría de TUTOSEBAS V1 y deseas preparar la exportación?

No preparar la exportación sin aprobación explícita.

## Fase 2 — Preparación de exportación

Crear una copia independiente sin alterar el Site activo. Debe incluir, según corresponda:

- código fuente;
- frontend y backend;
- package.json y lockfile;
- assets necesarios;
- esquema;
- migraciones;
- scripts;
- .gitignore;
- .env.example;
- README.md;
- PROJECT_CONTEXT.md;
- ARCHITECTURE.md;
- MIGRATION_PLAN.md;
- DEVELOPMENT_RULES.md;
- instrucciones de instalación, ejecución, build y despliegue;
- exportación de datos autorizada;
- exportación de archivos autorizada;
- manifiestos y conteos para verificar.

No incluir:

- secretos;
- tokens;
- contraseñas;
- claves privadas;
- archivos temporales;
- cachés;
- credenciales de Sites;
- datos personales innecesarios.

## Fase 3 — Verificación antes de GitHub

Sin alterar el Site:

- verificar archivos esenciales;
- instalar dependencias en una copia limpia cuando sea posible;
- ejecutar build;
- aplicar migraciones a una base de prueba;
- comprobar .gitignore y .env.example;
- buscar secretos y datos personales;
- verificar archivos grandes;
- comprobar que código, datos y archivos estén diferenciados;
- documentar elementos no exportables;
- comprobar las dependencias de Sites;
- comparar conteos de datos y archivos;
- registrar cualquier adaptación pendiente.

Solo después continuar.

## Punto de detención — conectar GitHub personal

Mostrar:

========================================================

TUTOSEBAS V1 ESTÁ PREPARADA PARA RESPALDO EN GITHUB.

Ahora conecta temporalmente TU CUENTA PERSONAL DE GITHUB
a esta cuenta de ChatGPT.

Ruta aproximada:

ChatGPT
→ Configuración
→ Complementos
→ GitHub
→ conectar tu cuenta personal.

Cuando la hayas conectado, vuelve aquí y dime:

"GITHUB PERSONAL CONECTADO".

NO continúes hasta recibir esa confirmación.

========================================================

No pedir contraseña ni token manual si la integración autorizada es suficiente.

## Fase 4 — GitHub personal

Después de recibir GITHUB PERSONAL CONECTADO:

1. verificar la cuenta GitHub disponible;
2. mostrar usuario o identificador no secreto;
3. pedir confirmación de que es la cuenta personal;
4. no subir nada todavía;
5. pedir nombre definitivo del repositorio;
6. confirmar que será privado;
7. volver a revisar .gitignore, secretos, datos privados y archivos grandes;
8. crear o utilizar el repositorio solo después de aprobación;
9. realizar el primer commit de V1;
10. identificar la versión como TUTOSEBAS V1.0;
11. crear tag o release V1.0 cuando sea apropiado;
12. registrar fecha, commit, estado y funciones.

Nombres sugeridos, sujetos a aprobación:

- tutosebas;
- tutosebas-v1.

El repositorio debe ser privado.

## Fase 5 — Verificación de GitHub

Confirmar que contiene:

- código fuente;
- estructura correcta;
- README;
- PROJECT_CONTEXT;
- ARCHITECTURE;
- MIGRATION_PLAN;
- DEVELOPMENT_RULES;
- dependencias;
- configuración segura;
- .gitignore;
- .env.example;
- scripts;
- esquema y migraciones;
- HANDOFF_TO_CHATGPT.md cuando corresponda.

Confirmar que no contiene secretos. Indicar al propietario qué revisar visualmente en GitHub.

Después mostrar:

TUTOSEBAS V1 ya está respaldada en tu GitHub personal.

Si no deseas mantener tu GitHub personal conectado a esta cuenta empresarial de ChatGPT, ahora puedes desconectarlo desde Configuración → Complementos → GitHub.

Desconectarlo de ChatGPT no elimina el repositorio de tu GitHub.

No desconectar nada automáticamente.

## Fase 6 — Traspaso a ChatGPT personal

Crear HANDOFF_TO_CHATGPT.md con:

- objetivo;
- versión y estado;
- arquitectura;
- documentos que debe leer;
- reglas de seguridad;
- instrucción de no modificar inmediatamente;
- verificación de dependencias;
- funciones existentes;
- pendientes de V1.1/V2;
- control de versiones;
- comandos verificados;
- dependencias de Sites que falten sustituir.

Primer procedimiento en ChatGPT personal:

1. conectar o acceder al repositorio;
2. leer README.md;
3. leer PROJECT_CONTEXT.md;
4. leer ARCHITECTURE.md;
5. leer MIGRATION_PLAN.md;
6. leer HANDOFF_TO_CHATGPT.md;
7. analizar el código;
8. no modificar todavía;
9. presentar un resumen de arquitectura;
10. identificar dependencias faltantes;
11. continuar solo después.

Prueba conceptual:

Si el chat original desaparece, ¿se puede continuar TUTOSEBAS desde GitHub personal y ChatGPT personal?

La respuesta debe ser sí. Si no, identificar y completar información, código, datos, archivos, configuración o documentación faltante.

## Fase 7 — Adaptación externa

No asumir que GitHub es producción.

Evaluar y autorizar separadamente:

- hosting;
- runtime;
- base de datos;
- almacenamiento;
- autenticación;
- autorización;
- proveedor de IA;
- copias de seguridad;
- observabilidad;
- correo;
- dominio;
- DNS;
- SSL;
- privacidad y cumplimiento;
- recuperación ante incidentes.

### Sustituciones previstas

| Sites/Work actual | Necesidad externa |
| --- | --- |
| Sign in with ChatGPT y cabeceras | proveedor OIDC/OAuth y sesiones |
| política de audiencia | control de acceso del hosting o aplicación |
| D1 administrado | D1 propio o base elegida |
| R2 administrado | R2 propio o almacenamiento compatible |
| repositorio interno | GitHub personal privado |
| despliegue de Sites | CI/CD y hosting |
| dominio de Sites | dominio propio, DNS y TLS |
| variables de Sites | gestor de secretos |

La opción de menor fricción técnica probablemente será mantener Cloudflare Workers, D1 y R2 bajo una cuenta propia y sustituir Sites y autenticación. Esta es una hipótesis para evaluar, no una decisión aprobada.

## Fase 8 — Producción

Antes de producción:

- restaurar datos y archivos en un entorno de ensayo;
- verificar relaciones y conteos;
- probar todos los roles;
- probar móvil y escritorio;
- probar copias y restauración;
- configurar monitoreo;
- ejecutar revisión de seguridad;
- preparar reversión;
- mantener Sites intacto hasta que el propietario decida lo contrario.

No comprar, contratar o conectar servicios sin autorización.

## Versionado futuro

Después de V1.0:

- V1.1;
- V1.2;
- V1.x;
- V2.0.

Usar control de versiones para comparar y, cuando sea posible, revertir cambios. Las migraciones de datos deben acompañar los cambios de código que las requieran.

## Riesgos principales de migración

- copiar código sin D1 ni R2;
- perder identidad estable de usuarios al cambiar autenticación;
- incluir datos personales o secretos en Git;
- romper enlaces entre D1 y objetos R2;
- creer que el repositorio interno de Sites es el GitHub personal;
- no disponer de un reemplazo para rutas de ingreso/salida;
- aplicar semillas sobre datos reales;
- desplegar antes de comprobar migraciones;
- retirar Sites demasiado pronto;
- describir funciones parciales como completas.

## Regla final

GitHub será primero una copia privada y nueva fuente de control. Sites permanece intacto hasta que el propietario solicite expresamente retirarlo o modificar su función.
