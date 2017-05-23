// Game Objects
import FireBall from '../../classes/shared/FireBall';
import PlayerCharacter from '../../classes/shared/PlayerCharacter';

// Constants & Enumerations
import MessageTypes from '../../classes/MessageTypes';
import TileTypes from '../../classes/TileTypes';
import SpriteTypes, { SpriteClassMap } from '../../classes/SpriteTypes';
import PlayerActions from '../../classes/PlayerActions';

// Game Managers
import GameSettings from '../../classes/GameSettings';

// tile canvas
const tileCanvas = document.querySelector('#tileCanvas');
const tileContext = tileCanvas.getContext('2d');
// sprite canvas
const spriteCanvas = document.querySelector('#spriteCanvas');
const spriteContext = spriteCanvas.getContext('2d');
// UI canvas / div ---- // TODO???
// Cursor canvas
const cursorCanvas = document.querySelector('#cursorCanvas');
const cursorContext = cursorCanvas.getContext('2d');

// Modes
const MODE_PLAY = 'PLAY';
const MODE_EDIT = 'EDIT';

// Application globals
const client = {
  token: undefined,
};
const TILE_SCALE = GameSettings.TILE_SCALE;
const gameMode = MODE_PLAY;

const TileColorMap = new Map();
TileColorMap.set(TileTypes.DIRT, '#5b2607');
TileColorMap.set(TileTypes.GRASS, 'green');
TileColorMap.set(TileTypes.ROCK, 'grey');
TileColorMap.set(TileTypes.WATER, 'blue');
TileColorMap.set(TileTypes.PIT, 'black');
TileColorMap.set(TileTypes.BRIDGE, '#7c4b2e');

const SpriteTextureMap = new Map();
SpriteTextureMap.set(SpriteTypes.CHEST, './images/ChestClosed.png');
SpriteTextureMap.set(SpriteTypes.FIREBALL, './images/FireballStatic.png');
SpriteTextureMap.set(SpriteTypes.PLAYER, './images/PlayerOverhead.png');

const ImageLoader = new Map();

let playerCharacter = null;

// level tiles / objects for map the player is currently on.
let tileMap = [];
let sprites = []; // SPRITE

