# SPEC 02 — Salida rápida de los fantasmas al iniciar la partida

**Estado:** Implement  
**Depende de:** Ninguno  
**Fecha:** 2026-10-27  

## Objetivo
Hacer que los 4 fantasmas salgan de la casa fantasma mucho antes al iniciar el juego. En lugar de quedarse atrapados/estancados, deben empezar a moverse y salir al mapa aproximadamente **1 segundo después** de iniciar la partida.

## Contexto
Actualmente:
- Los fantasmas nacen en `GHOST_STARTS`: `(13,14)`, `(14,14)`, `(13,15)`, `(14,15)` (dentro de la casa fantasma).
- La puerta de la casa es la celda `'-'` = tile `3` en `maze.js` (fila 12, columnas 13-14). 
- Para Pac-Man el tile `3` está bloqueado, pero **para fantasmas NO está bloqueado** (regla ya existente).
- No hay lógica de liberación desde casa: los fantasmas no tienen un estado `inHouse` ni temporizadores de salida. Con la IA actual pueden quedarse dando vueltas o tardar demasiado en salir.

## Requisitos
- **Liberación temprana:** Al pasar a estado `playing` (al pulsar Start), todos los fantasmas deben salir de la casa aproximadamente 1 segundo después (~60 frames a 60fps).
- **Salida forzada mientras están en casa:** Mientras un fantasma esté dentro de la casa, su dirección debe forzarse hacia arriba (`'up'`) cuando sea posible para dirigirse hacia la puerta y salir.
- **Sin romper comportamiento fuera de casa:** Una vez fuera de la casa fantasma, los fantasmas deben seguir usando la lógica de IA existente (`getTarget()` + elección por menor distancia Manhattan), respetando roles (Blinky, Pinky, Inky, Clyde) y el sistema scatter/chase.
- **Aplicable al inicio de partida:** La liberación debe aplicarse al inicio (`createGame()` / `startGame()`). No es estrictamente necesario cambiar el comportamiento tras perder una vida, pero se debe mantener coherente con el resto del juego.
- **Respetar reglas existentes:** Los fantasmas solo bloqueados por muros (`1`). Pueden atravesar la puerta (`3`). Debe respetarse el túnel (`TUNNEL_ROW`) y el movimiento fraccionario con `aligned()`.
- **Sin mutar `MAZE`:** Seguir usando copia de grid en `createGame()`.

## Diseño propuesto

### 1. Estado del juego (`src/js/game.js`)
- Añadir `ghostHouseExitTimer` al objeto devuelto por `createGame()`. Inicializarlo a `60` (frames, ~1 segundo). 
- Este temporizador debe decrementarse solo cuando `game.state === 'playing'`.

### 2. Estado de cada fantasma
- Añadir `inHouse: true` a cada fantasma creado en `createGame()`. 
- Cuando un fantasma salga de la casa (cruce la puerta/salga al pasillo exterior), marcar `g.inHouse = false`. 
- Al resetear posiciones tras perder vida (`resetPositions()`), volver a poner los fantasmas en casa (`inHouse: true`) y reiniciar el temporizador de liberación si se considera necesario para mantener el comportamiento pedido. Dado que el pedido es "apenas inicia el juego", al menos debe funcionar correctamente al inicio.

### 3. Lógica de liberación (`src/js/game.js`)
- En `update()`, decrementar `game.ghostHouseExitTimer` si `game.state === 'playing'`.
- Cuando `game.ghostHouseExitTimer <= 0`, marcar **todos** los fantasmas con `inHouse: false` (liberación simultánea tras ~1 segundo, tal como se pide).

### 4. Movimiento/salida forzada (`src/js/game.js`)
- En `decideGhost(game, g, index)`:
  - Si `g.inHouse === true`:
    - Forzar prioridad a subir hacia arriba: intentar dirección `'up'` primero si `canMove(grid, g.x, g.y, 'up', 'ghost')` es true.
    - Si no puede ir hacia arriba, elegir la dirección que mejor permita salir hacia la zona de la puerta/salir de la casa (acercarse a la fila superior de la casa hacia la puerta). Mantener lógica simple: preferir `'up'`, sino intentar las otras direcciones válidas (sin dar media vuelta innecesariamente, pero permitir si es callejón sin salida).
  - Si `g.inHouse === false`: mantener lógica actual (calcular target con `getTarget()` y elegir dirección por menor distancia Manhattan).
- En `moveGhost()`: cuando el fantasma esté alineado en celda y esté en casa, aplicar la lógica forzada. También detectar cuando sale de la casa para poner `g.inHouse = false` (por ejemplo, al cruzar la puerta o al salir fuera del área de la casa). Una forma sencilla: si el fantasma ya no está dentro del rectángulo/zona de la casa o si su posición está por encima de la puerta, marcarlo como fuera.

**Nota sobre detección de salida:** La casa ocupa aproximadamente las filas 12-15. La puerta está en fila 12. Cuando el fantasma suba por encima de la puerta hacia el pasillo (y = 11 o menos en esa zona), considerarlo fuera de casa.

### 5. Ajustes en inicialización/reset
- En `createGame()`: inicializar `ghostHouseExitTimer: 60`, y para cada fantasma añadir `inHouse: true`, `dir: 'up'`.
- En `resetPositions()`: volver a colocar fantasmas en `GHOST_STARTS`, poner `dir: 'up'`, `inHouse: true`, y reiniciar `game.ghostHouseExitTimer = 60` (para que tras perder vida también salgan rápido al reanudar, manteniendo el comportamiento fluido).

## Criterios de aceptación
- [ ] Al iniciar partida (Start), tras ~1 segundo los 4 fantasmas dejan de estar "atrapados" y se mueven hacia arriba para salir de la casa.
- [ ] Todos salen aproximadamente al mismo tiempo (~1s después de iniciar) o empiezan a salir tras ese temporizador, sin quedarse bloqueados indefinidamente en la casa.
- [ ] Fuera de la casa mantienen comportamiento IA distinto por rol (Blinky persigue, Pinky embosca, Inky combina con Blinky, Clyde alterna según distancia).
- [ ] No se rompe el sistema scatter/chase, túnel, colisiones ni reglas de muros/puerta.
- [ ] Funciona con el orden actual de scripts en `src/index.html` (sin módulos).

## Archivos a modificar
- `src/js/game.js` (crear estado, temporizador, lógica de salida forzada, reset)
- `src/js/main.js` (opcional, solo si es necesario para asegurar el flujo)

## Verificación manual
1. Abrir `src/index.html` en navegador
2. Pulsar Start
3. Observar que a los ~1 segundo los fantasmas empiezan a subir y salen de la casa hacia el pasillo
4. Comprobar que fuera de casa siguen con sus patrones de movimiento distintos
5. Perder una vida y comprobar que se reposicionan y vuelven a salir tras ~1s
