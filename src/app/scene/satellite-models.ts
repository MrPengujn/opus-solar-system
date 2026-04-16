import * as THREE from 'three';

// ─── Shared helpers ──────────────────────────────────
function metalMat(color: number, emissive = 0x000000): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.85,
    emissive,
    emissiveIntensity: emissive ? 0.15 : 0,
  });
}

function panelMat(color = 0x1a2266): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.6,
    emissive: 0x0a1244,
    emissiveIntensity: 0.1,
  });
}

function foilMat(color = 0xccaa44): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.15,
    metalness: 0.95,
    emissive: color,
    emissiveIntensity: 0.08,
  });
}

function addSolarPanels(
  group: THREE.Group, yOffset: number, panelW: number, panelH: number,
  depth: number, spread: number, color = 0x1a2266,
): void {
  const geo = new THREE.BoxGeometry(panelW, depth, panelH);
  const mat = panelMat(color);
  const left = new THREE.Mesh(geo, mat);
  left.position.set(-spread, yOffset, 0);
  group.add(left);
  const right = new THREE.Mesh(geo, mat);
  right.position.set(spread, yOffset, 0);
  group.add(right);
}

function addDish(
  group: THREE.Group, radius: number, pos: THREE.Vector3, color = 0xdddddd,
): void {
  const geo = new THREE.SphereGeometry(radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = metalMat(color);
  const dish = new THREE.Mesh(geo, mat);
  dish.position.copy(pos);
  dish.rotation.x = Math.PI;
  group.add(dish);
  // Feed horn
  const hornGeo = new THREE.CylinderGeometry(0.01, 0.01, radius * 0.6, 6);
  const horn = new THREE.Mesh(hornGeo, metalMat(0x888888));
  horn.position.copy(pos);
  horn.position.y -= radius * 0.35;
  group.add(horn);
}

function canvasTexture(
  w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  return new THREE.CanvasTexture(canvas);
}

// ─── ISS ─────────────────────────────────────────────
function buildISS(s: number): THREE.Group {
  const g = new THREE.Group();
  // Main truss
  const truss = new THREE.Mesh(
    new THREE.BoxGeometry(s * 3, s * 0.08, s * 0.08),
    metalMat(0xcccccc),
  );
  g.add(truss);
  // Hab modules (perpendicular)
  const hab = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 1.2, 8),
    metalMat(0xeeeeee, 0x222233),
  );
  hab.rotation.x = Math.PI / 2;
  g.add(hab);
  // 4 pairs of solar arrays
  const panelGeo = new THREE.BoxGeometry(s * 0.6, s * 0.02, s * 0.28);
  const pMat = panelMat(0x1a2266);
  for (const xOff of [-1.1, -0.5, 0.5, 1.1]) {
    const p = new THREE.Mesh(panelGeo, pMat);
    p.position.set(s * xOff, s * 0.15, 0);
    g.add(p);
    const p2 = new THREE.Mesh(panelGeo, pMat);
    p2.position.set(s * xOff, -s * 0.15, 0);
    g.add(p2);
  }
  return g;
}

// ─── Hubble ──────────────────────────────────────────
function buildHubble(s: number): THREE.Group {
  const g = new THREE.Group();
  // Cylindrical body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.9, 16),
    (() => {
      const mat = metalMat(0xbbbbcc);
      mat.map = canvasTexture(256, 128, (ctx) => {
        ctx.fillStyle = '#aaaabc';
        ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#888898';
        for (let y = 0; y < 128; y += 8) { ctx.fillRect(0, y, 256, 1); }
        ctx.fillStyle = '#666678';
        ctx.fillRect(0, 50, 256, 12);
        ctx.fillRect(0, 80, 256, 8);
      });
      return mat;
    })(),
  );
  body.rotation.x = Math.PI / 2;
  g.add(body);
  // Solar panels
  addSolarPanels(g, 0, s * 0.6, s * 0.18, s * 0.02, s * 0.5);
  // Aperture
  const aperture = new THREE.Mesh(
    new THREE.RingGeometry(s * 0.05, s * 0.19, 16),
    metalMat(0x111122),
  );
  aperture.position.z = s * 0.46;
  g.add(aperture);
  return g;
}

