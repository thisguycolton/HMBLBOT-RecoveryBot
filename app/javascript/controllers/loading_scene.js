export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
    this.topicCategories = new Map();
  }

  preload() {
    // Create a progress bar
    this.progressBar = this.add.graphics();
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x222222, 0.8);
    this.progressBox.fillRect(
      this.cameras.main.centerX - 100,
      this.cameras.main.centerY - 20,
      200,
      40
    );

    this.progressBar.clear();
    this.progressBar.fillStyle(0x4CAF50, 1);
    this.progressBar.fillRect(
      this.cameras.main.centerX - 100,
      this.cameras.main.centerY - 20,
      {
        width: 200 * this.load.progress,
        height: 40
      }
    );

    // Add loading text
    this.loadingText = this.make.text({
      x: this.cameras.main.centerX,
      y: this.cameras.main.centerY + 50,
      text: 'Loading...',
      style: {
        fontSize: '20px',
        fill: '#ffffff'
      }
    });

    // Update progress bar
    this.load.on('progress', (value) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x4CAF50, 1);
      this.progressBar.fillRect(
        this.cameras.main.centerX - 100,
        this.cameras.main.centerY - 20,
        {
          width: 200 * value,
          height: 40
        }
      );
      this.loadingText.setText(`Loading ${Math.round(value * 100)}%`);
    });

    // Remove loading bar when complete
    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
    });

    // Start loading your assets here
      this.load.script("webfont", "https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js");

  // Load other assets (images, sounds, etc.)
  this.load.image("loadingBar", "assets/loading-bar.png");

  // Emit an event once font is ready
  WebFont.load({
    google: {
      families: ["Silkscreen"],
    },
    active: () => {
      console.log("✅ Silkscreen font loaded!");
      this.fontLoaded = true;
    },
  });
    fetch('/topic_categories.json')
      .then(response => response.json())
      .then(categories => {
        categories.forEach(category => {
          if (category.icon) {

            const iconId = category.icon.file_path;
            const iconName = category.icon.name;
            const iconUrl = `https://acid-test.s3.us-west-2.amazonaws.com/game_icons/node/${iconName}.png`;
            this.load.image(iconName, iconUrl);
          }
        });

        // Load mystery icon
        const mysteryIconUrl = 'https://acid-test.s3.us-west-2.amazonaws.com/game_icons/node/icon_interrogation.png';
        this.load.image('mystery-icon', mysteryIconUrl);


        this.loadTopicCategories();

        this.loadGameState();
      })
      .catch(error => console.error('Error loading icons:', error));
  }



async loadTopicCategories() {
  try {
    const response = await fetch('/topic_categories.json');
    if (!response.ok) throw new Error('Failed to fetch topic categories');

    const categories = await response.json();

    this.load.reset(); // Clears any previous queue
    categories.forEach(category => {
      const iconId = category.icon?.file_path;
      const iconName = category.icon?.name;
      const iconUrl = iconId 
        ? `https://acid-test.s3.us-west-2.amazonaws.com/game_icons/node/${iconName}.png`
        : null;

      if (iconUrl) {
        const cacheBuster = `?v=${Date.now()}`; // Avoids caching issues
        const finalUrl = iconUrl + cacheBuster;

        console.log(`🖼️ Queuing image: ${iconName} from ${finalUrl}`);
        this.textures.remove(iconName); // Removes from cache if exists
        this.load.image(iconName, finalUrl);
      }

      this.topicCategories.set(category.title, {
        id: category.id, 
        title: category.title,
        icon: iconUrl ? { id: iconId, name: iconName, url: iconUrl } : null,
        topics: category.topics || []
      });
    });

    console.log("✅ Topic categories loaded:", this.topicCategories);
    console.log("📊 Phaser Loader Queue BEFORE start():", this.load.list);

    this.load.once("complete", () => {
      console.log("🔥 Emitting topicCategoriesLoaded event...");
      this.events.emit("topicCategoriesLoaded");
      this.scene.start("GameScene");
    });

    console.log("🚀 Starting Phaser asset loading...");
    this.load.start(); 
    
    // Debug queue state AFTER start()
    setTimeout(() => {
      console.log("📊 Phaser Loader Queue AFTER start():", this.load.list);
    }, 500);

    // Failsafe to force event after 3 seconds
    setTimeout(() => {
      if (!this.scene.isActive("GameScene")) {
        console.warn("⏳ Load taking too long—forcing topicCategoriesLoaded event!");
        this.events.emit("topicCategoriesLoaded");
        this.scene.start("GameScene");
      }
    }, 3000);
  } catch (error) {
    console.error("❌ Error loading topic categories:", error);
  }
}









async loadGameState() {
  try {
    if (this.controller && typeof this.controller.hideSessionList === "function") {
      this.controller.hideSessionList();
      console.log("Session list hidden using hideSessionList().");
    } else {
      console.warn("GameController or hideSessionList() method not found.");
    }

    const sessionId = this.registry.get("sessionId");
    const response = await fetch(`/api/v1/quest_sessions/${sessionId}`);

    if (!response.ok) throw new Error(`Failed to fetch session: ${response.statusText}`);

    const data = await response.json();
    console.log("Session data received:", data);

    // Store game state in registry for access in GameScene
    this.registry.set("gameState", data.game_state);
    this.registry.set("usedTopics", data.game_state.usedTopics || []);
    this.registry.set("currentPosition", data.game_state.current_position || { x: 0, y: 0 });
    this.registry.set("points", data.game_state.points || 5);
    this.registry.set("inventory", data.game_state.inventory || {});

    // Initialize the grid processing
    const gridEntries = Object.entries(data.game_state.grid || {});
    const grid = new Map();
    let loadedTiles = 0;
    const totalTiles = gridEntries.length;

    console.log(`Processing ${totalTiles} tiles...`);

    // Process tiles with progress tracking
    for (const [key, tileData] of gridEntries) {
      const [x, y] = key.split(",").map(Number);
      grid.set(key, { ...tileData, x, y });

      loadedTiles++;

      // Update loading bar (every 10 tiles for better performance)
      if (loadedTiles % 10 === 0) {
        const progress = loadedTiles / totalTiles;
        this.progressBar.clear();
        this.progressBar.fillStyle(0x4CAF50, 1);
        this.progressBar.fillRect(
          this.cameras.main.centerX - 100,
          this.cameras.main.centerY - 20,
          200 * progress,
          40
        );
        this.loadingText.setText(`Loading ${Math.round(progress * 100)}%`);
        await this.delay(5); // Small delay to allow UI updates
      }
    }

    this.registry.set("grid", grid);

    console.log("Grid loaded. Switching to GameScene...");
    this.scene.start("GameScene"); // Start GameScene AFTER grid is fully processed
  } catch (error) {
    console.error("Error loading game state:", error);
  }
}

// Helper function to introduce a slight delay for UI updates
delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


  create() {

  }
}