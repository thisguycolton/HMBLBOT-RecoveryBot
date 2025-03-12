import { Controller } from "@hotwired/stimulus";
import { Application, Text, Graphics, Container, Sprite, Texture, Assets, Spritesheet } from "pixi.js";
import { DropShadowFilter } from "pixi-filters";
import { Loader } from '@pixi/loaders';
import { sound } from '@pixi/sound';

export default class extends Controller {


static values = {
  topicsUrl: String,
  topicCategoriesUrl: String,
  initialized: Boolean,
  animationInProgress: Boolean,
  currentPlayer: Object,      // Stores the current player data
  currentSession: Object,      // Stores the current session data
  isLoading: Boolean,           // Tracks loading states
  usedTopics: Array
};

// Example item definitions
static itemDefinitions = {
  boat: {
    id: 'boat',
    icon: '🚣', // or a texture ID
    maxStack: 1,
    isConsumable: true,
    uses: 1
  },
  healingPotion: {
    id: 'healingPotion',
    icon: '⚕️', // or a texture ID
    maxStack: 4,
    isConsumable: true,
    uses: 1
  },
  skeletonKey: {
    id: 'skeletonKey',
    icon: '🗝️', // or a texture ID
    maxStack: 16,
    isConsumable: true,
    uses: 1
  }
};
static tileProperties = {
  tileSize: 100,
  padding: 2,
  borderRadius: 0,
  sprites: {
    grass: '1',
    path: '2',
    water: '3'
  }
};

constructor(...args) {
  super(...args);
  this.initialized = false;
  this.animationInProgress = false;
  this.animationHandle = null;
  this.points = 5;
  this.usedTopics = [];
  this.tileSprites = null; 
}

static categoryColors = {
  Reflection: 0xCC4B00,   // Darkened from 0xFF6F61
  Gratitude: 0xDAA520,    // Darkened from 0xFFD700
  'Step Reflection': 0x4B2E83, // Darkened from 0x6B5B95
  Support: 0x228B22,     // Darkened from 0x88B04B
  Mantra: 0xCC375B,      // Darkened from 0xF7CAC9
  Challenge: 0x4682B4,    // Darkened from 0x92A8D1
  Milestone: 0x786C3B,    // Darkened from 0x955251
  Serenity: 0x6B3FA3,     // Darkened from 0xB565A7
  'Random Act of Kindness': 0x8B0000, // Darkened from 0xDD4124
  Traditions: 0x008B45,   // Darkened from 0x009B77
};


async connect() {
  super.connect();
  this.initialized = false;
  this.currentPlayer = null;
  this.currentSession = null;
  this.isLoading = false;

  // Show the login screen
  this.showLoginScreen();
}

disconnect() {
  super.disconnect();
  this.currentPlayer = null;
  this.currentSession = null;
}


async loadSavedGameState(sessionId) {
  try {
    this.isLoading = true;
    const response = await fetch(`/api/v1/quest_sessions/${sessionId}`);
    const data = await response.json();
    const gameState = data.game_state;

    this.usedTopics = gameState.usedTopics || [];

    console.log('Loaded game state:', gameState);
    console.log('Loaded grid:', gameState.grid);

    // Convert the grid object to a Map
    const gridEntries = Object.entries(gameState.grid || {});
    this.grid = new Map();
    gridEntries.forEach(([key, tileData]) => {
      const [x, y] = key.split(',').map(Number);
      const tile = {
        key,
        x,
        y,
        type: tileData.type,
        visited: tileData.visited,
        unlocked: tileData.unlocked,
        canBeWater: tileData.canBeWater,
        isStructure: tileData.isStructure,
        structureId: tileData.structureId,
        size: tileData.size,
        topicCategory: tileData.topicCategory ? {
          id: tileData.topicCategory.id,
          title: tileData.topicCategory.title
        } : null
      };
      this.grid.set(key, tile);
    });

    console.log('Grid size after loading:', this.grid.size);

    // Check if grid has entries
    if (this.grid.size === 0) {
      console.log('Grid is empty - initializing starting area');
      this.initializeStartingArea();
    }

    this.currentPosition = gameState.current_position || { x: 0, y: 0 };
    console.log('Current position:', this.currentPosition);

    // Initialize the game with the loaded state
    this.points = gameState.points || 5;
    this.inventory = gameState.inventory || {};

    await this.loadIcons();

    this.updatePointsDisplay();

    // Render the grid
    this.renderGrid();
    this.centerOnPlayer(this.currentPosition);
    this.updateHotbarDisplay();

    console.log('Game state loaded successfully');
  } catch (error) {
    console.error('Error loading game state:', error);
  }
  this.isLoading = false;
}


showLoginScreen() {
  this.isLoading = true;
  const loginScreen = document.createElement('div');
  loginScreen.className = 'login-screen';
  loginScreen.innerHTML = `
    <h2>Welcome to the Adventure Game</h2>
    <input type="text" id="screen-name" placeholder="Enter your screen name...">
    <button id="join-button">Join Game</button>
  `;

  const joinButton = loginScreen.querySelector('#join-button');
  const screenNameInput = loginScreen.querySelector('#screen-name');

  joinButton.addEventListener('click', async () => {
  const screenName = screenNameInput.value.trim();
  if (!screenName) return;

  try {
    await this.createOrFindPlayer(screenName);
    this.hideLoginScreen();
  } catch (error) {
    console.error('Error joining game:', error);
  }
});

  document.body.appendChild(loginScreen);
  this.loginScreen = loginScreen;
}

hideLoginScreen() {
  if (this.loginScreen) {
    this.loginScreen.remove();
    this.loginScreen = null;
  }
}

async createOrFindPlayer(screenName) {
  try {
    const response = await fetch('/api/v1/quest_players/create_by_screen_name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken()
      },
      body: JSON.stringify({ 
        quest_player: { 
          screen_name: screenName 
        } 
      })
    });

    if (!response.ok) throw new Error('Failed to create or find player');

    const data = await response.json();
    this.currentPlayer = data;
    console.log('Player created or found:', data);
    
