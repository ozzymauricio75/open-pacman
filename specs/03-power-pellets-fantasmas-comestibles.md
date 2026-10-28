# SPEC 03 — Power Pellets y fantasmas comestibles

**Estado:** Implemented  
**Depende de:** Ninguno  
**Fecha:** 2026-10-27  

## 1. Objetivo
Añadir **power pellets** (energizadores) al laberinto para que, al comerlos, los fantasmas se vuelvan vulnerables durante un tiempo limitado. Cuando están en modo *frightened*, Pac-Man podrá comérselos (suman puntos con la cadena clásica), enviándolos de vuelta a la casa para que renazcan. Al finalizar el tiempo, los fantasmas vuelven a su comportamiento *scatter/chase* normal.

## 2. Alcance
- Añadir 4 power pellets colocados en las esquinas clásicas.
- Nuevo tile `4` para representar los power pellets en la grid.
- Modo **frightened** global activado al comer un power pellet.
- Fantasmas vulnerables: se dibujan en azul y, al acercarse al final del tiempo, parpadean entre azul y blanco.
- Al colisionar con un fantasma vulnerable y **no comido**, Pac-Man se lo come: suma puntos según cadena clásica, lo envía a casa como "ojos" (`eaten`).
- Los fantasmas comidos (`eaten`) vuelven a la casa, ignoran colisión letal y se regeneran allí para salir de nuevo con la lógica de salida rápida existente.
- Los power pellets se cuentan para la victoria (`dotsRemaining` debe incluirlos).
- Al perder vida (`resetPositions`), se limpia el estado *frightened/eaten* de los fantasmas y se reinicia el temporizador de frightened.
- Se mantiene todo el comportamiento existente (muros, túnel, puerta, salida rápida, IA de los 4 roles).

## 3. Estado actual relevante
- Puntos: `.` -> tile `2`, se cuentan en `dotsRemaining`, al comer se ponen a `0` y suman 10.
- Fantasmas con roles `blinky/pinky/inky/clyde`, `inHouse`, `ghostHouseExitTimer`, sistema `scatter/chase`, `getTarget()`, `decideGhost()`, `moveGhost()`.
- Colisión mata a Pac-Man (resta vida, `resetPositions()`, pierde con `lives <= 0`), gana con `dotsRemaining <= 0`.
- `render.js` dibuja puntos, muros, puerta, Pac-Man y fantasmas por color.

## 4. Diseño propuesto

### 4.1 Laberinto / `src/js/maze.js`
- Añadir soporte para el carácter `o` (minúscula) en `MAZE_STR`. Parsearlo como tile `4` en `parseTile()`: `if (ch === 'o' || ch === 'O') return 4;`
- Colocar **4 power pellets** en las **esquinas clásicas** sustituyendo 4 puntos `.` por `o`. Se decidirán las posiciones óptimas mirando el `MAZE_STR` actual.
- `MAZE` debe seguir siendo prístino (se copia en `createGame()`).

### 4.2 Estado / `src/js/game.js`
Ampliar objeto devuelto por `createGame()`:
- `frightenedTimer: 0` (frames restantes en modo frightened; 0 inactivo)
- `frightenedDuration: 420` (~7 segundos a 60fps)
- `ghostsEatenInFright: 0` (contador para la cadena de puntos)
- `dotsRemaining`: contar **tiles `2` + tiles `4`** al copiar la grid

Por cada fantasma añadir flags:
- `frightened: false`
- `eaten: false` (true = ya comido, modo "ojos", vuelve a casa)

### 4.3 Comer power pellet / `src/js/game.js` (`movePacman()`)
Cuando Pac-Man esté alineado en celda:
- Si `grid[y][x] === 2`: comportamiento actual (sumar 10, poner a 0, `dotsRemaining--`)
- Si `grid[y][x] === 4`: 
  - Poner `grid[y][x] = 0`
  - Sumar **50** puntos
  - `game.dotsRemaining--`
  - Activar modo frightened: `game.frightenedTimer = game.frightenedDuration`, `game.ghostsEatenInFright = 0`
  - Para todos los fantasmas **vivos** (`!g.eaten`): poner `g.frightened = true`

