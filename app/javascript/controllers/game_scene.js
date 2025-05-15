export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.container = null;
    this.grid = new Map(); // Initialize grid here
    this.topicCategories = new Map(); // Initialize as a Map
    this.loadingProgress = 0;
    this.topicPopup = null;
    this.typingInterval = null;  // ✅ Declare here
    this.timerInterval = null;
    this.isTimerRunning = false;  // ✅ Declare here

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
  }

init() {
  console.log("Get loadingScene");
  const loadingScene = this.scene.get('LoadingScene');
  if (loadingScene && loadingScene.topicCategories) {
    // Clear any existing entries
    this.topicCategories.clear();
    // Copy each entry from loadingScene's Map to this.topicCategories
    loadingScene.topicCategories.forEach((value, key) => {
      this.topicCategories.set(key, value);
    });
  }
  console.log('TopicCategories in GameScene:', this.topicCategories);
}


create() {

  console.log("GameScene created, emitting event...");
  this.events.emit("GameSceneCreated");

  this.grid = this.registry.get("grid") || new Map();

  console.log(this.grid);

  this.tileSize = 100;
  this.padding = 2;


    // Set up the grid container
  this.container = this.add.container(0, 0);


  // Only initialize a new grid if no saved grid is available
  if (!this.savedGrid) {
    this.grid = new Map();
    this.initializeStartingArea();
    this.currentPosition = { x: 0, y: 0 }; // Default position

  } else {
    this.grid = this.savedGrid;
    this.currentPosition = this.savedGrid.current_position || { x: 0, y: 0 };

  }

    this.usedTopics = this.registry.get("usedTopics") || [];
    this.currentPosition = this.registry.get("currentPosition") || { x: 0, y: 0 };
    this.points = this.registry.get("points") || 5;
    this.inventory = this.registry.get("inventory") || {};

    this.controlConfig = {
      cameraSpeed: 5,
      zoomSpeed: 0.1
    };
    this.input.enabled = true; 

  // ✅ Correctly retrieve LoadingScene
  const loadingScene = this.scene.get("LoadingScene");
  if (!loadingScene) {
    console.error("❌ Error: LoadingScene not found! Cannot listen for events.");
    return;
  }

  // ✅ Listen for topic categories event instead of looping
  if (this.topicCategories.size === 0) {
    console.warn("⚠️ Topic categories not loaded yet, waiting for event...");
    loadingScene.events.once("topicCategoriesLoaded", () => {
      console.log("✅ Topic categories are now loaded. Generating paths...");
      this.generatePathsFromStart();
      this.renderGrid();
    });
  } else {
    console.log("✅ Topic categories already loaded. Generating paths immediately.");
    this.generatePathsFromStart();
    this.renderGrid();
  }
  this.events.on("update", () => {
  if (this.uiContainer) {
    this.uiContainer.setPosition(this.cameras.main.worldView.x + this.scale.width / 2, 
                                 this.cameras.main.worldView.y + this.scale.height / 2);
  }
});

    // Center camera on the starting position
    this.centerCameraOnCurrentTile(false);

}

// ✅ Helper function to retry path generation once categories load
checkAndGeneratePaths() {
  if (this.topicCategories.size > 0) {
    console.log("Topic categories loaded. Generating paths...");
    this.generatePathsFromStart();
    this.renderGrid();
  } else {
    console.warn("Topic categories still not available. Trying again...");
    this.time.delayedCall(500, this.checkAndGeneratePaths, [], this);
  }
}

initializeGrid() {
  if (this.grid.size === 0) {
    console.log("Generating initial paths...");
    this.generatePathsFromStart();
  }

  this.renderGrid();
}

initializeStartingArea() {
  const startTile = this.getTile(0, 0);
  if (!startTile) return;

  startTile.type = 'path';
  startTile.unlocked = true;
  startTile.visited = true;

  // Generate initial paths in all four directions (increase range if needed)
  const directions = [
    { x: 1, y: 0 },  // Right
    { x: -1, y: 0 }, // Left
    { x: 0, y: 1 },  // Down
    { x: 0, y: -1 }  // Up
  ];


  if (this.pathsGenerated) {
    console.warn("⚠️ Paths already generated, skipping...");
    return;
  }

  console.log("🛤️ Generating Paths to POIs");
  this.generatePathsFromStart();
  this.pathsGenerated = true; // ✅ Prevent duplicate generation

}


