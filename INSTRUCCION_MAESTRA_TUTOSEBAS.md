INSTRUCCIÓN MAESTRA PERMANENTE
TUTOSEBAS — DESARROLLO V1, DOCUMENTACIÓN, EXPORTACIÓN,
GITHUB PERSONAL Y MIGRACIÓN A MI CHATGPT PERSONAL


========================================================
0. PROPÓSITO DE ESTA INSTRUCCIÓN
========================================================

Esta instrucción pasa a formar parte del plan de desarrollo de TUTOSEBAS.

Actualmente TUTOSEBAS se encuentra en fase de desarrollo y pruebas dentro de ChatGPT Work / Sites.

NO quiero migrar ni exportar todavía.

Quiero continuar desarrollando, probando, corrigiendo y completando TUTOSEBAS dentro del entorno actual hasta alcanzar una V1 estable.

Sin embargo, cuando V1 esté lista, quiero poder sacar una copia completa e independiente del proyecto para:

1. conservar el proyecto fuera de esta conversación;
2. guardar el código en MI GitHub personal;
3. continuar trabajando desde MI cuenta personal de ChatGPT;
4. poder ejecutar TUTOSEBAS fuera de ChatGPT Sites;
5. posteriormente desplegarlo en infraestructura/hosting y dominio propios;
6. no depender de esta conversación ni de esta cuenta empresarial para continuar desarrollándolo.

Por tanto, desde ahora debes desarrollar TUTOSEBAS teniendo presente esta futura portabilidad.

IMPORTANTE:

- NO exportes todavía.
- NO crees repositorios todavía.
- NO intentes acceder a GitHub mientras no te lo autorice.
- NO elimines ni modifiques la versión existente de Sites para preparar la migración.
- NO elimines archivos.
- NO elimines datos.
- NO desconectes servicios.
- NO reconstruyas TUTOSEBAS desde cero.
- Continúa desde el estado actual del proyecto.


========================================================
1. OBJETIVO DE TUTOSEBAS
========================================================

TUTOSEBAS es una plataforma de acompañamiento, preparación, estudio y evaluación relacionada con el examen de fin de carrera.

Debe permitir organizar y gestionar contenidos académicos y proporcionar herramientas de estudio, práctica, simulación, revisión y seguimiento.

Actualmente contempla, entre otros componentes:

- Panel de profesor/administración.
- Panel de estudiante.
- Materias de Fin de Carrera.
- Complexivos.
- Banco de preguntas.
- Simuladores.
- Trabajos y revisiones.
- Recursos y cursos.
- Notificaciones.
- Reportes.
- Estudiantes y grupos.
- Pagos y renovaciones.
- Planes y permisos.
- Periodos académicos.
- Historial.
- Archivos.
- Configuración.
- Funciones de automatización/IA previstas o implementadas.

Esta lista debe mantenerse actualizada según evolucione el proyecto.


========================================================
2. PRINCIPIO FUNDAMENTAL DE PORTABILIDAD
========================================================

A partir de ahora desarrolla TUTOSEBAS procurando que pueda trasladarse posteriormente fuera de ChatGPT Sites.

No quiero que una función dependa innecesariamente de:

- esta conversación;
- esta cuenta empresarial;
- ChatGPT Sites;
- archivos temporales de Work;
- rutas internas no exportables;
- configuraciones que solamente existan dentro del entorno actual.

Si alguna función NECESITA actualmente una característica específica de Sites o Work:

NO la elimines.

En su lugar documenta:

1. qué función es;
2. de qué depende;
3. por qué depende de ello;
4. qué servicio proporciona actualmente Sites/Work;
5. qué habrá que sustituir durante la migración;
6. qué alternativas externas podrían cumplir la misma función.

La prioridad actual sigue siendo que TUTOSEBAS funcione correctamente.


========================================================
3. DOCUMENTACIÓN PERMANENTE DEL PROYECTO
========================================================

Mantén documentación suficiente para que, al finalizar V1, una nueva instancia de ChatGPT o un desarrollador pueda recibir el proyecto y comprenderlo SIN NECESITAR leer toda nuestra conversación.

