import { Controller } from "@hotwired/stimulus";
import { Application, Text, Graphics, Container, Sprite, Texture, Assets } from "pixi.js";

export default class extends Controller {
  static values = {
    topicsUrl: String,
    topicCategoriesUrl: String,
  };

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
    // Add a flag to track initialization
    this.initialized = false;

    // Load the font and data in parallel
    await Promise.all([this.loadFont(), this.loadData()]);

    // Initialize the game
    if (!this.initialized) {
      this.initializeGame();
      
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
      console.log("Topics and topic categories loaded");
    } catch (error) {
      console.error("Error loading data:", error);
    }
  }

  async initializeGame() {
    // Set the initialized flag to true
    this.initialized = true;

    try {
      this.app = new Application();
      await this.app.init({ background: '#1099bb', resizeTo: window });

      this.element.appendChild(this.app.canvas);

      // Initialize iconTextures as an empty object
      this.iconTextures = {};

      // Preload all assets
      await this.preloadAssets();

      this.tileSize = 100;
      this.padding = 5;
      this.borderRadius = 10;

      this.grid = new Map();

      this.container = new Container();
      this.app.stage.addChild(this.container);

      this.initializeStartingArea();
      this.currentPosition = this.getTile(0, 0);
      this.renderGrid();
      this.centerOnPlayer(this.currentPosition);

      this.addResetButton();
    } catch (error) {
      console.error("Error initializing game:", error);
    }
  }

async preloadAssets() {
  try {
    // Load category icons
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

    console.log("All icons loaded successfully:", this.iconTextures);
  } catch (error) {
    console.error("Error loading assets:", error);
  }
}

