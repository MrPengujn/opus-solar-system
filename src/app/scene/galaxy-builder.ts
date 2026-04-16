import * as THREE from 'three';
import { Galaxy } from '../data/galaxies.data';

// ─── Procedural textures ─────────────────────────────

function spiralTexture(color: THREE.Color, secondary: THREE.Color): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2, cy = size / 2;

  // Background glow
  const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  bgGrad.addColorStop(0, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.9)`);
  bgGrad.addColorStop(0.15, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.4)`);
  bgGrad.addColorStop(0.6, `rgba(${(secondary.r * 255) | 0}, ${(secondary.g * 255) | 0}, ${(secondary.b * 255) | 0}, 0.08)`);
  bgGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Spiral arms
  ctx.globalCompositeOperation = 'lighter';
  const arms = 2;
  for (let a = 0; a < arms; a++) {
    const baseAngle = (a / arms) * Math.PI * 2;
    for (let i = 0; i < 1200; i++) {
      const t = i / 1200;
      const r = t * (size / 2) * 0.85;
      const angle = baseAngle + t * 4 * Math.PI + (Math.random() - 0.5) * 0.4;
      const spread = (Math.random() - 0.5) * (8 + t * 30);

      const x = cx + Math.cos(angle) * r + Math.cos(angle + Math.PI / 2) * spread;
      const y = cy + Math.sin(angle) * r + Math.sin(angle + Math.PI / 2) * spread;

      const alpha = (1 - t) * 0.4 + 0.05;
      const s = 1 + Math.random() * 2.5;
      const bright = Math.random();
      const c = bright > 0.85 ? color : secondary;

      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${(c.r * 255) | 0}, ${(c.g * 255) | 0}, ${(c.b * 255) | 0}, ${alpha})`;
      ctx.fill();
    }
  }

  // Bright core
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.06);
  coreGrad.addColorStop(0, 'rgba(255,255,240,0.9)');
  coreGrad.addColorStop(0.5, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.5)`);
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

function ellipticalTexture(color: THREE.Color, secondary: THREE.Color): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  grad.addColorStop(0, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.95)`);
  grad.addColorStop(0.3, `rgba(${(secondary.r * 255) | 0}, ${(secondary.g * 255) | 0}, ${(secondary.b * 255) | 0}, 0.4)`);
  grad.addColorStop(0.7, `rgba(${(secondary.r * 255) | 0}, ${(secondary.g * 255) | 0}, ${(secondary.b * 255) | 0}, 0.08)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Scattered stars
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 600; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (size / 2) * 0.7;
    const x = cx + Math.cos(angle) * r * (0.7 + Math.random() * 0.3);
    const y = cy + Math.sin(angle) * r;
    const alpha = (1 - r / (size / 2)) * 0.3;

    ctx.beginPath();
    ctx.arc(x, y, 0.5 + Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, ${alpha})`;
    ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

function irregularTexture(color: THREE.Color, secondary: THREE.Color): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  // Irregular blob base
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2.5);
  grad.addColorStop(0, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.7)`);
  grad.addColorStop(0.5, `rgba(${(secondary.r * 255) | 0}, ${(secondary.g * 255) | 0}, ${(secondary.b * 255) | 0}, 0.2)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Scattered clumps
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 400; i++) {
    const x = cx + (Math.random() - 0.5) * size * 0.6;
    const y = cy + (Math.random() - 0.5) * size * 0.5;
    const alpha = 0.15 + Math.random() * 0.2;
    const s = 0.5 + Math.random() * 3;

    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, ${alpha})`;
    ctx.fill();
  }

  // Star-forming bright spots
  for (let i = 0; i < 8; i++) {
    const x = cx + (Math.random() - 0.5) * size * 0.4;
    const y = cy + (Math.random() - 0.5) * size * 0.3;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, 12);
    g2.addColorStop(0, 'rgba(200,220,255,0.5)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(x - 15, y - 15, 30, 30);
  }

  return new THREE.CanvasTexture(canvas);
}

function lenticularTexture(color: THREE.Color, secondary: THREE.Color): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  // Stretched elliptical glow
  ctx.save();
  ctx.scale(1, 0.45);
  const grad = ctx.createRadialGradient(cx, cy / 0.45, 0, cx, cy / 0.45, size / 2);
  grad.addColorStop(0, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.9)`);
  grad.addColorStop(0.2, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.5)`);
  grad.addColorStop(0.6, `rgba(${(secondary.r * 255) | 0}, ${(secondary.g * 255) | 0}, ${(secondary.b * 255) | 0}, 0.1)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size / 0.45);
  ctx.restore();

  // Dust lane
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(30,20,10,0.3)';
  ctx.fillRect(0, cy - 3, size, 6);

  // Bright core
  ctx.globalCompositeOperation = 'lighter';
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.04);
  coreGrad.addColorStop(0, 'rgba(255,250,230,0.8)');
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

// ─── Build a single galaxy mesh ──────────────────────

export function buildGalaxyMesh(galaxy: Galaxy): THREE.Mesh {
  const color = new THREE.Color(galaxy.color);
  const secondary = new THREE.Color(galaxy.secondaryColor);

  let texture: THREE.CanvasTexture;
  switch (galaxy.type) {
    case 'spiral':
      texture = spiralTexture(color, secondary);
      break;
    case 'elliptical':
      texture = ellipticalTexture(color, secondary);
      break;
    case 'lenticular':
      texture = lenticularTexture(color, secondary);
      break;
    case 'irregular':
    case 'dwarf':
    default:
      texture = irregularTexture(color, secondary);
      break;
  }

  const geo = new THREE.PlaneGeometry(galaxy.radius * 2, galaxy.radius * 2);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...galaxy.position);
  mesh.rotation.set(...galaxy.tilt);

  return mesh;
}

// ─── Intergalactic starfield ─────────────────────────

export function buildGalaxyStarfield(): THREE.Points {
  const count = 4000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 600 + Math.random() * 1200;
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);
    const b = 0.3 + Math.random() * 0.4;
    colors[i3] = b + Math.random() * 0.1;
    colors[i3 + 1] = b;
    colors[i3 + 2] = b + Math.random() * 0.15;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 1.2,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
  });

  return new THREE.Points(geo, mat);
}
