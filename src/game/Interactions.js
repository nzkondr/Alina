import * as THREE from "three";

const temp = new THREE.Vector3();
const slotWorld = new THREE.Vector3();

export class Interactions {
  constructor({ player, input, world, sound, hud }) {
    this.player = player;
    this.input = input;
    this.world = world;
    this.sound = sound;
    this.hud = hud;
    this.held = null;
    this.correctCount = 0;
    this.nearTarget = null;
  }

  update(delta) {
    this.updateHeldPlaque(delta);
    this.findNearbyTarget();

    if (this.input.consumeAction()) {
      this.tryInteract();
    }
  }

  updateHeldPlaque(delta) {
    if (!this.held) return;
    temp.set(0, -0.35, -1.15).applyQuaternion(this.player.camera.quaternion).add(this.player.camera.position);
    this.held.position.lerp(temp, 1 - Math.exp(-12 * delta));
    this.held.rotation.x = THREE.MathUtils.lerp(this.held.rotation.x, 0, 1 - Math.exp(-10 * delta));
    this.held.rotation.y = this.player.camera.rotation.y;
    this.held.rotation.z = 0;
  }

  findNearbyTarget() {
    this.nearTarget = null;
    let prompt = "";
    let nearestDistance = 1.65;

    for (const plaque of this.world.interactables) {
      if (plaque.userData.placed || plaque === this.held) continue;
      const distance = plaque.position.distanceTo(this.player.position);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        this.nearTarget = plaque;
        prompt = `Натисни E, щоб взяти дату ${plaque.userData.date}`;
      }
    }

    if (this.held) {
      const frame = this.findClosestFrame();
      if (frame && frame.distance < 1.85) {
        this.nearTarget = frame.frame;
        prompt = frame.frame.date === this.held.userData.date
          ? "Натисни E, щоб поставити дату"
          : "Це не ця фотографія";
      } else {
        prompt = `Ти тримаєш ${this.held.userData.date}`;
      }
    }

    this.hud.setPrompt(prompt);
  }

  tryInteract() {
    if (!this.player.enabled) return;
    if (!this.held && this.nearTarget?.userData?.type === "date") {
      this.held = this.nearTarget;
      return;
    }

    if (this.held && this.nearTarget?.date) {
      if (this.nearTarget.date !== this.held.userData.date || this.nearTarget.placed) return;
      this.placeHeldDate(this.nearTarget);
    }
  }

  findClosestFrame() {
    let closest = null;
    for (const frame of this.world.frames) {
      if (frame.placed) continue;
      frame.dateSlot.getWorldPosition(slotWorld);
      const distance = slotWorld.distanceTo(this.player.position);
      if (!closest || distance < closest.distance) {
        closest = { frame, distance };
      }
    }
    return closest;
  }

  placeHeldDate(frame) {
    const placedPlaque = this.held;
    frame.dateSlot.getWorldPosition(slotWorld);
    this.held.userData.placed = true;
    placedPlaque.position.copy(slotWorld);
    placedPlaque.rotation.copy(frame.group.rotation);
    placedPlaque.rotation.x = 0;
    placedPlaque.scale.set(0.86, 0.86, 0.86);

    frame.dateSlot.attach(placedPlaque);
    placedPlaque.position.set(0, 0, 0.055);
    placedPlaque.rotation.set(0, 0, 0);
    placedPlaque.scale.set(0.76, 0.76, 0.76);

    frame.placed = true;
    frame.glowMaterial.emissiveIntensity = 1.4;
    frame.glowLight.intensity = 1.3;
    frame.notePanel.visible = true;
    frame.notePanel.userData.revealing = true;

    this.correctCount += 1;
    this.hud.setProgress(this.correctCount, this.world.frames.length);
    this.sound.success();
    this.held = null;

    if (this.correctCount === this.world.frames.length) {
      this.world.door.userData.opening = true;
    }
  }
}