    // Show the session list after creating or finding the player
    this.showSessionList();
  } catch (error) {
    console.error('Error creating or finding player:', error);
    throw error;
  }
}

  async loadFont() {
    return new Promise((resolve) => {
      window.WebFontConfig = {
        google: {
          families: ['Silkscreen'],
        },
        active: () => {
          resolve();
        },
      };

      this.loadWebFontLoader();
    });
  }

  async loadData() {
    try {
      await Promise.all([this.fetchTopics(), this.fetchTopicCategories()]);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  
  showSessionList() {
  this.isLoading = true;
  const sessionList = document.createElement('div');
  sessionList.className = 'session-list';
  sessionList.innerHTML = `
    <h2>Welcome, ${this.currentPlayer.screen_name}!</h2>
    <h3>Your Sessions</h3>
    <div id="session-list"></div>
    <button id="create-session">Create New Session</button>
  `;

  const sessionListContainer = sessionList.querySelector('#session-list');
  const createSessionButton = sessionList.querySelector('#create-session');

  createSessionButton.addEventListener('click', async () => {
    await this.createSession();
    this.reloadSessionList();
  });

  this.reloadSessionList(sessionListContainer);

  document.body.appendChild(sessionList);
  this.sessionList = sessionList;
}

// In the reloadSessionList method
async reloadSessionList(container = null) {
  try {
    const response = await fetch(`/api/v1/quest_players/${this.currentPlayer.id}/quest_sessions`);
    const sessions = await response.json();

    const sessionListContainer = container || this.sessionList.querySelector('#session-list');
    sessionListContainer.innerHTML = '';

    if (sessions.length === 0) {
      const noSessionsMessage = document.createElement('div');
      noSessionsMessage.textContent = 'No previous sessions found. Click "Create New Session" to start a new adventure!';
      sessionListContainer.appendChild(noSessionsMessage);
    } else {
      sessions.forEach(session => {
        const sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        sessionElement.innerHTML = `
          <div>${new Date(session.created_at).toLocaleDateString()}</div>
          <div>Join Code: ${session.join_code}</div>
          <button class="delete-session">🗑️</button>
        `;

        const deleteButton = sessionElement.querySelector('.delete-session');
        deleteButton.addEventListener('click', async (e) => {
          e.stopPropagation(); // Prevent joining the session when deleting
          if (confirm('Are you sure you want to delete this session?')) {
            await this.deleteSession(session.id);
            this.reloadSessionList(sessionListContainer);
          }
        });

        sessionElement.addEventListener('click', () => this.joinSession(session));
        sessionListContainer.appendChild(sessionElement);
      });
    }

    this.isLoading = false;
  } catch (error) {
    console.error('Error loading sessions:', error);
    this.isLoading = false;
  }
}

// Add this deleteSession method
async deleteSession(sessionId) {
  try {
    const response = await fetch(`/api/v1/quest_sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken()
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Session deleted:', data);
    return data;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
}



async createSession() {
  try {
    // Initialize the game properly first
    await this.initializeGame();
    
    // Initialize the starting area
    this.initializeStartingArea();
    
    // Get the current game state
    const gameState = {
      grid: Array.from(this.grid.entries()).reduce((acc, [key, tile]) => {
        acc[key] = {
          type: tile.type,
          unlocked: tile.unlocked,
          visited: tile.visited,
          canBeWater: tile.canBeWater,
          isStructure: tile.isStructure,
          structureId: tile.structureId,
          size: tile.size
        };
        return acc;
      }, {}),
      current_position: this.currentPosition,
      points: this.points,
      inventory: this.inventory
    };

    // Create a new session with the initialized game state
    const response = await fetch(`/api/v1/quest_players/${this.currentPlayer.id}/quest_sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken()
      },
      body: JSON.stringify({
        quest_session: {
          join_code: this.generateJoinCode(),
          game_state: gameState
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create session: ${error}`);
    }

    const session = await response.json();
    this.currentSession = session;
    console.log('Session created:', session);
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}

generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async joinSession(session) {
  try {
    this.isLoading = true;
    this.currentSession = session;
    
    // First initialize the game properly
    await this.initializeGame();
    
    // Then load the saved game state
    await this.loadSavedGameState(session.id);
    
    // Hide the session list after loading the session
    this.hideSessionList();

  } catch (error) {
    console.error('Error joining session:', error);
    this.isLoading = false;
  }
}

hideSessionList() {
  if (this.sessionList) {
    this.sessionList.remove();
    this.sessionList = null;
  }
}

async initializeGame() {
  try {
    this.isLoading = true;
    
    // Initialize Pixi.js application
    this.app = new Application();
    await this.app.init({ 
      backgroundColor: '#1099bb',
      resizeTo: window,
      width: window.innerWidth,
      height: window.innerHeight
    });

    // Add game elements
    this.element.appendChild(this.app.view);
    
    // Set up tile properties
    this.tileSize = this.constructor.tileProperties.tileSize;
    this.padding = this.constructor.tileProperties.padding;
    this.borderRadius = this.constructor.tileProperties.borderRadius;

    // Initialize grid
    this.grid = new Map();

    // Load assets
    await this.preloadAssets();
    await this.loadSpritesheet();
    await this.loadIcons();

    // Create UI elements
    this.createCopyButton(); 
    this.createPointsDisplay(); // Create points display first
    this.createHotbar();
    this.addSaveButton(this.currentSession?.id); // Pass sessionId if available

    // Initialize the tileset
    this.tileSprites = new Spritesheet(
      Texture.from('https://acid-test.s3.us-west-2.amazonaws.com/game-sprites/ClassicRPG_Sheet-sheet.png'),
      await fetch('https://acid-test.s3.us-west-2.amazonaws.com/game-sprites/ClassicRPG_Sheet.json').then(res => res.json())
    );
    await this.tileSprites.parse();

    // Initialize game state
    if (this.currentSession) {
      await this.loadSavedGameState(this.currentSession.id);
    } else {
      this.initializeStartingArea();
      this.currentPosition = this.getTile(0, 0);
    }

    // Render the grid
    this.renderGrid();
    this.centerOnPlayer(this.currentPosition);

    this.isLoading = false;
  } catch (error) {
    console.error('Error initializing game:', error);
    this.isLoading = false;
  }
}

async preloadAssets() {
  try {
    this.topicCategories = await this.fetchTopicCategories(); // Ensure topicCategories is set first
    if (!this.topicCategories || this.topicCategories.length === 0) {
      console.log('No topic categories available - using default categories');
      this.topicCategories = [
        { id: 'default', title: 'Default Category', color: 0x808080 }
      ];
    }

    // Proceed with loading assets
    for (const category of this.topicCategories) {
      if (category.icon) {
        const iconUrl = `/assets/${category.icon.file_path}`;
        const texture = await this.loadTexture(iconUrl);
        this.iconTextures[category.title] = texture;
      }
    }

    // Load mystery icon
    const mysteryTexture = await this.loadTexture('/assets/icons/icon_interrogation.png');
    this.iconTextures['mystery'] = mysteryTexture;

    // Load reset icon
    const resetTexture = await this.loadTexture('/assets/icons/icon_reset.png');
    this.iconTextures['reset'] = resetTexture;

    // Load close icon
    const closeText = new Text({
      text: "X",
      style: {
        fontFamily: 'Silkscreen, Arial',
        fontSize: 32,
        fill: 0xFF0000,
        align: 'center',
      },
    });
    this.iconTextures['close'] = closeText;

    this.timerCompleteSound = await sound.add('timerComplete', 'https://acid-test.s3.us-west-2.amazonaws.com/game_sounds/beep-03.mp3');
    await sound.load('timerComplete');

  } catch (error) {
    console.error("Error loading assets:", error);
    // Provide default icon textures in case of failure
    this.iconTextures = {
      'mystery': new Text({
        text: "❓",
        style: {
          fontFamily: 'Silkscreen, Arial',
          fontSize: 32,
          fill: 0xFFFFFF,
          align: 'center',
        },
      }),
      'reset': new Text({
        text: "↻",
        style: {
          fontFamily: 'Silkscreen, Arial',
          fontSize: 32,
          fill: 0xFFFFFF,
          align: 'center',
        },
      }),
      'close': new Text({
        text: "X",
        style: {
          fontFamily: 'Silkscreen, Arial',
          fontSize: 32,
          fill: 0xFF0000,
          align: 'center',
        },
      })
    };
  }
}


showLoadingIndicator() {
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-indicator';
  loadingIndicator.innerHTML = `
    <div class="spinner"></div>
    <p>Loading...</p>
  `;
  document.body.appendChild(loadingIndicator);
  this.loadingIndicator = loadingIndicator;
}

hideLoadingIndicator() {
  if (this.loadingIndicator) {
    this.loadingIndicator.remove();
    this.loadingIndicator = null;
  }
}

async fetchTopicCategories() {
  try {
    const response = await fetch(this.topicCategoriesUrlValue);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    this.topicCategories = data;
    return data;
  } catch (error) {
    this.topicCategories = [];
    return [];
  }
}

async fetchTopicCategoryById(categoryId) {
  try {
    const response = await fetch(`/topic_categories/${categoryId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching topic category by ID:", error);
    return null;
  }
}

async fetchTopics() {
  try {
    const response = await fetch(this.topicsUrlValue);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    this.topics = await response.json();
  } catch (error) {
    console.error('Error fetching topics:', error);
    this.topics = [];
  }
}


addSaveButton(sessionId) {
  try {
    if (!this.iconTextures['save']) {
      const saveIcon = new Text({
        text: "💾",
        style: {
          fontFamily: 'Silkscreen, Arial',
          fontSize: 32,
          fill: 0xFDBB2F, // Yellow color for better visibility
          align: 'center',
        },
      });
      this.iconTextures['save'] = saveIcon;
    }

    const saveButton = new Sprite(this.iconTextures['save']);
    saveButton.anchor.set(0.5, 0.5);
    saveButton.position.set(this.app.screen.width - 120, 80); // Position near the top-right corner
    saveButton.scale.set(2, 2);
    saveButton.interactive = true;
    saveButton.buttonMode = true;
  saveButton.on('pointerdown', () => this.saveGameState(sessionId));

    // Add styling
    saveButton.filters = [new DropShadowFilter({
      distance: 4,
      color: 0x000000,
      alpha: 0.5
    })];

    // Add background for better visibility
    const background = new Graphics()
      .beginFill(0x333333, 0.2)
      .drawRect(-40, -40, 80, 80) // Match button size
      .endFill();
    saveButton.addChild(background);

    this.app.stage.addChild(saveButton);
    console.log('Save button added to stage');
    
    // Verify the button exists in the stage
    console.log('Save button parent:', saveButton.parent);
  } catch (error) {
    console.error('Error adding save button:', error);
  }
}

// Save inventory to Rails API
async saveInventory() {
  try {
    const response = await fetch('/api/save-inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken()
      },
      body: JSON.stringify({
        inventory: this.inventory
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Inventory saved successfully');
  } catch (error) {
    console.error('Error saving inventory:', error);
  }
}

// Load inventory from Rails API
async loadInventory() {
  try {
    const response = await fetch('/api/load-inventory', {
      method: 'GET',
      headers: {
        'X-CSRF-Token': this.getCsrfToken()
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    this.inventory = data.inventory;
    this.updateHotbarDisplay();
  } catch (error) {
    console.error('Error loading inventory:', error);
  }
}

// Helper to get CSRF token
getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

  loadWebFontLoader() {
    const wf = document.createElement('script');
    wf.src = `${
      document.location.protocol === 'https:' ? 'https' : 'http'
    }://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js`;
    wf.type = 'text/javascript';
    wf.async = 'true';
    const s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
  }

// async loadSpritesheet(app) {
//   try {
//     // Load the texture
//     const texture = await Texture.from(
//       'https://acid-test.s3.us-west-2.amazonaws.com/game-sprites/ClassicRPG_Sheet-sheet.png'
//     );

//     // Load the spritesheet data
//     const spritesheetData = await fetch(
//       'https://acid-test.s3.us-west-2.amazonaws.com/game-sprites/ClassicRPG_Sheet.json'
//     );
//     const data = await spritesheetData.json();

//     // Create the spritesheet
//     const sheet = new Spritesheet(texture, data);

//     // Parse the spritesheet
//     await sheet.parse();

//     // Add the spritesheet to the app
//     app.stage.addChild(sheet);

//     console.log('Spritesheet loaded successfully');
//   } catch (error) {
//     console.error('Error loading spritesheet:', error);
//     // Fallback: Create a simple rectangle if spritesheet fails to load
//     const fallback = new Graphics()
//       .beginFill(0x00FF00)
//       .drawRect(0, 0, 100, 100)
//       .endFill();
//     app.stage.addChild(fallback);
//   }
// }

  fixSpritesheetData(rawData) {
    if (!rawData.frames || !Array.isArray(rawData.frames)) {
      console.error("Invalid spritesheet data format:", rawData);
      return rawData;
    }

    const fixedFrames = {};
    rawData.frames.forEach((frame, index) => {
      fixedFrames[`sprite_${index}`] = frame;
    });

    return { frames: fixedFrames };
  }

async loadSpritesheet() {
  try {
    console.log("Loading spritesheet...");

    this.tileSprites = await Assets.load(
      "https://acid-test.s3.us-west-2.amazonaws.com/game-sprites/ClassicRPG_Sheet.json"
    );

    console.log("Loaded Spritesheet:", this.tileSprites);
    console.log("Available texture keys:", Object.keys(this.tileSprites.textures));

    if (!this.tileSprites.textures) {
      console.error("Invalid spritesheet format:", this.tileSprites);
      return;
    }
    
        this.tileSprites = Assets.resources.gameSprites;


  } catch (error) {
    console.error("Error loading spritesheet:", error);
  }
}


async loadIcons() {
  this.iconTextures = {};

  if (!this.topicCategories || this.topicCategories.length === 0) {
    return;
  }

  try {
    // Load all icons in parallel
    await Promise.all(this.topicCategories.map(async (category) => {
      if (category.icon) {
        try {
          const icon = await this.getIconById(category.icon.id);
          if (icon) {
            const iconUrl = `/assets/${icon.file_path}`;
            const texture = await this.loadTexture(iconUrl);
            this.iconTextures[category.title] = texture;
          } else {
            console.error(`Icon not found for category "${category.title}"`);
            // Assign a fallback texture
            this.iconTextures[category.title] = this.getDefaultIcon();
          }
        } catch (error) {
          console.error(`Failed to load icon for category "${category.title}":`, error);
          // Assign a fallback texture
          this.iconTextures[category.title] = this.getDefaultIcon();
        }
      }
    }));

    // Load mystery icon
    const mysteryIconUrl = await this.getIconById(47);
    const mysteryTexture = await this.loadTexture(mysteryIconUrl);
    console.log('Mystery icon loaded:', mysteryIconUrl);
    this.iconTextures['mystery'] = mysteryTexture;

    // Load close icon
    const closeText = new Text({
      text: "X",
      style: {
        fontFamily: 'Silkscreen, Arial',
        fontSize: 32,
        fill: 0xFF0000,
        align: 'center',
      },
    });
    this.iconTextures['close'] = closeText;

  } catch (error) {
    console.error("Error loading icons:", error);
  }
}


getTile(x, y) {
  const gridSize = 100; // Adjust based on your game's needs
  if (Math.abs(x) > gridSize || Math.abs(y) > gridSize) {
    return null; // Boundary check
  }

  const key = `${x},${y}`;
  if (!this.grid.has(key)) {
    const tile = {
      key: `${x},${y}`,
      x: x,
      y: y,
      type: 'landscape',
      visited: false,
      unlocked: false,
      container: null,
      canBeWater: true,
      isStructure: false
    };

    // Generate rivers when creating new tiles
    if (Math.random() < 0.02) { // 2% chance for a river to start here
      this.generateRiverFromTile(tile);
    }

    this.grid.set(key, tile);
  }
  return this.grid.get(key);
}


// In your Stimulus controller
// Define the inventory structure as an object
inventory = {
  slots: Array(9).fill(null),
  items: {}
};

isPathOrPOI(x, y) {
  const tile = this.getTile(x, y);
  return tile && (tile.type === 'path' || tile.type === 'topic' || tile.type === 'mystery' || tile.type === 'water' || tile.isStructure);
}

async centerOnPlayer(playerTile) {
  if (!playerTile) return;

  const tilePositionX = playerTile.x * (this.constructor.tileProperties.tileSize + this.constructor.tileProperties.padding);
  const tilePositionY = playerTile.y * (this.constructor.tileProperties.tileSize + this.constructor.tileProperties.padding);
  
  const screenCenterX = this.app.screen.width / 2;
  const screenCenterY = this.app.screen.height / 2;
  
  const targetX = screenCenterX - tilePositionX;
  const targetY = screenCenterY - tilePositionY;

  if (this.container.x === targetX && this.container.y === targetY) {
    return Promise.resolve();
  }

  // Add smooth animation
  const animationDuration = 500; // Adjust as needed
  const startTime = Date.now();
  const startX = this.container.x;
  const startY = this.container.y;

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / animationDuration;

    if (progress < 1) {
      const easedProgress = progress; // You can add easing functions here
      this.container.x = startX + (targetX - startX) * easedProgress;
      this.container.y = startY + (targetY - startY) * easedProgress;
      requestAnimationFrame(animate);
    } else {
      this.container.x = targetX;
      this.container.y = targetY;
    }
  };

  requestAnimationFrame(animate);
}


calculatePathLength(startTile, endTile) {
  if (!startTile || !endTile) return 0;

  const openList = [];
  const closedList = [];
  
  openList.push(startTile);
  
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  
  gScore.set(startTile, 0);
  fScore.set(startTile, this.heuristic(startTile, endTile));
  
  while (openList.length > 0) {
    let current = openList[0];
    let currentIndex = 0;

    openList.forEach((tile, index) => {
      if (fScore.get(tile) < fScore.get(current)) {
        current = tile;
        currentIndex = index;
      }
    });

    if (current.x === endTile.x && current.y === endTile.y) {
      return this.getPathLength(cameFrom, current);
    }

    openList.splice(currentIndex, 1);
    closedList.push(current);

    const neighbors = [
      { x: current.x + 1, y: current.y }, // Right
      { x: current.x - 1, y: current.y }, // Left
      { x: current.x, y: current.y + 1 }, // Down
      { x: current.x, y: current.y - 1 }, // Up
    ];
    
    for (const neighbor of neighbors) {
      const tile = this.getTile(neighbor.x, neighbor.y);
      
      if (!tile) {
        continue;
      }
      
      if (closedList.includes(tile)) {
        continue;
      }
      
      if (!this.isPathTile(tile)) {
        continue;
      }
      
      const tentativeGScore = gScore.get(current) + 1;
      
      if (!gScore.has(tile)) {
        gScore.set(tile, tentativeGScore);
        fScore.set(tile, tentativeGScore + this.heuristic(tile, endTile));
        cameFrom.set(tile, current);
        
        if (!openList.includes(tile)) {
          openList.push(tile);
        }
      } else if (tentativeGScore < gScore.get(tile)) {
        gScore.set(tile, tentativeGScore);
        fScore.set(tile, tentativeGScore + this.heuristic(tile, endTile));
        cameFrom.set(tile, current);
      }
    }
  }

  return 0;
}

getPathLength(cameFrom, current) {
  let pathLength = 0;
  let tile = current;

  while (cameFrom.has(tile)) {
    tile = cameFrom.get(tile);
    pathLength++;
  }

  return pathLength;
}

isPathTile(tile) {
  return tile && tile.type === 'path' && tile.unlocked;
}

calculateMovementCost(fromTile, toTile) {
  // Calculate Manhattan distance
  const distance = Math.abs(toTile.x - fromTile.x) + Math.abs(toTile.y - fromTile.y);
  return distance;
}

canAffordMovement(cost) {
  return this.points >= cost;
}

deductPoints(cost) {
  this.points -= cost;
  this.updatePointsDisplay();
}

createTileContainer(tile) {
  if (!tile) return null;

  const keyParts = tile.key.split(',');
  const tileX = parseInt(keyParts[0]);
  const tileY = parseInt(keyParts[1]);

  const tileContainer = new Container();
  tileContainer.position.set(
    tileX * (this.tileSize + this.padding),
    tileY * (this.tileSize + this.padding)
  );

  let tileSprite;
  if (this.tileSprites && this.tileSprites.textures) {
    const textureMap = {
      landscape: "0",
      path: "1",
      water: "2",
      topic: "3",
      mystery: "4",
    };

    const textureKey = textureMap[tile.type] || "0";
    const texture = this.tileSprites.textures[textureKey];

    if (texture) {
      tileSprite = new Sprite(texture);
    } else {
      console.warn(`Texture ${textureKey} not found, using default`);
      tileSprite = new Sprite(Object.values(this.tileSprites.textures)[0]); // Use first available texture as fallback
    }
  }

  if (!tileSprite) {
    // Fallback to colored rectangles if spritesheet isn't available
    const tileColor = {
      landscape: 0x2ecc71,
      path: 0xd2b48c,
      water: 0x3498db,
      topic: 0x4b2e83,
      mystery: 0x8b0000,
    }[tile.type] || 0x808080;

    const tileBackground = new Graphics()
      .beginFill(tileColor)
      .drawRect(0, 0, this.tileSize, this.tileSize)
      .endFill();
    tileContainer.addChild(tileBackground);
    return tileContainer;
  }

  if (tile.visited) {
    tileSprite.tint = 0x808080;
  }

  tileContainer.addChild(tileSprite);

  // Add click handler
  tileContainer.interactive = true;
  tileContainer.buttonMode = true;
  tileContainer.on("pointerdown", () => this.handleTileClick(tile));

  return tileContainer;
}


// createTileContainer(tile) {
//   if (!tile) return null;

//   const keyParts = tile.key.split(',');
//   const tileX = parseInt(keyParts[0]);
//   const tileY = parseInt(keyParts[1]);

//   // Calculate tile position based on grid layout
//   const tilePositionX = tileX * (this.tileSize + this.padding);
//   const tilePositionY = tileY * (this.tileSize + this.padding);

//   const tileContainer = new Container();
//   tileContainer.position.set(tilePositionX, tilePositionY);

//   let tileSprite;
//   switch(tile.type) {
//     case 'landscape':
//       tileSprite = new Sprite(this.tileSprites.textures['grass-tile']);
//       break;
//     case 'path':
//       tileSprite = new Sprite(this.tileSprites.textures['path-tile']);
//       break;
//     case 'water':
//       tileSprite = new Sprite(this.tileSprites.textures['water-tile']);
//       break;
//   }
//   if (tile.type === 'structure') {
//     return; // Structure tiles are rendered separately
//   }

//   // Declare waterLabel at the top of the method
//   let waterLabel = null;

//   // Make the tile interactive
//   tileContainer.interactive = true;
//   tileContainer.buttonMode = true;

//   // Create the tile background with pixelated effects
//   const tileBackground = new Graphics();

//   // Add a slight shadow
//   tileBackground.filters = [new DropShadowFilter({
//     distance: 1,
//     color: 0x000000,
//     alpha: 0.1
//   })];

//   // Set the background color based on tile type
//   let tileColor = 0x2ecc71; // Default color for landscape

//   if (tile.type === 'path') {
//     tileColor = 0xD2B48C; // Path color
//   } else if (tile.type === 'water') {
//     tileColor = 0x3498db; // Water color
//   } else if (tile.type === 'topic' || tile.type === 'mystery') {
//     if (tile.visited) {
//       // For visited tiles, use a solid grey background
//       tileColor = 0x808080;
//     } else {
//       // For unvisited tiles, use the category color or default
//       if (tile.topicCategory) {
//         tileColor = this.constructor.categoryColors[tile.topicCategory.title] || 0x808080;
//       } else {
//         tileColor = 0x808080; // Default for unspecified categories
//       }
//     }
//   }

//   // Add a subtle border
//   tileBackground.lineStyle(2, tile === this.currentPosition ? 0xFFFF00 : 0x333333);
//   tileBackground.beginFill(tileColor);
//   tileBackground.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius);
//   tileBackground.endFill();

//   tileContainer.addChild(tileBackground);

//   // Add additional styling based on tile type
//   if (tile === this.currentPosition) {
//     const highlight = new Graphics()
//       .beginFill(0xFFFF00)
//       .roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
//       .endFill();
//     highlight.alpha = 0.5;
//     tileContainer.addChild(highlight);
//   }

//   if (tile.type === 'water') {
//     // Create water effect
//     const water = new Graphics();
//     water.beginFill(0x3498db); // Blue color for water
//     water.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius);
//     water.endFill();
//     tileContainer.addChild(water);

//     // Add subtle animation for water flow
//     let flowOffset = 0;
//     const animateWater = () => {
//       flowOffset += 0.1;
//       water.x = Math.sin(flowOffset) * 2;
//       requestAnimationFrame(animateWater);
//     };
//     animateWater();

//     // Add a visual indicator for debugging
//     waterLabel = new Text({
//       text: "W",
//       style: {
//         fontFamily: 'Silkscreen, Arial',
//         fontSize: 24,
//         fill: 0xFFFFFF,
//         align: 'center',
//       },
//     });
//     waterLabel.anchor.set(0.5, 0.5);
//     waterLabel.x = this.tileSize / 2;
//     waterLabel.y = this.tileSize / 2;
//     tileContainer.addChild(waterLabel);
//   }

//   // Add the original tile graphics on top
//   const tileGraphic = new Graphics();
//   if (tile.type === 'topic' || tile.type === 'mystery') {
//     if (!tile.visited) {
//       if (tile.type === 'mystery') {
//         // For unvisited mystery tiles, show the mystery icon
//         const iconTexture = this.iconTextures['mystery'];
//         if (iconTexture) {
//           const iconSprite = new Sprite(iconTexture);
//           iconSprite.anchor.set(0.5, 0.5);
//           iconSprite.x = this.tileSize / 2;
//           iconSprite.y = this.tileSize / 2;
//           iconSprite.width = 48;
//           iconSprite.height = 48;
//           tileContainer.addChild(iconSprite);
//         } else {
//           console.error("Mystery icon texture not found");
//           // Add fallback icon
//           const fallbackIcon = new Text({
//             text: "❓",
//             style: {
//               fontFamily: 'Silkscreen, Arial',
//               fontSize: 32,
//               fill: 0xFFFFFF,
//               align: 'center',
//             },
//           });
//           fallbackIcon.anchor.set(0.5, 0.5);
//           fallbackIcon.x = this.tileSize / 2;
//           fallbackIcon.y = this.tileSize / 2;
//           tileContainer.addChild(fallbackIcon);
//         }
//       } else {
//         if (tile.topicCategory) {
//           const iconTexture = this.iconTextures[tile.topicCategory.title];
//           if (iconTexture) {
//             const iconSprite = new Sprite(iconTexture);
//             iconSprite.anchor.set(0.5, 0.5);
//             iconSprite.x = this.tileSize / 2;
//             iconSprite.y = this.tileSize / 2;
//             iconSprite.width = 48;
//             iconSprite.height = 48;
//             tileContainer.addChild(iconSprite);
//           } else {
//             console.error(`Icon texture not found for category "${tile.topicCategory.title}"`);
//             // Add fallback icon
//             const fallbackIcon = new Text({
//               text: "📌",
//               style: {
//                 fontFamily: 'Silkscreen, Arial',
//                 fontSize: 32,
//                 fill: 0xFFFFFF,
//                 align: 'center',
//               },
//             });
//             fallbackIcon.anchor.set(0.5, 0.5);
//             fallbackIcon.x = this.tileSize / 2;
//             fallbackIcon.y = this.tileSize / 2;
//             tileContainer.addChild(fallbackIcon);
//           }
//         }
//       }
//     } else {
//       // For visited tiles, show the category icon and solid background
//       if (tile.topicCategory) {
//         const iconTexture = this.iconTextures[tile.topicCategory.title];
//         if (iconTexture) {
//           const iconSprite = new Sprite(iconTexture);
//           iconSprite.anchor.set(0.5, 0.5);
//           iconSprite.x = this.tileSize / 2;
//           iconSprite.y = this.tileSize / 2;
//           iconSprite.width = 48;
//           iconSprite.height = 48;
//           tileContainer.addChild(iconSprite);
//         } else {
//           console.error(`Icon texture not found for category "${tile.topicCategory.title}"`);
//           // Add fallback icon
//           const fallbackIcon = new Text({
//             text: "📌",
//             style: {
//               fontFamily: 'Silkscreen, Arial',
//               fontSize: 32,
//               fill: 0xFFFFFF,
//               align: 'center',
//             },
//           });
//           fallbackIcon.anchor.set(0.5, 0.5);
//           fallbackIcon.x = this.tileSize / 2;
//           fallbackIcon.y = this.tileSize / 2;
//           tileContainer.addChild(fallbackIcon);
//         }
//       }
//     }
//     tileContainer.on('pointerdown', () => this.handleTileClick(tile));
//     tileContainer.addChild(tileGraphic);
//   }
//   tileContainer.name = `tile-${tileX},${tileY}`;

//   return tileContainer;
// }


createStructure(startX, startY, width = 2, height = 2) {
  // Check if there's space for the structure
  for (let x = startX; x < startX + width; x++) {
    for (let y = startY; y < startY + height; y++) {
      if (this.isPathOrPOI(x, y)) {
        console.log("Not enough space for structure");
        return null;
      }
    }
  }

  // Create the structure
  const structureId = `structure-${Date.now()}`;
  
  // Mark all tiles as part of this structure
  for (let x = startX; x < startX + width; x++) {
    for (let y = startY; y < startY + height; y++) {
      const tile = this.getTile(x, y);
      if (tile) {
        tile.type = 'structure';
        tile.structureId = structureId;
        tile.size = { width, height };
        tile.unlocked = true;
        tile.canBeWater = false;
        tile.isStructure = true;
      }
    }
  }

  // Render the structure
  this.renderStructure(this.getTile(startX, startY));
  
  return this.getTile(startX, startY);
}

createCopyButton() {
  if (this.copyButton) {
    return;
  }

  // Create the button
  const button = new Graphics();
  button.beginFill(0x4B2E83) // Dark purple color
    .roundRect(0, 0, 250, 40, 5) // Width: 200, Height: 40, Corner radius: 5
    .endFill();

  // Add button text
  const buttonText = new Text({
    text: "Copy Used Topics",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 18,
      fill: 0xFFFFFF,
      align: 'center',
    },
  });
  buttonText.position.set(23, 8); // Center the text

  // Add hover effect
  button.interactive = true;
  button.buttonMode = true;
  
  // Add the text to the button
  button.addChild(buttonText);

  // Position the button
  button.position.set(20, window.innerHeight - 145); // Position near the top-left corner

  // Add click handler
  button.on('pointerdown', () => {
    // Prepare the text to copy
    const topicsText = this.usedTopics
      .map(topic => `${topic.title}${topic.subtitle ? `: ${topic.subtitle}` : ''}`)
      .join('\n');

    // Log the text for debugging
    console.log('Copying to clipboard:', topicsText);

    // Copy to clipboard
    navigator.clipboard.writeText(topicsText)
      .then(() => {
        console.log('Text copied successfully');
        // Show feedback to the user
        this.showCopyFeedback(true);
      })
      .catch(err => {
        console.error('Failed to copy text:', err);
        this.showCopyFeedback(false);
      });
  });

  // Add hover effect
  button.on('pointerover', () => {
    button.alpha = 0.8;
  });

  button.on('pointerout', () => {
    button.alpha = 1;
  });

  // Add the button to the stage
  this.app.stage.addChild(button);
  this.copyButton = button;
}

updateCopyButton() {
  if (!this.copyButton) {
    this.createCopyButton();
    return;
  }

  // Update the button text
  const buttonText = this.copyButton.getChildAt(0);
  if (buttonText && buttonText.text) {
    buttonText.text = `Copy Topics (${this.usedTopics.length})`;
  }
}

// Add this method to show feedback
showCopyFeedback(success) {
  const feedbackText = new Text({
    text: success ? "Copied to clipboard! ✓" : "Failed to copy ☓",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 18,
      fill: success ? 0x00FF00 : 0xFF0000,
    },
  });
  feedbackText.position.set(this.copyButton.x + 10, this.copyButton.y - 30);
  this.app.stage.addChild(feedbackText);

  setTimeout(() => {
    this.app.stage.removeChild(feedbackText);
  }, 2000);
}

async loadTexture(url) {
  try {
    const texture = await Assets.load(url); // Use Assets.load instead of Texture.from
    return texture;
  } catch (error) {
    // Fallback to a default icon
    const fallbackTexture = await Assets.load('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/question-circle.svg');
    return fallbackTexture;
  }
}

canPass(tile) {
  if (!tile) return false;
  if (tile.type === 'water') {
    // You can add conditions here for when water can be passed
    // For example, if the player has a certain item or ability
    return false; // By default, water is not passable
  }
  return true;
}

handlePlayerMovement(tile) {
  if (tile.type === 'path' && tile.unlocked && this.canPass(tile)) {
    this.currentPosition = tile;
    this.centerOnPlayer(this.currentPosition);
    this.renderGrid();
  }
}

async handleTileClick(tile) {
  if (tile.type === 'topic' || tile.type === 'mystery') {
    if (!tile.visited) {
      tile.visited = true;
      tile.unlocked = true;
      this.currentPosition = tile;
      this.centerOnPlayer(this.currentPosition);

      try {
        if (tile.type === 'mystery') {
          const randomCategory = this.getRandomTopicCategory();
          if (randomCategory) {
            tile.topicCategory = randomCategory;
          }
        }

        // Get a new topic that hasn't been used yet
        let topic;
        let isTopicUsed = false;
        let retryCount = 0;
        
        do {
          topic = await this.getRandomTopicFromCategory(tile.topicCategory);
          isTopicUsed = this.usedTopics.some(t => t.id === topic.id.toString()); // Ensure ID comparison is correct
          
          if (isTopicUsed) {
            console.log("Topic already used, getting new one...");
            retryCount++;
            
            if (retryCount >= 3) {
              break;
            }
          }
        } while (isTopicUsed && retryCount < 3);

        if (isTopicUsed || !topic) {
          this.displayTopicPopup({
            title: "Topic Already Used",
            subtitle: "This topic has already been covered in this session.",
            topicCategory: tile.topicCategory
          });
          return;
        }

        // Add to used topics
        this.usedTopics.push({
          id: topic.id,
          title: topic.title,
          subtitle: topic.subtitle,
          category: topic.topicCategory?.title,
          timestamp: new Date().toISOString(),
        });

        // Display the topic popup
        this.displayTopicPopup(topic);

        // Calculate path length and deduct points
        const pathLength = this.calculatePathLength(this.currentPosition, tile);
        if (pathLength > 0) {
          if (this.canAffordMovement(pathLength)) {
            this.deductPoints(pathLength);
          } else {
            console.log("Cannot afford to move to this POI");
            return;
          }
        }

        let pointsAwarded = 0;
        if (tile.type === 'mystery') {
          pointsAwarded = 8;
        } else {
          pointsAwarded = Math.floor(Math.random() * (5 - 2 + 1)) + 1;
        }

        this.points += pointsAwarded;
        this.updatePointsDisplay();
        this.updateCopyButton();
        // Generate paths
        const directions = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 },
        ];
        const numPaths = Math.floor(Math.random() * 3) + 2;
        const shuffledDirections = directions.sort(() => Math.random() - 0.5);

        for (let i = 0; i < numPaths; i++) {
          const direction = shuffledDirections[i];
          this.generatePathToPOI(this.currentPosition, direction);
        }

        this.renderGrid();
      } catch (error) {
        console.error("Error handling tile click:", error);
        this.displayTopicPopup({
          title: "Error",
          subtitle: "Failed to load topic. Please try again.",
          topicCategory: tile.topicCategory
        });
      }
    } else {
      this.displayTopicPopup({
        title: "Topic Already Used",
        subtitle: "This topic has already been covered in this session.",
        topicCategory: tile.topicCategory
      });
    }
  }
}


handleStructureClick(tile) {
  // Example: Generate paths from structure to nearby areas
  this.generateStructurePaths(tile);
}

// Updated generateStructurePaths method
generateStructurePaths(structureTile) {
  const playerTile = this.currentPosition;
  
  if (!playerTile) {
    console.log("No player position available");
    return;
  }

  // First, try to find a straight line path
  const straightPath = this.createStraightPath(structureTile, playerTile);
  
  if (straightPath) {
    straightPath.forEach(tile => {
      if (tile.type !== 'structure') {
        tile.type = 'path';
        tile.unlocked = true;
      }
    });
    this.renderGrid();
    return;
  } else {
    console.log("No straight path found, using A* pathfinding");
  }

  // If no straight path found, use A* pathfinding
  const path = this.findPath(structureTile, playerTile);
  
  if (path) {
    path.forEach(tile => {
      if (tile.type !== 'structure') {
        tile.type = 'path';
        tile.unlocked = true;
      }
    });
    this.renderGrid();
  } else {
    // Create a direct path as fallback
    this.createDirectPath(structureTile, playerTile);
    this.renderGrid();
  }
}

generateRiverFromTile(startTile) {
  const directions = [
    { x: 1, y: 0 }, // Right
    { x: -1, y: 0 }, // Left
    { x: 0, y: 1 }, // Down
    { x: 0, y: -1 }, // Up
  ];

  const direction = directions[Math.floor(Math.random() * directions.length)];
  const riverLength = Math.floor(Math.random() * 5) + 3;

  this.generateRiver(startTile, direction, riverLength);
}

generateRivers() {
  const safeRadius = 3;
  const riverStartProbability = 0.01;
  const riverLength = Math.floor(Math.random() * 5) + 3;

  let riversGenerated = 0;
  let tilesConvertedToWater = 0;

  // Get the current bounds
  const minX = Math.min(...Array.from(this.grid.keys()).map(key => parseInt(key.split(',')[0]))),
        maxX = Math.max(...Array.from(this.grid.keys()).map(key => parseInt(key.split(',')[0]))),
        minY = Math.min(...Array.from(this.grid.keys()).map(key => parseInt(key.split(',')[1]))),
        maxY = Math.max(...Array.from(this.grid.keys()).map(key => parseInt(key.split(',')[1])));

  // Generate rivers in the current bounds
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const tile = this.getTile(x, y);
      if (tile && Math.random() < riverStartProbability) {
        // Check if the tile is within the safe zone
        const distance = this.distanceFromOrigin(x, y);
        if (distance <= safeRadius) {
          console.log(`Tile at (${x},${y}) is within the safe zone - skipping river generation.`);
          continue;
        }

        console.log(`Generating river starting at (${x},${y})`);
        const direction = [
          { x: 1, y: 0 },
          { x: -1, y: 0 },
          { x: 0, y: 1 },
          { x: 0, y: -1 }
        ][Math.floor(Math.random() * 4)];

        const tilesConverted = this.generateRiver(tile, direction, riverLength);
        if (tilesConverted > 0) {
          riversGenerated++;
          tilesConvertedToWater += tilesConverted;
        }
      }
    }
  }

  console.log(`River generation complete:`);
  console.log(`Rivers generated: ${riversGenerated}`);
  console.log(`Tiles converted to water: ${tilesConvertedToWater}`);
}


generateRiver(startTile, direction, length) {
  let currentTile = startTile;
  let tilesConverted = 0;

  for (let i = 0; i < length; i++) {
    currentTile = this.getTile(
      currentTile.x + direction.x,
      currentTile.y + direction.y
    );

    if (!currentTile) break;

    // Skip if the tile is already water or is a POI
    if (currentTile.type === 'water' || currentTile.type === 'path' || currentTile.type === 'topic' || currentTile.type === 'mystery' || currentTile.isStructure) {
      break;
    }

    // Ensure the tile can be converted to water
    if (currentTile.canBeWater === false) {
      break;
    }

    currentTile.type = 'water';
    currentTile.unlocked = true;
    currentTile.visited = true;
    tilesConverted++;
  }

  return tilesConverted;
}

createHotbar() {
  console.log('Creating hotbar...');
  if (this.hotbar) {
    this.hotbar.destroy();
  }

  this.hotbar = new Container();
  this.hotbar.position.set(
    (window.innerWidth - 100) / 3.33, // Adjusted positioning
    window.innerHeight - 150
  );
  this.app.stage.addChild(this.hotbar);

  // Create slots
  for (let i = 0; i < 9; i++) {
    const slot = new Container();
    slot.width = 100;
    slot.height = 100;
    
    // Add slot background
    const background = new Graphics();
    background.beginFill(0x333333, 0.5);
    background.drawRect(0, 0, 50, 50);
    background.endFill();
    
    // Add border
    const border = new Graphics();
    border.lineStyle(2, 0x888888);
    border.drawRect(0, 0, 50, 50);
    
    slot.addChild(background);
    slot.addChild(border);

    if (this.inventory && this.inventory.items && this.inventory.items[i]) {
      const itemIcon = new Sprite(this.inventory.items[i].icon);
      itemIcon.position.set(5, 5);
      slot.addChild(itemIcon);
    }

    slot.position.x = i * 55;
    this.hotbar.addChild(slot);
  }

  console.log('Hotbar created successfully');
}


// Add an item to the inventory
addItem(itemId, count = 1) {
  if (!this.inventory.items[itemId]) {
    // Initialize the item if it doesn't exist
    this.inventory.items[itemId] = {
      count: 0,
      maxStack: this.constructor.itemDefinitions[itemId].maxStack,
      isConsumable: this.constructor.itemDefinitions[itemId].isConsumable,
      uses: this.constructor.itemDefinitions[itemId].uses
    };
  }

  // Calculate remaining space in the stack
  const remainingSpace = this.inventory.items[itemId].maxStack - this.inventory.items[itemId].count;
  const addAmount = Math.min(count, remainingSpace);

  if (addAmount > 0) {
    this.inventory.items[itemId].count += addAmount;
    this.updateHotbarDisplay();
  }
}

// Use an item
useItem(itemId, slotIndex) {
  if (!this.inventory.items[itemId]) {
    console.error(`Item ${itemId} not found in inventory`);
    return;
  }

  if (this.inventory.items[itemId].isConsumable) {
    if (this.inventory.items[itemId].count > 0) {
      this.inventory.items[itemId].count--;
      if (this.inventory.items[itemId].count === 0) {
        delete this.inventory.items[itemId];
      }
    }
  } else {
    if (this.inventory.items[itemId].uses !== null) {
      this.inventory.items[itemId].uses--;
      if (this.inventory.items[itemId].uses <= 0) {
        delete this.inventory.items[itemId];
      }
    }
  }

  this.updateHotbarDisplay();
}

// Update the hotbar display
updateHotbarDisplay() {
  // Ensure hotbar is initialized
  if (!this.hotbar) {
    this.createHotbar();
  }

  // Clear previous hotbar items
  this.hotbar.removeChildren();

  // Create slots
  for (let i = 0; i < 9; i++) {
    const slot = new Container();
    slot.width = 50;
    slot.height = 50;
    
    // Add slot background
    const background = new Graphics();
    background.fill(0x333333, 0.5);
    background.rect(0, 0, 50, 50);
    background.fill();
    
    // Add border
    const border = new Graphics();
    border.stroke(2, 0x888888);
    border.rect(0, 0, 50, 50);
    
    slot.addChild(background);
    slot.addChild(border);
    
    // Check if inventory items exist before accessing
    if (this.inventory && this.inventory.items && this.inventory.items[i]) {
      // Add item icon
      const itemIcon = new Sprite(this.inventory.items[i].icon);
      itemIcon.position.set(5, 5);
      slot.addChild(itemIcon);
      
      // Add stack size text if needed
      if (this.inventory.items[i].stackSize > 1) {
        const stackText = new Text(
          this.inventory.items[i].stackSize.toString(),
          { fill: 0xffffff }
        );
        stackText.position.set(35, 35);
        slot.addChild(stackText);
      }
    }

    slot.position.x = i * 55; // Space between slots
    this.hotbar.addChild(slot);
  }
}

createPointsDisplay() {
  this.pointsDisplay = new Text({
    text: `Points: ${this.points}`,
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 24,
      fill: 0xFFFFFF,
      stroke: 0x000000,
      strokeThickness: 4,
    },
  });
  this.pointsDisplay.x = 20;
  this.pointsDisplay.y = 40;
  this.app.stage.addChild(this.pointsDisplay);
}

updatePointsDisplay() {
  if (!this.pointsDisplay) {
    this.createPointsDisplay();
  }
  this.pointsDisplay.text = `Points: ${this.points}`;
}

// Optimized createStraightPath method
createStraightPath(startTile, endTile) {
  
  const path = [];
  let currentX = startTile.x;
  let currentY = startTile.y;

  // First move horizontally
  while (currentX !== endTile.x) {
    currentX = currentX < endTile.x ? currentX + 1 : currentX - 1;
    const tile = this.getTile(currentX, currentY);
    if (!tile || this.isPathOrPOI(currentX, currentY)) {
      return null;
    }
    path.push(tile);
    console.log("Added tile to straight path:", currentX, currentY);
  }

  // Then move vertically
  while (currentY !== endTile.y) {
    currentY = currentY < endTile.y ? currentY + 1 : currentY - 1;
    const tile = this.getTile(currentX, currentY);
    if (!tile || this.isPathOrPOI(currentX, currentY)) {
      console.log("Straight path blocked at", currentX, currentY);
      return null;
    }
    path.push(tile);
  }

  console.log("Straight path successfully created");
  return path;
}
// Optimized createDirectPath
createDirectPath(startTile, endTile) {
  
  const path = [];
  let currentX = startTile.x;
  let currentY = startTile.y;

  // Move directly toward the target
  while (currentX !== endTile.x || currentY !== endTile.y) {
    const dx = Math.sign(endTile.x - currentX);
    const dy = Math.sign(endTile.y - currentY);
    
    if (currentX !== endTile.x) {
      currentX += dx;
    }
    if (currentY !== endTile.y) {
      currentY += dy;
    }
    
    const tile = this.getTile(currentX, currentY);
    if (tile && !tile.structureId) {
      tile.type = 'path';
      tile.unlocked = true;
      path.push(tile);
    } else {
      return;
    }
  }

  this.renderGrid();
}

// Optimized findPath method
findPath(startTile, endTile) {
  
  const openList = [];
  const closedList = [];
  
  openList.push(startTile);
  
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  
  gScore.set(startTile, 0);
  fScore.set(startTile, this.heuristic(startTile, endTile));
  
  while (openList.length > 0) {
    let current = openList[0];
    let currentIndex = 0;

    openList.forEach((tile, index) => {
      if (fScore.get(tile) < fScore.get(current)) {
        current = tile;
        currentIndex = index;
      }
    });

    if (current.x === endTile.x && current.y === endTile.y) {
      return this.reconstructPath(cameFrom, current);
    }

    openList.splice(currentIndex, 1);
    closedList.push(current);

    const neighbors = [
      { x: current.x + 1, y: current.y }, // Right
      { x: current.x - 1, y: current.y }, // Left
      { x: current.x, y: current.y + 1 }, // Down
      { x: current.x, y: current.y - 1 }, // Up
    ];
    
    for (const neighbor of neighbors) {
      const tile = this.getTile(neighbor.x, neighbor.y);
      
      if (!tile) {
        continue;
      }
      
      if (closedList.includes(tile)) {
        continue;
      }
      
      if (this.isPathOrPOI(neighbor.x, neighbor.y)) {
        continue;
      }
      
      const tentativeGScore = gScore.get(current) + 1;
      
      if (!gScore.has(tile)) {
        gScore.set(tile, tentativeGScore);
        fScore.set(tile, tentativeGScore + this.heuristic(tile, endTile));
        cameFrom.set(tile, current);
        
        if (!openList.includes(tile)) {
          openList.push(tile);
        }
      } else if (tentativeGScore < gScore.get(tile)) {
        gScore.set(tile, tentativeGScore);
        fScore.set(tile, tentativeGScore + this.heuristic(tile, endTile));
        cameFrom.set(tile, current);
      }
    }
  }

  return null;
}

// Optimized heuristic
heuristic(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx + dy;
}

// Optimized reconstructPath
reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(current);
  }
  return path;
}


  addResetButton() {
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Game';
    resetButton.style.position = 'absolute';
    resetButton.style.top = '10px';
    resetButton.style.left = '10px';
    resetButton.addEventListener('click', () => {
      this.grid.clear();
      this.initializeStartingArea();
      this.currentPosition = this.getTile(0, 0);
      this.renderGrid();
      this.centerOnPlayer(this.currentPosition);
    });
    document.body.appendChild(resetButton);
  }


displayTopicPopup(randomTopic) {
  const popupContainer = new Container();
  popupContainer.width = 400;
  popupContainer.height = 400; // Adjusted height
  popupContainer.x = (this.app.screen.width - popupContainer.width) / 4.9;
  popupContainer.y = (this.app.screen.height - popupContainer.height) / 2.95;

  // Create a transparent overlay covering the entire screen
  const overlay = new Graphics()
    .rect(0, 0, this.app.screen.width, this.app.screen.height)
    .fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static';
  overlay.cursor = 'pointer';
  this.app.stage.addChild(overlay);

  // Create the blocky background
  const background = new Graphics()
    .rect(0, 0, 550, randomTopic.subtitle ? 400 : 400)
    .fill({ color: 0x000000 })
    .stroke({ width: 4, color: 0xFFFFFF });
  popupContainer.addChild(background);

  // Add the topic category icon
  if (randomTopic.topicCategory && this.iconTextures[randomTopic.topicCategory.title]) {
    const iconTexture = this.iconTextures[randomTopic.topicCategory.title];
    const iconSprite = new Sprite(iconTexture);
    iconSprite.anchor.set(0.5, 0.5);
    iconSprite.x = popupContainer.width / 2;
    iconSprite.y = 60;
    iconSprite.width = 64;
    iconSprite.height = 64;
    popupContainer.addChild(iconSprite);
  }

  // Create the title text
  const titleText = new Text({
    text: randomTopic.title,
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 32,
      fill: 0xFFFFFF,
      align: 'center',
    },
  });
  titleText.x = 20;
  titleText.y = randomTopic.subtitle ? 100 : 100;
  popupContainer.addChild(titleText);

  // Handle subtitles
  const subtitleContent = randomTopic.subtitle || "";
  let subtitleChunks = this.splitTextIntoChunks(subtitleContent, 20, 155);

  // Create subtitle container and text
  const subtitleContainer = new Container();
  subtitleContainer.x = 20;
  subtitleContainer.y = randomTopic.subtitle ? 150 : 150;
  subtitleContainer.width = popupContainer.width - 40;
  subtitleContainer.height = randomTopic.subtitle ? 100 : 100;
  popupContainer.addChild(subtitleContainer);

  const subtitleText = new Text({
    text: "",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 20,
      fill: 0xFFFFFF,
      align: 'left',
      wordWrap: true,
      wordWrapWidth: 450,
    },
  });
  subtitleText.x = 0;
  subtitleText.y = 0;
  subtitleContainer.addChild(subtitleText);

  // Timer display positioning
  const timerY = randomTopic.subtitle ? 240 : 180;
  const progressBarY = popupContainer.height - 40;


  // Timer display
  let timeLeft = 180;
  let timerInterval = null;
  let isTimerRunning = false;

  // Timer text
  const timerDisplay = new Text({
    text: "3:00",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 24,
      fill: 0xFFFFFF,
      align: 'left',
    },
  });
  timerDisplay.x = 20;
  timerDisplay.y = popupContainer.height - 80;
  popupContainer.addChild(timerDisplay);

  // Progress bar
  const progressBar = new Graphics();
  progressBar.beginFill(0x3498db);
  progressBar.roundRect(
    20,
    progressBarY,
    popupContainer.width - 40,
    20,
    10
  );
  progressBar.endFill();
  popupContainer.addChild(progressBar);

  // Timer controls container
  const controlsContainer = new Container();
  controlsContainer.x = popupContainer.width - 140; // Center horizontally
  controlsContainer.y = popupContainer.height - 65; // Below timer display
  popupContainer.addChild(controlsContainer);

  const playButton = new Text({
    text: "▶",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 24,
      fill: 0x90D5FF,
      align: 'center',
    },
  });
  playButton.anchor.set(0.5, 0.5);
  playButton.x = 50;
  playButton.eventMode = 'static';
  playButton.cursor = 'pointer';
  controlsContainer.addChild(playButton);

  const pauseButton = new Text({
    text: "",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 24,
      fill: 0x90D5FF,
      align: 'center',
    },
  });
  pauseButton.anchor.set(0.5, 0.5);
  pauseButton.x = 50;
  pauseButton.eventMode = 'static';
  pauseButton.cursor = 'pointer';
  controlsContainer.addChild(pauseButton);

  const resetButton = new Text({
    text: "🔄",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 24,
      fill: 0x90D5FF,
      align: 'center',
    },
  });
  resetButton.anchor.set(0.5, 0.5);
  resetButton.x = 100;
  resetButton.eventMode = 'static';
  resetButton.cursor = 'pointer';
  controlsContainer.addChild(resetButton);

  // "Next" button for subtitle chunks
  const nextButton = new Text({
    text: "Next",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 20,
      fill: 0x90D5FF,
      align: 'center',
    },
  });
  nextButton.x = popupContainer.width - nextButton.width - 20;
  nextButton.y = popupContainer.height - nextButton.height - 100;
  nextButton.eventMode = 'static';
  nextButton.cursor = 'pointer';
  nextButton.visible = subtitleChunks.length > 1; // Only show if needed
  popupContainer.addChild(nextButton);

  // "New Topic" button
  const newTopicButton = new Sprite(this.iconTextures['reset']);
  newTopicButton.anchor.set(0.5, 0.5);
  newTopicButton.x = 40;
  newTopicButton.y = 40;
  newTopicButton.scale.set(2, 2); // Adjust the size as needed
  newTopicButton.interactive = true;
  newTopicButton.buttonMode = true;
  popupContainer.addChild(newTopicButton);

  // Track current page
  let currentPage = 0;
  let isAnimating = false;

  let currentCharIndex;
  let typingInterval;

  // Modified displayPageWithTypingAnimation function
  const displayPageWithTypingAnimation = async () => {
    if (isAnimating) return;

    isAnimating = true;
    const pageText = subtitleChunks[currentPage];
    
    // Reset text state
    subtitleText.text = "";
    subtitleText.width = subtitleContainer.width;
    
    currentCharIndex = 0; // Initialize currentCharIndex here

    typingInterval = setInterval(() => {
      if (currentCharIndex < pageText.length) {
        subtitleText.text += pageText[currentCharIndex];
        currentCharIndex++;
      } else {
        clearInterval(typingInterval);
        isAnimating = false;
      }
    }, 50);
  };

  // Display first page
  displayPageWithTypingAnimation();

  // Handle "Next" button
  nextButton.on('pointerdown', async () => {
    if (isAnimating) return;

    currentPage++;
    if (currentPage < subtitleChunks.length) {
      await displayPageWithTypingAnimation();
    }
  });

  // Timer functionality
  const updateTimer = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.text = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const progress = (180 - timeLeft) / 180;
    progressBar.width = (popupContainer.width - 40) * progress;
  };

  playButton.on('pointerdown', () => {
  if (!isTimerRunning) {
    isTimerRunning = true;
    playButton.text = "⏸";
    timerInterval = setInterval(() => {
      timeLeft--;
      updateTimer();
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        playButton.text = "▶";
        timeLeft = 180;
        updateTimer();
        
        // Play completion sound
        if (this.timerCompleteSound) {
          sound.play('timerComplete');
        }
      }
    }, 1000);
  } else {
    isTimerRunning = false;
    clearInterval(timerInterval);
    playButton.text = "▶";
  }
});

  pauseButton.on('pointerdown', () => {
    isTimerRunning = false;
    clearInterval(timerInterval);
    playButton.text = "▶";
  });

  resetButton.on('pointerdown', () => {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timeLeft = 180;
    updateTimer();
    playButton.text = "▶";
  });

  // Handle "New Topic" button