Al momento de V1 deberán existir, como mínimo:

README.md

PROJECT_CONTEXT.md

MIGRATION_PLAN.md

ARCHITECTURE.md

Si consideras necesario algún documento adicional, créalo también.


========================================================
4. README.md — MANUAL PRINCIPAL
========================================================

README.md debe contener como mínimo:


TUTOSEBAS


OBJETIVO

Explica:

- qué es TUTOSEBAS;
- qué problema resuelve;
- para quién está diseñado;
- cuál es su objetivo académico.


TECNOLOGÍA

Documenta:

- framework utilizado;
- lenguaje;
- frontend;
- backend;
- base de datos;
- almacenamiento;
- sistema de autenticación;
- sistema de autorización;
- IA utilizada;
- APIs;
- servicios externos;
- librerías principales;
- sistema de construcción;
- entorno de ejecución.


FUNCIONES

Documenta todas las funciones existentes.

Como mínimo revisa:

- Panel profesor.
- Panel estudiante.
- Banco de preguntas.
- Simuladores.
- Historial.
- Archivos.
- Materias.
- Complexivos.
- Trabajos.
- Revisiones.
- Recursos.
- Cursos.
- Notificaciones.
- Reportes.
- Estudiantes.
- Grupos.
- Pagos.
- Renovaciones.
- Planes.
- Permisos.
- Periodos.
- Administración.
- IA/automatización.

No documentes funciones inexistentes como si estuvieran terminadas.

Indica su estado cuando corresponda.


CÓMO FUNCIONA

Explica cada módulo y cómo se relaciona con los demás.


ESTRUCTURA DEL CÓDIGO

Explica:

- carpetas principales;
- archivos importantes;
- componentes;
- rutas;
- servicios;
- modelos;
- APIs;
- configuración.

Una nueva instancia de ChatGPT debe poder entender dónde modificar cada parte del sistema.


BASE DE DATOS

Documenta:

- tecnología utilizada;
- tablas/colecciones;
- relaciones;
- identificadores;
- datos principales;
- migraciones;
- índices importantes;
- políticas de acceso;
- cómo se conecta la aplicación;
- qué datos deben migrarse.


AUTENTICACIÓN Y PERMISOS

Explica:

- cómo inicia sesión un usuario;
- cómo se identifica;
- roles;
- profesor;
- estudiante;
- administrador;
- permisos;
- protección de rutas;
- variables relacionadas.


DECISIONES IMPORTANTES

Registra decisiones relevantes tomadas durante el desarrollo y por qué se tomaron.

No hace falta copiar toda nuestra conversación.

Conserva únicamente información que sea necesaria para continuar desarrollando correctamente TUTOSEBAS.


PENDIENTES

Mantén una lista actualizada de:

- funciones pendientes;
- mejoras;
- errores conocidos;
- funciones previstas para versiones posteriores.


CÓMO EJECUTAR TUTOSEBAS

Incluye instrucciones paso a paso para que otra persona o entorno pueda ejecutar el proyecto.


CÓMO DESPLEGARLO

Incluye instrucciones para llevar TUTOSEBAS a producción fuera de ChatGPT Sites.


========================================================
5. PROJECT_CONTEXT.md
========================================================

Este documento debe funcionar como la memoria técnica y funcional del proyecto.

Debe explicar:

- visión de TUTOSEBAS;
- objetivo;
- usuarios;
- funcionamiento;
- módulos;
- flujo profesor;
- flujo estudiante;
- decisiones funcionales;
- decisiones técnicas;
- decisiones de diseño importantes;
- qué se ha construido;
- por qué se construyó así;
- qué falta;
- qué ideas quedan para después;
- limitaciones actuales;
- decisiones tomadas durante nuestras conversaciones que otra instancia de ChatGPT necesite conocer.

NO copies toda la conversación.

Resume el conocimiento realmente importante.

La pregunta que debe responder este archivo es:

"Si mañana pierdo este chat y entrego TUTOSEBAS a mi ChatGPT personal, ¿tendrá suficiente contexto para continuar correctamente?"


========================================================
6. ARCHITECTURE.md
========================================================

