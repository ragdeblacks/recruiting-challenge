# Written answers — Edgar Alberto Sanabria Paredes

## Authorship declaration

Estas experiencias son de mi trabajo. Compartí mis decisiones, lo que construí y los problemas que enfrenté; usé IA para revisar las referencias y ayudarme a redactar este documento con ese contexto. *(English below is an AI translation of my Spanish original; the Spanish version at the end of this file is canonical.)*

---

## My background

I have worked as a frontend architect and mobile tech lead, defining the foundation of applications and taking them to production. At a microfinance company I took charge of rebuilding in Flutter an internal tool for the entire field operation. The work covered architecture, service integration, security and delivery. The operation served a portfolio of roughly 2,000 clients.

I also built my own application for small businesses: a point of sale with mobile operation in Flutter and web administration. There I owned both the architecture and the implementation. My experience includes making the technical decisions of a product and building what is needed to turn those decisions into a working tool.

## Q1 — How I validated that a replacement produced the correct results

At a bank I took charge of a migration of financial reports that were spread across several Java repositories. The original developer was gone. The files were used by accounting and operations, so generating a report without execution errors was not enough: I had to prove the figures were correct.

I built a parity tool and ran the new system in parallel with the live one. I compared files for the same day, aligning rows and checking figures. The tool returned a success or error code so the result did not depend on a visual review. I also used the history of consecutive green days as the criterion to move the migration forward.

At first, differences in decimal formats, columns and paths put noise into the review. I defined accepted equivalences to distinguish those differences from a real error. We also found a new version of a report that produced exactly the same output as the previous one, even though it was supposed to change.

That case showed the limit of the comparison: reproducing the legacy system did not guarantee meeting a new requirement. The validation had to consider both parity on what had to be preserved and the differences we did expect to introduce.

## Q2 — The internal application I rebuilt from the architecture to production

At a microfinance company we needed a tool for the entire field operation, which served a portfolio of roughly 2,000 clients. The need was to cover the team's work across the credit cycle and take advantage of the capabilities of the mobile device.

The project had started in Ionic with another person. When I took it over, I found an architecture poorly suited for what we needed to build and maintain. As the frontend architect, I proposed rebuilding it in Flutter and defined the foundation from the start: separation of domain, data and presentation, service integration and offline-first operation.

The application integrated queries to a credit bureau, prospect registration, client follow-up, document capture and information validation. It also covered the follow-up of validations, credit disbursement and renewal processes. It was an internal tool for the complete operation.

The project took a year and I carried it to production. I was responsible from the architecture to the delivery process. The structural change responded to the operational scope we needed to cover and to the capabilities of the device. The figure of 2,000 corresponded to the clients in the portfolio served by the team.

## Q3 — When I accepted an AI configuration that did not control consumption

I put four AI agents to review several large frontend PRs in parallel. I gave each agent a budget of 120 thousand tokens in the prompt. I accepted the configuration because I assumed that instruction would limit the work. The reviews looked correct and that made me trust the process.

The signal that flipped my judgment was the real consumption: each agent spent between 179 and 218 thousand tokens, around 770 thousand across the four. The combined budget was 480 thousand. We had exceeded the plan by roughly 60%.

The mistake was assuming that a restriction written in the prompt was enforced during execution. The reviews being useful did not solve that problem: the process was consuming more than what I had authorized as a budget.

Afterwards I reduced the scope assigned to each reviewer and configured turn limits outside the prompt. That did not turn the turns into an exact token budget either, but it did establish a mechanism that could stop the execution.

From that experience I changed my acceptance criterion: besides reviewing what the AI delivered, I had to verify how the work was controlled and how much it cost to produce that result.

---

## Original en español (versión canónica)

### Declaración de autoría

Estas experiencias son de mi trabajo. Compartí mis decisiones, lo que construí y los problemas que enfrenté; usé IA para revisar las referencias y ayudarme a redactar este documento con ese contexto.

### Mi experiencia

He trabajado como arquitecto frontend y líder técnico móvil, definiendo la base de aplicaciones y llevándolas hasta producción. En una empresa de microfinanzas me hice cargo de reconstruir en Flutter una herramienta interna para toda la fuerza operativa. El trabajo incluyó arquitectura, integración de servicios, seguridad y entrega. La operación atendía una cartera de aproximadamente 2,000 clientes.

