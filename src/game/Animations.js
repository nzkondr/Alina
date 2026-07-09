import * as THREE from "three";

export class Animations {
  constructor(world, player, hud, scene) {
    this.world = world;
    this.player = player;
    this.hud = hud;
    this.scene = scene;
    this.finalShown = false;
    this.nightApplied = false;
  }

  update(delta, elapsed) {
    this.world.frames.forEach((frame) => {
      if (!frame.placed) return;
      const pulse = 1.1 + Math.sin(elapsed * 3.2) * 0.3;
      frame.glowMaterial.emissiveIntensity = pulse;
      this.updateNote(frame, delta);
    });

    this.world.dissolvingWalls.forEach((wall) => this.updateWall(wall, delta));
    this.updateDoor(delta);
    this.updateGifts(elapsed);
    this.updateFinal();
  }

  updateWall(wall, delta) {
    if (!wall.userData.opening || wall.userData.progress >= 1) return;
    wall.userData.progress = Math.min(1, wall.userData.progress + delta * 0.28);
    const t = ease(wall.userData.progress);
    wall.userData.wall.material.opacity = 1 - t;
    wall.userData.wall.position.y = -t * 0.28;
    wall.userData.particles.children.forEach((particle) => {
      particle.material.opacity = Math.sin(t * Math.PI) * 0.82;
      particle.position.addScaledVector(particle.userData.velocity, delta);
    });
    if (wall.userData.progress >= 1) {
      wall.userData.wall.visible = false;
    }
  }

  updateNote(frame, delta) {
    if (!frame.notePanel?.userData.revealing) return;
    frame.notePanel.userData.progress = Math.min(1, frame.notePanel.userData.progress + delta * 1.8);
    const t = ease(frame.notePanel.userData.progress);
    frame.noteMaterial.opacity = t;
    frame.notePanel.scale.setScalar(0.94 + t * 0.06);
  }

  updateDoor(delta) {
    const door = this.world.door;
    if (!door.userData.opening) return;
    door.userData.progress = Math.min(1, door.userData.progress + delta * 0.2);
    const t = ease(door.userData.progress);
    door.userData.left.rotation.y = -t * 1.28;
    door.userData.right.rotation.y = t * 1.28;
    this.world.garden.visible = t > 0.03;
    if (this.world.garden.visible && !this.nightApplied) {
      this.nightApplied = true;
      this.scene.background = new THREE.Color("#030714");
      this.scene.fog = new THREE.Fog("#050b16", 20, 82);
    }
    this.player.bounds.minZ = t > 0.55 ? this.world.unlockedEnd : -57;
  }

  updateGifts(elapsed) {
    this.world.gifts.forEach((gift, index) => {
      if (!gift.visible) return;
      gift.rotation.y += 0.28 * 0.016;
      gift.position.y = 0.08 + Math.sin(elapsed * 1.6 + index) * 0.035;
    });
  }

  updateFinal() {
    if (this.finalShown || !this.world.garden.visible) return;
    if (this.world.door.userData.progress > 0.62 && this.player.position.z < -60.3) {
      this.finalShown = true;
      this.hud.showFinal();
    }
  }
}

function ease(t) {
  return THREE.MathUtils.smoothstep(t, 0, 1);
}
