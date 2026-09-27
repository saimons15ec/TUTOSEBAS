# TUTOSEBAS — Reglas permanentes de desarrollo

Este documento incorpora la instrucción maestra vigente para el desarrollo hacia V1, la auditoría, la futura exportación, GitHub personal y el traspaso a ChatGPT personal.

## Mandato actual

TUTOSEBAS continúa en desarrollo dentro de ChatGPT Work / Sites.

Por ahora:

- no exportar;
- no conectar GitHub;
- no crear repositorios externos;
- no migrar;
- no cambiar la arquitectura solo por portabilidad;
- no eliminar archivos;
- no eliminar datos;
- no desconectar servicios;
- no reconstruir desde cero;
- continuar desde el estado actual;
- mantener Sites funcionando;
- actualizar documentación y preparación de portabilidad.

## Objetivo de portabilidad

Al finalizar V1 debe poder prepararse una copia completa e independiente para:

- conservar el proyecto fuera del chat;
- guardarlo en GitHub personal privado;
- continuar desde una cuenta personal de ChatGPT;
- ejecutarlo fuera de Sites;
- desplegarlo después con infraestructura y dominio propios;
- dejar de depender de esta conversación o cuenta empresarial.

La portabilidad futura no autoriza acciones de migración presentes.

## Regla para dependencias de Sites/Work

No eliminar una función que depende de Sites o Work si actualmente es necesaria.

Documentar:

1. la función;
2. la dependencia;
3. la razón;
4. el servicio que presta el entorno;
5. la sustitución necesaria;
6. alternativas externas posibles.

La prioridad inmediata es que TUTOSEBAS funcione bien.

## Contrato de documentación

Mantener:

- README.md como manual principal;
- PROJECT_CONTEXT.md como memoria funcional y técnica;
- ARCHITECTURE.md como descripción real;
- MIGRATION_PLAN.md como procedimiento de salida;
- DEVELOPMENT_RULES.md como reglas de gobierno.

Cuando se autorice el traspaso, crear HANDOFF_TO_CHATGPT.md.

No documentar una función inexistente como terminada. Usar estados como implementado, básico, parcial, pendiente o futuro.

Actualizar la lista de módulos cuando cambie el producto.

## Datos, archivos y secretos

- El código no equivale a la aplicación completa.
- D1, R2, políticas de acceso y variables forman parte del inventario.
- No copiar secretos a documentación o Git.
- .env.example solo contiene ejemplos seguros.
- No eliminar adjuntos o archivos sin autorización.
- En la auditoría clasificar archivos A, B, C o D.
- Evitar datos personales innecesarios en un futuro repositorio.

## Seguridad

Antes de cerrar V1 revisar:

- autenticación;
- autorización;
- separación profesor/estudiante;
- permisos;
- rutas;
- sesiones;
- archivos;
- validación;
- datos sensibles;
- variables;
- tokens;
- mensajes de error.

Nunca declarar seguridad absoluta.

## Definición de candidata a V1

Requiere comprobar razonablemente:

- profesor;
- estudiante;
- autenticación;
- autorización;
- navegación;
- materias;
- preguntas;
- simuladores;
- resultados;
- historial;
- archivos;
- persistencia;
- alcance de IA acordado;
- escritorio;
- móvil;
- errores;
- estabilidad;
- ausencia de errores críticos conocidos.

## Aviso obligatorio

Cuando se cumplan los criterios, detenerse antes de una nueva función importante y mostrar el aviso de candidata a V1 conservado íntegramente en MIGRATION_PLAN.md.

No exportar. Pedir autorización para auditar.

## Puertas de aprobación

1. Autorización para auditoría.
2. Presentación de auditoría.
3. Aprobación de auditoría y autorización para preparar exportación.
4. Verificación del paquete.
5. Confirmación de que GitHub personal está conectado.
6. Confirmación de la identidad de GitHub.
7. Aprobación del nombre y repositorio privado.
8. Verificación del respaldo.
9. Traspaso a ChatGPT personal.
10. Decisión separada sobre hosting, dominio y producción.

Ninguna fase autoriza automáticamente la siguiente.

## GitHub

- No acceder antes de autorización.
- No pedir contraseña.
- Verificar la cuenta conectada.
- Pedir confirmación del propietario.
- Pedir nombre definitivo.
- Repositorio privado.
- Revisar secretos, datos privados y archivos grandes.
- Etiquetar la versión estable como TUTOSEBAS V1.0.
- Verificar después de subir.
- Recordar que desconectar la integración no elimina el repositorio.

## Conservación de Sites

Sites es el entorno activo y debe seguir funcionando durante el respaldo y las verificaciones.

No retirar:

- el Site;
- versiones;
- base de datos;
- almacenamiento;
- configuración;
- servicios.

Solo modificar o retirar la versión anterior por petición expresa.

## Control de versiones

Conservar historial de cambios. Asociar cambios de esquema con sus migraciones. Evitar mezclar modificaciones no relacionadas. Verificar compilación antes de publicar.

Versiones futuras previstas:

- V1.0;
- V1.1;
- V1.2;
- V1.x;
- V2.0.

## Regla de continuidad

La documentación debe permitir que otra instancia de ChatGPT o un desarrollador comprenda el sistema sin leer el chat original.

La prueba final del traspaso será:

Si desaparece la conversación original, ¿puede continuarse TUTOSEBAS desde GitHub personal y ChatGPT personal?

La respuesta deberá ser sí antes de declarar finalizada la migración.

## Ciclo maestro obligatorio

Todo proceso posterior usa **ANALIZA → CONFIGURA → TESTEA**.

- ANALIZA confirma alcance, riesgos, datos afectados, compatibilidad y forma de retorno.
- CONFIGURA aplica el cambio mínimo completo y actualiza la documentación relevante.
- TESTEA ejecuta pruebas negativas y positivas, tipos, lint, compilación y controles específicos del cambio.
- Si aparece un error, se analiza su causa y se repiten los tres pasos antes de publicar.
- Solo se solicita intervención del propietario cuando haga falta una decisión de costo, proveedor, acceso, credenciales no disponibles o una acción irreversible fuera del alcance ya autorizado.
