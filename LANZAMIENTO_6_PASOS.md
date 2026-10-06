# TUTOSEBAS: los seis pasos de lanzamiento

Esta ruta aplica ANALIZA → CONFIGURA → TESTEA en cada paso; un error vuelve a esos tres pasos. La autorización del usuario para avanzar está registrada en la conversación del 6 de octubre de 2026. Las aprobaciones antiguas de exportación no se vuelven a pedir para la preparación autorizada. No contratar servicios, reemplazar datos ni retirar Sites sin resolver accesos y verificar resultados.

## 1. Auditoría final y correcciones

**Analiza:** leer `AUDITORIA_FINAL.md`, código, dependencias, inventario y controles de acceso. Distinguir funciones probadas de servicios realmente conectados.

**Configura:** parches de seguridad, origen estricto, validaciones de preguntas, exclusiones de secretos, acceso por contraseña preparado y respaldo completo.

**Testea:** 288 pruebas, tipos, lint, build de Sites y build independiente. Auditar dependencias de producción y revisar el aviso sin parche de herramientas.

**Salida:** correcciones técnicas verificadas; sin declaración de producción independiente hasta cumplir el resto.

## 2. Contenido académico de apertura

**Analiza:** confirmar qué ofrecer al primer grupo. En el inventario actual hay 20 preguntas vigentes aprobadas de Ciencias Naturales, 6 funcionales y 20 históricas de Fin de Carrera; no hay examen final vigente publicado ni lecciones de curso registradas.

**Configura:** profesor → área → materia → tema. Publicar material académico validado; importar/revisar preguntas por bloque, aprobarlas; configurar práctica, simulador de materia y examen final solo con preguntas suficientes. Apartar demostraciones en la copia de apertura sin eliminar historial.

**Testea:** validar en pantalla de estudiante el tema, formatos disponibles, cantidad, corrección, recuperación del intento y permisos. La revisión de exactitud académica corresponde al profesor.

**Salida:** materias y opciones habilitadas con contenido real. No anunciar Fin de Carrera si no se ha preparado su periodo vigente.

## 3. Respaldo de código, datos y archivos

**Analiza:** código en el GitHub privado personal; información operativa fuera del repositorio. El antiguo JSON de respaldo es insuficiente por sí solo.

**Configura:** profesor → Configuración → **Respaldo privado completo** → **Descargar registros y archivos**. Guardar el ZIP en `TUTOSEBAS/Respaldos privados` de la cuenta principal. Contiene datos privados; no subirlo a GitHub.

**Testea:** comprobar el ZIP real con:

```bash
python3 scripts/verify-private-backup.py /ruta/respaldo-privado.zip
python3 scripts/verify-private-backup.py /ruta/respaldo-privado.zip --restore-to backups/restauracion-verificada
```

El destino debe ser una carpeta nueva. Comparar perfiles, registros, objetos, tamaños, SHA-256 y referencias. La prueba sintética y la copia actual recibida ya pasaron: datos y los 14 objetos fueron verificados y restaurados en un destino aislado. El ZIP se reconstruyó desde backup.json, manifest.json y sus piezas; no se verificó el contenedor original. Repetir la copia final después de crear credenciales y ante cambios nuevos de datos. El lector nativo de esta sesión no proporciona los binarios de R2 y truncó 12 JSON largos, por lo que esas lecturas no se usan como respaldo íntegro.

**Salida:** código versionado y ZIP real restaurado en una copia separada. Para transferir cuentas de contraseña se conserva el mismo proyecto de autenticación o se reasignan credenciales; el ZIP no contiene sus contraseñas.

## 4. Infraestructura propia y contraseñas

**Analiza:** ruta recomendada para conservar el stack: Cloudflare Workers + D1 + R2; Supabase Auth para contraseñas. GitHub privado para código y Drive privado para respaldos. No se necesita la API de OpenAI para los bloques manuales.

**Configura:** crear/conectar ambas cuentas con la cuenta personal principal. Verificar propietario y límites antes de activar facturación o contratar planes. En Supabase crear un proyecto de TUTOSEBAS, permitir email/contraseña, desactivar nuevos registros y cuentas anónimas. Utilizar claves actuales `sb_publishable_` y `sb_secret_`.

Guardar URL y claves mediante la configuración segura del servidor. No pegarlas en chat ni escribirlas en código. En el Site actual, el origen durante preparación debe ser su URL actual; esto permite a un profesor autenticado por Sites asignar sus credenciales y las de alumnos registrados sin cambiar el acceso exterior. Una asignación requiere la ficha interna exacta.

Antes de preparar el destino, asignar desde el Site la contraseña inicial del administrador principal y confirmar que su identidad quedó vinculada a su ficha. **Después de crear o cambiar esas credenciales, repetir el paso 3:** descargar un nuevo ZIP completo, verificarlo y restaurarlo en una carpeta nueva. Esa copia final debe incluir `auth_identities` y sus vínculos con los perfiles; no importar la copia anterior a la creación de credenciales. Mantener el mismo proyecto Supabase en origen y destino. Las contraseñas de los estudiantes pueden asignarse desde el destino una vez que el administrador haya entrado y cambiado su contraseña inicial.