newTopicButton.on('pointerdown', async () => {
    try {
      const currentCategory = randomTopic.topicCategory;
      const newTopic = await this.getAnotherRandomTopicFromCategory({
        id: currentCategory.id,
        title: currentCategory.title
      });

      if (!newTopic.topicCategory || !newTopic.topicCategory.id) {
        console.error("Invalid category returned");
        return;
      }

      // Reset subtitle text state
      subtitleText.text = "";  // Clear current text
      subtitleText.width = subtitleContainer.width;
      
      // Update chunks with new content
      subtitleChunks = this.splitTextIntoChunks(newTopic.subtitle || "", 20, 155);
      
      // Update title and subtitle
      titleText.text = newTopic.title;
      
      // Reset page tracking and animation state
      currentPage = 0;
      isAnimating = false;
      currentCharIndex = 0;

      // Clear any existing intervals
      if (typingInterval) {
        clearInterval(typingInterval);
      }

      // Start fresh animation
      displayPageWithTypingAnimation();
    } catch (error) {
      console.error("Error getting new topic:", error);
    }
  });

  // Close button
  const closeButton = new Text({
    text: "X",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 32,
      fill: 0xFF0000,
      align: 'center',
    },
  });
  closeButton.anchor.set(0.5, 0.5);
  closeButton.x = popupContainer.width - 40;
  closeButton.y = 40;
  closeButton.eventMode = 'static';
  closeButton.cursor = 'pointer';
  closeButton.on('pointerdown', () => {
    this.app.stage.removeChild(popupContainer);
    this.app.stage.removeChild(overlay);
    if (timerInterval) {
      clearInterval(timerInterval);
    }
  });
  popupContainer.addChild(closeButton);

  // Add the popup to the stage
  this.app.stage.addChild(popupContainer);
}