async fetchTopicCategories() {
  try {
    const response = await fetch(this.topicCategoriesUrlValue);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Raw topic categories data:", data);
    this.topicCategories = data;
    console.log("Assigned topic categories:", this.topicCategories);
    return data;
  } catch (error) {
    console.error('Error fetching topic categories:', error);
    this.topicCategories = [];
    return [];
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


async loadIcons() {
  this.iconTextures = {};

  if (!this.topicCategories || this.topicCategories.length === 0) {
    console.log('No topic categories available');
    return;
  }

  try {
    // Load all icons in parallel
    await Promise.all(this.topicCategories.map(async category => {
      if (category.icon) {
        try {
          const icon = await this.getIconById(category.icon.id);
          if (icon) {
            const iconUrl = `/assets/${icon.file_path}`;
            console.log(`Attempting to load icon for category "${category.title}" from URL:`, iconUrl);
            const texture = await this.loadTexture(iconUrl);
            this.iconTextures[category.title] = texture;
            console.log(`Successfully loaded icon for category "${category.title}"`);
          }
        } catch (error) {
          console.error(`Failed to load icon for category "${category.title}":`, error);
        }
      }
    }));

    // Load mystery icon
    const mysteryIconUrl = '/assets/icons/icon_interrogation.png';
    console.log('Attempting to load mystery icon from URL:', mysteryIconUrl);
    const mysteryTexture = await this.loadTexture(mysteryIconUrl);
    this.iconTextures['mystery'] = mysteryTexture;
    console.log('Successfully loaded mystery icon');

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
    console.log('Successfully loaded close icon');

  } catch (error) {
    console.error("Error loading icons:", error);
  }
}
  getTile(x, y) {
    const key = `${x},${y}`;
    if (!this.grid.has(key)) {
      this.grid.set(key, { 
        x, 
        y, 
        type: 'landscape', 
        visited: false, 
        unlocked: false, 
        container: null 
      });
    }
    return this.grid.get(key);
  }

  centerOnPlayer(playerTile) {
    const screenCenterX = this.app.screen.width / 2;
    const screenCenterY = this.app.screen.height / 2;
    const tileCenterX = playerTile.x * (this.tileSize + this.padding);
    const tileCenterY = playerTile.y * (this.tileSize + this.padding);

    this.container.x = screenCenterX - tileCenterX;
    this.container.y = screenCenterY - tileCenterY;
  }

  isPathOrPOI(x, y) {
    const tile = this.getTile(x, y);
    return tile.type === 'path' || tile.type === 'topic' || tile.type === 'mystery';
  }

createTileContainer(tile) {
  const tileContainer = new Container();
  tileContainer.x = tile.x * (this.tileSize + this.padding);
  tileContainer.y = tile.y * (this.tileSize + this.padding);

  // Make the tile interactive
  tileContainer.interactive = true; // Enable interactivity
  tileContainer.buttonMode = true;  // Show pointer cursor on hover

  const tileGraphic = new Graphics();
  if (tile === this.currentPosition) {
    tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
      .fill({ color: 0xFFD700 });
  } else if (tile.type === 'topic') {
    const category = tile.topicCategory;
    if (!category) {
      console.error("Tile is of type 'topic' but topicCategory is undefined:", tile);
      tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
        .fill({ color: 0x808080 });
    } else {
      const categoryColor = this.constructor.categoryColors[category.title] || 0x808080;
      if (tile.visited) {
        tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
          .fill({ color: 0x808080 });
      } else if (tile.unlocked) {
        tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
          .fill({ color: categoryColor });
      } else {
        tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
          .fill({ color: 0x808080 });
      }
    }
  } else if (tile.type === 'mystery') {
    const rainbowGradient = new Graphics();
    const rainbowColors = [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3];
    let colorIndex = 0;
    let frameCounter = 0;
    const framesPerColor = 10;

    const animateRainbow = () => {
      frameCounter++;
      if (frameCounter >= framesPerColor) {
        frameCounter = 0;
        rainbowGradient.clear();
        rainbowGradient.beginFill(rainbowColors[colorIndex]);
        rainbowGradient.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius);
        rainbowGradient.endFill();
        colorIndex = (colorIndex + 1) % rainbowColors.length;
      }
    };

    this.app.ticker.add(animateRainbow);
    tileContainer.addChild(rainbowGradient);
  } else if (tile.type === 'path') {
    tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
      .fill({ color: 0xD2B48C });
  } else {
    tileGraphic.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
      .fill({ color: 0x2ecc71 });
  }

  tileContainer.addChild(tileGraphic);

  if (tile.type === 'topic' || tile.type === 'mystery') {
    const iconTexture = (this.iconTextures && this.iconTextures[tile.topicCategory?.title]) || this.iconTextures?.['mystery'];
    if (iconTexture) {
      const iconSprite = new Sprite(iconTexture);
      iconSprite.anchor.set(0.5, 0.5);
      iconSprite.x = this.tileSize / 2;
      iconSprite.y = this.tileSize / 2;
      iconSprite.width = 48;
      iconSprite.height = 48;
      tileContainer.addChild(iconSprite);
    } else {
      console.error("Icon texture not found for category:", tile.topicCategory?.title);
      // Add fallback icon
      const fallbackIcon = new Text({
        text: "📌",
        style: {
          fontFamily: 'Silkscreen, Arial',
          fontSize: 32,
          fill: 0xFFFFFF,
          align: 'center',
        },
      });
      fallbackIcon.anchor.set(0.5, 0.5);
      fallbackIcon.x = this.tileSize / 2;
      fallbackIcon.y = this.tileSize / 2;
      tileContainer.addChild(fallbackIcon);
    }

    // Add click event listener
    tileContainer.on('pointerdown', () => this.handleTileClick(tile));
  }

  return tileContainer;
}
async loadTexture(url) {
  try {
    console.log(`Attempting to load texture from URL: ${url}`);
    const texture = await Assets.load(url); // Use Assets.load instead of Texture.from
    console.log(`Successfully loaded texture from URL: ${url}`);
    return texture;
  } catch (error) {
    console.error(`Failed to load texture from URL: ${url}`, error);
    // Fallback to a default icon
    console.log(`Attempting to load fallback texture from URL: https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/question-circle.svg`);
    const fallbackTexture = await Assets.load('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/question-circle.svg');
    console.log(`Successfully loaded fallback texture`);
    return fallbackTexture;
  }
}

  handlePlayerMovement(tile) {
    if (tile.type === 'path' && tile.unlocked) {
      this.currentPosition = tile;
      this.centerOnPlayer(this.currentPosition);
      this.renderGrid();
    }
  }

async handleTileClick(tile) {
  console.log('Tile clicked:', tile);
  if (tile.type === 'topic' && !tile.visited) {
    tile.visited = true;
    tile.unlocked = true;
    this.currentPosition = tile;
    this.centerOnPlayer(this.currentPosition);

    try {
      const randomTopic = await this.getRandomTopicFromCategory(tile.topicCategory);
      console.log('Random topic:', randomTopic);
      this.displayTopicPopup(randomTopic);

      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const numPaths = Math.floor(Math.random() * 3) + 1;
      const shuffledDirections = directions.sort(() => Math.random() - 0.5);

      for (let i = 0; i < numPaths; i++) {
        const direction = shuffledDirections[i];
        this.generatePathToPOI(this.currentPosition, direction);
      }

      this.renderGrid();
    } catch (error) {
      console.error("Error handling tile click:", error);
    }
  } else if (tile.type === 'mystery' && !tile.visited) {
    tile.visited = true;
    tile.unlocked = true;
    tile.type = 'topic';
    tile.topicCategory = this.getRandomTopicCategory();

    this.currentPosition = tile;
    this.centerOnPlayer(this.currentPosition);

    try {
      const randomTopic = await this.getRandomTopicFromCategory(tile.topicCategory);
      console.log('Random topic:', randomTopic);
      this.displayTopicPopup(randomTopic);

      const directions = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
      ];
      const numPaths = Math.floor(Math.random() * 3) + 1;
      const shuffledDirections = directions.sort(() => Math.random() - 0.5);

      for (let i = 0; i < numPaths; i++) {
        const direction = shuffledDirections[i];
        this.generatePathToPOI(this.currentPosition, direction);
      }

      this.renderGrid();
    } catch (error) {
      console.error("Error handling mystery tile click:", error);
    }
  } else if (tile.type === 'path') {
    this.handlePlayerMovement(tile);
  }
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
  popupContainer.height = randomTopic.subtitle ? 250 : 200;
  popupContainer.x = (this.app.screen.width - popupContainer.width) / 3;
  popupContainer.y = (this.app.screen.height - popupContainer.height) / 2.3;

  // Create a transparent overlay covering the entire screen
  const overlay = new Graphics()
    .rect(0, 0, this.app.screen.width, this.app.screen.height)
    .fill({ color: 0x000000, alpha: 0.5 });
  overlay.eventMode = 'static'; // Make it interactive
  overlay.cursor = 'pointer'; // Show pointer cursor on hover
  this.app.stage.addChild(overlay);

  // Create the blocky background using the modern Graphics API
  const background = new Graphics()
    .rect(0, 0, 550, randomTopic.subtitle ? 350 : 200) // Explicit dimensions
    .fill({ color: 0x000000 }) // Fill with black
    .stroke({ width: 4, color: 0xFFFFFF }); // Add a white border
  popupContainer.addChild(background);

  // Add the topic category icon at the top of the popup
  if (randomTopic.topicCategory && this.iconTextures[randomTopic.topicCategory.title]) {
    const iconTexture = this.iconTextures[randomTopic.topicCategory.title];
    console.log("Icon Texture Found:", iconTexture);

    const iconSprite = new Sprite(iconTexture);
    iconSprite.anchor.set(0.5, 0.5); // Center the sprite
    iconSprite.x = popupContainer.width / 2; // Center horizontally
    iconSprite.y = 60; // Position above the title
    iconSprite.width = 64; // Set icon size
    iconSprite.height = 64; // Set icon size
    popupContainer.addChild(iconSprite);
  } else {
    console.error("Icon Texture Not Found for Category:", randomTopic.topicCategory?.title);
  }

  // Create the title text
  const titleText = new Text({
    text: randomTopic.title,
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 32, // Larger font size
      fill: 0xFFFFFF, // White text
      align: 'center',
    },
  });
  titleText.x = (popupContainer.width - titleText.width) / 2;
  titleText.y = randomTopic.subtitle ? 100 : 100; // Adjusted position to make room for the icon
  popupContainer.addChild(titleText);

  // Handle empty subtitles
  const subtitleContent = randomTopic.subtitle || "";

  // Split the subtitle into chunks (8 words or 50 chars, whichever comes first)
  const subtitleChunks = this.splitTextIntoChunks(subtitleContent, 20, 155);

  // Create a container for the subtitle text
  const subtitleContainer = new Container();
  subtitleContainer.x = 20; // Add some padding
  subtitleContainer.y = randomTopic.subtitle ? 150 : 120; // Adjusted position to make room for the icon and title
  subtitleContainer.width = popupContainer.width - 40; // Adjust width
  subtitleContainer.height = randomTopic.subtitle ? 100 : 0; // Adjust height
  popupContainer.addChild(subtitleContainer);

  // Create the subtitle text
  const subtitleText = new Text({
    text: "", // Start with empty text
    style: {
      fontFamily: 'Silkscreen, Arial', // Use Silkscreen font with Arial fallback
      fontSize: 20, // Smaller font size
      fill: 0xFFFFFF, // White text
      align: 'left',
      wordWrap: true, // Enable word wrap
      wordWrapWidth: 450, // Adjust wrap width
    },
  });
  subtitleText.x = 0;
  subtitleText.y = 0;
  subtitleContainer.addChild(subtitleText);

  // Add a "Next" button
  const nextButton = new Text({
    text: "Next",
    style: {
      fontFamily: 'Silkscreen, Arial',
      fontSize: 20,
      fill: 0x90D5FF,
      align: 'center',
    },
  });
  nextButton.x = popupContainer.width - nextButton.width - 20; // Position at bottom-right
  nextButton.y = popupContainer.height - nextButton.height - 30;
  nextButton.eventMode = 'static'; // Make it interactive
  nextButton.cursor = 'pointer'; // Show pointer cursor on hover
  popupContainer.addChild(nextButton);

  // Track the current page of text
  let currentPage = 0;
  let isAnimating = false;

  // Function to display the current page with typing animation
  const displayPageWithTypingAnimation = async () => {
    if (isAnimating) return; // Prevent multiple animations

    isAnimating = true;
    const pageText = subtitleChunks[currentPage];
    let currentCharIndex = 0;

    // Clear the existing text
    subtitleText.text = "";

    // Typing animation
    const typingInterval = setInterval(() => {
      if (currentCharIndex < pageText.length) {
        subtitleText.text += pageText[currentCharIndex];
        currentCharIndex++;
      } else {
        clearInterval(typingInterval);
        isAnimating = false;
      }
    }, 50); // Adjust typing speed (milliseconds per character)

    // Wait for the animation to complete
    await new Promise(resolve => {
      const animationCompleteInterval = setInterval(() => {
        if (!isAnimating) {
          clearInterval(animationCompleteInterval);
          resolve();
        }
      }, 50);
    });
  };

  // Display the first page
  displayPageWithTypingAnimation();

  // Handle "Next" button click
  nextButton.on('pointerdown', async () => {
    if (isAnimating) return; // Prevent multiple clicks during animation

    currentPage++;
    if (currentPage < subtitleChunks.length) {
      await displayPageWithTypingAnimation(); // Display the next page
    } else {
      // No more pages, close the popup or reset
      this.app.stage.removeChild(popupContainer);
      this.app.stage.removeChild(overlay);
    }
  });
  // Add close button
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
});
popupContainer.addChild(closeButton);

  // Add the popup to the stage
  this.app.stage.addChild(popupContainer);
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
    console.error("No topic categories available");
    return null;
  }

  // Create a list of available categories
  const availableCategories = this.topicCategories.filter(category => {
    return category.title && this.constructor.categoryColors[category.title];
  });

  if (availableCategories.length === 0) {
    console.error("No valid categories available");
    return null;
  }

  // Select a random category
  const randomIndex = Math.floor(Math.random() * availableCategories.length);
  return availableCategories[randomIndex];
}

