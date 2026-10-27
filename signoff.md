# Sign-off — Edgar Alberto Sanabria Paredes

## Authorship declaration

La decisión final de cada veredicto es mía, el asistente organizó los datos de cada commit y analice junto con ella y redacte este documento de acuerdo a lo esperado para el reto.

---

## Sign-offs

- `d2c6626` — *"fix: Funcion que separa ingresos y reembolsos (los rembolsos se sumaban como parte de los ingresos)"*
  Contenido: método de revenue neto en la capa de datos (ventas menos rembolsos en SQL), la UI de revenue consumiéndolo, tests de revenue.
  Veredicto: Lo analice en conjunto con la IA. Revisé que las ventas no tenian distincion entre ingresos y rembolsos, los ajustes adicionales a estos fue agregar la consulta filtra por merchant y que los tests contemplan neto negativo y ausencia de movimientos. Para esta corrección del cálculo neto, la interpretación de los días se corrige en el commit de fechas.

- `f3323d1` — *"fix: restringe acceso a ordenes por parte de comercios a los que no les corresponde la orden - conocer el id de orden"*
  Contenido: getById ahora exige merchantId, respuesta 404 para órdenes ajenas, ajuste en la creación de órdenes, tests de tenancy.
  Veredicto: Hice una pruena colocando una orden que no corresponde al negocio, la IA me ayudo a confirmar. Realice un ajuste para que getById exija merchantId, que el SQL filtre por merchant e id y que estos cambios aplicaran a la creación, ahora tambien recupera la orden con ese mismo alcance y que la UI devuelve 404 para una orden ajena.

- `5ab7359` — *"fix: Se definen reglas que evitan la insercion de datos sin validacion en la tabla de ordenes"*
  Contenido: validación del POST (monto entero positivo, tipos, email), tabla STRICT con CHECKs, migración que reconstruye la tabla y manda la basura a cuarentena, tests de validación. (El SQL de la migración es la pieza más grande generada en un solo commit.)
  Veredicto: Con ayuda de los querys de la IA me di cuenta del problema, la tabla no tiene restricciones, y el codigo tampoco las tenia en la data layer. Estoy seguro de la dirección del cambio: validar antes del INSERT y reforzar montos, tipos y estados en la base. Donde podria mis dudas es sobre la reconstrucción de una base existente y la conservación del histórico en cuarentena; los tests de este commit cubren el validador y las restricciones, pero no esa migración. Querría probarla sobre una copia representativa, conciliar filas y montos, y comprobar recuperación ante un fallo antes de producción. La validación de email de la base es más especifica que la del POST, ademas de que garantiza que la deuda tecnica no se arastre a otras funcionalidades similares.

- `40ea705` — *"fix: Ajuste de metrrics, eliminacion de deuda tecnica y alienacion a arquitectura"*
  Contenido: summaryByMerchant y topCustomersByMerchant en la capa de datos (promedio solo ventas, top por gasto neto), eliminación de la segunda conexión SQLite de metrics.ts, tests de metrics.
  Veredicto: Despues del hallazgo anterior, me di cuenta que habia una clase que se escapa a las restricciones de data layer (esta fuera de la arquitectura). Con la correccion aseguro de que las consultas pasan por la capa de datos, respetando las correcciones anteriores. La incertidumbre está en la definición de negocio: contar únicamente ventas y ordenar clientes por gasto neto.

- `8fddead` — *"fix: Ajuste de rango de fechas para incluir venta del dia en ultimos 30 dias"*
  Contenido: rangos de fechas como días completos (created_at < date(to, '+1 day')) en revenue y listado, normalización del formato de created_at dentro de la migración, tests de fechas.
  Veredicto: En la observacion inicial segun el reto no me cuadraban las cuentas, y la IA me ayudo a encontrar que si tenia un punto. Revisé el límite superior exclusivo del día siguiente y los tests que incluyen el último instante del día final y excluyen la medianoche siguiente por el formato date y datetime. Tengo dudas con respecto a formato UTC, y tome desiciones basadas en mexico pero sigo incierto sobre si ese día coincide con el que espera el comercio y sobre la migración del histórico. Querría acordar la zona horaria con producto y probar la normalización.

- `a846d4a` — *"feat: endpoint de buscador de ordenes, con filtros"*
  Contenido: searchByMerchant en la capa de datos (filtros combinables, desempate por id, total para paginar), search-validation.ts (todas las validaciones con 400 detallado), endpoint GET /api/orders/search, tests de búsqueda. (El validador es la pieza más densa.)
  Veredicto: La ia me ayudo a resolver este. Revisé el merchant obligatorio, los parámetros del SQL, el escape de comodines del email, los filtros combinados y el desempate por id. Estoy seguro del comportamiento cubierto con un conjunto de datos fijo, no del rendimiento con cientos de miles de filas ni de la estabilidad entre páginas con escrituras concurrentes.

- `b69a7c6` — *"feat: Implementacion de endpoint de busqueda en UI"*
  Contenido: app.js reescrito (barra de filtros, pills, presets, chips, debounce, estado en URL, paginación, estado vacío, render con textContent) e index.html con la nueva estructura y estilos. (El archivo con más líneas generadas de un jalón.)
  Veredicto: Dado los ajustes que realice me parece que este es el feature mas adecuado para darle cierre a las implementaciones a los fixes.

## Estado posterior a estos siete commits

- `42f9cf1` — *"fix: Correccion de paginado, limpieza de query params y ajusta de validacion de fechas (info ingresos)"*
  Contenido: ajuste en backend para trabajar con los filtros de manera adecuada (el listado viejo valida `limit` y fechas con 400; revenue valida formato y orden del rango con 400, igual que la búsqueda) y la implementación en la UI para manejar esos filtros y la paginación (50 filas por página, igual que el default del API).
  Nota: la IA, a pesar de solicitar la implementacion segun una limitante de 100, tomo la desicion de 50 por pedirle la investicacion de alguna dependencia para gestionar datos en tabla de UI.