async getAnotherRandomTopicFromCategory(category) {
  try {
    if (!category) {
      throw new Error("No category provided");
    }

    // Ensure category has proper format
    const categoryToUse = category.id ? {
      id: category.id,
      title: category.title || ""
    } : {
      id: category,
      title: ""
    };

    const response = await fetch(`/topics/by_category?topic_category_id=${categoryToUse.id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return {
        title: 'Notice',
        subtitle: 'No more topics available in this category.',
        topicCategory: categoryToUse
      };
    }

    const randomTopic = data[Math.floor(Math.random() * data.length)];
    return {
      title: randomTopic.title,
      subtitle: randomTopic.subtitle,
      topicCategory: categoryToUse
    };

  } catch (error) {
    console.error("Error fetching topics by category:", error);
    return {
      title: 'Error',
      subtitle: 'Failed to load topics. Please try again.',
      topicCategory: category
    };
  }
}

  splitTextIntoChunks(text, maxWords = 8, maxChars = 50) {
    if (!text.trim()) return [""];

    const chunks = [];
    const words = text.split(" ");
    let currentChunk = "";
    let currentWordCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (currentChunk.length + word.length + 1 > maxChars || currentWordCount >= maxWords) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
        currentWordCount = 0;
      }

      currentChunk += (currentChunk ? " " : "") + word;
      currentWordCount++;
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

getRandomTopicCategory() {
  if (!this.topicCategories || this.topicCategories.length === 0) {
    console.error("No topic categories available - using default category");
    return {
      id: 'default',
      title: 'Default Category',
      color: 0x808080
    };
  }

  // Create a list of available categories
  const availableCategories = this.topicCategories.filter(category => {
    return category.title && this.constructor.categoryColors[category.title];
  });

  if (availableCategories.length === 0) {
    console.error("No valid categories available - using default category");
    return {
      id: 'default',
      title: 'Default Category',
      color: 0x808080
    };
  }

  // Select a random category
  const randomIndex = Math.floor(Math.random() * availableCategories.length);
  return availableCategories[randomIndex];
}

async getRandomTopicFromCategory(category) {
  try {
    if (!category || !category.id) {
      console.error("Invalid category provided");
      return {
        title: 'Error',
        subtitle: 'Failed to load topic',
        topicCategory: {
          id: 'default',
          title: 'Default Category'
        }
      };
    }

    // Ensure category has proper format
    const categoryToUse = {
      id: category.id,
      title: category.title || "Default Category"
    };

    // Get used topic IDs for this category
    const usedTopicIds = this.usedTopics
      .filter(usedTopic => usedTopic.category?.id === categoryToUse.id)
      .map(usedTopic => usedTopic.id);

    try {
      const response = await fetch(`/topics/by_category?topic_category_id=${categoryToUse.id}${usedTopicIds.length > 0 ? `&exclude_ids=${usedTopicIds.join(',')}` : ''}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        return {
          title: 'No Topic Found',
          subtitle: data.error,
          topicCategory: categoryToUse
        };
      }

      if (!data.id || !data.title) {
        throw new Error('Invalid topic format');
      }

      return {
        id: data.id.toString(), // Ensure ID is a string
        title: data.title,
        subtitle: data.subtitle || '',
        topicCategory: categoryToUse
      };

    } catch (error) {
      console.error("Error fetching topics by category:", error);
      return {
        title: 'Error',
        subtitle: 'Failed to load topics.',
        topicCategory: categoryToUse
      };
    }
  } catch (error) {
    console.error("Error in getRandomTopicFromCategory:", error);
    return {
      title: 'Error',
      subtitle: 'Failed to load topic.',
      topicCategory: {
        id: 'default',
        title: 'Default Category'
      }
    };
  }
}


  getIconById(iconId) {
    return fetch(`/icons/${iconId}.json`)
      .then(response => {
        if (!response.ok) {
          throw new Error("Failed to fetch icon");
        }
        return response.json();
      })
      .catch(error => {
        console.error("Error fetching icon by ID:", error);
        return null;
      });
  }