async getRandomTopicFromCategory(topicCategory) {
  try {
    const response = await fetch(`/topics/by_category?topic_category_id=${topicCategory.id}`);
    if (!response.ok) {
      throw new Error("Failed to fetch topics for category");
    }
    const topicsInCategory = await response.json();

    if (topicsInCategory.length === 0) {
      return { title: 'No Topic Found', subtitle: 'Please try another category.' };
    }

    // Get the category title from the topicCategory parameter
    const randomTopic = topicsInCategory[Math.floor(Math.random() * topicsInCategory.length)];
    randomTopic.topicCategory = {
      title: topicCategory.title // Add the category title to the topic
    };
    return randomTopic;
  } catch (error) {
    console.error("Error fetching topics by category:", error);
    return { title: 'Error', subtitle: 'Failed to load topics.' };
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

  initializeStartingArea() {
    const startTile = this.getTile(0, 0);
    startTile.type = 'path';
    startTile.unlocked = true;
    startTile.visited = true;

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
      this.generatePathToPOI(startTile, direction);
    }
  }

generatePathToPOI(fromTile, direction) {
  const { x, y } = fromTile;
  let currentX = x;
  let currentY = y;

  const depth = Math.floor(Math.random() * 3) + 1;

  for (let i = 1; i <= depth; i++) {
    const newX = currentX + direction.x * i;
    const newY = currentY + direction.y * i;

    if (this.isPathOrPOI(newX, newY)) {
      break;
    }

    const pathTile = this.getTile(newX, newY);
    pathTile.type = 'path';
    pathTile.unlocked = true;

    if (i === depth) {
      if (Math.random() < 0.1) {
        const mysteryTile = this.getTile(newX + direction.x, newY + direction.y);
        mysteryTile.type = 'mystery';
        mysteryTile.unlocked = true;
      } else {
        const poiTile = this.getTile(newX + direction.x, newY + direction.y);
        poiTile.type = 'topic';
        const randomCategory = this.getRandomTopicCategory();
        if (randomCategory) {
          poiTile.topicCategory = randomCategory;
        } else {
          console.error("Could not assign topic category to POI tile");
        }
        poiTile.unlocked = true;
      }
    }
  }
}

  renderGrid() {
    const radius = 5;
    const playerX = this.currentPosition.x;
    const playerY = this.currentPosition.y;

    this.container.removeChildren();

    for (let x = playerX - radius; x <= playerX + radius; x++) {
      for (let y = playerY - radius; y <= playerY + radius; y++) {
        const tile = this.getTile(x, y);
        if (tile) {
          const tileContainer = this.createTileContainer(tile);
          this.container.addChild(tileContainer);
        }
      }
    }
  }
}