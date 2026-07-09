export class Hud {
  constructor() {
    this.prompt = document.querySelector("#prompt");
    this.progress = document.querySelector("#progress");
    this.finalMessage = document.querySelector("#final-message");
  }

  setPrompt(text) {
    this.prompt.textContent = text;
    this.prompt.classList.toggle("visible", Boolean(text));
  }

  setProgress(done, total) {
    this.progress.textContent = `${done} / ${total}`;
  }

  showFinal() {
    this.finalMessage.classList.add("visible");
  }
}
