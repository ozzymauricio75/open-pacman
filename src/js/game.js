// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Esquinas de scatter clásicas (Namco)
const SCATTER_TARGETS = [
  { x: 25, y: 0 },   // Blinky
  { x: 2, y: 0 },    // Pinky
  { x: 27, y: 29 },  // Inky
  { x: 0, y: 29 },   // Clyde
];

// Orden de roles según GHOST_STARTS
const GHOST_ROLES = ['blinky', 'pinky', 'inky', 'clyde'];

// Ciclo de modos scatter/chase (valores razonables en frames aproximados)
const MODE_SCHEDULE = [
  { mode: 'scatter', time: 420 }, // ~7s
  { mode: 'chase', time: 1200 },  // ~20s
  { mode: 'scatter', time: 420 },
  { mode: 'chase', time: 1200 },
  { mode: 'scatter', time: 300 },
  { mode: 'chase', time: Infinity },
];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map((row) => row.slice());
  // La celda de inicio de Pacman arranca sin dot.
  grid[PACMAN_START.y][PACMAN_START.x] = 0;

  let dots = 0;
  for (const row of grid) for (const v of row) if (v === 2) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    mode: 'scatter',
    modeTimer: MODE_SCHEDULE[0].time,
    modeIndex: 0,
    ghostHouseExitTimer: 60, // ~1 segundo para salir de la casa
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map((g, i) => ({
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      type: GHOST_ROLES[i] || 'blinky',
      inHouse: true,
    })),
  };
}