Documenta técnicamente la arquitectura real de TUTOSEBAS.

Incluye:

- frontend;
- backend;
- framework;
- estructura;
- componentes;
- rutas;
- APIs;
- base de datos;
- autenticación;
- autorización;
- almacenamiento;
- archivos;
- IA;
- servicios externos;
- variables de entorno;
- flujo de datos;
- dependencias;
- sistema de despliegue actual;
- dependencias específicas de Sites/Work.

No inventes arquitectura.

Documenta solamente lo que realmente existe.


========================================================
7. MIGRATION_PLAN.md
========================================================

Mantén un plan específico para sacar TUTOSEBAS de este entorno.

Debe contemplar:

TUTOSEBAS Work/Sites
↓
V1 estable
↓
Auditoría
↓
Exportación
↓
Verificación
↓
Conectar temporalmente mi GitHub personal
↓
Repositorio PRIVADO
↓
Verificación del repositorio
↓
Desconectar GitHub de la cuenta empresarial si así lo deseo
↓
Abrir proyecto desde mi ChatGPT personal
↓
Verificar funcionamiento
↓
Entorno externo
↓
Hosting/infraestructura
↓
Dominio
↓
Producción


========================================================
8. ARCHIVOS QUE HE CARGADO DURANTE EL DESARROLLO
========================================================

He proporcionado durante nuestras conversaciones diferentes:

- PDF;
- documentos;
- imágenes;
- ZIP;
- materiales académicos;
- ejemplos;
- preguntas;
- exámenes;
- referencias;
- otros archivos.

NO asumas que todos deben exportarse.

Cuando llegue la auditoría V1 clasifica cada archivo relevante, hasta donde sea técnicamente posible determinarlo, como:


A — REFERENCIA

Se utilizó solamente para comprender requisitos, contenido, diseño o funcionamiento.

No es necesario para ejecutar TUTOSEBAS.


B — INFORMACIÓN YA INCORPORADA

Su contenido necesario ya fue convertido en:

- código;
- base de datos;
- contenido estructurado;
- configuración;
- recursos internos.


C — DEPENDENCIA OPERATIVA

TUTOSEBAS necesita actualmente ese archivo para funcionar.

Debe migrarse.


D — RECURSO FUTURO

No es necesario para ejecutar V1, pero conviene conservarlo para:

- IA;
- preguntas;
- contenidos;
- generación automática;
- futuras versiones.


Para cada elemento relevante informa:

- nombre;
- categoría;
- uso;
- ubicación actual si puede determinarse;
- necesidad de migración;
- consecuencia de no migrarlo.

NO elimines archivos sin mi autorización.


========================================================
9. DATOS Y PERSISTENCIA
========================================================

Identifica dónde se almacenan realmente:

- usuarios;
- profesores;
- estudiantes;
- administradores;
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
- datos utilizados por IA.

Clasifica dónde vive cada información:

- código;
- base de datos;
- almacenamiento;
- Sites;
- Work;
- servicio externo;
- otro.

La migración NO debe asumir que tener el código equivale a tener toda la aplicación.


========================================================
10. VARIABLES DE ENTORNO
========================================================

Documenta todas las variables necesarias.

Por ejemplo, actualmente pueden existir variables relacionadas con administración, autenticación, APIs u otros servicios.

Nunca copies secretos reales a documentación pública.

Al exportar crea:

.env.example

Debe contener únicamente:

NOMBRE_DE_VARIABLE=ejemplo_seguro

Nunca:

- contraseñas reales;
- tokens reales;
- API keys reales;
- secretos;
- credenciales privadas.


========================================================
11. SEGURIDAD ANTES DE V1
========================================================

Antes de recomendar cerrar V1 revisa:

- autenticación;
- autorización;
- separación profesor/estudiante;
- permisos;
- protección de rutas;
- exposición de información;
- validación;
- sesiones;
- archivos privados;
- API keys;
- tokens;
- variables de entorno;
- información sensible;
- errores que puedan revelar información interna.

No declares que el sistema es "100 % seguro".

Documenta las verificaciones realizadas y las limitaciones conocidas.


========================================================
12. CRITERIOS PARA DECLARAR V1 CANDIDATA
========================================================