En Cloudflare crear una D1 nueva y R2 privado; nunca usar la base de Sites como destino de restauración. Aplicar migraciones del repositorio, importar el `data-import.sql` privado generado en el paso 3, y cargar los binarios con sus claves originales del manifiesto. No abrir un bucket público.

Copiar `deployment/cloudflare.example.json` como `deployment/cloudflare.production.json`, completar los IDs reales, correo administrador y origen HTTPS. No usar valores de prueba.

Variables de destino: `APP_DEPLOYMENT=independent`, `APP_AUTH_MODE=password`, `APP_ORIGIN`, `ADMIN_EMAILS`, `SUPABASE_URL`. Configurar `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` como secretos de runtime, fuera del JSON.

**Testea:** propietario de recursos, conteos restaurados, hashes, administrador correcto y llamada real al proveedor. Correo no registrado, contraseña incorrecta, primer cambio, sesión vencida, suspensión, reactivación y restablecimiento. La prueba contra el proveedor real se ejecuta al conectar el proyecto, no se sustituye con la simulación.

**Salida:** entorno propio preparado y cuentas externas vinculadas sin cambiar los IDs académicos. Conectar un proyecto Supabase no implica migrar la base académica a Postgres.

## 5. Despliegue, dominio y HTTPS

**Analiza:** verificar propietario del hosting y dominio elegido. Primero usar una URL de prueba del hosting; después conectar el dominio. El cambio de formulario no elimina la autorización exterior de Sites.

**Configura:** construir el destino con:

```bash
node scripts/build-external.mjs deployment/cloudflare.production.json
```

El build independiente excluye el plugin de Sites y exige modo contraseña. El script construye; no crea recursos ni despliega. Después desplegar el Worker desde la cuenta propia, configurar secretos y el origen exacto de la URL asignada. Conectar el dominio con DNS y comprobar su certificado. Al cambiar de dominio, actualizar `APP_ORIGIN` y comenzar sesiones nuevas.

**Testea:** navegar con una cuenta registrada y con un correo ajeno; entrar sin ChatGPT; subir/descargar archivo real; verificar acceso por grupo/plan, intento final, recuperación, suspensión y reset. Probar en móvil y escritorio. Verificar HTTPS, caducidad, cookies y que los archivos no tengan URL pública.

**Salida:** instalación propia verificada. Mantener Sites como piloto/respaldo durante la comparación; no retirarlo automáticamente.

## 6. Primer grupo y mantenimiento

**Analiza:** abrir primero Grupo 1 UIC, tres integrantes, Simon 1 como coordinador y Gold. Confirmar correos exactos y el periodo/fecha de vigencia del plan, sin reutilizar cuentas de demostración por error.

**Configura:** registrar cada correo, grupo y rol; dar una contraseña temporal distinta a cada estudiante; publicar solo materias y secciones preparadas. Mostrar al estudiante cómo entrar, cambiar su clave, practicar por tema, completar un simulador y subir un trabajo. Activar la apertura del grupo después de verificar el paso 5.

**Testea:** los tres hacen un recorrido corto real; el profesor comprueba los resultados y archivos desde su cuenta. No iniciar el grupo si hay un bloqueo urgente de acceso o pérdida de datos.

Mantenimiento mínimo:

- Diariamente: verificar que se puede entrar, revisar errores y pendientes de profesor.
- Antes de cada actualización y semanalmente: respaldo privado completo; verificarlo y conservar copias con fecha. Programación automática solo después de conectar la infraestructura y definir retención/destino.
- Mensualmente: restauración de prueba en destino nuevo, revisión de usuarios activos, planes, dependencias y consumo de servicios.
- Actualizar código mediante una rama, pruebas/build y despliegue probado. Conservar una versión anterior; las migraciones de datos requieren respaldo propio y no se revierten cambiando solo el código.
- Agregar alumno: ficha de correo → grupo/plan → contraseña inicial. Suspenderlo: Estudiantes y grupos → Suspender; conserva historial y cancela sesiones. Restablecer clave: asignar una nueva temporal desde la misma pestaña.
- No compartir claves de administrador; activar segundo factor en las cuentas propietarias de servicios.

**Salida:** grupo en uso y procedimiento de operación documentado.

## Próximas acciones indispensables del propietario

Conectar/abrir las cuentas de Supabase y Cloudflare de la cuenta principal, indicar el dominio que desea utilizar si ya dispone de uno, y facilitar un nuevo respaldo final después de vincular credenciales. La copia actual recibida ya se verificó y restauró de forma aislada. Las claves se configuran de forma segura, no por chat. Todo lo demás que no dependa de esos accesos puede prepararse y probarse automáticamente.
