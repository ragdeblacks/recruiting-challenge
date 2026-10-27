# Decision Log — Edgar Alberto Sanabria Paredes

## Authorship declaration

Las decisiones y el razonamiento son míos y quedaron registrados en mis notas de trabajo durante el reto, la ia en momentos es frustrante, pero es por que no tiene el contexto bien bajado adecuadamente para poder trabajar con IA de manera profesional. Usé un asistente para organizar esas notas y preparar este borrador, revisé la versión final y asumo su contenido aqui redactado, las desiciones estan tomadas y enfocadas en lo que primero es mas grave y deja perdidas economicas o bloqueantes para el negocio o usuario, luego las siguientes.

---

## Issues addressed

- **Issue 1 — El dashboard reporta dinero que no existe: rembolsos que suman como ingreso**
  - What was wrong or weak: la función sum de total_amount sin filtrar por tipo, en orders-dal.ts. Causa raíz: la función que calcula los ingresos solo sabe sumar números, no sabe qué es un rembolso. El método sumAmountByMerchant es una suma que no concreta los valores reales de ingreso.
  - Shape of my improvement: darle al Data Access Layer un método con nombre adecuado a la funcionalidad requerida, que separe y reste adecuadamente de los ingresos los rembolsos. Así el seam queda bien: la regla de negocio vive solo en un lugar y cualquiera puede consumirla. Ingreso neto = ventas menos rembolsos, calculado en un SQL.
  - **Confidence (1–10):** 10
  - **What would falsify this fix:** una devolución de una venta de otro periodo (venta en septiembre, devolución en octubre) — muy seguramente el ingreso sale negativo para el cliente en ese periodo, pero si fuera por periodo, el revenue sale correcto a nivel de contabilidad. Creo que mi corrección atribuye al periodo en el que ocurre. También comprobar periodos con más devoluciones que ventas: solo confirmar que el frontend lo muestre bien.
  - **I disagreed with Claude on:** (1) Neto vs bruto: la IA propuso mostrar revenue neto en la tarjeta e intentó reforzarlo citando cómo reportan Stripe y Shopify. Le comenté que no, porque no he usado esas plataformas y no voy a colocar algo que desconozco del negocio; solo puede ser una propuesta. (2) Alcance del commit: la IA propuso arreglar metrics.ts dentro del mismo fix porque es la misma clase de bug. Debatí: bajo las convenciones de git los commits deben ser con un tipo y alcance definido, el PR debe tener un objetivo concreto. Lo separé en otro commit para que cada commit cuente una sola decisión.
  - Alternatives I considered and rejected: (1) Solo excluir los refunds de la suma: eso me daría revenue bruto, no neto. Implementar algo así seguiría generando un engaño: un comercio que vende 10000 y devolvió 9000 vería 10000. Para decisiones de negocio el valor neto es el valor concreto: ventas menos devoluciones, y no solo las ventas. (2) Guardar los refunds con monto negativo en la base: exige migrar los datos que ya existen, crea redundancia, se requeriría un constraint, y habría que cambiar todos los contratos de datos de los consumidores de la tabla en un solo cambio. (3) Arreglarlo desde el frontend: ese tipo de soluciones solo ocultan la deuda técnica real mientras la parchan visualmente al cliente, y es un posible bug si se requiere esta misma función en otro módulo o proceso.

- **Issue 2 — Un comercio puede leer las órdenes de otro sin restricción**
  - What was wrong or weak: el servicio GET /api/orders/:id no tiene restricciones adecuadas y le entrega datos de una orden a un comercio aunque la orden no sea de él, si conoce el id. Lo probé: identificándome como el restaurante bistro, pedí una orden de la tienda acme y el sistema me dio completa la información. Causa raíz: orders-dal.ts:38 — getById(id) busca solo por id, sin merchant_id en la condición; la ruta tampoco verifica nada.
  - Shape of my improvement: ajustar el método getById(id) agregando merchantId → getById(merchantId, id). Así se garantiza que el comercio que solicita la orden sea a quien le pertenece. Si conoce el id de una orden ajena, el sistema responde 404 — podría ser 403, pero eso a un atacante le indicaría que sí existe esa orden, solo que no es suya.
  - **Confidence (1–10):** 10
  - **What would falsify this fix:** que exista algún otro lugar donde getById esté siendo usado. Aunque metrics.ts escribe consultas por fuera de la capa de datos, sus consultas sí filtran adecuadamente — pero no es algo definido y bajo regla, solo supongo la disciplina; por ahí podría abrirse un hueco si no se documenta.
  - **I disagreed with Claude on:** el código de respuesta — el 403 fue lo que recomendó la IA; sin embargo, por cómo se gestiona la data y se manejan excepciones ante atacantes, lo más adecuado para mí es 404.
  - Alternatives I considered and rejected: (1) Validarla en el front: es una solución, pero no es escalable — si esta misma funcionalidad se requiere en otra parte, no puede reusarse. (2) Responder 403: es indicarle a un atacante que la orden existe; 404 vale igual.