// ─── JWST ────────────────────────────────────────────
function buildJWST(s: number): THREE.Group {
  const g = new THREE.Group();
  // Hexagonal mirror array (simplified as a hexagon)
  const mirrorShape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(angle) * s * 0.45;
    const y = Math.sin(angle) * s * 0.45;
    if (i === 0) mirrorShape.moveTo(x, y);
    else mirrorShape.lineTo(x, y);
  }
  mirrorShape.closePath();
  const mirrorGeo = new THREE.ExtrudeGeometry(mirrorShape, { depth: s * 0.02, bevelEnabled: false });
  const mirrorMat = new THREE.MeshStandardMaterial({
    color: 0xeebb33,
    roughness: 0.05,
    metalness: 1.0,
    emissive: 0xddaa22,
    emissiveIntensity: 0.12,
  });
  const mirror = new THREE.Mesh(mirrorGeo, mirrorMat);
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = s * 0.1;
  g.add(mirror);
  // Sunshield (5 layers simplified as a trapezoid)
  const shieldGeo = new THREE.BoxGeometry(s * 0.8, s * 0.04, s * 0.55);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0xcc88cc,
    roughness: 0.7,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = -s * 0.2;
  g.add(shield);
  return g;
}

// ─── TESS ────────────────────────────────────────────
function buildTESS(s: number): THREE.Group {
  const g = new THREE.Group();
  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.25, s * 0.3, s * 0.25),
    foilMat(0xcccccc),
  );
  g.add(body);
  // Camera hood (4 cameras)
  for (let i = 0; i < 4; i++) {
    const cam = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.04, s * 0.06, s * 0.12, 8),
      metalMat(0x222222),
    );
    cam.position.set(
      (i % 2 === 0 ? -1 : 1) * s * 0.06,
      s * 0.22,
      (i < 2 ? -1 : 1) * s * 0.06,
    );
    g.add(cam);
  }
  addSolarPanels(g, 0, s * 0.35, s * 0.15, s * 0.02, s * 0.35);
  return g;
}

// ─── Landsat 9 ───────────────────────────────────────
function buildLandsat(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.2, s * 0.35, s * 0.2),
    (() => {
      const mat = metalMat(0xdddddd);
      mat.map = canvasTexture(128, 128, (ctx) => {
        ctx.fillStyle = '#dddddd';
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#44aa66';
        ctx.fillRect(10, 20, 108, 30);
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 70, 128, 3);
      });
      return mat;
    })(),
  );
  g.add(body);
  // Single solar panel wing
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.55, s * 0.02, s * 0.2),
    panelMat(),
  );
  panel.position.set(s * 0.4, 0, 0);
  g.add(panel);
  // Sensor array
  const sensor = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.08, s * 0.06, s * 0.1, 8),
    metalMat(0x333333),
  );
  sensor.position.y = s * 0.23;
  g.add(sensor);
  return g;
}

// ─── Terra ───────────────────────────────────────────
function buildTerra(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.25, s * 0.35, s * 0.2),
    foilMat(0xddcc88),
  );
  g.add(body);
  addSolarPanels(g, 0, s * 0.5, s * 0.2, s * 0.02, s * 0.4);
  addDish(g, s * 0.12, new THREE.Vector3(0, s * 0.25, 0));
  return g;
}

// ─── Aqua ────────────────────────────────────────────
function buildAqua(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.22, s * 0.33, s * 0.18),
    foilMat(0x88aacc),
  );
  g.add(body);
  addSolarPanels(g, 0, s * 0.5, s * 0.18, s * 0.02, s * 0.38, 0x1a2255);
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.01, s * 0.01, s * 0.25, 4),
    metalMat(0xaaaaaa),
  );
  antenna.position.set(s * 0.12, s * 0.28, 0);
  antenna.rotation.z = 0.3;
  g.add(antenna);
  return g;
}

// ─── LRO ─────────────────────────────────────────────
function buildLRO(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.15, s * 0.2, s * 0.15),
    foilMat(0xbbbb99),
  );
  g.add(body);
  addSolarPanels(g, 0, s * 0.3, s * 0.12, s * 0.015, s * 0.25);
  addDish(g, s * 0.1, new THREE.Vector3(0, s * 0.16, 0));
  return g;
}

// ─── ICESat-2 ────────────────────────────────────────
function buildICESat2(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.15, s * 0.3, s * 0.15),
    metalMat(0xdddddd),
  );
  g.add(body);
  // Laser instrument
  const laser = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.12, 8),
    metalMat(0x44dd88),
  );
  laser.position.y = -s * 0.21;
  g.add(laser);
  // Single solar panel
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.45, s * 0.015, s * 0.15),
    panelMat(),
  );
  panel.position.set(s * 0.3, s * 0.05, 0);
  g.add(panel);
  return g;
}