getTile(x, y) {
  const gridSize = 1000;
  if (Math.abs(x) > gridSize || Math.abs(y) > gridSize) return null;

  const key = `${x},${y}`;
  
  if (!this.grid.has(key)) {
    // ❌ Remove random topic assignment
    const tile = {
      key,
      x,
      y,
      type: "landscape",  // 🔥 Always start as "landscape"
      visited: false,
      unlocked: false,
      canBeWater: true,
      isStructure: false,
      topicCategory: null, // 🔥 No category assigned here
    };

    this.grid.set(key, tile);
  }

  return this.grid.get(key);
  
}



generatePathsFromStart() {
  const startTile = this.getTile(0, 0);
  if (!startTile) return;

  console.log("🛤️ Generating Paths to POIs");

  const possibleDirections = [
    { x: 1, y: 0 },  // Right
    { x: -1, y: 0 }, // Left
    { x: 0, y: 1 },  // Down
    { x: 0, y: -1 }  // Up
  ];

  const pathCount = Phaser.Math.Between(2, 4);
  const usedDirections = new Set();

  for (let i = 0; i < pathCount; i++) {
    let direction;
    do {
      direction = Phaser.Utils.Array.GetRandom(possibleDirections);
    } while (usedDirections.has(direction)); // Prevents duplicate paths in the same direction

    usedDirections.add(direction);
    const pathLength = Phaser.Math.Between(3, 5);

    console.log(`🚶‍♂️ Path ${i + 1}: Moving ${pathLength} tiles in direction (${direction.x}, ${direction.y})`);
    this.generatePathToPOI(startTile, direction, pathLength);
  }
}


async generatePathToPOI(fromTile, directions, range = 5) {
  if (!fromTile) {
    console.warn("⚠️ Cannot generate path: `fromTile` is undefined.");
    return;
  }

  if (!Array.isArray(directions) || directions.length === 0) {
    console.warn("⚠️ Directions must be a non-empty array.");
    return;
  }

  let currentX = fromTile.x;
  let currentY = fromTile.y;
  let lastTile = null;
  let pathTiles = []; // Store tiles that should be converted to path

  for (let i = 1; i <= range; i++) {
    // Get the current direction (cycle through directions array if needed)
    const currentDirection = directions[i % directions.length];
    
    currentX += currentDirection.x;
    currentY += currentDirection.y;

    const tile = this.getTile(currentX, currentY);
    if (!tile || tile.type !== "landscape") {
      // If the next tile is invalid, try changing direction
      if (directions.length > 1) {
        // Cycle to the next direction
        const nextDirectionIndex = (directions.indexOf(currentDirection) + 1) % directions.length;
        const newDirection = directions[nextDirectionIndex];
        // Reset position to the previous valid tile
        currentX = lastTile ? lastTile.x : fromTile.x;
        currentY = lastTile ? lastTile.y : fromTile.y;
        // Decrease i to retry the current step with the new direction
        i--;
      } else {
        // No more valid directions, break the loop
        break;
      }
    } else {
      // Mark the tile as path
      tile.type = "path";
      tile.unlocked = true;
      tile.canBeWater = false;
      pathTiles.push(tile);
      
      // Update last valid tile
      lastTile = tile;
    }
  }

  if (!lastTile) {
    console.warn("⚠️ No valid endpoint for path.");
    return;
  }

  // Update the visuals of all path tiles
  pathTiles.forEach(tile => this.updateTile(tile));

  // Get a valid category
  const allCategories = Array.from(this.topicCategories.values());
  const validCategories = allCategories.filter(cat => cat.id);

  if (validCategories.length === 0) {
    console.warn("⚠️ No valid topic categories available.");
    return;
  }

  const randomCategory = Phaser.Utils.Array.GetRandom(validCategories);
  console.log(`🔍 Fetching topic from category: ${randomCategory.title} (ID: ${randomCategory.id})`);

  // Fetch a topic from API
  const topic = await this.getRandomTopicFromCategory(randomCategory.title);

  // Assign topic to the last tile
  lastTile.type = "topic";
  lastTile.topicCategory = randomCategory;
  lastTile.topic = topic;

  console.log(`📍 Assigned topic "${topic.title}" at (${lastTile.x}, ${lastTile.y})`);

  // Update the final topic tile
  this.updateTile(lastTile);

  // Move camera to the new POI
  this.moveCameraToTile(lastTile);
}

// Example usage in generatePathsFromStart:
generatePathsFromStart() {
  const startTile = this.getTile(0, 0);
  if (!startTile) return;

  console.log("🛤️ Generating Paths to POIs");

  const possibleDirections = [
    { x: 1, y: 0 },  // Right
    { x: -1, y: 0 }, // Left
    { x: 0, y: 1 },  // Down
    { x: 0, y: -1 }  // Up
  ];

  const pathCount = Phaser.Math.Between(2, 4);
  const usedDirections = new Set();

  for (let i = 0; i < pathCount; i++) {
    let direction;
    do {
      direction = Phaser.Utils.Array.GetRandom(possibleDirections);
    } while (usedDirections.has(direction)); // Prevents duplicate paths in the same direction

    usedDirections.add(direction);
    const pathLength = Phaser.Math.Between(3, 5);

    console.log(`🚶♂️ Path ${i + 1}: Moving ${pathLength} tiles in direction (${direction.x}, ${direction.y})`);
    this.generatePathToPOI(startTile, [direction], pathLength);
  }
}