- **Issue 3 — El libro contable acepta cualquier cosa, y es una tabla sensible**
  - What was wrong or weak: la tabla orders es el libro de contabilidad de todo el sistema y no existen restricciones adecuadas para insertar: la única validación era un email y que el monto fuera un número. Lo probé insertando por el POST: una venta con monto negativo quedó persistida; un tipo "banana" pasó; NaN es número en JavaScript así que pasaba; decimales en un sistema de centavos enteros; y el email podía traer HTML, abriendo la puerta a XSS.
  - Shape of my improvement: dos puntos complementarios. (1) Reglas en la base que limiten la inserción de basura: SQLite no permite agregar candados a una tabla existente, así que hice una migración — tabla nueva con candados y copia del histórico; la basura existente se aísla en una tabla de cuarentena para revisión, porque puede que los tipos raros sean errores de captura. (2) Validaciones en el POST antes de insertar: monto entero y positivo, tipos de orden, regex adecuada para el email, con manejo de errores adecuado.
  - **Confidence (1–10):** 10
  - **What would falsify this fix:** (1) un email válido raro que sea rechazado — suele pasar cuando un dominio raro no lo cubre la regex; (2) que se consideren tipos nuevos en la tabla: la regla nos obligaría a migrar para incluirlos; (3) validar que montos negativos, NaN o decimales se capturen sin mostrar el error por frontend.
  - **I disagreed with Claude on:** aquí empatamos con la idea de la IA. (Did not disagree.)
  - Alternatives I considered and rejected: (1) Validar solo en la entrada sin tocar el esquema: si esta tabla se toca en otro lado sin considerar las reglas, no hay restricción que evite volver a caer en el mismo fallo. (2) Solo ajustar el esquema: los datos quedan protegidos pero sin manejo de errores adecuado — la inserción simplemente fallaría.

- **Issue 4 — Las métricas siguen sin separar ingresos y rembolsos, y el proceso se salta la capa de datos**
  - What was wrong or weak: dos problemas que son uno. (1) En metrics.ts las métricas cuentan rembolsos como ventas: el promedio sube igual con una devolución que con una venta, y el top de clientes suma todo como "gasto" — un cliente que compró $5,000 y devolvió los $5,000 aparece con $10,000: el peor cliente sería el mejor, y si un comercio usa ese top para dar descuentos, se los da al cliente que más le devuelve. (2) El más grande: esta clase se salta la capa de datos completamente — abre su propia conexión a SQLite y escribe sus consultas a mano; las reglas ya escritas en la capa (rembolso resta, solo completed, tenancy) no le aplican.
  - Shape of my improvement: mover las consultas de metrics a métodos de la capa de acceso a datos con semántica adecuada (summaryByMerchant, topCustomersByMerchant), aplicando las reglas ya conocidas, y eliminar la segunda conexión. Con eso los dos problemas se arreglan juntos, porque el primero era síntoma del segundo. Lo correcto además es consultar con negocio o producto cómo esperan manejar los rembolsos en los conteos.
  - **Confidence (1–10):** 9
  - **What would falsify this fix:** que la solicitud de parte de producto o negocio nos obligue a rediseñar las funciones previstas dada la necesidad.
  - **I disagreed with Claude on:** did not disagree en este fix.
  - Alternatives I considered and rejected: (1) Corregir el SQL dentro de metrics.ts sin tocar la arquitectura: arregla los números de hoy dejando deuda técnica y duplicidad, abriendo la puerta a que el problema regrese. Es solo un parche. (2) Mantener la conexión de solo lectura: la seguridad que importa (reglas de negocio, tenancy) debe vivir en una capa, no en un ajuste de solo lectura.

- **Issue 5 — El rango de fechas excluye el último día (día en curso)**
  - What was wrong or weak: la ficha "Revenue (last 30 days)" jamás incluye las ventas del día en curso. Lo verifiqué: con una venta de $123.45 hecha hoy, el rango que termina "hoy" devuelve $369.39 y el que termina "mañana" devuelve $492.84. El comerciante vende en la mañana, abre el dashboard en la tarde, y su venta "no está" — eso se traduce en tickets. Causa raíz: el frontend manda fechas incompletas (to=2026-10-23) y la base guarda fecha y hora; la comparación de textos deja fuera todo el día final. Además había dos formatos de created_at conviviendo (ISO del seed y formato tipo mysql de las órdenes nuevas), que el navegador interpreta distinto.
  - Shape of my improvement: dos partes. (1) El contrato de la API dice "fechas YYYY-MM-DD", así que la capa las interpreta como días completos: internamente se compara created_at < date(to, '+1 day'). Aplica a revenue y al listado. (2) Unificar el formato de created_at a ISO y migrar las filas viejas — un paso más en la migración del fix 3.
  - **Confidence (1–10):** 9
  - **What would falsify this fix:** (1) la zona horaria del día: la base guarda UTC, y una venta de las 7pm de CDMX cae en el día siguiente UTC; (2) venta de medianoche: con el rango semiabierto cae en el día que empieza, sin huecos ni dobles conteos — justo lo que el test debe fijar; (3) la migración sobre una base ya migrada debe ser inofensiva (idempotente).
  - **I disagreed with Claude on:** la zona horaria — yo propuse manejar el día en hora de México, la IA se apegó a UTC. Al final quedó en UTC (la base guarda UTC y el rango se compara ahí), y la duda quedó documentada como escenario que falsificaría el fix.
  - Alternatives I considered and rejected: (1) Arreglarlo en el frontend (mandar to=mañana): cualquier otro consumidor de la API hereda el bug. (2) Exigir timestamps completos en la API: técnicamente correcto pero empeora la API para el caso común y rompe el contrato documentado.

