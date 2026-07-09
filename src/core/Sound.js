export class Sound {
  constructor() {
    this.successAudio = new Audio("/audio/date-success.mp3");
    this.successAudio.volume = 0.75;

    this.music = new Audio("/audio/background-music.mp3");
    this.music.loop = true;
    this.music.volume = 0.14;
  }

  ensure() {
    this.music.play().catch(() => {});
  }

  success() {
    this.successAudio.currentTime = 0;
    this.successAudio.play().catch(() => {});
  }
}