// ─── GPM ─────────────────────────────────────────────
function buildGPM(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.22, s * 0.25, s * 0.18),
    foilMat(0xddddcc),
  );
  g.add(body);
  // Radar panels
  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.35, s * 0.04, s * 0.35),
    metalMat(0x888899),
  );
  radar.position.y = -s * 0.16;
  g.add(radar);
  addSolarPanels(g, s * 0.05, s * 0.4, s * 0.14, s * 0.02, s * 0.35);
  return g;
}

// ─── Parker Solar Probe ──────────────────────────────
function buildParker(s: number): THREE.Group {
  const g = new THREE.Group();
  // Thermal Protection System (heat shield)
  const shieldGeo = new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.04, 24);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.9,
    metalness: 0.1,
  });
  const shield = new THREE.Mesh(shieldGeo, shieldMat);
  shield.position.y = s * 0.2;
  g.add(shield);
  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.12, s * 0.2, s * 0.12),
    foilMat(0xcccccc),
  );
  g.add(body);
  // Solar panel wings (small, angled)
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.25, s * 0.015, s * 0.06),
      panelMat(),
    );
    panel.position.set(side * s * 0.22, -s * 0.08, 0);
    panel.rotation.z = side * 0.3;
    g.add(panel);
  }
  return g;
}

// ─── Voyager (1 & 2) ─────────────────────────────────
function buildVoyager(s: number): THREE.Group {
  const g = new THREE.Group();
  // Main bus
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.14, s * 0.08, s * 0.14),
    foilMat(0xcccc99),
  );
  g.add(body);
  // High-gain antenna (large dish)
  addDish(g, s * 0.25, new THREE.Vector3(0, s * 0.18, 0));
  // Magnetometer boom
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.008, s * 0.008, s * 0.6, 4),
    metalMat(0xaaaaaa),
  );
  boom.position.set(s * 0.32, 0, 0);
  boom.rotation.z = Math.PI / 2;
  g.add(boom);
  // RTG power source (cylinder on boom)
  const rtg = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.15, 6),
    metalMat(0x443322),
  );
  rtg.position.set(-s * 0.22, -s * 0.06, 0);
  rtg.rotation.z = Math.PI / 4;
  g.add(rtg);
  // Science boom
  const scienceBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.006, s * 0.006, s * 0.35, 4),
    metalMat(0x999999),
  );
  scienceBoom.position.set(0, 0, s * 0.2);
  scienceBoom.rotation.x = Math.PI / 2;
  g.add(scienceBoom);
  return g;
}

// ─── New Horizons ────────────────────────────────────
function buildNewHorizons(s: number): THREE.Group {
  const g = new THREE.Group();
  // Triangular main body
  const shape = new THREE.Shape();
  shape.moveTo(0, s * 0.18);
  shape.lineTo(-s * 0.15, -s * 0.12);
  shape.lineTo(s * 0.15, -s * 0.12);
  shape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: s * 0.06, bevelEnabled: false });
  const body = new THREE.Mesh(bodyGeo, foilMat(0xbbaa77));
  body.position.z = -s * 0.03;
  g.add(body);
  // Large dish
  addDish(g, s * 0.18, new THREE.Vector3(0, s * 0.06, s * 0.06));
  // RTG
  const rtg = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.025, s * 0.025, s * 0.2, 6),
    metalMat(0x333322),
  );
  rtg.position.set(0, -s * 0.22, 0);
  g.add(rtg);
  return g;
}

// ─── Pioneer 10 ──────────────────────────────────────
function buildPioneer(s: number): THREE.Group {
  const g = new THREE.Group();
  // Large dish
  addDish(g, s * 0.3, new THREE.Vector3(0, s * 0.08, 0));
  // Body behind dish
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.1, s * 0.12, s * 0.1),
    foilMat(0xccbb88),
  );
  body.position.y = -s * 0.1;
  g.add(body);
  // Boom arms
  for (const angle of [-0.6, 0.6]) {
    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.008, s * 0.008, s * 0.35, 4),
      metalMat(0xaaaaaa),
    );
    boom.position.set(Math.sin(angle) * s * 0.2, -s * 0.15, Math.cos(angle) * s * 0.1);
    boom.rotation.z = angle;
    g.add(boom);
  }
  return g;
}