// Start socket
function startSocketClient() {
  // TODO: Does this cause conflicts if called more than once?
  let sock = null;
  try {
    sock = client.socket || new WebSocket(`ws://${location.hostname}:8080/`);
    client.socket = sock;
  } catch(ex) {
    console.log("Error: ", ex);
    console.log("If you're testing on the server, did you remember to use localhost?")
  }

  sock.onmessage = function onmessage(event) {
    const message = JSON.parse(event.data);

    switch (message.type) {
      case MessageTypes.Who:
        sendPackage(MessageTypes.Who, { who: 'James:df8c8023ae' });
        break;
      case MessageTypes.Authentication:
        if (message.success === true) {
          LoginSucceeded(message);
        } else {
          LoginFailed(message.error);
        }
        break;
      case MessageTypes.Port:
        console.log('PORTED');
        if (message.success === true) {
          console.log(message);
          tileMap = message.level.tileMap;
          sprites.push(...message.level.sprites); // SPRITE
          message.level.sprites.forEach(s => {
            sprites[s.instanceId] = s
          });
          
          const pcIndex = sprites.findIndex(s => s.instanceId === client.instanceId); // SPRITE
          playerCharacter = Object.assign(new PlayerCharacter(), sprites[pcIndex]); // SPRITE
          sprites[pcIndex] = playerCharacter; // SPRITE

          playerCharacter.setPosition(message.playerCharacter.position);

          sprites.push(playerCharacter); // SPRITE
          // TODO: Can we determine if this is a first load?
          drawCanvas();
        } else {
          console.log("Message was not successful!!!!", message);
        }
        break;
      case MessageTypes.MoveTo:
        console.log("Attempted to move: ", message);
        playerCharacter.setPosition(message);
        drawSprites();
        break;
      case MessageTypes.Spawn:
        console.log('Spawn info: ', message);
        if(!message.spawnClass) {
          console.error("No spawn class provided.");
          return;
        }
        const spawnClass = SpriteClassMap.get(message.spawnClass);
        if(message.spawn.instanceId === playerCharacter.instanceId) return;
        const newSpawn = Object.assign(new spawnClass(), message.spawn);
        sprites.push(newSpawn);
        sprites[newSpawn.instanceId] = newSpawn;
        break;
      case MessageTypes.Despawn:
        console.log('Despawn Message: ', message); // message.spawnId
        sprites.splice(sprites.findIndex(s => s.instanceId === message.spawnId), 1);
        sprites[message.spawnId] = undefined;
        break;
      case MessageTypes.FrameQueue:
        // TODO: finish below
        //    ... console.log("FrameQueue received: ", message.queue);
        message.queue.forEach((item) => {
          if(item.type === MessageTypes.UpdateSprite) {
            const spriteUpdateInfo = JSON.parse(item.sprite);
            if(spriteUpdateInfo.instanceId === playerCharacter.instanceId) return;
            //console.log(spriteUpdateInfo.position);
            const spriteToUpdate = sprites[spriteUpdateInfo.instanceId];
            if(spriteToUpdate) {
              Object.assign(spriteToUpdate, spriteUpdateInfo);
              //console.log(spriteToUpdate);
            } else {
              console.log("couldn't find sprite.", spriteUpdateInfo);
            }
          }
        });
        drawSprites();
        // TODO: Draw sprite changes all in one go - DO NOT draw them in each iteration above.
        break;
      case MessageTypes.DEBUG:
        console.log('Debug package received. Message: ' + message.message);
        break;
      default:
        console.log('Message type not recognized: ', message);
        break;
    }
  };

  sock.onclose = function onclose(something) {
    console.log('Socket Closed -> ', something);
    // TODO: Set a timer to attempt to reconnect.
  };
  sock.onerror = function onerror(something) {
    console.log('Some Error -> ', something);
    // TODO: Determine conditions for reconnect and then use them to create reconnect logic.
  };
}

// Pipeline message handlers
function LoginSucceeded(message = {}) {
  if (!message.token) return;
  client.token = message.token; // Save to global for later use.
  toast('Welcome', 'Connected to server.');

  client.instanceId = JSON.parse(message.playerCharacter).instanceId;
  //playerCharacter = Object.assign(new PlayerCharacter(), JSON.parse(message.playerCharacter));

  // TODO: Show loading message.
  startGame();
}

function LoginFailed(error = 'not defined') {
  /* eslint-disable no-alert */
  toast('YOU FAILED!!!');
  toast("PS. Who doesn't hate alerts?");
  toast('Oh and the error was: ', error);
}

function toast(title = 'Toast', message) {
  // TODO: Develop/borrow toaster alert

  const t = document.querySelector('#toast__template');

  const tToast = t.content.querySelector('.toast');
  const toastDiv = document.importNode(tToast, true);

  const tClose = toastDiv.querySelector('.toast__close');
  const tTitle = toastDiv.querySelector('.toast__title');
  const tMessage = toastDiv.querySelector('.toast__message');

  tTitle.textContent = title;
  tMessage.textContent = message;
  tClose.addEventListener('click', (e) => {
    // Start CSS animation. Takes 2.5 seconds.
    toastDiv.classList.add('closing');
    // Remove after completely faded out. (2.5 seconds)
    setTimeout(() => { toastDiv.parentElement.removeChild(toastDiv); }, 2500);
    e.stopPropagation();
  });

  document.querySelector('#toasts').appendChild(toastDiv);
}

// Set up canvas: (Note: may need to use this later to reinit when screen size changes.)
function initCanvas() {
  handleResize();
  if (tileMap.length > 0) drawCanvas(); // TODO: Put this in a timed loop?
}

function handleResize() {
  spriteCanvas.width = cursorCanvas.width = tileCanvas.width = document.body.offsetWidth;
  spriteCanvas.height = cursorCanvas.height = tileCanvas.height = document.body.offsetHeight;
  drawCanvas();
}