### 4.4 Modo frightened / `src/js/game.js` (`updateMode()`)
- Si `game.state === 'playing'` y `game.frightenedTimer > 0`: decrementar `game.frightenedTimer` cada frame
- Al llegar a `0`:
  - Desactivar `frightened` para todos los fantasmas **no comidos** (`!g.eaten` -> `g.frightened = false`)
  - Resetear `game.ghostsEatenInFright = 0`

### 4.5 IA de fantasmas / `src/js/game.js` (`decideGhost()`, `getTarget()`)
Prioridades:
1. **Si `g.eaten === true`**: fantasma comido ("ojos"). Debe volver a casa para renacer. Target hacia la zona de casa (usar centro de `GHOST_STARTS`, ej. `(13,14)`). Ignorar frightened/scatter/chase normales. Una vez llegue/esté en casa y alineado, pasar a `g.eaten = false`, `g.frightened = false`, `g.inHouse = true`, `g.dir = 'up'`.
2. **Si `g.frightened === true && g.eaten === false`**: vulnerable. **No** usar targeting agresivo. Elegir dirección válida (excluyendo giro 180° si hay alternativas) **aleatoriamente** entre las opciones válidas. Respetar túnel, puerta solo bloquea a Pac-Man, muros `1`.
3. **Si normal**: mantener lógica existente.

### 4.6 Colisiones / `src/js/game.js` (`update()`)
En el bucle de colisión:
- Si `collides(pacman, g)`:
  - Si `g.frightened && !g.eaten`: **comer fantasma**
    - `game.ghostsEatenInFright++`
    - Puntos: `200 * (2 ** (game.ghostsEatenInFright - 1))` -> 200, 400, 800, 1600
    - `game.score += puntos`
    - Marcar `g.eaten = true`, `g.frightened = false`
    - Enviar a casa: colocar en `GHOST_STARTS`, poner `g.inHouse = true`, `g.dir = 'up'`
    - **No** restar vida
  - Si `g.eaten`: ignorar
  - Si normal: comportamiento actual (restar vida, `resetPositions()` si quedan vidas, `lost` si `lives <= 0`)

### 4.7 Reset al perder vida / `src/js/game.js` (`resetPositions()`)
- Colocar Pac-Man en inicio
- Colocar fantasmas en `GHOST_STARTS`, `dir = 'up'`, `inHouse = true`
- `g.frightened = false`, `g.eaten = false` para todos
- Reiniciar modo `scatter/chase` a inicio, `ghostHouseExitTimer = 60`
- `game.frightenedTimer = 0`, `game.ghostsEatenInFright = 0`

### 4.8 Render / `src/js/render.js`
- **Power pellets**: círculos más grandes (radio ~6-7), parpadeo con `frame` (visible cada 8 frames)
- **Fantasmas vulnerables**: azul `#2121ff`, parpadean entre azul/blanco en últimos ~60 frames
- **Fantasmas comidos**: solo ojos
- Mantener colores normales

## 5. Criterios de aceptación
- [ ] Hay 4 power pellets en las esquinas
- [ ] Al comer pellet se activa frightened (~7s), se reinicia contador
- [ ] Fantasmas vulnerables azules, parpadean al final
- [ ] Comer fantasma da 200/400/800/1600, se convierte en ojos y vuelve a casa
- [ ] Ojos no matan, vuelven a casa y renacen
- [ ] Al acabar frightened vuelven a scatter/chase
- [ ] Comer todo (puntos+pellets) lleva a `won`
- [ ] Al perder vida se limpia estado y sale rápido
- [ ] No se rompe comportamiento existente

## 6. Archivos a modificar
- `src/js/maze.js`
- `src/js/game.js`
- `src/js/render.js`
