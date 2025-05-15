export default class ChunkManager extends Phaser.Scene {
  constructor(scene, chunkSize) {
    this.scene = scene;
    this.chunkSize = chunkSize;
    this.chunks = new Map(); // Map of chunk coordinates to Chunk objects
    this.visibleChunks = new Set(); // Currently visible chunks
  }

  getChunk(x, y) {
    const chunkX = Math.floor(x / this.chunkSize);
    const chunkY = Math.floor(y / this.chunkSize);
    const key = `${chunkX},${chunkY}`;
    
    if (!this.chunks.has(key)) {
      const chunk = new Chunk(chunkX, chunkY, this.chunkSize);
      this.chunks.set(key, chunk);
    }
    return this.chunks.get(key);
  }

  updateVisibility(camera) {
    const { scrollX, scrollY, width, height } = camera;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // Calculate the range of chunks to load
    const minX = Math.floor((scrollX - halfWidth) / (this.chunkSize * this.scene.tileSize));
    const maxX = Math.ceil((scrollX + halfWidth) / (this.chunkSize * this.scene.tileSize));
    const minY = Math.floor((scrollY - halfHeight) / (this.chunkSize * this.scene.tileSize));
    const maxY = Math.ceil((scrollY + halfHeight) / (this.chunkSize * this.scene.tileSize));

    // Load/unload chunks based on visibility
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.visibleChunks.has(key)) {
          this.loadChunk(x, y);
          this.visibleChunks.add(key);
        }
      }
    }

    // Unload chunks that are no longer visible
    this.visibleChunks.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      if (x < minX || x > maxX || y < minY || y > maxY) {
        this.unloadChunk(x, y);
        this.visibleChunks.delete(key);
      }
    });
  }

  loadChunk(x, y) {
    const key = `${x},${y}`;
    const chunk = this.getChunk(x, y);
    if (!chunk.isLoaded) {
      chunk.generateTerrain();
      chunk.isLoaded = true;
      this.scene.renderChunk(chunk);
    }
  }

  unloadChunk(x, y) {
    const key = `${x},${y}`;
    const chunk = this.getChunk(x, y);
    if (chunk.isLoaded) {
      chunk.isLoaded = false;
      this.scene.clearChunk(chunk);
    }
  }
}