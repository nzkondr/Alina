export class Input {
  constructor({ canvas, actionButton, joystick }) {
    this.canvas = canvas;
    this.actionButton = actionButton;
    this.joystick = joystick;
    this.joystickKnob = joystick.querySelector(".mobile-stick__knob");
    this.keys = new Set();
    this.lookDelta = { x: 0, y: 0 };
    this.stick = { id: null, x: 0, y: 0, originX: 0, originY: 0 };
    this.lookPointer = { id: null, x: 0, y: 0 };
    this.actionRequested = false;
    this.isTouch = matchMedia("(hover: none), (pointer: coarse)").matches;

    window.addEventListener("keydown", (event) => {
      if (this.isMovementKey(event.code) || event.code === "KeyE") {
        event.preventDefault();
      }
      this.keys.add(event.code);
      if (event.code === "KeyE") {
        this.actionRequested = true;
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.lookDelta.x += event.movementX;
      this.lookDelta.y += event.movementY;
    });

    canvas.addEventListener("pointerdown", (event) => {
      if (!this.isTouch) {
        this.canvas.requestPointerLock?.();
        return;
      }
      if (this.lookPointer.id !== null) return;
      this.lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.canvas.setPointerCapture?.(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.lookPointer.id) return;
      this.lookDelta.x += event.clientX - this.lookPointer.x;
      this.lookDelta.y += event.clientY - this.lookPointer.y;
      this.lookPointer.x = event.clientX;
      this.lookPointer.y = event.clientY;
    });

    canvas.addEventListener("pointerup", (event) => {
      if (event.pointerId === this.lookPointer.id) {
        this.lookPointer.id = null;
      }
    });

    canvas.addEventListener("pointercancel", (event) => {
      if (event.pointerId === this.lookPointer.id) {
        this.lookPointer.id = null;
      }
    });

    joystick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.stick.id = event.pointerId;
      this.stick.originX = event.clientX;
      this.stick.originY = event.clientY;
      joystick.setPointerCapture?.(event.pointerId);
    });

    actionButton.addEventListener("click", () => {
      this.actionRequested = true;
    });

    actionButton.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });

    window.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.stick.id) return;
      const max = 42;
      const dx = event.clientX - this.stick.originX;
      const dy = event.clientY - this.stick.originY;
      const length = Math.hypot(dx, dy);
      const scale = length > max ? max / length : 1;
      this.stick.x = dx * scale;
      this.stick.y = dy * scale;
      this.joystickKnob.style.transform = `translate(calc(-50% + ${this.stick.x}px), calc(-50% + ${this.stick.y}px))`;
    });

    window.addEventListener("pointerup", (event) => this.releaseStick(event));
    window.addEventListener("pointercancel", (event) => this.releaseStick(event));
  }

  consumeAction() {
    const requested = this.actionRequested;
    this.actionRequested = false;
    return requested;
  }

  consumeLookDelta() {
    const delta = { ...this.lookDelta };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return delta;
  }

  getMoveVector() {
    const move = { x: 0, y: 0 };
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) move.y += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) move.y -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) move.x += 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) move.x -= 1;

    move.x += this.stick.x / 42;
    move.y += -this.stick.y / 42;

    const length = Math.hypot(move.x, move.y);
    if (length > 1) {
      move.x /= length;
      move.y /= length;
    }
    return move;
  }

  releaseStick(event) {
    if (event.pointerId !== this.stick.id) return;
    this.stick.id = null;
    this.stick.x = 0;
    this.stick.y = 0;
    this.joystickKnob.style.transform = "translate(-50%, -50%)";
  }

  isMovementKey(code) {
    return ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(code);
  }
}
