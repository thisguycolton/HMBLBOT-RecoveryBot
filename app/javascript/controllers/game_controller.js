import { Controller } from "@hotwired/stimulus";
import Phaser from "phaser";
import GameScene from "./game_scene";
import LoadingScene from "./loading_scene";

export default class extends Controller {
   static values = {
    topicsUrl: String,
    topicCategoriesUrl: String,
    initialized: Boolean,
    animationInProgress: Boolean,
    currentPlayer: Object,
    currentSession: Object,
    isLoading: Boolean,
    usedTopics: Array
  };

  constructor(...args) {
    super(...args);
    this.initialized = false;
    this.animationInProgress = false;
    this.points = 5;
    this.usedTopics = [];
  }

    connect() {
    super.connect();
    this.showLoginScreen();
  }

showLoginScreen() {
  this.isLoading = true;
  const loginScreen = document.createElement('div');
  loginScreen.id = 'login-screen';
  loginScreen.className = 'login-screen';
  loginScreen.innerHTML = `
    <h2>Welcome to </br> THE ACID QUEST</h2>
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
      this.showSessionList();
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
      
      return data;
    } catch (error) {
      console.error('Error creating or finding player:', error);
      throw error;
    }
  }

showSessionList() {
  this.isLoading = true;
  const sessionList = document.createElement('div');
  sessionList.id = 'session-list';
  sessionList.className = 'session-list';
  sessionList.innerHTML = `
    <h2>Welcome, ${this.currentPlayer.screen_name}!</h2>
    <h3>Your Sessions</h3>
    <div id="session-list-container"></div>
    <button id="create-session">Create New Session</button>
  `;

  const sessionListContainer = sessionList.querySelector('#session-list-container');
  const createSessionButton = sessionList.querySelector('#create-session');

  createSessionButton.addEventListener('click', async () => {
    await this.createSession();
    this.hideSessionList();
  });

  this.reloadSessionList(sessionListContainer);

  document.body.appendChild(sessionList);
  this.sessionList = sessionList;
  this.isLoading = false;
}

hideSessionList() {
  if (this.sessionList) {
    this.sessionList.remove();
    this.sessionList = null;
  }
}

async reloadSessionList(container = null) {
  try {
    const response = await fetch(`/api/v1/quest_players/${this.currentPlayer.id}/quest_sessions`);
    const sessions = await response.json();

    const sessionListContainer = container || document.getElementById('session-list-container');
    if (!sessionListContainer) {
      console.error('Session list container not found');
      return;
    }

    sessionListContainer.innerHTML = '';// Clear previous sessions

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

        sessionElement.addEventListener('click', async () => {
          console.log('Joining session:', session);
          await this.joinSession(session);
        });
        sessionListContainer.appendChild(sessionElement);
      });
    }

    this.isLoading = false;
  } catch (error) {
    console.error('Error loading sessions:', error);
    this.isLoading = false;
  }
}
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

  
async joinSession(session) {
  try {
    console.log('Starting joinSession with session:', session);
    this.currentSession = session;
    this.hideSessionList();
    
    console.log('Fetching topic categories...');
    const categories = await this.fetchTopicCategories();
    console.log('Topic categories fetched:', categories);

    console.log('Initializing game...');
    await this.initializeGame();

    if (this.scene) {
      this.scene.topicCategories = categories;
      this.scene.loadIcons();
    } else {
      console.error('Scene is not available for loading icons');
    }

    console.log('Game initialized. Loading saved game state...');
    await this.loadSavedGameState(session.id);
    
    console.log('Game state loaded. Proceeding...');
  } catch (error) {
    console.error('Error in joinSession:', error);
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
    this.hideSessionList();
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
}


async loadSavedGameState(sessionId) {
  try {
    console.log('Starting to load game state for session ID:', sessionId);
    this.isLoading = true;

    // Wait for game to be ready
    console.log('Checking if game is initialized...');
    await this.initializeGame();

    if (!this.scene) {
      console.error('Phaser scene is not available');
      return;
    }

    console.log('Scene is available, proceeding to fetch session data...');
    const response = await fetch(`/api/v1/quest_sessions/${sessionId}`);

    if (!response.ok) {
      console.error('Failed to fetch session:', await response.text());
      throw new Error(`Failed to fetch session: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Session data received:', data);

    // Process the game state here
    const gameState = data.game_state;

    if (gameState.grid) {
      console.log('Processing grid data...');
      const gridEntries = Object.entries(gameState.grid);
      const grid = new Map();

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
        grid.set(key, tile);
      });

