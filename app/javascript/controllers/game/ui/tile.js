// app/javascript/controllers/game/ui/tile.js
import { Graphics, Container, Sprite, Text } from 'pixi.js';
import { DropShadowFilter } from 'pixi-filters';

export class Tile {
  constructor(tileData, app, tileSize, padding, borderRadius) {
    this.tileData = tileData;
    this.app = app;
    this.tileSize = tileSize;
    this.padding = padding;
    this.borderRadius = borderRadius;
    this.container = new Container();
  }

  createContainer() {
      if (!tile) return null;

  const keyParts = tile.key.split(',');
  const tileX = parseInt(keyParts[0]);
  const tileY = parseInt(keyParts[1]);

  // Calculate tile position based on grid layout
  const tilePositionX = tileX * (this.tileSize + this.padding);
  const tilePositionY = tileY * (this.tileSize + this.padding);

  const tileContainer = new Container();
  tileContainer.position.set(tilePositionX, tilePositionY);

  if (tile.type === 'structure') {
    return; // Structure tiles are rendered separately
  }

  // Declare waterLabel at the top of the method
  let waterLabel = null;

  // Make the tile interactive
  tileContainer.interactive = true;
  tileContainer.buttonMode = true;

  // Create the tile background with pixelated effects
  const tileBackground = new Graphics();

  // Add a slight shadow
  tileBackground.filters = [new DropShadowFilter({
    distance: 1,
    color: 0x000000,
    alpha: 0.1
  })];

  // Set the background color based on tile type
  let tileColor = 0x2ecc71; // Default color for landscape

  if (tile.type === 'path') {
    tileColor = 0xD2B48C; // Path color
  } else if (tile.type === 'water') {
    tileColor = 0x3498db; // Water color
  } else if (tile.type === 'topic' || tile.type === 'mystery') {
    if (tile.visited) {
      // For visited tiles, use a solid grey background
      tileColor = 0x808080;
    } else {
      // For unvisited tiles, use the category color or default
      if (tile.topicCategory) {
        tileColor = this.constructor.categoryColors[tile.topicCategory.title] || 0x808080;
      } else {
        tileColor = 0x808080; // Default for unspecified categories
      }
    }
  }

  // Add a subtle border
  tileBackground.lineStyle(2, tile === this.currentPosition ? 0xFFFF00 : 0x333333);
  tileBackground.beginFill(tileColor);
  tileBackground.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius);
  tileBackground.endFill();

  tileContainer.addChild(tileBackground);

  // Add additional styling based on tile type
  if (tile === this.currentPosition) {
    const highlight = new Graphics()
      .beginFill(0xFFFF00)
      .roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius)
      .endFill();
    highlight.alpha = 0.5;
    tileContainer.addChild(highlight);
  }

  if (tile.type === 'water') {
    // Create water effect
    const water = new Graphics();
    water.beginFill(0x3498db); // Blue color for water
    water.roundRect(0, 0, this.tileSize, this.tileSize, this.borderRadius);
    water.endFill();
    tileContainer.addChild(water);

    // Add subtle animation for water flow
    let flowOffset = 0;
    const animateWater = () => {
      flowOffset += 0.1;
      water.x = Math.sin(flowOffset) * 2;
      requestAnimationFrame(animateWater);
    };
    animateWater();

    // Add a visual indicator for debugging
    waterLabel = new Text({
      text: "W",
      style: {
        fontFamily: 'Silkscreen, Arial',
        fontSize: 24,
        fill: 0xFFFFFF,
        align: 'center',
      },
    });
    waterLabel.anchor.set(0.5, 0.5);
    waterLabel.x = this.tileSize / 2;
    waterLabel.y = this.tileSize / 2;
    tileContainer.addChild(waterLabel);
  }

  // Add the original tile graphics on top
  const tileGraphic = new Graphics();
  if (tile.type === 'topic' || tile.type === 'mystery') {
    if (!tile.visited) {
      if (tile.type === 'mystery') {
        // For unvisited mystery tiles, show the mystery icon
        const iconTexture = this.iconTextures['mystery'];
        if (iconTexture) {
          const iconSprite = new Sprite(iconTexture);
          iconSprite.anchor.set(0.5, 0.5);
          iconSprite.x = this.tileSize / 2;
          iconSprite.y = this.tileSize / 2;
          iconSprite.width = 48;
          iconSprite.height = 48;
          tileContainer.addChild(iconSprite);
        } else {
          console.error("Mystery icon texture not found");
          // Add fallback icon
          const fallbackIcon = new Text({
            text: "❓",
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
      } else {
        if (tile.topicCategory) {
          const iconTexture = this.iconTextures[tile.topicCategory.title];
          if (iconTexture) {
            const iconSprite = new Sprite(iconTexture);
            iconSprite.anchor.set(0.5, 0.5);
            iconSprite.x = this.tileSize / 2;
            iconSprite.y = this.tileSize / 2;
            iconSprite.width = 48;
            iconSprite.height = 48;
            tileContainer.addChild(iconSprite);
          } else {
            console.error(`Icon texture not found for category "${tile.topicCategory.title}"`);
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
        }
      }
    } else {
      // For visited tiles, show the category icon and solid background
      if (tile.topicCategory) {
        const iconTexture = this.iconTextures[tile.topicCategory.title];
        if (iconTexture) {
          const iconSprite = new Sprite(iconTexture);
          iconSprite.anchor.set(0.5, 0.5);
          iconSprite.x = this.tileSize / 2;
          iconSprite.y = this.tileSize / 2;
          iconSprite.width = 48;
          iconSprite.height = 48;
          tileContainer.addChild(iconSprite);
        } else {
          console.error(`Icon texture not found for category "${tile.topicCategory.title}"`);
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
      }
    }
    tileContainer.on('pointerdown', () => this.handleTileClick(tile));
    tileContainer.addChild(tileGraphic);
  }
  tileContainer.name = `tile-${tileX},${tileY}`;

  return tileContainer;
  }
}