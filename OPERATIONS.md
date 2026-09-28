# Operación, incidentes y recuperación de TUTOSEBAS

## Responsabilidad

La cuenta propietaria del Site es responsable de autorizar visitantes, revisar alertas y custodiar respaldos. Solo un administrador activo definido en `ADMIN_EMAILS` puede descargar el respaldo lógico o ejecutar acciones administrativas.

## Respaldo operativo

1. Ingresar como profesor.
2. Abrir **Configuración**.
3. Seleccionar **Descargar respaldo**.
4. Guardar el JSON en una ubicación cifrada y separada del equipo de uso diario.
5. Verificar que `counts` coincida con los bloques exportados y que `r2InventoryTruncated` sea `false`.
6. No enviar el archivo por mensajería ni correo sin cifrado: contiene datos personales y académicos.

El archivo exporta D1 y el inventario R2, no los binarios. Hasta definir un repositorio externo, la recuperación de archivos depende de que el bucket R2 original permanezca disponible.

## Retiro de materias

La acción **Quitar materia** no elimina datos físicos. Archiva la materia y sus contenidos, conserva intentos, auditoría y archivos, y devuelve a borrador los exámenes finales cuya distribución haya sido ajustada. Para volver a usarla, añade la materia nuevamente y revisa o publica sus contenidos.

## Inventario de archivos

La opción **Verificar inventario** de Configuración compara R2 con los registros académicos. Solo registra objetos vinculados que superan la validación vigente; los archivos huérfanos o con contenido activo permanecen bloqueados. La operación está limitada y deja evidencia en la auditoría de seguridad.

## Incidentes

### Prioridad alta

- cuenta no reconocida con acceso;
- cambio de plan, pago o estado que nadie autorizó;
- exposición de un archivo privado;
- pérdida o corrupción de datos;
- secreto o token visible en una captura, mensaje o repositorio.

### Contención inmediata

1. Retirar del acceso del Site a la cuenta sospechosa.
2. Suspender el perfil interno afectado.
3. No borrar registros, eventos ni archivos.
4. Descargar el respaldo lógico y conservar la hora exacta del incidente.
5. Revisar `security_audit` y los registros del Worker alrededor de esa hora.
6. Rotar únicamente los secretos afectados y volver a desplegar.
7. Probar acceso de profesor, estudiante, descargas y mutaciones antes de reabrir.

### Evidencia mínima

- fecha y hora con zona horaria;
- cuenta y rol involucrados;
- acción o archivo afectado;
- identificador de evento, registro o archivo;
- versión publicada del Site;
- medidas aplicadas y resultado de las pruebas.

Nunca incluir contraseñas, tokens, documentos completos, cédulas ni comprobantes en el reporte del incidente.

## Restauración controlada

La restauración nunca se ejecuta directamente sobre producción sin una prueba previa.

1. Crear un Site privado de pruebas con audiencia solo del propietario.
2. Aplicar las mismas migraciones D1.
3. Importar una copia del respaldo lógico mediante una herramienta de restauración revisada para esa versión del esquema.
4. Copiar los binarios R2 desde el respaldo externo elegido.
5. Comparar conteos, grupos, pagos, entregas y claves de archivos.
6. Probar acceso con cuentas sintéticas de administrador y estudiante.
7. Documentar diferencias antes de autorizar cualquier recuperación productiva.

El respaldo lógico actual es exportable, pero la importación automatizada se habilitará solo después de crear el Site de pruebas y realizar un ensayo completo. Esto evita que una restauración no probada sobrescriba producción.

## Verificación después de cada publicación

Ejecutar el ciclo **ANALIZA → CONFIGURA → TESTEA** y comprobar:

- Site activo y audiencia sin cambios;
- raíz y API con cabeceras de seguridad;
- API sin identidad devuelve 401;
- tablas D1 y migraciones esperadas;
- cero errores no esperados en registros del Worker;
- pruebas, tipos, lint, build y auditoría de dependencias aprobados.