No consideres V1 terminada solamente porque la interfaz esté completa.

Comprueba razonablemente:

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
- funciones de IA definidas para V1;
- escritorio;
- móvil;
- manejo de errores;
- estabilidad;
- ausencia de errores críticos conocidos.

Si posteriormente decido que alguna función pertenece a V1.1/V2, documenta esa decisión.


========================================================
13. ALERTA OBLIGATORIA CUANDO V1 ESTÉ LISTA
========================================================

Cuando consideres que TUTOSEBAS cumple los criterios de V1, DETENTE antes de comenzar una nueva función importante.

Muéstrame claramente este aviso:


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


NO exportes automáticamente.

Espera mi autorización.


========================================================
14. FASE 1 — AUDITORÍA V1
========================================================

Cuando yo responda que sí:

realiza una auditoría completa.

Entrégame un informe sobre:

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
26. archivos A/B/C/D.

Al final muestra cuatro apartados claros:

SE MIGRA

NO NECESITA MIGRAR

OPCIONAL

REQUIERE ADAPTACIÓN


========================================================
15. APROBACIÓN OBLIGATORIA
========================================================

Después de mostrarme la auditoría:

DETENTE.

Pregúntame:

"¿Apruebas la auditoría de TUTOSEBAS V1 y deseas preparar la exportación?"

No ejecutes la exportación sin mi aprobación explícita.


========================================================
16. PREPARACIÓN DE EXPORTACIÓN
========================================================

Una vez aprobada:

prepara una copia independiente.

Debe incluir todo lo necesario que corresponda:

- código fuente;
- frontend;
- backend;
- configuración;
- package.json o equivalentes;
- lockfiles;
- assets;
- recursos necesarios;
- esquema de base de datos;
- migraciones;
- scripts;
- documentación;
- .gitignore;
- .env.example;
- README.md;
- PROJECT_CONTEXT.md;
- ARCHITECTURE.md;
- MIGRATION_PLAN.md;
- instrucciones de instalación;
- instrucciones de ejecución;
- instrucciones de build;
- instrucciones de despliegue.

NO incluyas secretos.


========================================================
17. VERIFICACIÓN ANTES DE GITHUB
========================================================

ANTES de pedirme conectar GitHub:

verifica el paquete.

Comprueba:

- archivos esenciales;
- dependencias;
- estructura;
- documentación;
- secretos;
- .gitignore;
- .env.example;
- datos necesarios;
- elementos no exportables;
- dependencias de Sites.

Si es posible, ejecuta pruebas/build sin alterar el Site existente.

Solo cuando esta revisión termine correctamente pasa al siguiente paso.


========================================================
18. RECORDATORIO PARA CONECTAR MI GITHUB PERSONAL
========================================================

En este momento DETENTE.

Muéstrame exactamente un aviso equivalente a:


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


No me pidas contraseñas.

No me pidas tokens manualmente si la integración autorizada puede realizar la operación.


========================================================
19. GITHUB PERSONAL
========================================================

Cuando yo confirme:

"GITHUB PERSONAL CONECTADO"

primero verifica qué cuenta GitHub está disponible/autorizada.

Muéstrame el nombre de usuario o identificador no secreto disponible y pídeme confirmar que ES MI CUENTA PERSONAL.

NO subas nada todavía.

Después de que yo confirme:

crea o utiliza, según mi aprobación, un repositorio PRIVADO destinado a TUTOSEBAS.

Nombre sugerido:

tutosebas

o

tutosebas-v1

pero pregúntame antes de decidir el nombre definitivo.

El repositorio debe ser PRIVADO.

Antes del primer push:

- revisa .gitignore;
- excluye .env;
- excluye secretos;
- excluye credenciales;
- excluye tokens;
- excluye API keys;
- evita datos privados innecesarios;
- verifica archivos grandes innecesarios.

Después realiza el primer commit de V1.


========================================================
20. ETIQUETA DE VERSIÓN
========================================================

Identifica claramente la versión estable como:

TUTOSEBAS V1.0

Cuando sea técnicamente apropiado, crea una etiqueta/release/tag correspondiente a V1.0.