## Feature chosen

- **Feature:** C — búsqueda de órdenes con filtros.
- **Why this one and not the others:** A, exportar CSV, era la opción más segura y barata. Después de los cinco fixes, aportaba poca evidencia nueva sobre las reglas que acababa de corregir. B, webhooks, tenía más interés arquitectónico: reintentos, firmas y garantías de entrega, y conte con poco tiempo por mi trabajo. También abría trabajo nuevo de suscripciones y entrega asíncrona cuando buena parte de tiempo ya se había ido en los fixes. Elegí C porque aprovechaba ese trabajo realizado hasta el momento en las correcciones. La búsqueda ejercita el aislamiento por merchant, los tipos válidos y los rangos de días completos. Las reglas de la capa de datos se vuelven comportamiento visible de la feature.
- **What I cut to ship it in budget:** dejé el orden fijo por fecha descendente, con criterio de igualdad por id descendente. No agregué selección de columna, vistas guardadas ni filtros favoritos, solo me limité el tamaño de página a 100. Preparé los índices, pero no demostré su rendimiento con cientos de miles de filas, es una prueba que considero aportaria valor. También conservé el endpoint anterior de listado por compatibilidad, aunque la búsqueda cubre su función.
- **Confidence (1–10) that the shape I picked is the right one:** 8. Aclaro mi decisión inicial de usar páginas de 50: ese es el valor predeterminado del API. En un ajuste posterior alineé también la UI a 50 filas por página, con la implementación en la UI para manejar esos filtros y la paginación. Las pruebas unitarias y la verificación en navegador respaldan el funcionamiento observado. La principal limitación de esa evidencia es que no demuestra rendimiento a gran escala ni estabilidad de las páginas bajo muchas escrituras concurrentes.
- **What would change my mind:** si el comercio necesitara texto libre sobre varios campos a la vez, replantearía el contrato de filtros por campo. Si producto definiera una zona horaria propia del comercio, recalcularía fechas basados en el formato esperado especifico de hoy y últimos días con esa definición. Si el volumen y las escrituras concurrentes causaran repeticiones o saltos entre páginas, cambiaría a paginación por cursor. El desempate por id hace determinista el orden, pero no evita que nuevas escrituras desplacen filas entre peticiones.

## Things I noticed but did NOT fix

- El listado anterior devolvía 500 con `limit=abc`. Primero lo dejé fuera del alcance porque la búsqueda cubre ese uso, pero al final lo resolví en un ajuste de backend para trabajar los query params de manera adecuada: ahora valida y responde 400.
- Revenue no validaba las fechas como la búsqueda y una fecha malformada podía producir cero silenciosamente. También quedó resuelto en ese mismo ajuste de backend: responde 400 ante fecha malformada o rango invertido, igual que la búsqueda.
- El campo `revenue` usa una división entre 100 en flotante. Priorizé el contrato de centavos enteros; ese campo es redundante.
- La autenticación por header no tiene firma. El reto la presenta como una simplificación intencional; además, queda pendiente que un merchant inexistente recibe 200 vacío.
- La detección de ejecución directa del seed es frágil. No la prioricé porque solo afecta herramientas de desarrollo.

El riesgo de XSS del render quedó resuelto con la UI nueva: los datos se insertan como texto y no como HTML. No lo cuento como pendiente.

## Docs / code I left alone deliberately

- Conservé los tests originales, que el README describe como intencionalmente delgados. Sumé 34 tests propios para cubrir los cambios.
- También mantuve el listado anterior de órdenes por compatibilidad.

## What I'd do with another 6 hours

Abordaría los webhooks sobre la capa de datos ya endurecida, ajustando su alcance al tiempo disponible. También priorizaría unificar la validación de fechas de revenue y búsqueda, preparar el retiro del listado anterior y generar cientos de miles de filas para medir el efecto de los índices. Definiría con producto la zona horaria del comercio y trabajaría en reemplazar el header por autenticación firmada.

## Where I felt uncertain

- La regex del email: un email válido raro que sea rechazado — suele pasar cuando un dominio raro no lo cubre la regex o la dependencia de validación que se use.
- La zona horaria: la base guarda UTC, y una venta de las 7pm de CDMX cae en el día siguiente UTC. Quedó en UTC, documentado.
- La disciplina no documentada de metrics: sus consultas sí filtraban adecuadamente, pero no era algo definido y bajo regla — solo suponía la disciplina. (Resuelto en el fix 4, pero fue incertidumbre real mientras decidía.)