generatePathToPOI(fromTile, direction) {
  try {
    const { x, y } = fromTile;
    console.log(`Starting generatePathToPOI from (${x},${y}) in direction (${direction.x},${direction.y})`);
    
    let currentX = x;
    let currentY = y;

    const depth = Math.floor(Math.random() * 3) + 1;
    let shouldExtend = false;
    let waterPosition = null;
    let poiPlaced = false;
    let beyondWater = false;

    for (let i = 1; i <= depth; i++) {
      const newX = currentX + direction.x * i;
      const newY = currentY + direction.y * i;

      console.log(`Checking position (${newX},${newY}) at step ${i}`);

      if (!this.getTile(newX, newY)) {
        console.log(`Position (${newX},${newY}) is out of bounds`);
        break;
      }

      const tile = this.getTile(newX, newY);
      
      if (tile.type === 'water' && !shouldExtend) {
        waterPosition = { x: newX, y: newY };
        shouldExtend = true;
        beyondWater = true;
        console.log(`Found water at (${newX},${newY}) - will attempt to place POI beyond`);
        continue;
      }

      if (beyondWater) {
        if (tile.type === 'water') {
          console.log(`Beyond water position is also water - cannot place POI`);
          break;
        }
        if (this.isPathOrPOI(newX, newY)) {
          console.log(`Beyond water position is already a path or POI - cannot place POI`);
          continue;
        }
        console.log(`Placing POI beyond water at (${newX},${newY})`);
        if (Math.random() < 0.1) {
          tile.type = 'mystery';
        } else {
          tile.type = 'topic';
          const randomCategory = this.getRandomTopicCategory();
          if (randomCategory) {
            tile.topicCategory = randomCategory;
            console.log(`Assigned topic category: ${randomCategory.title}`);
          } else {
            console.error("Could not assign topic category to POI tile");
          }
        }
        tile.unlocked = true;
        tile.visited = false;
        tile.canBeWater = false;
        poiPlaced = true;
        break;
      }

      if (this.isPathOrPOI(newX, newY)) {
        console.log(`Position (${newX},${newY}) is already a path or POI`);
        break;
      }

      const pathTile = tile;
      pathTile.type = 'path';
      pathTile.unlocked = true;
      pathTile.canBeWater = false;

      if (i === depth) {
        console.log(`Reached end of path at (${newX},${newY}) - attempting to place POI`);
        const poiX = newX + direction.x;
        const poiY = newY + direction.y;
        const poiTile = this.getTile(poiX, poiY);

        if (poiTile && !this.isPathOrPOI(poiX, poiY) && poiTile.type !== 'water') {
          console.log(`Placing POI at (${poiX},${poiY})`);
          if (Math.random() < 0.1) {
            poiTile.type = 'mystery';
          } else {
            poiTile.type = 'topic';
            const randomCategory = this.getRandomTopicCategory();
            if (randomCategory) {
              poiTile.topicCategory = randomCategory;
              console.log(`Assigned topic category: ${randomCategory.title}`);
            } else {
              console.error("Could not assign topic category to POI tile");
            }
          }
          poiTile.unlocked = true;
          poiTile.visited = false;
          poiTile.canBeWater = false;
          poiPlaced = true;
        } else {
          console.log(`Could not place POI at end of path - invalid position`);
        }
      }
    }

    if (!poiPlaced && shouldExtend && waterPosition) {
      console.log(`Attempting to place POI beyond water at (${waterPosition.x},${waterPosition.y})`);
      let beyondWaterX = waterPosition.x + direction.x;
      let beyondWaterY = waterPosition.y + direction.y;
      
      for (let i = 1; i <= depth; i++) {
        const tile = this.getTile(beyondWaterX, beyondWaterY);
        
        if (!tile) {
          console.log(`Beyond water position (${beyondWaterX},${beyondWaterY}) is out of bounds`);
          beyondWaterX += direction.x;
          beyondWaterY += direction.y;
          continue;
        }

        if (tile.type === 'water') {
          console.log(`Beyond water position is also water - continuing to next tile`);
          beyondWaterX += direction.x;
          beyondWaterY += direction.y;
          continue;
        }

        if (this.isPathOrPOI(beyondWaterX, beyondWaterY)) {
          console.log(`Beyond water position is already a path or POI - continuing to next tile`);
          beyondWaterX += direction.x;
          beyondWaterY += direction.y;
          continue;
        }

        console.log(`Placing POI beyond water at (${beyondWaterX},${beyondWaterY})`);
        if (Math.random() < 0.1) {
          tile.type = 'mystery';
        } else {
          tile.type = 'topic';
          const randomCategory = this.getRandomTopicCategory();
          if (randomCategory) {
            tile.topicCategory = randomCategory;
            console.log(`Assigned topic category: ${randomCategory.title}`);
          } else {
            console.error("Could not assign topic category to POI tile");
          }
        }
        tile.unlocked = true;
        tile.visited = false;
        tile.canBeWater = false;
        poiPlaced = true;
        break;
      }
    } else {
      console.log(`No POI placed beyond water - either POI was already placed or water extension not needed`);
    }

    console.log(`Path generation complete`);
  } catch (error) {
    console.error("Error in generatePathToPOI:", error);
  }
}

