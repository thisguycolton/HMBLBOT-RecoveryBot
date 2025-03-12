export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.container = null;
    this.grid = new Map(); // Initialize grid here
    this.topicCategories = [];
    this.loadingProgress = 0;
  }

  static categoryColors = {
  Reflection: 0xCC4B00,    // Darkened from 0xFF6F61
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

  preload() {
    // Load any necessary assets here
    this.loadIcons();

  }




create() {
  console.log(this.grid)
  // Only initialize a new grid if no saved grid is available
  if (!this.savedGrid) {
    this.grid = new Map();
    this.tileSize = 100;
    this.padding = 2;
    
    // Initialize the starting area
    this.initializeStartingArea();
  } else {
    // Use the saved grid data
    this.grid = this.savedGrid;
  }
  
  // Set up the grid container
  this.container = this.add.container(0, 0);

  // Render the grid
  // this.renderGrid();

  // Set up the camera to follow the player
  this.cameras.main.startFollow(this.container);
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
    const gridSize = 1000;
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
  console.log('Rendering grid...', this.container);
  if (!this.container) {
    console.error('Container is not initialized');
    return;
  }

  // Clear previous tiles
  this.container.removeAll();

  // Get camera bounds
  const camera = this.cameras.main;
  const halfWidth = camera.width / 2;
  const halfHeight = camera.height / 2;

  // Calculate the visible area bounds
  const minX = Math.floor((camera.scrollX - halfWidth) / (this.tileSize + this.padding));
  const maxX = Math.ceil((camera.scrollX + halfWidth) / (this.tileSize + this.padding));
  const minY = Math.floor((camera.scrollY - halfHeight) / (this.tileSize + this.padding));
  const maxY = Math.ceil((camera.scrollY + halfHeight) / (this.tileSize + this.padding));

  // Render tiles within the visible area
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

async getIconById(iconId) {
  try {
    const response = await fetch(`/icons/${iconId}.json`);
    if (!response.ok) throw new Error('Failed to fetch icon');
    return await response.json();
  } catch (error) {
    console.error('Error fetching icon by ID:', error);
    return null;
  }
}
loadIcons() {
  console.log('Starting icon load with categories:', this.topicCategories);

  this.iconTextures = {};

  if (!this.topicCategories || this.topicCategories.length === 0) {
    console.log("No topic categories available - skipping icon loading");
    return;
  }

  // Load all category icons
  this.topicCategories.forEach(category => {
    if (category.icon) {
      const iconId = category.icon.file_path;
      const iconUrl = `/assets/${iconId}`; // Adjust the path as needed
      console.log(`Loading icon for category "${category.title} from:`, iconUrl);

      fetch(iconUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load icon: ${iconUrl}`);
          }
          return response.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          this.iconTextures[category.title] = url;
          console.log(`Successfully loaded icon for category "${category.title} from:`, url);
        })
        .catch(error => {
          console.error(`Failed to load icon for category "${category.title} from:`, iconUrl);
        });
    }
  });

  // Load mystery icon
  const mysteryIconUrl = '/assets/icons/icon_interrogation.png';
  fetch(mysteryIconUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load mystery icon from: ${mysteryIconUrl}`);
      }
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      this.iconTextures['mystery'] = url;
      console.log('Successfully loaded mystery icon from:', mysteryIconUrl);
    })
    .catch(error => {
      console.error(`Failed to load mystery icon from: ${mysteryIconUrl}`);
    });
}

// Helper method to get default icon
getDefaultIcon() {
  const defaultIcon = this.add.text(0, 0, "📌", {
    fontFamily: 'Silkscreen, Arial',
    fontSize: 32,
    color: '#FFFFFF',
  });
  defaultIcon.setOrigin(0.5, 0.5);
  return defaultIcon;
}


createTileContainer(tile) {
  if (!tile) return null;

  const keyParts = tile.key.split(',');
  const tileX = parseInt(keyParts[0]);
  const tileY = parseInt(keyParts[1]);

  // Calculate tile position based on grid layout
  const tilePositionX = tileX * (this.tileSize + this.padding);
  const tilePositionY = tileY * (this.tileSize + this.padding);

  const tileContainer = this.add.container(tilePositionX, tilePositionY);

  let tileColor = 0x2ecc71; // Default color for landscape

  if (tile.type === 'path') {
    tileColor = 0xD2B48C; // Path color
  } else if (tile.type === 'water') {
    tileColor = 0x3498db; // Water color
  } else if (tile.type === 'topic' || tile.type === 'mystery') {
    if (tile.visited) {
      tileColor = 0x808080; // Grey for visited tiles
    } else {
      if (tile.topicCategory) {
        tileColor = GameScene.categoryColors[tile.topicCategory.title] || 0x4b2e83;
      } else {
        tileColor = 0x4b2e83; // Default purple for unspecified categories
      }
    }
  }

  const tileBackground = this.add.graphics();
  tileBackground.clear();
  tileBackground.fillStyle(tileColor);
  tileBackground.fillRect(0, 0, this.tileSize, this.tileSize);

  tileContainer.add(tileBackground);

  if (tile.type === 'topic' || tile.type === 'mystery') {
    if (!tile.visited) {
      if (tile.type === 'mystery') {
        const iconSprite = this.add.image(0, 0, 'mystery-icon');
        iconSprite.setOrigin(0.5, 0.5);
        tileContainer.add(iconSprite);
      } else {
        if (this.iconTextures && this.iconTextures[tile.topicCategory.icon.name]) {
          const iconSprite = this.add.image(0, 0, tile.topicCategory.name);
          iconSprite.setOrigin(0.5, 0.5);
          tileContainer.add(iconSprite);
        } else {
          const fallbackIcon = this.add.text(0, 0, "📌", {
            fontFamily: 'Silkscreen, Arial',
            fontSize: 32,
            color: '#FFFFFF',
          });
          fallbackIcon.setOrigin(0.5, 0.5);
          tileContainer.add(fallbackIcon);
        }
      }
    }
  }

  tileBackground.setInteractive();
  tileBackground.on('pointerdown', () => this.handleTileClick(tile));

  return tileContainer;
}

//   if (tile.type === 'topic' && !tile.visited) {
//   // Debug text
//   const debugText = this.add.text(
//     this.tileSize/2,
//     this.tileSize/2,
//     `${tile.topicCategory?.title || 'Unknown'}\n${tile.x},${tile.y}`,
//     {
//       fontSize: '12px',
//       color: '#ffffff',
//       align: 'center'
//     }
//   );
//   debugText.setOrigin(0.5);
//   tileContainer.add(debugText);
// }



handleTileClick(tile) {
  console.log('Clicked tile:', tile.x, tile.y, tile.type, tile.topicCategory);
  // Add your tile click logic here
}

onloadComplete() {
  console.log("All assets loaded");
  // You can call methods that require loaded assets here
  this.createTileContainer();
}

  update(time, delta) {
    const camera = this.cameras.main;
    
    // Smooth camera movement using basic arithmetic
    camera.scrollX += (this.container.x - camera.scrollX) * delta * 10;
    camera.scrollY += (this.container.y - camera.scrollY) * delta * 10;
  }
  clearGrid() {
  console.log('Clearing existing grid...');
  this.grid.clear(); // Clear the existing Map
  this.container.removeAll(true); // Remove all displayed tiles
}
}