// ─── MESSENGER ───────────────────────────────────────
function buildMESSENGER(s: number): THREE.Group {
  const g = new THREE.Group();
  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.18, s * 0.22, s * 0.15),
    foilMat(0xccccaa),
  );
  g.add(body);
  // Sunshade
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.28, s * 0.02, s * 0.22),
    metalMat(0xeeeeee),
  );
  shade.position.y = s * 0.16;
  g.add(shade);
  addSolarPanels(g, 0, s * 0.3, s * 0.1, s * 0.015, s * 0.28);
  return g;
}

// ─── Magellan ────────────────────────────────────────
function buildMagellan(s: number): THREE.Group {
  const g = new THREE.Group();
  // Large radar antenna
  addDish(g, s * 0.28, new THREE.Vector3(0, s * 0.12, 0));
  // Bus
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.1, s * 0.1, s * 0.2, 8),
    foilMat(0xddcc88),
  );
  body.position.y = -s * 0.12;
  g.add(body);
  addSolarPanels(g, -s * 0.1, s * 0.35, s * 0.12, s * 0.015, s * 0.3);
  return g;
}

// ─── Mars Reconnaissance Orbiter ─────────────────────
function buildMRO(s: number): THREE.Group {
  const g = new THREE.Group();
  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.15, s * 0.28, s * 0.15),
    foilMat(0xddddcc),
  );
  g.add(body);
  // Large HiRISE dish
  addDish(g, s * 0.2, new THREE.Vector3(s * 0.12, s * 0.14, 0));
  // Solar panels
  addSolarPanels(g, s * 0.05, s * 0.5, s * 0.2, s * 0.015, s * 0.4);
  return g;
}

// ─── MAVEN ───────────────────────────────────────────
function buildMAVEN(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.18, s * 0.22, s * 0.15),
    foilMat(0x8899bb),
  );
  g.add(body);
  // Gull-wing solar panels
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.5, s * 0.015, s * 0.15),
      panelMat(),
    );
    panel.position.set(side * s * 0.38, s * 0.06, 0);
    panel.rotation.z = side * 0.2;
    g.add(panel);
  }
  // Antenna
  const ant = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.01, s * 0.01, s * 0.2, 4),
    metalMat(0xaaaaaa),
  );
  ant.position.y = s * 0.21;
  g.add(ant);
  return g;
}

// ─── Mars Odyssey ────────────────────────────────────
function buildMarsOdyssey(s: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.15, s * 0.2, s * 0.12),
    foilMat(0xccbb88),
  );
  g.add(body);
  // Boom-mounted antenna
  addDish(g, s * 0.12, new THREE.Vector3(0, s * 0.18, 0));
  // Single solar panel wing
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.5, s * 0.015, s * 0.18),
    panelMat(),
  );
  panel.position.set(s * 0.35, 0, 0);
  g.add(panel);
  // GRS boom
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.006, s * 0.006, s * 0.35, 4),
    metalMat(0xaaaaaa),
  );
  boom.position.set(-s * 0.2, 0, 0);
  boom.rotation.z = Math.PI / 2;
  g.add(boom);
  return g;
}

// ─── InSight ─────────────────────────────────────────
function buildInSight(s: number): THREE.Group {
  const g = new THREE.Group();
  // Lander body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.15, s * 0.18, s * 0.1, 12),
    foilMat(0xcccc99),
  );
  g.add(body);
  // Circular solar panels
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.01, 16),
      panelMat(),
    );
    panel.position.set(side * s * 0.28, s * 0.02, 0);
    g.add(panel);
  }
  // Seismometer (deployed)
  const seis = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.04, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    metalMat(0xdddddd),
  );
  seis.position.set(s * 0.18, -s * 0.06, s * 0.12);
  g.add(seis);
  return g;
}

// ─── Juno ────────────────────────────────────────────
function buildJuno(s: number): THREE.Group {
  const g = new THREE.Group();
  // Central body
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.1, s * 0.12, s * 0.18, 8),
    foilMat(0xbbbbaa),
  );
  g.add(body);
  // 3 massive solar panel arms
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(s * 0.6, s * 0.015, s * 0.12),
      panelMat(0x152255),
    );
    panel.position.set(
      Math.cos(angle) * s * 0.38,
      0,
      Math.sin(angle) * s * 0.38,
    );
    panel.rotation.y = -angle;
    g.add(panel);
  }
  // Antenna
  addDish(g, s * 0.08, new THREE.Vector3(0, s * 0.14, 0));
  return g;
}