// Draw canvas
function drawCanvas() {
  tileContext.fillStyle = 'cyan';
  // clear bg
  tileContext.fillRect(0, 0, tileCanvas.width, tileCanvas.height);

  // draw background tiles
  drawBackground();

  // draw sprites
  drawSprites();

  // TODO: draw HUD
}

const drawBackground = function drawBackground() {
  // TODO: Rewrite using array functions for looping.
  for (let r = 0; r < tileMap.length; r += 1) {
    const row = tileMap[r];
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      tileContext.fillStyle = TileColorMap.get(cell);
      tileContext.fillRect(c * TILE_SCALE, r * TILE_SCALE, TILE_SCALE, TILE_SCALE);
    }
  }
};

const drawSprites = function drawSprites() {
  // TODO: Check differences. Only erase previous sprites if they moved and redraw???

  // but for now, lets just clear sprites and redraw
  spriteContext.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);

  sprites.forEach((sprite) => {  // SPRITE
    // DEBUG: console.log("SPRITES: ", sprites);
    const color = sprite.color || TileColorMap.get(sprite.type) || '#FFFFFF';

    if (sprite instanceof FireBall) {
      drawSprite(sprite.position.x, sprite.position.y, SpriteTextureMap.get(SpriteTypes.FIREBALL), sprite.angle);
    } else if (sprite instanceof PlayerCharacter) {
      drawSprite(sprite.position.x, sprite.position.y, SpriteTextureMap.get(SpriteTypes.PLAYER), sprite.angle || 0);
      //drawCircle(sprite.tx, sprite.ty, (TILE_SCALE / 2) - 2, color);
    } else {
      // console.log("Other type of sprite: ", sprite.type, sprite.position, typeof sprite);

      drawSprite(sprite.position.x, sprite.position.y, SpriteTextureMap.get(sprite.type));
    }
  });
};

// Canvas helper functions
const drawCircle = function drawCircle(x, y, radius = TILE_SCALE, fill = '#FFFFFF', strokeColor = '#000000') {
  const centerX = (x * TILE_SCALE) + (TILE_SCALE / 2);
  const centerY = (y * TILE_SCALE) + (TILE_SCALE / 2);

  tileContext.beginPath();
  tileContext.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  tileContext.fillStyle = fill;
  tileContext.fill();
  tileContext.lineWidth = 1;
  tileContext.strokeStyle = strokeColor;
  tileContext.stroke();
};

const drawSprite = function drawSprite(x, y, imageSource, angle = null) {
  // const imgElement = document.querySelector('#image-loader');

  let imgElement = ImageLoader.get(imageSource);
  let rotAngle = 0;
  if (angle) {
    rotAngle = angle;
  }
  if (!imgElement) {
    imgElement = new Image();
    imgElement.src = imageSource;
    const onImageLoad = () => {
      spriteContext.translate(x , y);
      spriteContext.rotate(rotAngle);
      spriteContext.drawImage(imgElement, -16, -16);
      spriteContext.rotate(-rotAngle);
      spriteContext.translate(-x, -y);

      ImageLoader.set(imageSource, imgElement);
      imgElement.removeEventListener('load', onImageLoad);
    };
    // TODO: handle errors where images are not found.
    imgElement.addEventListener('load', onImageLoad);
  } else {
    spriteContext.translate(x, y);
    spriteContext.rotate(rotAngle);
    spriteContext.drawImage(imgElement, -16, -16);
    spriteContext.rotate(-rotAngle);
    spriteContext.translate(-x, -y);
  }
};

function keyPressed(keyName) {
  // If the keyName starts with Unmapped...
  if (keyName.toUpperCase().indexOf('UNMAPPED') === 0) {
    const code = parseInt(keyName.split(':')[1], 10);
    console.log(`Unmapped key pressed: ${code}`);
  } else {
    sendPackage(MessageTypes.KeyPressed, { action: keyName });
  }
}
function keyReleased(keyName) {
  if (keyName.indexOf('UNMAPPED') === 0) {
    const code = parseInt(keyName.split(':')[1], 10);
    console.log(`Unmapped key released: ${code}`);
  } else {
    sendPackage(MessageTypes.KeyReleased, { action: keyName });
  }
}