También construí una aplicación propia para negocios: un punto de venta con operación móvil en Flutter y administración web. Ahí me hice cargo tanto de la arquitectura como de la implementación. Mi experiencia incluye tomar las decisiones técnicas del producto y construir lo necesario para que esas decisiones se conviertan en una herramienta de trabajo.

### Q1 — Cómo validé que un reemplazo produjera los resultados correctos

En un banco me hice cargo de una migración de reportes financieros que estaban distribuidos en varios repositorios Java. El desarrollador original ya no estaba. Los archivos se usaban en contabilidad y operaciones, así que generar un reporte sin errores de ejecución no era suficiente: tenía que comprobar que las cifras fueran correctas.

Construí una herramienta de paridad y ejecuté el sistema nuevo en paralelo con el vigente. Comparé archivos del mismo día, alineando filas y revisando cifras. La herramienta devolvía un código de éxito o error para que el resultado no dependiera de una revisión visual. Usé también el historial de días en verde como criterio para avanzar con la migración.

Al principio aparecieron diferencias de formato decimal, columnas y rutas que metían ruido en la revisión. Definí las equivalencias aceptadas para distinguir esas diferencias de un error real. También encontramos una versión nueva de un reporte que producía exactamente lo mismo que la anterior, aunque debía cambiar.

Ese caso mostró el límite de la comparación: reproducir el legado no garantizaba cumplir un requerimiento nuevo. La validación tenía que considerar tanto la paridad de lo que debía conservarse como las diferencias que sí esperábamos introducir.

### Q2 — La aplicación interna que reconstruí desde la arquitectura hasta producción

En una empresa de microfinanzas necesitábamos una herramienta para toda la fuerza operativa, que atendía una cartera de aproximadamente 2,000 clientes. La necesidad era cubrir el trabajo del equipo durante el ciclo del crédito y aprovechar las capacidades del dispositivo móvil.

El proyecto había comenzado en Ionic con otra persona. Cuando lo tomé, encontré una arquitectura mal planteada para lo que necesitábamos construir y mantener. Como arquitecto frontend, propuse la reconstrucción en Flutter y definí la base desde el inicio: separación de dominio, datos y presentación, integración con servicios y operación offline-first.

La aplicación integró consultas a una sociedad de información crediticia, registro de prospectos, seguimiento de clientes, captura de documentación y validación de información. También cubrió el seguimiento de las validaciones, el desembolso de créditos y los procesos de renovación. Era una herramienta interna para la operación completa.

El proyecto tomó un año y lo llevé hasta producción. Me hice cargo desde la arquitectura hasta el proceso de entrega. El cambio estructural respondió al alcance operativo que necesitábamos cubrir y a las capacidades del dispositivo. La cifra de 2,000 correspondía a los clientes de la cartera atendida por el equipo.

### Q3 — Cuando acepté una configuración de IA que no controlaba el consumo

Puse cuatro agentes de IA a revisar en paralelo varios PRs grandes de un frontend. A cada agente le indiqué en el prompt un presupuesto de 120 mil tokens. Acepté la configuración porque asumí que esa instrucción limitaría el trabajo. Las revisiones parecían correctas y eso me hizo confiar en el proceso.

La señal que cambió mi juicio fue el consumo real: cada agente gastó entre 179 mil y 218 mil tokens, alrededor de 770 mil entre los cuatro. El presupuesto conjunto era de 480 mil. Habíamos superado lo previsto aproximadamente un 60 %.

El error estuvo en asumir que una restricción escrita en el prompt se hacía cumplir durante la ejecución. Que las revisiones fueran útiles no resolvía ese problema: el proceso estaba consumiendo más de lo que yo había autorizado como presupuesto.

Después reduje el alcance asignado a cada revisor y configuré límites de turnos fuera del prompt. Eso tampoco convertía los turnos en un presupuesto exacto de tokens, pero sí establecía un mecanismo que podía detener la ejecución.

A partir de esa experiencia cambié mi criterio de aceptación: además de revisar lo que entregaba la IA, tenía que verificar cómo se controlaba el trabajo y cuánto costaba producir ese resultado.