updateTile(tile) {
  if (!this.container) {
    console.error("Error: Tile container is not initialized yet.");
    return;
  }

  // Remove the old tile's visual representation
  const existingTile = this.container.getByName(tile.key);
  if (existingTile) {
    this.container.remove(existingTile, true);
  }

  // Create a new visual representation of the tile
  const newTile = this.createTileContainer(tile);
  newTile.name = tile.key; // Store it with a unique identifier

  // Add it back to the container
  this.container.add(newTile);
}





renderGrid() {
  console.log("Rendering grid...");

  if (this.renderTimeout) return; // Prevent multiple calls

  this.renderTimeout = setTimeout(() => {
    if (!this.container) {
      console.error("Error: Tile container is not initialized yet.");
      this.renderTimeout = null;
      return;
    }

    // ✅ Clear existing tile containers before rendering
    this.container.removeAll(true);  

    const camera = this.cameras.main;
    const viewWidth = camera.width;
    const viewHeight = camera.height;
    const tileSize = this.tileSize;

    const startX = Math.floor(camera.worldView.x / tileSize) - 1;
    const startY = Math.floor(camera.worldView.y / tileSize) - 1;
    const endX = startX + Math.ceil(viewWidth / tileSize) + 2;
    const endY = startY + Math.ceil(viewHeight / tileSize) + 2;

    console.log(`Rendering tiles from (${startX},${startY}) to (${endX},${endY})`);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        const tile = this.getTile(x, y);
        if (tile) {
          // ✅ Pass tile.visited status to `createTileContainer`
          const tileContainer = this.createTileContainer(tile);
          this.container.add(tileContainer);
        }
      }
    }

    this.renderTimeout = null;
  }, 50);
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

  // Calculate position based on tile coordinates
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
        const categoryName = tile.topicCategory.title; // Use the title as the key
        const category = this.topicCategories.get(categoryName);
        if (category) {
          tileColor = category.icon ? GameScene.categoryColors[category.title] || 0x4b2e83 : 0x4b2e83;
        } else {
          tileColor = 0x4b2e83; // Default purple for unspecified categories
        }
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
        if (tile.topicCategory) {
          const categoryName = tile.topicCategory.title; // Use the title as the key
          const category = this.topicCategories.get(categoryName);
          if (category && category.icon) {
            const iconSprite = this.add.image(this.tileSize / 2, this.tileSize / 2, category.icon.name);
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
    }else{
            if (tile.type === 'mystery') {
        const iconSprite = this.add.image(0, 0, 'mystery-icon');
        iconSprite.setOrigin(0.5, 0.5);
        tileContainer.add(iconSprite);
      } else {
        if (tile.topicCategory) {
          const categoryName = tile.topicCategory.title; // Use the title as the key
          const category = this.topicCategories.get(categoryName);
          if (category && category.icon) {
            const iconSprite = this.add.image(this.tileSize / 2, this.tileSize / 2, category.icon.name);
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

  // ✅ Explicitly set a hit area for the tile
  tileBackground.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, this.tileSize, this.tileSize),
    Phaser.Geom.Rectangle.Contains
  );

  // ✅ Ensure clicks trigger `handleTileClick`
  tileBackground.on("pointerdown", () => {
    this.handleTileClick(tile);
  });

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

centerCameraOnCurrentTile(animate = true) {
  if (!this.currentPosition || !this.cameras.main) {
    console.error("Error: Camera or current position is not set.");
    return;
  }

  const { x, y } = this.currentPosition;
  const tileSize = this.tileSize;
  const worldX = x * tileSize + tileSize / 2;
  const worldY = y * tileSize + tileSize / 2;

  // Check if the camera is already at the right position
  if (
    this.cameras.main.scrollX === worldX - this.cameras.main.width / 2 &&
    this.cameras.main.scrollY === worldY - this.cameras.main.height / 2
  ) {
    return; // No need to move the camera
  }

  if (animate) {
    this.cameras.main.pan(worldX, worldY, 500, "Linear");
  } else {
    this.cameras.main.scrollX = worldX - this.cameras.main.width / 2;
    this.cameras.main.scrollY = worldY - this.cameras.main.height / 2;
  }
}


async handleTileClick(tile) {
  if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
    console.warn("⚠️ Invalid tile clicked:", tile);
    return;
  }

  if (tile.visited) {
    console.log(`⛔ Tile at (${tile.x}, ${tile.y}) is already visited.`);
    return;
  }

  console.log("🚀 Moving camera before showing popup...");

  if (!this.topicPopup) { // ✅ Only move if no popup is active
    await this.moveCameraToTile(tile);
    await this.sleep(300); // ✅ Ensure camera finishes moving
  } else {
    console.log("🚫 Skipping camera movement, popup is active.");
  }

  console.log("📍 Camera moved. Now fetching topic...");
  
  if (tile.type !== "topic" || !tile.topicCategory) {
    console.warn(`⚠️ Ignoring click: ${tile.type} at (${tile.x}, ${tile.y}) has no topicCategory.`);
    return;
  }

  this.currentTile = tile;

  try {
    const randomTopic = await this.getRandomTopicFromCategory(tile.topicCategory.title);
    
    if (!randomTopic) {
      throw new Error("No topic received from API.");
    }

    console.log("📌 Showing topic popup in the center of the screen...");

    // ✅ Now show popup after camera movement
    this.showTopicPopup({
      title: randomTopic?.title || "Unknown Topic",
      subtitle: randomTopic?.subtitle || "",
      topicCategory: tile.topicCategory, // ✅ Ensure topicCategory is passed
    });

    // ✅ Generate paths after everything is set
    console.log(`🛤️ Generating paths from (${tile.x}, ${tile.y})`);
    this.generatePathToPOI(tile, { x: 0, y: 1 }); // Example: Move downward
  } catch (error) {
    console.error("⚠️ Error fetching topic:", error);
    this.showTopicPopup({
      title: "Error",
      subtitle: "Failed to load topic.",
    });
  }
}

// ✅ Helper function to ensure delay
sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



moveCameraToTile(tile) {
  console.log(`📸 Moving camera to (${tile.x}, ${tile.y})`);

  if (!this.cameras || !this.cameras.main) {
    console.error("🚨 Error: No camera found!");
    return;
  }

  const camera = this.cameras.main;

  // ✅ Convert tile position to world coordinates
  const worldX = tile.x * (this.tileSize + this.padding);
  const worldY = tile.y * (this.tileSize + this.padding);

  console.log(`🎯 Target World Position: (${worldX}, ${worldY})`);

  camera.pan(worldX, worldY, 1000, "Power2");
}





async getRandomTopicFromCategory(categoryTitle) {
  if (!this.topicCategories.has(categoryTitle)) {
    console.warn(`⚠️ Category ${categoryTitle} not found.`);
    return { title: "Unknown Topic", subtitle: "No data available." };
  }

  const category = this.topicCategories.get(categoryTitle);
  if (!category.id) {
    console.error(`⚠️ Invalid category: ${categoryTitle} (category.id is missing)`);
    return { title: "Unknown Topic", subtitle: "No category ID." };
  }

  console.log(`🔎 Fetching topic for Category ID: ${category.id}, Title: ${categoryTitle}`);

  try {
    const response = await fetch(`/topics/by_category?topic_category_id=${category.id}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const topicData = await response.json();

    if (!topicData || !topicData.title) {
      console.warn(`⚠️ No valid topics found for category: ${categoryTitle}`);
      return { title: categoryTitle, subtitle: "No topics available in this category." };
    }

    console.log(`📖 Selected Topic: ${topicData.title} (Category: ${categoryTitle})`);

    return {
      title: topicData.title,
      subtitle: topicData.subtitle || "",
    };

  } catch (error) {
    console.error(`🚨 Error fetching topic for ${categoryTitle}:`, error);
    return { title: "Error", subtitle: "Failed to load topic." };
  }
}





showTopicPopup(topic) {
  console.log("📌 Showing topic popup in the center of the screen...");

  if (this.topicPopup) {
    console.warn("⚠️ Popup already exists, not creating another.");
    return;
  }

  const screenWidth = this.scale.width;
  const screenHeight = this.scale.height;

  const popupWidth = screenWidth * 0.6;  
  const popupHeight = screenHeight * 0.5;  
  const fontSizeTitle = Math.max(24, popupWidth * 0.05);
  const fontSizeSubtitle = Math.max(18, popupWidth * 0.035);

  // ✅ Ensure a dedicated UI container
  if (!this.uiContainer) {
    this.uiContainer = this.add.container(0, 0);
    this.uiContainer.setDepth(9999); // Always on top
    this.uiContainer.setScrollFactor(0); // ✅ Keeps it fixed to the screen
  }

  // ✅ Create the popup container and position it at the center
  this.topicPopup = this.add.container(
    screenWidth / 2 - popupWidth / 2, 
    screenHeight / 2 - popupHeight / 2
  );
  this.topicPopup.setDepth(10000);
  this.topicPopup.setScrollFactor(0); // Ensure it doesn't scroll with the camera

  // ✅ Overlay
  const overlay = this.add.graphics();
  overlay.fillStyle(0x000000, 0.5);
  overlay.fillRect(-265, -300, screenWidth, screenHeight);
  overlay.setScrollFactor(0);
  overlay.setInteractive();
  overlay.on("pointerdown", () => this.closeTopicPopup());

  // ✅ Popup Background
  const popupBg = this.add.graphics();
  popupBg.fillStyle(0x000000, 1);
  popupBg.fillRoundedRect(0, 0, popupWidth, popupHeight, 5);
  popupBg.setScrollFactor(0);
  popupBg.lineStyle(4, 0xffffff);
  popupBg.strokeRoundedRect(0, 0, popupWidth, popupHeight, 5);

  // ✅ Create a Header Container
  const headerContainer = this.add.container(0, 0);

  // ✅ Header Background
  const headerBackground = this.add.graphics();
  headerBackground.fillStyle(0x222222, 1);
  headerBackground.fillRect(0, 0, popupWidth, 170);
  headerBackground.setScrollFactor(0);

  // ✅ Category Icon
  const categoryIcon = this.add.image(popupWidth / 2, 30, topic.topicCategory.icon.name).setOrigin(0.5, 0);
  categoryIcon.setDisplaySize(60, 60); // Adjust size as needed
  categoryIcon.setScrollFactor(0);
  
  // ✅ Category Name
  const categoryNameText = this.add.text(popupWidth / 2, 120, topic.topicCategory.title, {
    fontSize: `${fontSizeTitle}px`,
    fill: "#ffffff",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setOrigin(0.5).setScrollFactor(0);

  // ✅ Line at Bottom of Header
  const headerLine = this.add.graphics();
  headerLine.lineStyle(4, 0xffffff); // White, 4px thick
  headerLine.beginPath();
  headerLine.moveTo(0, 170); // Start at bottom-left of header
  headerLine.lineTo(popupWidth, 170); // Draw to bottom-right
  headerLine.strokePath();
  headerLine.setScrollFactor(0);

  // ✅ Add to Header
  headerContainer.add([headerBackground, categoryIcon, categoryNameText, headerLine]);

  // ✅ Title Text
  const titleText = this.add.text(20, 200, topic.title, {
    fontSize: `${fontSizeTitle}px`,
    fill: "#ffffff",
    fontFamily: "Silkscreen, Arial",
    align: "left",
  }).setOrigin(0, 0.5).setScrollFactor(0);

  // ✅ Subtitle Handling (Typing Effect)
  let subtitleChunks = this.splitTextIntoChunks(topic.subtitle || "", Math.floor(popupWidth / 10));
  let currentChunkIndex = 0;
  let isAnimating = false;

  const subtitleText = this.add.text(20, 230, "", {
    fontSize: `${fontSizeSubtitle}px`,
    fill: "#ffffff",
    fontFamily: "Silkscreen, Arial",
    wordWrap: { width: popupWidth - 40, useAdvancedWrap: true },
    align: "left",
  }).setOrigin(0, 0).setScrollFactor(0);

  const typeText = (text, targetTextObject) => {
    if (this.typingInterval) clearInterval(this.typingInterval);

    if (!this.topicPopup) return;

    targetTextObject.text = "";
    let index = 0;
    isAnimating = true;

    this.typingInterval = setInterval(() => {
      if (!this.topicPopup) {
        clearInterval(this.typingInterval);
        this.typingInterval = null;
        return;
      }

      if (index < text.length) {
        targetTextObject.text += text[index];
        index++;
      } else {
        clearInterval(this.typingInterval);
        this.typingInterval = null;
        isAnimating = false;
      }
    }, 50);
  };

  if (subtitleChunks.length > 0) {
    typeText(subtitleChunks[0], subtitleText);
  }

  // ✅ "Next" Button for Subtitle
  const nextButton = this.add.text(popupWidth - 40, popupHeight - 140, "Next", {
    fontSize: `${fontSizeSubtitle}px`,
    fill: "#90D5FF",
    fontFamily: "Silkscreen, Arial",
    align: "right",
  }).setInteractive().setOrigin(1, 1);

  nextButton.on("pointerdown", () => {
    if (isAnimating) return;
    currentChunkIndex++;
    if (currentChunkIndex < subtitleChunks.length) {
      typeText(subtitleChunks[currentChunkIndex], subtitleText);
    } else {
      nextButton.setVisible(false);
    }
  });
  nextButton.setVisible(subtitleChunks.length > 1);

  // Timer Display
  const timerDisplay = this.add.text(20, popupHeight - 100, "3:00", {
    fontSize: "24px",
    fill: "#ffffff",
    fontFamily: "Silkscreen, Arial",
  }).setScrollFactor(0);

  let timeLeft = 180;
  let timerInterval = null;

  // ✅ Create a container to hold the progress bar elements
  const progressBarContainer = this.add.container(20, popupHeight - 50);

  // ✅ Static Background Bar (Grey, Rounded)
  const progressBarBg = this.add.graphics();
  progressBarBg.fillStyle(0x666666);
  progressBarBg.fillRoundedRect(0, 0, popupWidth - 40, 20, 10);
  progressBarBg.setScrollFactor(0);
  progressBarContainer.add(progressBarBg);

  // ✅ Foreground Bar (Regular Rect that gets masked)
  const progressBarFill = this.add.graphics();
  progressBarFill.fillStyle(0x3498db);
  progressBarFill.fillRect(0, 0, popupWidth - 40, 20);
  progressBarFill.setScrollFactor(0);
  progressBarContainer.add(progressBarFill);

  // ✅ Create a Rounded Mask (Hidden)
  const maskGraphics = this.add.graphics();
  maskGraphics.fillStyle(0xffffff);
  maskGraphics.fillRoundedRect(0, 0, popupWidth - 40, 20, 10);
  maskGraphics.setScrollFactor(0);
  const mask = maskGraphics.createGeometryMask();

  progressBarFill.setMask(mask);
  maskGraphics.setVisible(false);

  const updateProgressBar = () => {
    progressBarFill.clear();
    progressBarFill.fillStyle(0x3498db);

    const progressWidth = Phaser.Math.Clamp(
      (popupWidth - 40) * (1 - timeLeft / 180),
      1,
      popupWidth - 40
    );

    progressBarFill.fillRect(0, 0, progressWidth, 20);
  };

  updateProgressBar();

  const updateTimer = () => {
    if (!this.topicPopup) return;

    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.setText(`${minutes}:${seconds.toString().padStart(2, "0")}`);
  };

  // ✅ Create Timer Controls Container (Positioned below the progress bar)
  const timerControlsContainer = this.add.container(popupWidth - 140, popupHeight - 130);

  // ✅ Play Button
  const playButton = this.add.text(0, 30, "▶", {
    fontSize: "24px",
    fill: "#90D5FF",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setInteractive().setScrollFactor(0);
  timerControlsContainer.add(playButton);

  // ✅ Pause Button
  const pauseButton = this.add.text(40, 30, "⏸", {
    fontSize: "24px",
    fill: "#90D5FF",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setInteractive().setScrollFactor(0);
  timerControlsContainer.add(pauseButton);

  // ✅ Reset Button
  const resetButton = this.add.text(80, 30, "🔄", {
    fontSize: "24px",
    fill: "#90D5FF",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setInteractive().setScrollFactor(0);
  timerControlsContainer.add(resetButton);

  playButton.on("pointerdown", () => {
    if (!this.isTimerRunning) {
      this.isTimerRunning = true;
      timerInterval = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          updateTimer();
          updateProgressBar();
        } else {
          clearInterval(timerInterval);
          this.isTimerRunning = false;
          console.log("⏳ Timer complete!");
        }
      }, 1000);
    }
  });

  pauseButton.on("pointerdown", () => {
    this.isTimerRunning = false;
    clearInterval(timerInterval);
  });

  resetButton.on("pointerdown", () => {
    this.isTimerRunning = false;
    clearInterval(timerInterval);
    timeLeft = 180;
    updateProgressBar();
  });

  // ✅ Close Button
  const closeButton = this.add.text(popupWidth - 30, 30, "X", {
    fontSize: `${fontSizeTitle}px`,
    fill: "#ff5555",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setInteractive().setOrigin(0.5).setScrollFactor(0);

  closeButton.on("pointerdown", () => this.closeTopicPopup(this.currentTile));

  // ✅ "New Topic" Button (Top Left)
  const newTopicButton = this.add.text(20, 20, "🔄 New", {
    fontSize: "20px",
    fill: "#90D5FF",
    fontFamily: "Silkscreen, Arial",
    align: "center",
  }).setInteractive().setOrigin(0, 0).setScrollFactor(0);

  newTopicButton.on("pointerdown", async () => {
    console.log("🔄 Fetching a new topic...");
    const newTopic = await this.getAnotherRandomTopicFromCategory(topic.topicCategory.title, titleText.text);

    if (!newTopic || !newTopic.title) {
      console.error("❌ Failed to fetch a valid new topic.");
      return;
    }

    console.log(`✅ New topic fetched: ${newTopic.title}`);

    titleText.setText(newTopic.title);
    subtitleChunks = this.splitTextIntoChunks(newTopic.subtitle || "", Math.floor(popupWidth / 10));
    currentChunkIndex = 0;
    subtitleText.setText("");

    if (subtitleChunks.length > 0) {
      typeText(subtitleChunks[0], subtitleText);
    } else {
      subtitleText.setText("");
    }

    nextButton.setVisible(subtitleChunks.length > 1);
  });

  // ✅ Add Elements to Popup
  this.topicPopup.add([
    overlay, popupBg, titleText, subtitleText, nextButton,
    timerDisplay, progressBarContainer, timerControlsContainer, headerContainer, closeButton, newTopicButton
  ]);

  console.log("Popup successfully created!");

  // ✅ Responsive Resize Handling
  this.scale.on("resize", (gameSize) => {
  if (this.topicPopup) {
    const newScreenWidth = gameSize.width;
    const newScreenHeight = gameSize.height;
    
    this.topicPopup.setPosition(
      newScreenWidth / 2 - popupWidth / 2,
      newScreenHeight / 2 - popupHeight / 2
    );
    
    overlay.clear();
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(-265, -300, newScreenWidth, newScreenHeight);
  }
});
}




closeTopicPopup(tile) {
  if (this.topicPopup) {
    if (this.typingInterval) {  // ✅ Prevents ReferenceError
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }

    if (this.timerInterval) {  // ✅ Also clears timer safely
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isTimerRunning = false; 

    this.topicPopup.destroy();
    this.topicPopup = null;
  }

  if (tile) {
    this.lockTile(tile); // Now it has a reference
  }
}

splitTextIntoChunks(text, maxCharsPerLine = 100) {
  const words = text.split(" ");
  let chunks = [];
  let currentLine = "";

  for (let word of words) {
    if ((currentLine + word).length > maxCharsPerLine) {
      chunks.push(currentLine);
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  }
  if (currentLine.trim() !== "") chunks.push(currentLine.trim());

  return chunks;
}

async getAnotherRandomTopicFromCategory(categoryTitle, previousTopicTitle) {
  if (!this.topicCategories.has(categoryTitle)) {
    console.warn(`⚠️ Category ${categoryTitle} not found.`);
    return { title: "Unknown Topic", subtitle: "No data available." };
  }

  const category = this.topicCategories.get(categoryTitle);
  if (!category.id) {
    console.error(`⚠️ Invalid category: ${categoryTitle} (category.id is missing)`);
    return { title: "Unknown Topic", subtitle: "No category ID." };
  }

  console.log(`🔎 Fetching another topic for category: ${categoryTitle} (ID: ${category.id})`);

  try {
    const response = await fetch(`/topics/by_category?topic_category_id=${category.id}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const topicData = await response.json();
    
    console.log("🔍 API Response Data:", topicData);

    // ✅ Check if the response is a single topic object
    if (!Array.isArray(topicData)) {
      console.warn("⚠️ API returned a single topic, not an array.");
      
      // If it's the same topic as before, we can't provide a new one
      if (topicData.title === previousTopicTitle) {
        return { title: categoryTitle, subtitle: "No more topics in this category." };
      }

      return {
        title: topicData.title,
        subtitle: topicData.subtitle || "",
      };
    }

    // ✅ Ensure we get a different topic than the previous one
    const filteredTopics = topicData.filter(t => t.title !== previousTopicTitle);

    if (filteredTopics.length === 0) {
      console.warn(`⚠️ No more topics available for ${categoryTitle}`);
      return { title: categoryTitle, subtitle: "No more topics in this category." };
    }

    // ✅ Pick a new random topic
    const newTopic = Phaser.Utils.Array.GetRandom(filteredTopics);
    console.log(`✅ New topic selected: ${newTopic.title} (Category: ${categoryTitle})`);

    return {
      title: newTopic.title,
      subtitle: newTopic.subtitle || "",
    };

  } catch (error) {
    console.error(`🚨 Error fetching topic for ${categoryTitle}:`, error);
    return { title: "Error", subtitle: "Failed to load topic." };
  }
}


lockTile(tile) {
  console.log(`🔒 Locking tile at (${tile.x}, ${tile.y})`);

  tile.visited = true; // ✅ Mark as visited
  this.registry.set("usedTopics", this.usedTopics); // ✅ Persist visited topics

  // ✅ Find and remove the old tile container
  const existingContainer = this.getTileContainer(tile);
  if (existingContainer) {
    existingContainer.destroy();
  }

  // ✅ Create a new tile container with updated visuals
  const newTileContainer = this.createTileContainer(tile);

  if (newTileContainer) {
    this.container.add(newTileContainer); // ✅ Re-add updated tile
  }

  // ✅ Keep the icon visible (text or image)
  const icon = newTileContainer?.list.find(child => child instanceof Phaser.GameObjects.Image || child instanceof Phaser.GameObjects.Text);

  if (icon) {
    if (icon instanceof Phaser.GameObjects.Image) {
      icon.setAlpha(0.6); // ✅ Dim image icon
    } else if (icon instanceof Phaser.GameObjects.Text) {
      icon.setColor("#FFFFFF"); // ✅ Ensure text remains white
    }
  } else {
    console.warn(`⚠️ No icon found for tile at (${tile.x}, ${tile.y})`);
  }

  console.log(`✅ Tile at (${tile.x}, ${tile.y}) is now locked.`);
}







getTileContainer(x, y) {
  if (!this.container || !this.container.list) {
    console.error("❌ Tile container is not initialized.");
    return null;
  }

  return this.container.list.find(child => {
    return child.x === x * (this.tileSize + this.padding) &&
           child.y === y * (this.tileSize + this.padding);
  }) || null;
}





getRandomTopicCategory() {
  if (!this.topicCategories || this.topicCategories.length === 0) {
    console.error("No topic categories available - using default category");
    return {
      id: 'default',
      title: 'Default Category',
      color: 0x808080,
      icon: {
        id: 'default-icon',
        name: 'default-icon'
      }
    };
  }

  // Select a random category from the topicCategories array
  const randomIndex = Math.floor(Math.random() * this.topicCategories.length);
  const randomCategory = this.topicCategories[randomIndex];

  // Ensure the category includes the icon property
  if (!randomCategory.icon) {
    console.warn(`Category "${randomCategory.title}" does not have an icon property.`);
    // Assign a default icon if missing
    randomCategory.icon = {
      id: 'default-icon',
      name: 'default-icon'
    };
  }

  return randomCategory;
}

moveCameraToTile(tile) {
  if (!tile || typeof tile.x !== "number" || typeof tile.y !== "number") {
    console.warn("⚠️ Invalid tile for camera movement:", tile);
    return;
  }

  if (this.topicPopup) {
    console.log("🚫 Camera movement skipped, popup is active.");
    return; // 🚫 Do not move the camera when popup is active
  }

  const camera = this.cameras.main;
  
  if (camera.scrollX === tile.x && camera.scrollY === tile.y) {
    console.log("🔹 Camera is already at the target tile.");
    return;
  }

  console.log(`📸 Moving camera to tile at (${tile.x}, ${tile.y})`);
  camera.pan(tile.x * this.tileSize, tile.y * this.tileSize, 1000, "Power2");
}



clearGrid() {
  console.log('Clearing existing grid...');
  this.grid.clear(); // Clear the existing Map
  this.container.removeAll(true); // Remove all displayed tiles
  this.renderGrid(); // Re-render the grid
}

onloadComplete() {
  console.log("All assets loaded");
  // You can call methods that require loaded assets here
  this.createTileContainer();
}

update(time, delta) {
  const camera = this.cameras.main;
  const { cameraSpeed, zoomSpeed } = this.controlConfig;

  let moved = false; // Track whether the camera moved

  if (this.cursors) {
    if (this.cursors.left.isDown) {
      camera.scrollX -= cameraSpeed;
      moved = true;
    }
    if (this.cursors.right.isDown) {
      camera.scrollX += cameraSpeed;
      moved = true;
    }
    if (this.cursors.up.isDown) {
      camera.scrollY -= cameraSpeed;
      moved = true;
    }
    if (this.cursors.down.isDown) {
      camera.scrollY += cameraSpeed;
      moved = true;
    }
  }

  // Handle zooming
  if (this.input.keyboard.addKey('W').isDown) {
    camera.zoom = Math.min(camera.zoom + zoomSpeed, 1.5);
    moved = true;
  }
  if (this.input.keyboard.addKey('S').isDown) {
    camera.zoom = Math.max(camera.zoom - zoomSpeed, 0.5);
    moved = true;
  }

  // Keep camera within bounds
  const bounds = { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 };
  camera.scrollX = Phaser.Math.Clamp(camera.scrollX, bounds.minX, bounds.maxX);
  camera.scrollY = Phaser.Math.Clamp(camera.scrollY, bounds.minY, bounds.maxY);

  if (moved) {
    this.renderGrid(); // ✅ Only render when camera actually moves
  }
}



clearGrid() {
  if (!this.grid || this.grid.size === 0) return;
  console.log("Clearing existing grid...");
  this.grid.clear();
  this.container.removeAll(true); // Remove existing tiles
}



}