const keyMap = [
  { code: 65, action: PlayerActions.LEFT }, // a
  { code: 65, action: PlayerActions.LEFT },
  { code: 37, action: PlayerActions.LEFT }, // left arrow
  { code: 87, action: PlayerActions.UP }, // w
  { code: 38, action: PlayerActions.UP }, // up arrow
  { code: 68, action: PlayerActions.RIGHT }, // d
  { code: 39, action: PlayerActions.RIGHT }, // right arrow
  { code: 83, action: PlayerActions.DOWN }, // s
  { code: 40, action: PlayerActions.DOWN }, // down arrow
  { code: 16, action: PlayerActions.SHIFT },
];

// Low Level Event Handlers
function keyDown(e) {
  const keyInfo = keyMap.find(k => k.code === e.keyCode);
  if (keyInfo) {
    keyPressed(keyInfo.action);
  } else {
    keyPressed(`${PlayerActions.UNMAPPED}:${e.keyCode}`);
  }
}
function keyUp(e) {
  const keyInfo = keyMap.find(k => k.code === e.keyCode);
  if (keyInfo) {
    keyReleased(keyInfo.action);
  } else {
    keyReleased(`${PlayerActions.UNMAPPED}:${e.keyCode}`);
  }
}
function mouseMove(e) {
  cursorCanvas.focusedTileCoords = {
    tx: Math.floor(e.clientX / TILE_SCALE),
    ty: Math.floor(e.clientY / TILE_SCALE)
  };

  clearCursors();
  drawCursors();
}
function mouseClick(e) {
  sendPackage(MessageTypes.KeyPressed, { 
    action: PlayerActions.MOUSE_ACTION_1, 
    start: playerCharacter.position, 
    aim: { x: e.clientX, y: e.clientY }
  });
}
function spawnFireball(paramsObj) {
  // fireball is flavor like image and particle systems
  // fireball should inherit from projectile // projectile manages speed and angle and updates position
  // projectile should inherit from sprite // sprite is an object with a visual representation that shows up above the tiled map
  // sprite should inherit from gameobject // Gameobject is something that belongs to a map. It has a position, but does not necessarily have a representation.
  const fireball = new FireBall(
    { 
      start: paramsObj.start, // start
      aim: paramsObj.aim, // aim at
      speed: paramsObj.speed // speed
    }
  );
  fireball.delete = () => {
    sprites = sprites.filter(s => s !== this); // SPRITE
  };
  sprites.push(fireball); // SPRITE
  drawCanvas();
}

function getCanvasCoords(info) {
  return {
    tx: Math.floor(info.x / TILE_SCALE) || -1,
    ty: Math.floor(info.y / TILE_SCALE) || -1,
  };
}

function clearCursors() {
  cursorContext.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
}

function updateCursors() {
  clearCursors();
  drawCursors();
}

function drawCursors() {
  const cursors = [
    {
      type: 'SELECTED',
      source: './images/SelectionCursorSelected.png',
      tx: (cursorCanvas.selectedTileCoords && cursorCanvas.selectedTileCoords.tx) || 0,
      ty: (cursorCanvas.selectedTileCoords && cursorCanvas.selectedTileCoords.ty) || 0
    },
  ];
  if (gameMode === MODE_EDIT) {
    cursors.push({
      type: 'FOCUSED',
      source: './images/SelectionCursorFocused.png',
      tx: (cursorCanvas.focusedTileCoords && cursorCanvas.focusedTileCoords.tx) || 0,
      ty: (cursorCanvas.focusedTileCoords && cursorCanvas.focusedTileCoords.ty) || 0
    });
  }
  cursors.forEach((cursor) => {
    if (cursor.tx === null || cursor.ty === null) return;
    const cursorSource = cursor.source;
    let cursorElement = ImageLoader.get(cursorSource);
    if (!cursorElement) {
      cursorElement = new Image();
      cursorElement.src = cursorSource;
      const onImageLoad = () => {
        cursorContext.drawImage(cursorElement, cursor.tx * TILE_SCALE, cursor.ty * TILE_SCALE);
        ImageLoader.set(cursorSource, cursorElement);
        cursorElement.removeEventListener('load', onImageLoad);
      };
      // TODO: handle errors where images are not found.
      cursorElement.addEventListener('load', onImageLoad);
    } else {
      cursorContext.drawImage(cursorElement, cursor.tx * TILE_SCALE, cursor.ty * TILE_SCALE);
    }
  });
}