distanceFromOrigin(x, y) {
  return Math.sqrt(x * x + y * y);
}

initializeStartingArea() {
  console.log('Initializing starting area...');
  const startTile = this.getTile(0, 0);
  if (!startTile) {
    console.error("Failed to create starting tile at (0,0)");
    return;
  }

  startTile.type = 'path';
  startTile.unlocked = true;
  startTile.visited = true;
  
  console.log('Start tile initialized at (0,0)' );

  // Generate initial paths
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];
  const numTopics = Math.floor(Math.random() * 4) + 1;
  const shuffledDirections = directions.sort(() => Math.random() - 0.5);

  for (let i = 0; i < numTopics; i++) {
    const direction = shuffledDirections[i];
    console.log(`Generating path in direction (${direction.x},${direction.y})`);
    try {
      this.generatePathToPOI(startTile, direction);
    } catch (error) {
      console.error(`Error generating path in direction (${direction.x},${direction.y}):`, error);
    }
  }
  
  // Generate rivers
  try {
    this.generateRivers();
    console.log('Rivers generated successfully');
  } catch (error) {
    console.error("Error generating rivers:", error);
  }
  
  // Create initial structure with proper size
  try {
    const structure = this.createStructure(5, 5, 2, 2);
    if (structure) {
      structure.size = { width: 2, height: 2 }; // Ensure size is set
      console.log('Initial structure created successfully');
    }
  } catch (error) {
    console.error("Error creating initial structure:", error);
  }
  
  // Render the grid
  try {
    this.renderGrid();
  } catch (error) {
    console.error("Error rendering grid:", error);
  }
}

