# AGENTS.md

## Visión general
Clone vanilla de Pac-Man (HTML/CSS/JS). Solo archivos estáticos, sin build, sin gestor de paquetes ni runner de tests.

## Cómo ejecutar
- Abrir `src/index.html` directamente en el navegador (`file://`) o servir el directorio `src/` con cualquier servidor estático.
- **Orden de scripts obligatorio** (ver `src/index.html`): `src/js/maze.js` → `src/js/game.js` → `src/js/render.js` → `src/js/main.js`. No convertir a ES Modules sin actualizar este orden.

## Spec Driven Development
Este proyecto está orientado a aprender **Spec Driven Development** (ver `README.md`).

- **Skills disponibles**: En `.agents/skills/` y registrados en `skills-lock.json` hay dos skills de `klerith/fernando-skills` relevantes:
  - `spec` – para crear/definir la especificación antes de implementar.
  - `spec-impl` – para guiar la implementación a partir de esa especificación.
- **Regla**: Si vas a añadir o modificar funcionalidad, prioriza seguir el flujo *spec → impl* usando esos skills en lugar de codificar directamente.

## Arquitectura
- **Laberinto / grid** (`src/js/maze.js`): Matriz 28x31 parseada desde `MAZE_STR`. Tiles: `#` muro (1), `.` punto (2), `-` puerta del corral (3), espacio vacío transitable (0). Exporta globals `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`. `GHOST_STARTS` define las 4 posiciones iniciales de los fantasmas (en orden). `MAZE` debe permanecer prístino: `createGame()` hace una copia por partida.
- **Estado y reglas** (`src/js/game.js`): Usa globals de `maze.js`. Exporta `createGame()`, `update(game)`, `DIRS` a `window`.
  - Se copia la grid y se limpia la celda de inicio de Pacman. Los puntos se cuentan en `dotsRemaining`.
  - **Reglas de muros distintas**: Pacman bloqueado por muros (1) y puerta (3). Los fantasmas solo bloqueados por muros (1).
  - **Túnel**: Si el actor está en `TUNNEL_ROW`, cruzar los bordes horizontales está permitido (`canMove` / `wrapTunnel`).
  - **Velocidades**: `PACMAN_SPEED = 0.125`, `GHOST_SPEED = 0.1`. Movimiento fraccionario con chequeos `aligned()` para encajar en celdas al girar/decidir.
  - **IA fantasmas (clásico Namco)**: Se asignan 4 roles por orden de `GHOST_STARTS`: `blinky` (rojo), `pinky` (rosa), `inky` (cian), `clyde` (naranja).
    - **Sistema de modos global**: `scatter`/`chase` con temporizador (`modeTimer`). `blinky` **ignora el modo scatter** y persigue agresivamente a Pac-Man en modo *chase* permanente.
    - **Targeting**:
      - `blinky`: Persigue directamente al tile de Pac-Man.
      - `pinky`: Apunta a 4 casillas delante de la dirección actual de Pac-Man (emboscada).
      - `inky`: Usa la posición de `blinky` + el vector desde `blinky` hacia el tile 2 casillas delante de Pac-Man (duplicado) para obtener su objetivo.
      - `clyde`: Si la distancia Manhattan a Pac-Man > 8 tiles, persigue directamente. Si <= 8 tiles, huye hacia su esquina de *scatter*.
    - **Movimiento**: Selección de dirección por menor distancia Manhattan al *target*. Solo gira 180° si es un callejón sin salida. Respeta túnel y puerta (los fantasmas pueden atravesar la puerta `3`).
  - **Colisión / fin**: Al colisionar se resta vida y se resetean posiciones (`resetPositions`), **no** se reinicia la grid completa. Pierde con `lives <= 0`. Gana cuando `dotsRemaining <= 0`.
- **Render** (`src/js/render.js`): Dibuja desde `game.grid` (los puntos desaparecen al comérselos). Canvas 560x620 (28*20 x 31*20). Los muros se dibujan uniendo centros de celdas adyacentes; la puerta se dibuja aparte. Cada fantasma se dibuja con su color según su rol. Exporta `draw(ctx, game, frame)` a `window`.
- **Entrada / bucle** (`src/js/main.js`): Las flechas guardan `game.pacman.nextDir` solo en estado `playing`. Overlay para inicio/ganar/perder. Usa `createGame`, `update`, `draw` vía globals. Estados: `start` → `playing` → `won` / `lost`.

## Trampas a evitar
- **Sin bundler/módulos**: Todo comparte estado vía `window.*`. Si migras a ES Modules, **obligatorio** actualizar el orden de `<script>` en `src/index.html`.
- **No mutar `MAZE`**: Siempre usar la copia de `createGame()`. Comer un punto pone `grid[y][x] = 0`.
- **Túnel especial**: La lógica de wrap está condicionada por `TUNNEL_ROW`.
- **Puerta exclusiva**: La celda tipo `3` bloquea a Pacman pero **no** a los fantasmas.
- **Movimiento fraccionario**: Los giros, decisiones y paradas dependen de `aligned()` por las velocidades fraccionarias por frame
