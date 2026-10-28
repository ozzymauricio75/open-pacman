# SPEC 01 — Cuatro fantasmas con comportamientos distintos (Clásico Namco)

**Estado:** Approved  
**Depende de:** Ninguno  
**Fecha:** 2026-10-27  
**Objetivo:** Implementar los 4 fantasmas con comportamientos distintos siguiendo el esquema clásico Namco (Blinky, Pinky, Inky, Clyde), con Blinky persiguiendo agresivamente a Pac-Man (modo chase permanente), manteniendo el sistema global scatter/chase, asignando colores distintos a cada uno y sin implementar el modo frightened en esta spec.

## Alcance

### Dentro del alcance
- Asignar roles clásicos a los 4 fantasmas: **Blinky** (rojo), **Pinky** (rosa), **Inky** (cian), **Clyde** (naranja).
- Implementar IA con targeting distinto por fantasma (clásico Namco).
- **Blinky agresivo:** persigue directamente a Pac-Man en modo chase y **ignora el modo scatter** (permanece persiguiendo de forma agresiva).
- Mantener el sistema **global scatter/chase** con temporizador para Pinky, Inky y Clyde.
- Implementar las esquinas de scatter clásicas para cada fantasma.
- Añadir lógica de targeting para Pinky (emboscada, 4 casillas delante de Pac-Man), Inky (combinación con Blinky + 2 casillas delante) y Clyde (huye a su esquina cuando está cerca, persigue cuando está lejos).
- Asignar colores distintos por fantasma en `render.js`.
- Adaptar la IA en `game.js` respetando las reglas existentes (túnel, puerta solo bloquea a Pac-Man, movimiento fraccionario con `aligned()`, velocidades actuales).
- Hacer los cambios mínimos necesarios en `maze.js` si se requiere para soportar roles/esquinas.

### Fuera del alcance
- **Modo frightened/vulnerable** al comer una power pill (queda fuera de esta spec).
- Cambios en el sistema de vidas, puntos, win/lose, overlay o bucle principal (`main.js`) salvo ajustes estrictamente necesarios para que la nueva IA funcione.
- Añadir power pills o mecánicas nuevas.
- Crear nuevos modos de juego, menú o configuración.
- Cambiar las físicas de movimiento, velocidades base o reglas del túnel/puerta.
- Comportamientos completamente personalizados fuera del esquema Namco.

## Modelo de datos

Se introducirán los siguientes elementos (nombres concretos a mantener):

- **Roles de fantasmas** (`ghosts[].type` o equivalente): `blinky`, `pinky`, `inky`, `clyde`. Se asignarán según el orden de `GHOST_STARTS` para mantener compatibilidad con el inicio actual.
- **Esquinas de scatter** (constantes): coordenadas de target para cada fantasma en modo scatter (clásicas). Se definirán en `game.js` o `maze.js` según convenga, sin mutar `MAZE`.
- **Modo global**: estado `scatter`/`chase` con temporizador (`modeTimer`) compartido por todos los fantasmas. **Excepción:** `blinky` ignora este modo y siempre usa targeting de chase.
- **Target por fantasma**: cada fantasma calcula su `target` (tile `{x,y}`) según su rol:
  - `blinky`: posición actual de Pac-Man (target directo).
  - `pinky`: casilla 4 pasos delante de Pac-Man en su dirección actual.
  - `inky`: usa posición de Blinky + vector desde 2 pasos delante de Pac-Man (fórmula clásica Namco).
  - `clyde`: si distancia a Pac-Man > 8 tiles persigue (target = Pac-Man), si <= 8 tiles va a su esquina de scatter.
- **Colores**: mapeo por tipo de fantasma para dibujado en `render.js` (distintos para los 4).

**Nota:** No se introduce persistencia. Todo es estado efímero por partida (`createGame()` seguirá copiando el maze).

## Plan de implementación

1. **Definir roles y datos base**  
   - Asignar `blinky`, `pinky`, `inky`, `clyde` a los fantasmas en orden usando `GHOST_STARTS`.  
   - Añadir constantes para esquinas de scatter por fantasma.  
   - Añadir mapeo de colores por rol para el render.

2. **Implementar sistema de modos global**  
   - Añadir `mode` (`'scatter'|'chase'`), `modeTimer` y ciclo de tiempos clásico (o valores razonables y verificables) en el estado del juego.  
   - Actualizar el temporizador en `update(game)`.  
   - Asegurar que **solo Blinky** ignore el cambio a scatter (siga en lógica de chase).

3. **Calcular targeting por fantasma**  
   - Implementar helpers: obtener tile delante de una entidad según dirección, obtener tile redondeado, distancia en tiles.  
   - `blinky`: target = tile de Pac-Man.  
   - `pinky`: target = tile 4 delante de Pac-Man.  
   - `inky`: obtener tile 2 delante de Pac-Man, calcular vector desde posición de Blinky hacia ese tile y duplicarlo para obtener target.  
   - `clyde`: calcular distancia tile a Pac-Man; si > 8 → target Pac-Man, si <= 8 → target esquina de scatter de Clyde.