// ─── Europa Clipper ──────────────────────────────────
function buildEuropaClipper(s: number): THREE.Group {
  const g = new THREE.Group();
  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(s * 0.18, s * 0.25, s * 0.15),
    foilMat(0xddcc77),
  );
  g.add(body);
  // Very large solar panels (largest interplanetary)
  addSolarPanels(g, 0, s * 0.7, s * 0.15, s * 0.015, s * 0.55, 0x152255);
  // Ice-penetrating radar antenna
  const radarBoom = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.006, s * 0.006, s * 0.5, 4),
    metalMat(0xaaaaaa),
  );
  radarBoom.position.set(0, 0, s * 0.3);
  radarBoom.rotation.x = Math.PI / 2;
  g.add(radarBoom);
  addDish(g, s * 0.12, new THREE.Vector3(0, s * 0.2, 0));
  return g;
}

// ─── Cassini ─────────────────────────────────────────
function buildCassini(s: number): THREE.Group {
  const g = new THREE.Group();
  // Large high-gain antenna
  addDish(g, s * 0.25, new THREE.Vector3(0, s * 0.18, 0));
  // Body stack
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.13, s * 0.15, s * 0.3, 10),
    foilMat(0xddddbb),
  );
  g.add(body);
  // Magnetometer boom
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.006, s * 0.006, s * 0.5, 4),
    metalMat(0xaaaaaa),
  );
  boom.position.set(s * 0.28, 0, 0);
  boom.rotation.z = Math.PI / 2;
  g.add(boom);
  // RTG booms
  for (const side of [-1, 1]) {
    const rtg = new THREE.Mesh(
      new THREE.CylinderGeometry(s * 0.025, s * 0.025, s * 0.15, 6),
      metalMat(0x443322),
    );
    rtg.position.set(side * s * 0.18, -s * 0.2, 0);
    rtg.rotation.z = side * 0.5;
    g.add(rtg);
  }
  return g;
}

// ─── Huygens ─────────────────────────────────────────
function buildHuygens(s: number): THREE.Group {
  const g = new THREE.Group();
  // Disc-shaped heat shield
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.25, s * 0.28, s * 0.06, 20),
    new THREE.MeshStandardMaterial({
      color: 0x885522,
      roughness: 0.9,
      metalness: 0.1,
    }),
  );
  shield.position.y = -s * 0.05;
  g.add(shield);
  // Upper body
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(s * 0.2, s * 0.25, s * 0.15, 16),
    foilMat(0xccbb88),
  );
  top.position.y = s * 0.08;
  g.add(top);
  // Top dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(s * 0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    metalMat(0xdddddd),
  );
  dome.position.y = s * 0.16;
  g.add(dome);
  return g;
}

// ─── Factory ─────────────────────────────────────────
export function buildSatelliteModel(name: string, scale: number): THREE.Group {
  const builders: Record<string, (s: number) => THREE.Group> = {
    'ISS': buildISS,
    'Hubble Space Telescope': buildHubble,
    'James Webb Space Telescope': buildJWST,
    'TESS': buildTESS,
    'Landsat 9': buildLandsat,
    'Terra': buildTerra,
    'Aqua': buildAqua,
    'Lunar Reconnaissance Orbiter': buildLRO,
    'ICESat-2': buildICESat2,
    'GPM Core Observatory': buildGPM,
    'Parker Solar Probe': buildParker,
    'Voyager 1': buildVoyager,
    'Voyager 2': buildVoyager,
    'New Horizons': buildNewHorizons,
    'Pioneer 10': buildPioneer,
    'MESSENGER': buildMESSENGER,
    'Magellan': buildMagellan,
    'Mars Reconnaissance Orbiter': buildMRO,
    'MAVEN': buildMAVEN,
    'Mars Odyssey': buildMarsOdyssey,
    'InSight Lander': buildInSight,
    'Juno': buildJuno,
    'Europa Clipper': buildEuropaClipper,
    'Cassini': buildCassini,
    'Huygens Probe': buildHuygens,
  };

  const builder = builders[name];
  if (builder) {
    return builder(scale);
  }

  // Fallback: generic satellite with small body + panels
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(scale * 0.15, scale * 0.2, scale * 0.15),
    metalMat(0xcccccc),
  );
  g.add(body);
  addSolarPanels(g, 0, scale * 0.3, scale * 0.1, scale * 0.015, scale * 0.28);
  return g;
}