Registra:

- fecha;
- estado;
- commit correspondiente;
- funciones principales incluidas.


========================================================
21. VERIFICACIÓN DE GITHUB
========================================================

Después de subir el proyecto:

NO asumas que el proceso terminó.

Verifica que el repositorio contenga:

- código fuente;
- estructura correcta;
- README;
- PROJECT_CONTEXT;
- ARCHITECTURE;
- MIGRATION_PLAN;
- dependencias;
- configuración segura;
- .gitignore;
- .env.example;
- scripts necesarios.

Verifica que NO contenga secretos.

Indícame qué debo revisar visualmente en GitHub para confirmar que el proyecto está ahí.


========================================================
22. RECORDATORIO DE DESCONEXIÓN
========================================================

Después de verificar GitHub, avísame:


"TUTOSEBAS V1 ya está respaldada en tu GitHub personal.

Si no deseas mantener tu GitHub personal conectado a esta cuenta empresarial de ChatGPT, ahora puedes desconectarlo desde Configuración → Complementos → GitHub.

Desconectarlo de ChatGPT no elimina el repositorio de tu GitHub."


No desconectes nada automáticamente.


========================================================
23. PAQUETE PARA MI CHATGPT PERSONAL
========================================================

Ahora prepara TUTOSEBAS para que pueda continuar trabajando desde MI CUENTA PERSONAL DE CHATGPT.

La nueva instancia debe poder comprender el proyecto sin acceder a este chat.

Asegúrate de que el repositorio/documentación permita conocer:


TUTOSEBAS


OBJETIVO

Plataforma para preparación del examen de fin de carrera.


TECNOLOGÍA

- Framework utilizado.
- Lenguaje.
- Frontend.
- Backend.
- Base de datos.
- Sistema de autenticación.
- Sistema de autorización.
- IA utilizada.
- APIs.
- Servicios externos.


FUNCIONES

- Panel profesor.
- Panel estudiante.
- Banco de preguntas.
- Simuladores.
- Historial.
- Archivos.
- Todas las demás funciones realmente implementadas.


CÓMO FUNCIONA

Explicación de cada módulo.


ESTRUCTURA DEL CÓDIGO

Qué hace cada carpeta y archivo importante.


BASE DE DATOS

Tablas/colecciones, relaciones, datos necesarios y procedimiento de configuración/migración.


DECISIONES IMPORTANTES

Por qué se construyeron determinadas funciones de cierta manera.


PENDIENTES

Qué falta.

Qué corresponde a V1.1.

Qué corresponde a versiones futuras.


CÓMO EJECUTAR TUTOSEBAS

Instrucciones paso a paso.


CÓMO DESPLEGARLO

Instrucciones para llevarlo posteriormente a producción.


========================================================
24. PROMPT DE TRASPASO
========================================================

Al finalizar, genera también un archivo:

HANDOFF_TO_CHATGPT.md

Este archivo debe contener un prompt preparado específicamente para que yo pueda iniciar una conversación en MI CHATGPT PERSONAL.

Debe permitir que yo pueda decirle aproximadamente:

"Este es TUTOSEBAS V1.0. Analiza el repositorio y su documentación antes de modificar nada. Quiero continuar desarrollándolo desde aquí."

Pero crea un prompt mucho más completo que incluya:

- objetivo;
- estado actual;
- arquitectura;
- documentación que debe leer primero;
- reglas de seguridad;
- necesidad de no modificar inmediatamente;
- necesidad de comprobar dependencias;
- funciones existentes;
- pendientes;
- instrucciones para continuar el control de versiones.

De esta forma podré copiar HANDOFF_TO_CHATGPT.md en mi cuenta personal y continuar el proyecto.


========================================================
25. PRIMERA ACCIÓN EN MI CHATGPT PERSONAL
========================================================

La recomendación documentada debe ser:

1. conectar/acceder al repositorio desde mi ChatGPT personal cuando corresponda;
2. leer README.md;
3. leer PROJECT_CONTEXT.md;
4. leer ARCHITECTURE.md;
5. leer MIGRATION_PLAN.md;
6. leer HANDOFF_TO_CHATGPT.md;
7. analizar el código;
8. NO modificar nada todavía;
9. comprobar que comprende la arquitectura;
10. presentarme un resumen;
11. identificar cualquier dependencia que falte;
12. solamente después continuar desarrollando.


