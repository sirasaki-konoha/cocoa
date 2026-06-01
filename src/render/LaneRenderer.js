import * as THREE from 'three';
import { JUDGE_LINE_Y, LANE_COUNT, LANE_HEIGHT, LANE_WIDTH, laneX } from '../game/constants.js';

const LANE_TEXTURES = [
  createLaneTexture('#3a2517', '#170c06', '#d2a66b'),
  createLaneTexture('#24321f', '#0c1309', '#9fc47a'),
];

export class LaneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.flashes = new Array(LANE_COUNT).fill(0);
    this.flashMeshes = [];

    this.createPanel();
    this.createLanes();
    this.createJudgeLine();
    this.scene.add(this.group);
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  flash(lane) {
    this.flashes[lane] = 1;
  }

  update(deltaTime) {
    for (let i = 0; i < LANE_COUNT; i += 1) {
      this.flashes[i] = Math.max(0, this.flashes[i] - deltaTime * 5.5);
      this.flashMeshes[i].material.opacity = this.flashes[i] * 0.34;
    }
  }

  createPanel() {
    const width = LANE_WIDTH * LANE_COUNT + 0.58;
    const height = LANE_HEIGHT + 0.72;

    this.group.add(createPlane(width + 0.28, height + 0.24, 0x080402, 0.5, 0, 0.24, -1.35));
    this.group.add(createPlane(width, height, 0x5a341a, 0.94, 0, 0.38, -1.2));
    this.group.add(createPlane(width - 0.16, height - 0.16, 0x2a170c, 0.92, 0, 0.38, -1.1));

    const topEdge = createPlane(width - 0.08, 0.04, 0x5f3a1f, 0.38, 0, LANE_HEIGHT / 2 + 0.75, -0.9);
    const bottomEdge = createPlane(width - 0.08, 0.1, 0x100804, 0.54, 0, -LANE_HEIGHT / 2 - 0.02, -0.9);
    this.group.add(topEdge, bottomEdge);
  }

  createLanes() {
    for (let i = 0; i < LANE_COUNT; i += 1) {
      const x = laneX(i);
      const laneWidth = LANE_WIDTH * 0.9;
      const texture = LANE_TEXTURES[i % 2];

      const shadow = createPlane(laneWidth, LANE_HEIGHT, 0x090402, 0.38, x + 0.035, 0.31, -0.08);
      this.group.add(shadow);

      const lane = new THREE.Mesh(
        roundedRectGeometry(laneWidth, LANE_HEIGHT, 0.055),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: i % 2 === 0 ? 0.92 : 0.88 }),
      );
      lane.position.set(x, 0.38, 0);
      this.group.add(lane);

      const innerShadow = createPlane(laneWidth * 0.84, LANE_HEIGHT - 0.18, 0x050201, 0.22, x, 0.3, 0.2);
      this.group.add(innerShadow);

      const highlight = createPlane(laneWidth * 0.58, LANE_HEIGHT - 0.3, 0xffd892, i % 2 === 0 ? 0.055 : 0.035, x - laneWidth * 0.2, 0.2, 0.35);
      this.group.add(highlight);

      const flash = new THREE.Mesh(
        roundedRectGeometry(laneWidth * 0.95, LANE_HEIGHT, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xf2c374, transparent: true, opacity: 0, depthWrite: false }),
      );
      flash.position.set(x, 0.38, 0.7);
      this.flashMeshes.push(flash);
      this.group.add(flash);

      const divider = createPlane(0.018, LANE_HEIGHT - 0.1, 0x8b5b2c, 0.7, x - LANE_WIDTH / 2, 0.38, 0.82);
      const dividerLight = createPlane(0.006, LANE_HEIGHT - 0.22, 0xf4d19a, 0.32, x - LANE_WIDTH / 2 + 0.016, 0.38, 0.84);
      this.group.add(divider, dividerLight);
    }

    const rightDivider = createPlane(0.018, LANE_HEIGHT - 0.1, 0x8b5b2c, 0.7, laneX(6) + LANE_WIDTH / 2, 0.38, 0.82);
    this.group.add(rightDivider);
  }

  createJudgeLine() {
    const width = LANE_WIDTH * LANE_COUNT + 0.3;
    this.group.add(createPlane(width, 0.26, 0x120905, 0.58, 0, JUDGE_LINE_Y - 0.025, 0.9));
    this.group.add(createPlane(width, 0.085, 0xd0a05d, 0.96, 0, JUDGE_LINE_Y, 1.02));
    this.group.add(createPlane(width - 0.18, 0.026, 0xffe3a8, 0.75, 0, JUDGE_LINE_Y + 0.03, 1.08));
  }
}

function createPlane(width, height, color, opacity, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
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
  return new THREE.ShapeGeometry(shape, 10);
}

function createLaneTexture(top, bottom, grainColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.52, bottom);
  gradient.addColorStop(1, '#1d1008');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.globalAlpha = 0.18;
  context.strokeStyle = grainColor;
  for (let y = 0; y < canvas.height; y += 10) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(26, y + 5, 64, y - 4, canvas.width, y + 2);
    context.stroke();
  }

  context.globalAlpha = 0.22;
  context.fillStyle = '#000000';
  context.fillRect(0, 0, 8, canvas.height);
  context.fillRect(canvas.width - 8, 0, 8, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
