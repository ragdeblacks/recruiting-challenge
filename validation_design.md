# Validation design — Edgar Alberto Sanabria Paredes

## Authorship declaration

Usé IA para contrastar mis notas con el código y los tests, ademas de guiarme adecuadamente con la barrera del lenguaje. Las decisiones son basadas en mi experiencia profesional, mi criterio y tambien lo que la IA puede complementar.

---

## Clase 1 — Aislamiento multi-tenant (IDOR)

**Instancias:** acceso a órdenes ajenas por id y alcance por comercio en revenue, metrics y búsqueda.

**Gate construido:** los métodos de lectura de ordersDal exigen merchantId y filtran en su nombre, la funcion getById(id) ya no existe. Además, extendí las pruebas de encapsulamiento a los métodos que usa cada consumidor: `test/orders.test.ts:41`, `test/revenue.test.ts:98`, `test/metrics.test.ts:64` y `test/search.test.ts:81`.

**Qué cubre:** cuando se usen estos métodos hereda el alcance por comercio.

**Pendiente:** todavía depende de respetar la arquitectura. Con más tiempo agregaría una regla de imports restringidos en el linter: solo db.ts abre SQLite y las rutas no importan el driver ni la conexión db directamente. Así impediría repetir el desvío de metrics. No construí ese gate por tiempo; recibir merchantId tampoco demuestra por sí solo que una consulta nueva lo use correctamente.

## Clase 2 — Integridad del libro contable

**Instancias:** montos negativos, decimales o NaN, tipos como banana y emails inválidos.

**Gate construido:** STRICT y CHECKs de monto, tipo, status y forma básica de email (`src/db.ts:21`). El test de `test/order-validation.test.ts:51` inserta directamente, saltándose el validador, y exige rechazo de datos inválidos. NaN se prueba en el validador (`:17`). La migración conserva en cuarentena las filas que incumplen su predicado de validación.

**Qué cubre:** futuros caminos de escritura siguen sujetos al esquema. El POST da errores 400 entendibles; la base protege los datos aunque otro consumidor olvide validar.

**Límite:** el CHECK de email es permisivo y no garantiza ausencia de HTML. La protección del render quedó en textContent. La migración todavía necesita validación sobre una copia representativa antes de producción.

## Clase 3 — Semántica de dinero y fechas

**Instancias:** rembolsos sumados como ingreso, exclusión del día final y formatos de fecha distintos.

**Gates construidos:** revenueByMerchant concentra el cálculo de revenue: ventas menos rembolsos, solo completed (`src/dal/orders-dal.ts:179`). El test de invariante genera 200 movimientos aleatorios y compara contra una suma independiente (`test/revenue.test.ts:108`). Los tests de frontera fijan días inclusivos, inclusión de hoy y formato ISO (`:72`, `:80`, `:86`); búsqueda comprueba también el día final (`test/search.test.ts:74`).

**Qué cubren:** combinaciones adicionales de movimientos y refactors que alteren los límites del rango. El test aleatorio no es exhaustivo; las fechas siguen bajo el contrato UTC, pendiente de definición con producto.

## Lo que quedó fuera

No construí el lint de imports ni la prueba de rendimiento con cientos de miles de filas por tiempo. Dejé los índices preparados, pero eso no demuestra rendimiento a escala.