renderGrid() {
  const radius = 10;
  const playerX = this.currentPosition?.x || 0;
  const playerY = this.currentPosition?.y || 0;

  console.log('Rendering grid...');
  this.container.removeChildren();

  // Calculate visible area bounds
  const minX = Math.floor(playerX - radius);
  const maxX = Math.ceil(playerX + radius);
  const minY = Math.floor(playerY - radius);
  const maxY = Math.ceil(playerY + radius);

  // Render tiles within the visible area
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const tile = this.getTile(x, y);
      if (tile) {
        const tileContainer = this.createTileContainer(tile);
        if (tileContainer) {
          this.container.addChild(tileContainer);
        }
      }
    }
  }

  console.log('Grid rendering complete');
}


renderStructure(structureTile) {
  if (!structureTile) return;

  // Ensure size is defined
  const width = structureTile.size ? structureTile.size.width : 32; // Default width
  const height = structureTile.size ? structureTile.size.height : 32; // Default height

  const startX = structureTile.x;
  const startY = structureTile.y;

  const structureContainer = new Container();
  structureContainer.x = startX * (this.tileSize + this.padding);
  structureContainer.y = startY * (this.tileSize + this.padding);

  // Create the structure background
  const structureBackground = new Graphics();
  structureBackground.roundRect(0, 0, width, height, this.borderRadius)
    .fill({ color: 0x4B2E83 }); // Use your categoryColors or a custom color
  structureContainer.addChild(structureBackground);

  // Add structure content here (icons, text, etc.)
  const structureIcon = new Text({
    text: "🏛️", // Change this to your structure icon
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 64,
      fill: 0xFFFFFF,
      align: 'center',
    },
  });
  structureIcon.anchor.set(0.5, 0.5);
  structureIcon.x = width / 2;
  structureIcon.y = height / 2;
  structureContainer.addChild(structureIcon);

  // Add click handler for the structure
  structureContainer.interactive = true;
  structureContainer.buttonMode = true;
  structureContainer.on('pointerdown', () => this.handleStructureClick(structureTile));

  this.container.addChild(structureContainer);
}