      console.log('Grid size after loading:', grid.size);

      if (this.scene) {
        console.log('Passing grid to Phaser scene...');
        if (this.scene.grid) {
          console.log('Clearing old grid before loading new session...');
          this.scene.clearGrid(); // Call a function in GameScene to clear the previous grid
        }
        this.scene.grid = grid;
        this.scene.renderGrid();
      }
    }

    this.usedTopics = gameState.usedTopics || [];
    this.currentPosition = gameState.current_position || { x: 0, y: 0 };
    this.points = gameState.points || 5;
    this.inventory = gameState.inventory || {};

    console.log('Game state loaded successfully');
  } catch (error) {
    console.error('Error loading game state:', error);
  } finally {
    this.isLoading = false;
  }
}

async fetchTopicCategories() {
  try {
    const response = await fetch('/topic_categories.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    this.topicCategories = data;
    return data;
  } catch (error) {
    console.error("Error fetching topic categories:", error);
    return [];
  }
}

async initializeGame() {
  if (this.game) return;

  console.log('Initializing Phaser game...');
  
  const config = {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1099bb',
    scene: [LoadingScene, GameScene],
    parent: 'game-container',
    resizeTo: window,
    scaleMode: Phaser.Scale.RESIZE_TO_FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  };

  this.game = new Phaser.Game(config);
  
  console.log('Phaser game created. Waiting for ready event...');
  
  return new Promise(resolve => {
    this.game.events.once(Phaser.Core.Events.READY, () => {
      console.log('Phaser game is ready');
      this.game.scene.start('LoadingScene');
      
      // Give the scene some time to initialize
      setTimeout(() => {
        this.scene = this.game.scene.getScene('GameScene');
        console.log('Scene reference:', this.scene);
        resolve();
      }, 1000);
    });
  });
}
  getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  }

  preload() {
    // Load any necessary assets here
  }


  initializeStartingArea() {
    const startTile = this.getTile(0, 0);
    if (!startTile) return;

    startTile.type = 'path';
    startTile.unlocked = true;
    startTile.visited = true;

    // Generate initial paths
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    directions.forEach(direction => {
      this.generatePathToPOI(startTile, direction);
    });
  }

  getTile(x, y) {
    const gridSize = 100;
    if (Math.abs(x) > gridSize || Math.abs(y) > gridSize) return null;

    const key = `${x},${y}`;
    if (!this.grid.has(key)) {
      const tile = {
        key,
        x,
        y,
        type: 'landscape',
        visited: false,
        unlocked: false,
        canBeWater: true,
        isStructure: false
      };
      this.grid.set(key, tile);
    }
    return this.grid.get(key);
  }

  generatePathToPOI(fromTile, direction) {
    let currentX = fromTile.x;
    let currentY = fromTile.y;

    for (let i = 1; i <= 5; i++) {
      currentX += direction.x;
      currentY += direction.y;

      const tile = this.getTile(currentX, currentY);
      if (!tile) break;

      tile.type = 'path';
      tile.unlocked = true;
      tile.canBeWater = false;
    }
  }

  renderGrid() {
    const radius = 10;
    const playerX = 0;
    const playerY = 0;

    const minX = Math.floor(playerX - radius);
    const maxX = Math.ceil(playerX + radius);
    const minY = Math.floor(playerY - radius);
    const maxY = Math.ceil(playerY + radius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const tile = this.getTile(x, y);
        if (tile) {
          const tileContainer = this.createTileContainer(tile);
          if (tileContainer) {
            this.container.add(tileContainer);
          }
        }
      }
    }
  }



  handleTileClick(tile) {
    console.log('Clicked tile:', tile.x, tile.y);
    // Add your tile click logic here
  }
}