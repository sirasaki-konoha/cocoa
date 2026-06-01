import * as THREE from 'three';

export class BgaManager {
  constructor(scene) {
    this.scene = scene;
    this.video = null;
    this.texture = null;
    this.material = null;
    this.mesh = null;
    this.veil = null;
  }

  prepare(chart) {
    this.dispose();

    const geometry = new THREE.PlaneGeometry(18, 10);
    if (chart.bgaFile) {
      this.video = document.createElement('video');
      this.video.src = chart.bgaFile;
      this.video.muted = true;
      this.video.loop = false;
      this.video.playsInline = true;
      this.texture = new THREE.VideoTexture(this.video);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.material = new THREE.MeshBasicMaterial({ color: 0x8a7966, map: this.texture });
    } else {
      this.texture = createCafeBackdropTexture();
      this.material = new THREE.MeshBasicMaterial({ map: this.texture });
    }

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.z = -8;
    this.scene.add(this.mesh);

    const veil = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 10),
      new THREE.MeshBasicMaterial({ color: 0x1a0f08, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    veil.position.z = -7.5;
    this.veil = veil;
    this.scene.add(veil);
  }

  async start() {
    if (!this.video) return;
    this.video.currentTime = 0;
    await this.video.play();
  }

  stop() {
    this.video?.pause();
  }

  update() {}

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
    }

    if (this.veil) {
      this.scene.remove(this.veil);
      this.veil.geometry.dispose();
      this.veil.material.dispose();
    }

    this.texture?.dispose();
    this.video = null;
    this.texture = null;
    this.material = null;
    this.mesh = null;
    this.veil = null;
  }
}

function createCafeBackdropTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const context = canvas.getContext('2d');

  const wall = context.createLinearGradient(0, 0, 0, canvas.height);
  wall.addColorStop(0, '#3a2415');
  wall.addColorStop(0.54, '#2a1a10');
  wall.addColorStop(1, '#160d08');
  context.fillStyle = wall;
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawPaperGrain(context, canvas.width, canvas.height);
  drawShelf(context, 110, 138, 800);
  drawShelf(context, 170, 292, 690);
  drawPendantLamp(context, 246, 38, 104);
  drawPendantLamp(context, 758, 30, 116);
  drawCounter(context, canvas.width, canvas.height);

  const vignette = context.createRadialGradient(512, 260, 160, 512, 260, 650);
  vignette.addColorStop(0, 'rgba(255, 224, 171, 0.1)');
  vignette.addColorStop(0.55, 'rgba(34, 17, 8, 0.14)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawPaperGrain(context, width, height) {
  context.save();
  context.globalAlpha = 0.15;
  for (let i = 0; i < 900; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const tone = Math.random() > 0.5 ? 255 : 0;
    context.fillStyle = `rgba(${tone}, ${tone}, ${tone}, ${0.06 + Math.random() * 0.08})`;
    context.fillRect(x, y, 1 + Math.random() * 2, 1);
  }
  context.restore();
}

function drawShelf(context, x, y, width) {
  const shelf = context.createLinearGradient(0, y, 0, y + 34);
  shelf.addColorStop(0, '#7a4a27');
  shelf.addColorStop(0.42, '#4e2c17');
  shelf.addColorStop(1, '#211109');
  context.fillStyle = shelf;
  context.fillRect(x, y, width, 28);
  context.fillStyle = 'rgba(12, 6, 2, 0.45)';
  context.fillRect(x + 8, y + 28, width - 16, 10);

  for (let i = 0; i < 7; i += 1) {
    const cupX = x + 54 + i * 94;
    context.fillStyle = i % 2 === 0 ? '#d8bf92' : '#8b6d4a';
    context.fillRect(cupX, y - 28, 32, 24);
    context.fillStyle = 'rgba(255, 244, 220, 0.16)';
    context.fillRect(cupX + 4, y - 24, 7, 16);
    context.strokeStyle = 'rgba(226, 198, 156, 0.5)';
    context.lineWidth = 3;
    context.strokeRect(cupX + 28, y - 22, 12, 12);
  }
}

function drawPendantLamp(context, x, y, radius) {
  context.strokeStyle = 'rgba(34, 18, 8, 0.72)';
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, y + 34);
  context.stroke();

  const light = context.createRadialGradient(x, y + radius * 0.7, 12, x, y + radius * 0.85, radius * 1.6);
  light.addColorStop(0, 'rgba(255, 215, 138, 0.36)');
  light.addColorStop(0.45, 'rgba(197, 119, 54, 0.12)');
  light.addColorStop(1, 'rgba(197, 119, 54, 0)');
  context.fillStyle = light;
  context.beginPath();
  context.arc(x, y + radius, radius * 1.4, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#3a2010';
  context.beginPath();
  context.ellipse(x, y + 58, radius * 0.42, radius * 0.18, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#e0a75e';
  context.beginPath();
  context.arc(x, y + 64, radius * 0.12, 0, Math.PI * 2);
  context.fill();
}

function drawCounter(context, width, height) {
  const counter = context.createLinearGradient(0, height - 160, 0, height);
  counter.addColorStop(0, '#8a522b');
  counter.addColorStop(0.34, '#5c351c');
  counter.addColorStop(1, '#231109');
  context.fillStyle = counter;
  context.fillRect(0, height - 150, width, 150);

  context.globalAlpha = 0.28;
  context.strokeStyle = '#d4a66a';
  for (let y = height - 138; y < height; y += 18) {
    context.beginPath();
    context.moveTo(0, y + Math.sin(y) * 4);
    context.bezierCurveTo(260, y - 10, 620, y + 12, width, y - 4);
    context.stroke();
  }
  context.globalAlpha = 1;
}