function aligned(v) {
  return Math.abs(v - Math.round(v)) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall(grid, x, y, actor) {
  if (y < 0 || y >= grid.length) return true;
  if (x < 0 || x >= grid[0].length) return true;
  const v = grid[y][x];
  if (v === 1) return true;
  if (v === 3 && actor === 'pacman') return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove(grid, x, y, dir, actor) {
  const d = DIRS[dir];
  if (!d) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if (ty === TUNNEL_ROW && (tx < 0 || tx >= grid[0].length)) return true;
  return !isWall(grid, tx, ty, actor);
}

function wrapTunnel(a, width) {
  if (Math.round(a.y) === TUNNEL_ROW) {
    if (a.x < 0) a.x += width;
    else if (a.x >= width) a.x -= width;
  }
}

function movePacman(game) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[0].length;

  if (aligned(p.x) && aligned(p.y)) {
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);

    // Aplicar giro pendiente si es posible.
    if (p.nextDir && canMove(grid, p.x, p.y, p.nextDir, 'pacman')) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if (grid[p.y][p.x] === 2) {
      grid[p.y][p.x] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if (!canMove(grid, p.x, p.y, p.dir, 'pacman')) return;
  }

  const d = DIRS[p.dir];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel(p, width);
}

function getTileAhead(pacman, steps = 4) {
  const px = Math.round(pacman.x);
  const py = Math.round(pacman.y);
  const d = DIRS[pacman.dir] || { x: 0, y: 0 };
  // En el original de Namco hay un bug de Pinky al mirar hacia arriba, pero mantenemos
  // lógica simple y funcional según lo acordado
  return { x: px + d.x * steps, y: py + d.y * steps };
}

function getTarget(game, g, index) {
  const p = game.pacman;
  const grid = game.grid;
  const px = Math.round(p.x);
  const py = Math.round(p.y);
  const type = g.type || GHOST_ROLES[index] || 'blinky';

  // Blinky siempre persigue en modo chase (ignora scatter)
  if (type === 'blinky') {
    return { x: px, y: py };
  }

  // Determinar modo efectivo para este fantasma
  let effectiveMode = game.mode;
  if (type === 'blinky') {
    effectiveMode = 'chase';
  }

  if (effectiveMode === 'scatter') {
    return SCATTER_TARGETS[index] || { x: px, y: py };
  }

  // Modo chase según tipo
  if (type === 'pinky') {
    // 4 casillas delante de Pac-Man
    const ahead = getTileAhead(p, 4);
    return ahead;
  } else if (type === 'inky') {
    // Tile 2 pasos delante de Pac-Man
    const ahead2 = getTileAhead(p, 2);
    // Vector desde Blinky hasta ahead2, duplicado
    const blinky = game.ghosts[0];
    const bx = Math.round(blinky.x);
    const by = Math.round(blinky.y);
    const vx = ahead2.x - bx;
    const vy = ahead2.y - by;
    return { x: bx + vx * 2, y: by + vy * 2 };
  } else if (type === 'clyde') {
    const gx = Math.round(g.x);
    const gy = Math.round(g.y);
    const dist = Math.abs(gx - px) + Math.abs(gy - py);
    if (dist > 8) {
      // Persigue a Pac-Man
      return { x: px, y: py };
    } else {
      // Va a su esquina de scatter
      return SCATTER_TARGETS[index] || { x: px, y: py };
    }
  }

  // Por defecto, perseguir
  return { x: px, y: py };
}

function decideGhost(game, g, index) {
  const grid = game.grid;

  // Mientras esté en la casa, forzar salida hacia arriba tras liberación
  if (g.inHouse) {
    const options = Object.keys(DIRS).filter(
      (dir) => dir !== OPPOSITE[g.dir] && canMove(grid, g.x, g.y, dir, 'ghost')
    );
    const choices = options.length ? options : ['' + OPPOSITE[g.dir]];

    // Priorizar subir hacia la puerta
    if (choices.includes('up') && canMove(grid, g.x, g.y, 'up', 'ghost')) {
      g.dir = 'up';
      return;
    }

    // Si no puede subir, elegir la que más se acerque a salir (hacia y menor)
    let best = choices[0];
    let bestDist = Infinity;
    const gx = Math.round(g.x);
    const gy = Math.round(g.y);
    for (const dir of choices) {
      const d = DIRS[dir];
      const nx = gx + d.x;
      const ny = gy + d.y;
      // Preferir subir (menor y)
      const dist = (gy - ny) * 10 + Math.abs(nx - gx);
      if (dist < bestDist) {
        bestDist = dist;
        best = dir;
      }
    }
    g.dir = best;
    return;
  }

  const options = Object.keys(DIRS).filter(
    (dir) => dir !== OPPOSITE[g.dir] && canMove(grid, g.x, g.y, dir, 'ghost')
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : ['' + OPPOSITE[g.dir]];

  const target = getTarget(game, g, index);
  const gx = Math.round(g.x);
  const gy = Math.round(g.y);

  let best = choices[0];
  let bestDist = Infinity;
  for (const dir of choices) {
    const d = DIRS[dir];
    const nx = gx + d.x;
    const ny = gy + d.y;
    // Usar distancia Manhattan; fiel al original
    const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost(game, g, index) {
  const grid = game.grid;
  const width = grid[0].length;

  if (aligned(g.x) && aligned(g.y)) {
    g.x = Math.round(g.x);
    g.y = Math.round(g.y);
    // Liberar todos tras temporizador al iniciar partida
    if (game.ghostHouseExitTimer !== undefined && game.ghostHouseExitTimer <= 0 && g.inHouse) {
      g.inHouse = false;
    }
    decideGhost(game, g, index);
    if (!canMove(grid, g.x, g.y, g.dir, 'ghost')) return;
    // Detectar salida de casa (sube por encima de la puerta)
    if (g.inHouse && g.y < 12) {
      g.inHouse = false;
    }
  }

  const d = DIRS[g.dir];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel(g, width);
  // Detectar salida también durante movimiento
  if (g.inHouse && Math.round(g.y) < 12) {
    g.inHouse = false;
  }
}

function updateMode(game) {
  if (game.state !== 'playing') return;
  if (game.ghostHouseExitTimer !== undefined && game.ghostHouseExitTimer > 0) {
    game.ghostHouseExitTimer--;
    if (game.ghostHouseExitTimer <= 0) {
      // Liberar todos los fantasmas tras ~1 segundo
      if (game.ghosts) {
        game.ghosts.forEach((g) => {
          if (g.inHouse) g.inHouse = false;
        });
      }
    }
  }
  game.modeTimer--;
  if (game.modeTimer <= 0) {
    game.modeIndex++;
    if (game.modeIndex < MODE_SCHEDULE.length) {
      game.mode = MODE_SCHEDULE[game.modeIndex].mode;
      game.modeTimer = MODE_SCHEDULE[game.modeIndex].time;
    } else {
      // Mantener en chase
      game.mode = 'chase';
      game.modeTimer = Infinity;
    }
  }
}

function resetPositions(game) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach((g, i) => {
    g.x = GHOST_STARTS[i].x;
    g.y = GHOST_STARTS[i].y;
    g.dir = 'up';
    g.inHouse = true;
  });
  // Resetear modo y temporizador de salida
  game.mode = 'scatter';
  game.modeIndex = 0;
  game.modeTimer = MODE_SCHEDULE[0].time;
  if (game.ghostHouseExitTimer !== undefined) {
    game.ghostHouseExitTimer = 60;
  }
}

function collides(a, b) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

function update(game) {
  updateMode(game);
  movePacman(game);
  game.ghosts.forEach((g, i) => moveGhost(game, g, i));

  for (const g of game.ghosts) {
    if (collides(game.pacman, g)) {
      game.lives--;
      if (game.lives <= 0) {
        game.state = 'lost';
        return;
      }
      resetPositions(game);
      break;
    }
  }

  if (game.dotsRemaining <= 0) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