4. **Actualizar IA de movimiento**  
   - Reemplazar la lógica actual (`hunter` + aleatorio) por selección de dirección basada en **target por rol**.  
   - Mantener regla: **no dar media vuelta a menos que sea un callejón sin salida** (comportamiento existente).  
   - Respetar reglas de bloqueo: fantasmas solo bloqueados por muros (`1`). **Puerta (`3`) NO bloquea a fantasmas**.  
   - Mantener lógica de túnel (`TUNNEL_ROW` + `wrapTunnel`).  
   - Mantener movimiento fraccionario y uso de `aligned()`.

5. **Actualizar render**  
   - Dibujar cada fantasma con su color según rol (`blinky` rojo, `pinky` rosa, `inky` cian, `clyde` naranja).  
   - No cambiar formas/animaciones existentes salvo color.

6. **Verificación y ajustes**  
   - Comprobar que hay exactamente 4 fantasmas con comportamientos distintos observables.  
   - Comprobar que Blinky persigue constantemente incluso teóricamente en fase scatter.  
   - Comprobar que Pinky embosca, Inky se comporta de forma menos directa, Clyde alterna entre perseguir y huir a esquina según distancia.  
   - Verificar que túnel, puerta (Pac-Man bloqueado, fantasmas no) y colisión/vidas siguen funcionando como antes.

## Criterios de aceptación

- [ ] **Cuatro fantasmas**: El juego tiene exactamente 4 fantasmas con roles `blinky`, `pinky`, `inky`, `clyde`.
- [ ] **Colores distintos**: Cada fantasma se dibuja con un color distinto e identificable.
- [ ] **Blinky agresivo**: `blinky` persigue directamente a Pac-Man de forma consistente y **no se dirige a su esquina de scatter** (ignora el modo scatter global).
- [ ] **Pinky emboscador**: `pinky` apunta a una casilla delante de Pac-Man (comportamiento de emboscada observable).
- [ ] **Inky impredecible**: `inky` usa la combinación con `blinky` + casilla delante de Pac-Man (diferente a los demás).
- [ ] **Clyde errático**: `clyde` persigue cuando está lejos de Pac-Man y va hacia su esquina de scatter cuando está cerca (cambio observable según distancia).
- [ ] **Modos globales**: Existe ciclo scatter/chase para Pinky, Inky y Clyde; Blinky permanece en chase.
- [ ] **Reglas intactas**: Fantasmas siguen sin poder atravesar muros (`1`), pueden atravesar la puerta (`3`), túnel funciona con `TUNNEL_ROW`, Pac-Man sigue bloqueado por puerta (`3`).
- [ ] **Sin frightened**: No se ha implementado modo asustado/vulnerable en esta spec.
- [ ] **Sin regresiones**: Vidas, colisión, reset de posiciones, conteo de puntos, victoria/derrota y bucle de juego siguen funcionando como antes.

## Decisiones tomadas y descartadas

**Tomadas:**
- **Esquema clásico Namco (a):** Más fiel al Pac-Man original, reconocible y verificable sin inventar comportamientos arbitrarios.
- **Blinky siempre en chase / agresivo (a):** Cumple explícitamente "uno de ellos debe perseguir agresivamente a Pac-Man".
- **Colores distintos (a):** Necesarios para identificar visualmente cada comportamiento.
- **Modos globales scatter/chase (a):** Se mantiene el sistema global pero con excepción para Blinky (agresivo permanente). Cada fantasma interpreta su target distinto, creando la diferenciación.
- **Sin frightened (c):** Fuera de alcance por decisión explícita.
- **Cambios mínimos (a):** Solo tocar lo necesario (`game.js`, `render.js`, `maze.js` si imprescindible) manteniendo el resto intacto.

**Descartadas:**
- **Comportamientos completamente personalizados (b):** Descartado en favor del clásico para evitar ambigüedad y facilitar verificación.
- **Solo velocidades distintas para agresividad (c):** Se opta por targeting distinto + Blinky en chase permanente, no solo aumentar velocidad.
- **Frightened diferenciado o implementado (a/b):** Descartado por estar fuera de alcance.
- **IA independiente sin modos globales (b):** Descartado para mantener mayor fidelidad al esquema clásico acordado.

## Riesgos identificados

- **Cálculo de Inky**: La fórmula clásica depende correctamente de la posición de Blinky y del tile 2 pasos delante de Pac-Man. Un error en el vector produce un comportamiento poco reconocible.
- **Orden de GHOST_STARTS**: Asignar roles por orden es frágil si se reordena en el futuro, pero es lo menos invasivo y coincide con tener 4 posiciones definidas.
- **Excepción de Blinky**: Olvidar forzar a Blinky a permanecer en chase rompería el requisito "persigue agresivamente".
- **Coherencia con movimiento fraccionario**: Los targets deben calcularse con tiles alineados/enteros (`Math.round`/lógica basada en celdas) para no interferir con `aligned()` y las velocidades fraccionarias.
- **Reglas de puerta/túnel**: Cualquier cambio accidental al `canMove` podría romper la excepción (fantasmas sí pueden cruzar puerta). Hay que mantener esa distinción estricta.