// Event Handler Abstractions
const tryMovePlayer = function tryMovePlayer(dir) {
  // TODO: ensure we are allowed to move in the direction we want to before attempting to move.
  const newPosition = {
    tx: playerCharacter.tx,
    ty: playerCharacter.ty,
  };
  switch (dir) {
    case 'LEFT':
      newPosition.tx = playerCharacter.tx - 1;
      break;
    case 'RIGHT':
      newPosition.tx = playerCharacter.tx + 1;
      break;
    case 'UP':
      newPosition.ty = playerCharacter.ty - 1;
      break;
    case 'DOWN':
      newPosition.ty = playerCharacter.ty + 1;
      break;
    default:
      console.log('Invalid Direction');
      break;
  }
  if (isWalkable(newPosition)) {
    playerCharacter.tx = newPosition.tx;
    playerCharacter.ty = newPosition.ty;
  } else {
    // TODO: play "can't walk" sound.
  }

  drawCanvas();
};
const isWalkable = function isWalkable(tile) {
  // tile should have at minimum: { x , y }
  if (tile.ty < 0 || tile.tx < 0) return false;

  const tileTypeAtPosition = tileMap[tile.ty][tile.tx];

  if ([TileTypes.DIRT, TileTypes.GRASS, TileTypes.BRIDGE].includes(tileTypeAtPosition)) {
    if (!sprites.filter(s => s.tx === tile.tx && s.ty === tile.ty).length > 0) { // SPRITE
      return true;
    }
  }
  return false;
};

function initEventHandlers() {
  document.onkeydown = keyDown;
  document.onkeyup = keyUp;
  document.addEventListener('mousemove', mouseMove);
  document.addEventListener('click', mouseClick);
  window.onresize = handleResize;
  document.ondragstart = (e) => e.preventDefault();
  document.addEventListener('mousedown', function(e) {
    if(e.button === 2) {
      console.log("DOWN: " + e.button);
      e.preventDefault();
      return;
    }
  })
  document.addEventListener('mouseup', function(e) {
    if(e.button === 2) {
      console.log("UP: " + e.button);
      e.preventDefault();
      return;
    }
  })
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  })
}

// server side
// function updateSprites(delta) {
//   sprites.forEach((sprite) => { // SPRITE
//     if (sprite.update) {
//       sprite.update(delta);
//     }
//   });
// }

// Initiate game
function startGame() {
  initCanvas();
  initEventHandlers();
  sendPackage(MessageTypes.Port, { levelId: 1 });
  updateLoop();
}

let loopTime = performance.now();
function updateLoop(timestamp = performance.now()) {
  if(client.socket.readyState !== WebSocket.OPEN) {
    toast("Websocket has closed.");
    return;
  }
  const delta = (timestamp - loopTime) / 1000;
  loopTime = timestamp;
  // updateSprites(delta);
  drawCanvas();

  // ensure next frame runs.
  window.requestAnimationFrame(updateLoop);
}

const sendPackage = function sendPackage(type = null, attributes = {}) {
  if (type === null) throw new Error('Package type must be specified.');

  client.socket.send(JSON.stringify(Object.assign({ type }, attributes)));
};

startSocketClient(); // TODO: Need to monitor and reconnect