========================================================
26. NO DEPENDER DEL CHAT ORIGINAL
========================================================

La prueba final conceptual es:

"Si esta conversación desapareciera después de la migración,
¿podría continuar TUTOSEBAS desde mi GitHub personal y mi
ChatGPT personal?"

La respuesta debe ser SÍ antes de considerar completado el traspaso.

Si la respuesta es NO:

identifica qué información, código, datos, archivos, configuración o documentación falta y resuélvelo antes de declarar finalizada la migración.


========================================================
27. NO DESTRUIR SITES
========================================================

IMPORTANTE:

GitHub será inicialmente una COPIA/RESPALDO y nueva fuente de control del código.

NO elimines automáticamente:

- TUTOSEBAS de Sites;
- la versión actual;
- datos;
- almacenamiento;
- configuración;
- servicios.

Mantén Sites funcionando mientras verificamos la nueva copia.

Solo se retirará o modificará la versión anterior cuando YO lo solicite expresamente.


========================================================
28. HOSTING Y DOMINIO
========================================================

NO asumas que GitHub significa que TUTOSEBAS ya está en producción.

Después del traspaso a mi ChatGPT personal analizaremos separadamente:

- hosting;
- infraestructura;
- base de datos;
- almacenamiento;
- dominio;
- DNS;
- SSL;
- servicios externos;
- IA;
- copias de seguridad;
- producción.

No contrates, compres ni conectes servicios sin mi autorización.


========================================================
29. VERSIONADO FUTURO
========================================================

Después de V1.0 quiero poder continuar con:

V1.1
V1.2
V1.x
V2.0

Utiliza Git/control de versiones para conservar el historial.

Las modificaciones futuras importantes deben poder compararse y, cuando sea posible, revertirse.


========================================================
30. REGLA FINAL
========================================================

POR AHORA:

NO EXPORTES.

NO CONECTES GITHUB.

NO CREES REPOSITORIOS.

NO MIGRES.

NO CAMBIES LA ARQUITECTURA SOLO POR ESTA INSTRUCCIÓN.

CONTINÚA DESARROLLANDO TUTOSEBAS DESDE SU ESTADO ACTUAL.

Mantén actualizada la documentación y la preparación de portabilidad.

Cuando TUTOSEBAS alcance los criterios de V1:

1. AVÍSAME.
2. PÍDEME AUTORIZACIÓN PARA AUDITAR.
3. REALIZA LA AUDITORÍA.
4. MUÉSTRAME EL INFORME.
5. ESPERA MI APROBACIÓN.
6. PREPARA LA EXPORTACIÓN.
7. VERIFICA LA EXPORTACIÓN.
8. RECUÉRDAME CONECTAR MI GITHUB PERSONAL.
9. ESPERA QUE YO CONFIRME LA CONEXIÓN.
10. VERIFICA QUE SEA MI CUENTA PERSONAL.
11. PÍDEME AUTORIZACIÓN.
12. CREA/UTILIZA UN REPOSITORIO PRIVADO.
13. SUBE TUTOSEBAS V1.0.
14. VERIFICA EL REPOSITORIO.
15. RECUÉRDAME QUE PUEDO DESCONECTAR GITHUB DE LA CUENTA EMPRESARIAL.
16. PREPARA HANDOFF_TO_CHATGPT.md.
17. ASEGÚRATE DE QUE MI CHATGPT PERSONAL PUEDA CONTINUAR EL PROYECTO.
18. CONSERVA INTACTA LA VERSIÓN DE SITES HASTA QUE YO DECIDA LO CONTRARIO.


Confirma que has incorporado esta instrucción al plan actual de TUTOSEBAS.

Además, guarda este procedimiento dentro de la documentación del propio proyecto para que no dependa únicamente de que esta conversación lo recuerde.

Después de confirmarlo, continúa exactamente desde el estado actual del desarrollo de TUTOSEBAS.