async saveGameState(sessionId) {
  try {
    if (this.isLoading) return; // Prevent multiple saves
    this.isLoading = true;
    this.showLoadingIndicator();

    const gameState = {
      grid: Array.from(this.grid.entries()).reduce((acc, [key, tile]) => {
        const tileData = {
          type: tile.type,
          unlocked: tile.unlocked,
          visited: tile.visited,
          canBeWater: tile.canBeWater,
          isStructure: tile.isStructure,
          structureId: tile.structureId,
          size: tile.size,
          topicCategory: tile.topicCategory ? {
            id: tile.topicCategory.id,
            title: tile.topicCategory.title
          } : null
        };
        acc[key] = tileData;
        return acc;
      }, {}),
      current_position: this.currentPosition,
      points: this.points,
      inventory: this.inventory,
      usedTopics: this.usedTopics // Add usedTopics to game state
    };

    // Wrap gameState in a game_state object
    const response = await fetch(`/api/v1/quest_sessions/${sessionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': this.getCsrfToken()
      },
      body: JSON.stringify({
        game_state: gameState
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save game state');
    }

    const data = await response.json();
    console.log('Game state saved successfully:', data);
    this.hideLoadingIndicator();
  } catch (error) {
    console.error('Error saving game state:', error);
    this.hideLoadingIndicator();
    // Optional: Show error message to user
    alert('Failed to save game state. Please try again.');
  } finally {
    this.isLoading = false;
  }
}
}