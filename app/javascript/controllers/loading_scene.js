export default class LoadingScene extends Phaser.Scene {
  constructor() {
    super('LoadingScene');
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
    this.load.image('loading-bar', '/assets/images/loading-bar.png');
  }

  create() {
    // Once loading is complete, start your game scene
    this.scene.start('GameScene');
  }
}