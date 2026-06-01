import * as THREE from 'three';
import { laneX } from '../game/constants.js';

const NOTE_COLORS = {
  white: 0xfff7df,
  green: 0xb8ff7a,
  bonus: 0x72f4ff,
};

export class NoteRenderer {
  constructor(scene) {
    this.scene = scene;
  }

  create(note) {
    const isBonus = note.type === 'bonus';
    const color = isBonus ? NOTE_COLORS.bonus : note.lane % 2 === 0 ? NOTE_COLORS.white : NOTE_COLORS.green;
    const x = laneX(note.lane);

    const shadow = createNotePart(0.66, 0.24, 0x050201, 0.66, x + 0.045, 4.34, 1.72, 0.04);
    const border = createNotePart(0.64, 0.225, isBonus ? 0x06343a : 0x2a1206, 1, x, 4.4, 1.9, 0.045);
    const body = createNotePart(0.54, 0.145, color, 1, x, 4.418, 2.05, 0.035);
    const highlight = createNotePart(0.46, 0.03, 0xffffff, isBonus ? 0.7 : 0.52, x - 0.012, 4.463, 2.18, 0.012);
    const glow = createNotePart(0.74, 0.31, isBonus ? 0x72f4ff : 0xffdc7a, isBonus ? 0.22 : 0.13, x, 4.4, 1.65, 0.06);

    const rendered = { shadow, border, body, highlight, glow, isBonus };
    for (const mesh of Object.values(rendered)) {
      if (mesh instanceof THREE.Mesh) this.scene.add(mesh);
    }

    return rendered;
  }

  update(rendered, y, songTime) {
    rendered.shadow.position.y = y - 0.04;
    rendered.border.position.y = y;
    rendered.body.position.y = y + 0.015;
    rendered.highlight.position.y = y + 0.055;
    rendered.glow.position.y = y;

    if (rendered.isBonus) {
      const pulse = Math.sin(songTime * 10) * 0.5 + 0.5;
      rendered.glow.material.opacity = 0.13 + pulse * 0.12;
      rendered.highlight.material.opacity = 0.36 + pulse * 0.16;
    }
  }

  remove(rendered) {
    for (const mesh of [rendered.shadow, rendered.border, rendered.body, rendered.highlight, rendered.glow]) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}

function createNotePart(width, height, color, opacity, x, y, z, radius) {
  const mesh = new THREE.Mesh(
    roundedRectGeometry(width, height, radius),
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function roundedRectGeometry(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return new THREE.ShapeGeometry(shape, 8);
}
