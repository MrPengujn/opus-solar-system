import * as THREE from 'three';
import { GalacticObject } from '../data/galaxy-systems.data';

/**
 * Build a 3D mesh/group for a GalacticObject based on its type.
 */
export function buildGalacticObjectMesh(obj: GalacticObject): THREE.Object3D {
  switch (obj.type) {
    case 'black-hole':
      return buildBlackHole(obj);
    case 'star':
      return buildStar(obj);
    case 'planetary-system':
      return buildPlanetarySystem(obj);
    case 'nebula':
      return buildNebula(obj);
    case 'star-cluster':
      return buildStarCluster(obj);
    case 'globular-cluster':
      return buildGlobularCluster(obj);
    case 'pulsar':
      return buildPulsar(obj);
    case 'supernova-remnant':
      return buildSupernovaRemnant(obj);
    case 'quasar':
      return buildBlackHole(obj); // similar visual
    default:
      return buildStar(obj);
  }
}

// ─── Black Hole ──────────────────────────────────────

function buildBlackHole(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const baseColor = new THREE.Color(obj.secondaryColor ?? 0xff6600);

  // ── Event horizon (pitch-black sphere with slight depth bias) ──
  const coreGeo = new THREE.SphereGeometry(r * 0.40, 64, 64);
  const coreMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.renderOrder = 10;
  group.add(core);

  // ── Photon ring — thin, intense ring hugging the shadow edge ──
  // Billboards toward camera. Creates the iconic bright thin ring.
  const photonRingGeo = new THREE.RingGeometry(r * 0.38, r * 0.62, 256, 1);
  const photonRingMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: baseColor },
      uInner: { value: r * 0.38 },
      uOuter: { value: r * 0.62 },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying float vDist;
      varying vec2 vPos;
      void main() {
        vDist = length(position.xy);
        vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      uniform float uOuter;
      uniform float uTime;
      varying float vDist;
      varying vec2 vPos;
      void main() {
        float range = uOuter - uInner;
        float t = (vDist - uInner) / range;

        // Extremely sharp peak just outside event horizon
        float peak = exp(-pow((t - 0.08) * 14.0, 2.0)) * 3.0;
        // Softer secondary glow
        float glow = exp(-t * 5.0) * 0.6;
        float intensity = peak + glow;

        // Subtle angular variation (asymmetry from spin)
        float angle = atan(vPos.y, vPos.x);
        float spin = 0.85 + 0.15 * sin(angle * 1.0 + uTime * 0.8);
        intensity *= spin;

        // Color: white-hot at peak, blending to base color outward
        vec3 white = vec3(1.0, 0.98, 0.92);
        vec3 col = mix(white, uColor * 1.5, smoothstep(0.0, 0.3, t));
        col *= intensity;

        float alpha = clamp(intensity * 0.7, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const photonRing = new THREE.Mesh(photonRingGeo, photonRingMat);
  photonRing.userData['photonRing'] = true;
  photonRing.renderOrder = 5;
  group.add(photonRing);

  // ── Accretion disk — wide, hot, with Doppler beaming ──
  const diskSegments = 256;
  const diskRings = 12;
  const diskGeo = new THREE.RingGeometry(r * 0.50, r * 1.8, diskSegments, diskRings);
  const diskMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: baseColor },
      uInner: { value: r * 0.50 },
      uOuter: { value: r * 1.8 },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying float vDist;
      varying float vAngle;
      varying vec2 vLocalPos;
      void main() {
        vDist = length(position.xy);
        vAngle = atan(position.y, position.x);
        vLocalPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      uniform float uOuter;
      uniform float uTime;
      varying float vDist;
      varying float vAngle;
      varying vec2 vLocalPos;

      // Simple pseudo-noise for turbulence
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        float t = (vDist - uInner) / (uOuter - uInner);

        // Relativistic Doppler beaming — one side significantly brighter
        float doppler = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(vAngle + uTime * 0.4), 1.5);

        // Temperature profile: white-hot inner → orange → dim red outer
        float tempFalloff = pow(1.0 - t, 2.5);

        // Turbulent structure in the disk
        float noiseScale = 8.0;
        float turbAngle = vAngle + uTime * 0.3;
        float n1 = noise(vec2(turbAngle * noiseScale, t * 20.0 + uTime * 0.5));
        float n2 = noise(vec2(turbAngle * noiseScale * 2.0, t * 40.0 - uTime * 0.3));
        float turb = 0.7 + 0.3 * (n1 * 0.6 + n2 * 0.4);

        float brightness = tempFalloff * doppler * turb;

        // Color gradient: white → yellow → orange → deep red
        vec3 white = vec3(1.0, 0.97, 0.90);
        vec3 yellow = vec3(1.0, 0.85, 0.4);
        vec3 orange = uColor;
        vec3 deepRed = uColor * 0.3;

        vec3 col;
        if (t < 0.15) {
          col = mix(white, yellow, t / 0.15);
        } else if (t < 0.4) {
          col = mix(yellow, orange, (t - 0.15) / 0.25);
        } else {
          col = mix(orange, deepRed, (t - 0.4) / 0.6);
        }
        col *= brightness * 2.2;

        // Soft edges
        float edgeFade = smoothstep(0.0, 0.06, t) * smoothstep(0.0, 0.12, 1.0 - t);
        float alpha = clamp(brightness * edgeFade * 0.9, 0.0, 0.92);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = Math.PI * 0.5;
  disk.userData['accretionDisk'] = true;
  disk.renderOrder = 3;
  group.add(disk);

  // ── Gravitational lensing band — the warped back-image of the disk ──
  // Visible as a bright arc wrapping over/under the shadow (Interstellar style)
  const lensGeo = new THREE.RingGeometry(r * 0.39, r * 0.58, 256, 4);
  const lensMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: baseColor },
      uInner: { value: r * 0.39 },
      uOuter: { value: r * 0.58 },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying float vDist;
      varying float vAngle;
      void main() {
        vDist = length(position.xy);
        vAngle = atan(position.y, position.x);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uInner;
      uniform float uOuter;
      uniform float uTime;
      varying float vDist;
      varying float vAngle;
      void main() {
        float t = (vDist - uInner) / (uOuter - uInner);

        // Only show on top and bottom halves (the lensed arcs)
        float verticalBias = abs(sin(vAngle));
        verticalBias = pow(verticalBias, 0.6);

        // Brightness concentrated near inner edge
        float radial = exp(-t * 4.0) * 1.8;

        // Doppler: one vertical side brighter
        float doppler = 0.6 + 0.4 * sin(vAngle * 0.5 + uTime * 0.3);

        float brightness = radial * verticalBias * doppler;

        vec3 white = vec3(1.0, 0.95, 0.85);
        vec3 col = mix(white, uColor * 1.2, t);
        col *= brightness;

        float alpha = clamp(brightness * 0.55, 0.0, 0.8);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  // Tilted to be roughly perpendicular to the disk — wraps over the shadow
  const lensRing = new THREE.Mesh(lensGeo, lensMat);
  lensRing.userData['lensingBand'] = true;
  lensRing.renderOrder = 4;
  group.add(lensRing);

  // ── Subtle warm glow around the whole system ──
  const glowGeo = new THREE.SphereGeometry(r * 1.3, 32, 32);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(baseColor).multiplyScalar(0.5) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        float glow = pow(rim, 5.0) * 0.12;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // ── Gravitational lensing distortion sphere ──
  // Renders a sphere that samples a screen-space background texture with
  // radially-displaced UVs, creating the real spacetime-warping effect.
  const distortGeo = new THREE.SphereGeometry(r * 2.2, 64, 64);
  const distortMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    uniforms: {
      uScreenTex: { value: null as THREE.Texture | null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uStrength: { value: 0.035 },
      uEventHorizon: { value: 0.18 },
    },
    vertexShader: /* glsl */ `
      varying vec4 vScreenPos;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;
      varying vec3 vNorm;
      void main() {
        vNorm = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vScreenPos = projectionMatrix * mvPos;
        gl_Position = vScreenPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uScreenTex;
      uniform vec2 uResolution;
      uniform float uStrength;
      uniform float uEventHorizon;
      varying vec4 vScreenPos;
      varying vec3 vNorm;
      varying vec3 vViewDir;

      void main() {
        // Screen-space UV
        vec2 screenUV = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;

        // How close to center of sphere (rim vs face-on)
        float facing = dot(vNorm, vViewDir);
        float rim = 1.0 - abs(facing);

        // Distortion is strongest at the rim (light bending around the mass)
        // and falls off toward center and toward outer edge
        float distortionMask = pow(rim, 1.5);

        // Radial direction from center of sphere in screen space
        // The distortion pushes pixels radially outward (light bending around)
        vec2 centerUV = screenUV;
        vec2 radialDir = normalize(vNorm.xy);

        // Gravitational lens: displace UV radially outward
        float displacement = distortionMask * uStrength;
        vec2 distortedUV = screenUV + radialDir * displacement;

        // Clamp to valid range
        distortedUV = clamp(distortedUV, 0.001, 0.999);

        vec4 bgColor = texture2D(uScreenTex, distortedUV);

        // Inside the event horizon (face-on center), darken to black
        float darkness = smoothstep(uEventHorizon, uEventHorizon + 0.25, rim);

        // Only show distortion in the outer rim area, transparent elsewhere
        float alpha = smoothstep(0.05, 0.35, rim) * smoothstep(0.0, 0.15, distortionMask);

        // Blend: mostly the distorted background, dimmed near center
        vec3 finalColor = bgColor.rgb * darkness;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });
  const distortSphere = new THREE.Mesh(distortGeo, distortMat);
  distortSphere.userData['distortionSphere'] = true;
  distortSphere.renderOrder = 0;
  group.add(distortSphere);

  return group;
}

// ─── Star ────────────────────────────────────────────

// ─── Star ────────────────────────────────────────────

function buildStar(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const c = new THREE.Color(obj.color);

  // ── Core sphere with surface detail shader ──
  const coreGeo = new THREE.SphereGeometry(r, 48, 48);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z);
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.0;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        // Animated surface turbulence
        vec3 pos = vPosition * 3.0;
        float turb = fbm(pos + uTime * 0.15);
        float turb2 = fbm(pos * 1.5 - uTime * 0.1);

        // Bright granulation pattern
        float granule = smoothstep(0.35, 0.65, turb);

        // Hot spots / convection cells
        float hotSpot = pow(turb2, 3.0) * 0.6;

        // Base color varies slightly with surface detail
        vec3 hotColor = uColor * 1.4 + vec3(0.15, 0.08, 0.0);
        vec3 coolColor = uColor * 0.85;
        vec3 surface = mix(coolColor, hotColor, granule) + hotSpot;

        // Limb darkening
        float facing = dot(vNormal, vec3(0.0, 0.0, 1.0));
        float limb = pow(max(facing, 0.0), 0.5);
        surface *= mix(0.55, 1.0, limb);

        gl_FragColor = vec4(surface, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // ── Corona / outer glow — fresnel-based, additive ──
  const glowGeo = new THREE.SphereGeometry(r * 1.6, 32, 32);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: c.clone().multiplyScalar(0.8) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        float glow = pow(rim, 3.0) * 0.35;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // ── Subtle lens flare spikes (billboard) ──
  const spikeGeo = new THREE.PlaneGeometry(r * 4.5, r * 0.08);
  const spikeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: c.clone().multiplyScalar(0.4) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = abs(vUv.y - 0.5) * 2.0;
        float core = abs(vUv.x - 0.5) * 2.0;
        float alpha = (1.0 - d) * (1.0 - pow(core, 0.6)) * 0.4;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const spike1 = new THREE.Mesh(spikeGeo, spikeMat);
  spike1.userData['starSpike'] = true;
  group.add(spike1);
  const spike2 = new THREE.Mesh(spikeGeo.clone(), spikeMat.clone());
  spike2.rotation.z = Math.PI / 2;
  spike2.userData['starSpike'] = true;
  group.add(spike2);

  return group;
}

// ─── Planetary System ────────────────────────────────

function buildPlanetarySystem(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const starColor = new THREE.Color(obj.color);

  // ── Central star (simplified but nice) ──
  const starGeo = new THREE.SphereGeometry(r, 32, 32);
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: starColor }, uTime: { value: 0.0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;
      float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main() {
        float n = noise(vPos * 3.0 + uTime * 0.1);
        vec3 col = mix(uColor * 0.85, uColor * 1.3, n);
        float limb = pow(max(dot(vNormal, vec3(0,0,1)), 0.0), 0.5);
        col *= mix(0.6, 1.0, limb);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(starGeo, starMat));

  // ── Star glow ──
  const glowGeo = new THREE.SphereGeometry(r * 1.4, 16, 16);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: starColor.clone().multiplyScalar(0.5) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        gl_FragColor = vec4(uColor, pow(rim, 3.0) * 0.3);
      }
    `,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  // ── Orbiting planets with atmosphere effect ──
  const planetColors = [0x4488cc, 0x44cc88, 0xcc8844, 0x8844cc];
  for (let i = 0; i < 3; i++) {
    const orbitR = r * 1.8 + i * r * 0.8;
    const pColor = new THREE.Color(planetColors[i % planetColors.length]);

    // Planet body
    const pGeo = new THREE.SphereGeometry(r * 0.18, 16, 16);
    const pMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: pColor } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying vec3 vNormal;
        void main() {
          float light = max(dot(vNormal, normalize(vec3(-1.0, 0.5, 1.0))), 0.0);
          float ambient = 0.15;
          gl_FragColor = vec4(uColor * (ambient + light * 0.85), 1.0);
        }
      `,
    });
    const planet = new THREE.Mesh(pGeo, pMat);
    const angle = (i / 3) * Math.PI * 2;
    planet.position.set(Math.cos(angle) * orbitR, 0, Math.sin(angle) * orbitR);
    group.add(planet);

    // Planet atmosphere glow
    const atmoGeo = new THREE.SphereGeometry(r * 0.24, 12, 12);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: pColor.clone().multiplyScalar(0.5) } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal; varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vViewDir = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - abs(dot(vNormal, vViewDir));
          gl_FragColor = vec4(uColor, pow(rim, 4.0) * 0.5);
        }
      `,
    });
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    atmo.position.copy(planet.position);
    group.add(atmo);

    // ── Orbit ring (dashed / gradient) ──
    const segs = 128;
    const pts: THREE.Vector3[] = [];
    for (let j = 0; j <= segs; j++) {
      const t = (j / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * orbitR, 0, Math.sin(t) * orbitR));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x556688,
      transparent: true,
      opacity: 0.18,
    });
    group.add(new THREE.Line(lineGeo, lineMat));
  }

  return group;
}

// ─── Nebula ──────────────────────────────────────────

function buildNebula(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const c = new THREE.Color(obj.color);
  const c2 = new THREE.Color(obj.secondaryColor ?? obj.color);

  // ── Volumetric cloud layers with shader-based noise ──
  for (let i = 0; i < 5; i++) {
    const scale = 0.6 + i * 0.25;
    const geo = new THREE.SphereGeometry(r * scale, 32, 32);
    const blend = i / 4;
    const layerColor = c.clone().lerp(c2, blend);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: layerColor },
        uTime: { value: 0.0 },
        uSeed: { value: i * 7.13 },
        uOpacity: { value: 0.08 - i * 0.008 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uSeed;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float noise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        float fbm(vec3 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.1; a *= 0.5; }
          return v;
        }

        void main() {
          vec3 p = vPosition * 2.5 + uSeed;
          float n = fbm(p + uTime * 0.03);
          float n2 = fbm(p * 1.3 - uTime * 0.02);

          // Wispy cloud density
          float density = smoothstep(0.25, 0.7, n) * smoothstep(0.2, 0.6, n2);

          // Edge transparency for depth illusion
          float rim = 1.0 - abs(dot(vNormal, vViewDir));
          float edgeFade = smoothstep(0.0, 0.4, rim) * smoothstep(1.0, 0.6, rim);

          vec3 col = uColor * (0.8 + n * 0.5);
          float alpha = density * edgeFade * uOpacity * 4.0;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.set(i * 0.7, i * 1.1, i * 0.4);
    group.add(mesh);
  }

  // ── Bright inner core / emission region ──
  const coreGeo = new THREE.SphereGeometry(r * 0.25, 24, 24);
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: c.clone().multiplyScalar(1.3) },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float facing = abs(dot(vNormal, vViewDir));
        float glow = pow(facing, 1.5) * 0.6;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // ── Scattered embedded stars ──
  const starCount = 60;
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const d = (0.3 + Math.random() * 0.7) * r;
    starPos[i * 3] = d * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = d * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = d * Math.cos(phi);
    starSizes[i] = 0.3 + Math.random() * 0.6;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(starGeo, starMat));

  return group;
}

// ─── Star Cluster ────────────────────────────────────

function buildStarCluster(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const count = 350;
  const r = obj.radius;
  const c = new THREE.Color(obj.color);
  const c2 = new THREE.Color(obj.secondaryColor ?? obj.color).multiplyScalar(1.2);

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Open cluster — loose, slightly flattened distribution
    const dist = Math.pow(Math.random(), 0.5) * r;
    positions[i3] = dist * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = dist * Math.sin(phi) * Math.sin(theta) * 0.6; // flatten slightly
    positions[i3 + 2] = dist * Math.cos(phi);

    const bright = 0.5 + Math.random() * 0.5;
    const blend = Math.random();
    const starColor = c.clone().lerp(c2, blend);
    colors[i3] = starColor.r * bright;
    colors[i3 + 1] = starColor.g * bright;
    colors[i3 + 2] = starColor.b * bright;

    sizes[i] = 0.3 + Math.random() * 0.8;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(geo, mat));

  // ── Subtle central haze ──
  const hazeGeo = new THREE.SphereGeometry(r * 0.5, 16, 16);
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: c.clone().multiplyScalar(0.2) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        gl_FragColor = vec4(uColor, pow(rim, 2.5) * 0.2);
      }
    `,
  });
  group.add(new THREE.Mesh(hazeGeo, hazeMat));

  return group;
}

// ─── Globular Cluster ────────────────────────────────

function buildGlobularCluster(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const count = 600;
  const c = new THREE.Color(obj.color);
  const c2 = new THREE.Color(obj.secondaryColor ?? obj.color);

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // King profile — very dense core, sparse halo
    const dist = Math.pow(Math.random(), 2.0) * r;
    positions[i3] = dist * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = dist * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = dist * Math.cos(phi);

    const blend = dist / r;
    const bright = 0.4 + Math.random() * 0.6;
    // Core stars yellowish, outer stars bluer
    const starColor = c.clone().lerp(c2, blend);
    colors[i3] = starColor.r * bright;
    colors[i3 + 1] = starColor.g * bright;
    colors[i3 + 2] = starColor.b * bright;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Points(geo, mat));

  // ── Dense core glow ──
  const coreGeo = new THREE.SphereGeometry(r * 0.25, 24, 24);
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: c.clone().multiplyScalar(0.4) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float facing = abs(dot(vNormal, vViewDir));
        float glow = pow(facing, 2.0) * 0.4;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // ── Outer haze ──
  const hazeGeo = new THREE.SphereGeometry(r * 0.7, 16, 16);
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: c.clone().multiplyScalar(0.15) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        gl_FragColor = vec4(uColor, pow(rim, 3.0) * 0.25);
      }
    `,
  });
  group.add(new THREE.Mesh(hazeGeo, hazeMat));

  return group;
}

// ─── Pulsar ──────────────────────────────────────────

function buildPulsar(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const c = new THREE.Color(obj.color);

  // ── Neutron star core — intensely bright, tiny ──
  const coreGeo = new THREE.SphereGeometry(r * 0.35, 32, 32);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      void main() {
        // Pulsing brightness
        float pulse = 0.85 + 0.15 * sin(uTime * 8.0);
        float limb = pow(max(dot(vNormal, vec3(0,0,1)), 0.0), 0.3);
        vec3 col = uColor * 1.4 * pulse * limb;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));

  // ── Magnetic field glow — toroidal halo ──
  const torusGeo = new THREE.TorusGeometry(r * 0.7, r * 0.15, 24, 64);
  const torusMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: c.clone().multiplyScalar(0.3) },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vPos;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        float pulse = 0.6 + 0.4 * sin(uTime * 6.0 + vPos.x * 3.0);
        float alpha = pow(rim, 2.0) * 0.35 * pulse;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const torus = new THREE.Mesh(torusGeo, torusMat);
  torus.rotation.x = Math.PI * 0.5;
  group.add(torus);

  // ── Emission beams — glowing cones with shader ──
  const beamLen = r * 3.5;
  const beamGeo = new THREE.CylinderGeometry(0, r * 0.25, beamLen, 16, 8, true);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: c.clone().multiplyScalar(0.8) },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        vUv = uv;
        vHeight = uv.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      varying float vHeight;
      void main() {
        // Beam fades along its length
        float fade = 1.0 - vHeight;
        // Central brightness
        float xDist = abs(vUv.x - 0.5) * 2.0;
        float core = 1.0 - pow(xDist, 0.5);
        // Pulsing
        float pulse = 0.7 + 0.3 * sin(uTime * 8.0 - vHeight * 6.0);
        float alpha = fade * core * pulse * 0.4;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });

  const beam1 = new THREE.Mesh(beamGeo, beamMat);
  beam1.position.y = beamLen * 0.5;
  beam1.userData['pulsarBeam'] = true;
  group.add(beam1);

  const beam2 = new THREE.Mesh(beamGeo.clone(), beamMat.clone());
  beam2.position.y = -beamLen * 0.5;
  beam2.rotation.x = Math.PI;
  beam2.userData['pulsarBeam'] = true;
  group.add(beam2);

  // ── Outer glow ──
  const glowGeo = new THREE.SphereGeometry(r * 0.8, 16, 16);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: c.clone().multiplyScalar(0.4) },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        float pulse = 0.7 + 0.3 * sin(uTime * 8.0);
        float glow = pow(rim, 3.0) * 0.3 * pulse;
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(glowGeo, glowMat));

  return group;
}

// ─── Supernova Remnant ───────────────────────────────

function buildSupernovaRemnant(obj: GalacticObject): THREE.Group {
  const group = new THREE.Group();
  const r = obj.radius;
  const c1 = new THREE.Color(obj.color);
  const c2 = new THREE.Color(obj.secondaryColor ?? obj.color);

  // ── Expanding shock shell — shader with noise-based filaments ──
  const shellGeo = new THREE.SphereGeometry(r, 48, 48);
  const shellMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor1: { value: c1 },
      uColor2: { value: c2 },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vViewDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p) {
        float v = 0.0; float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.2; a *= 0.48; }
        return v;
      }

      void main() {
        vec3 p = vPosition * 3.0;
        float n1 = fbm(p + uTime * 0.04);
        float n2 = fbm(p * 1.8 - uTime * 0.03);

        // Filamentary structure: sharp ridges of bright gas
        float filament = pow(smoothstep(0.3, 0.8, n1), 2.0);
        float secondary = smoothstep(0.4, 0.7, n2) * 0.5;

        // Color varies: shock front is primary color, interior secondary
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        vec3 col = mix(uColor2, uColor1, rim * 0.7 + filament * 0.3);

        // Shell is brightest at edges (like a real expanding bubble)
        float shell = pow(rim, 1.2) * 0.5 + filament * 0.3 + secondary * 0.15;

        // Add hot spots
        float hotSpot = pow(n1 * n2, 3.0) * 1.5;
        col += vec3(hotSpot * 0.3, hotSpot * 0.1, 0.0);

        float alpha = shell * 0.6;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  group.add(new THREE.Mesh(shellGeo, shellMat));

  // ── Inner hot gas cloud ──
  const gasGeo = new THREE.SphereGeometry(r * 0.6, 32, 32);
  const gasMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: c2.clone().multiplyScalar(0.6) },
      uTime: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uTime;
      varying vec3 vNormal; varying vec3 vViewDir; varying vec3 vPos;
      float hash(vec3 p) { p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 p) {
        vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main() {
        float n = noise(vPos * 4.0 + uTime * 0.05);
        float facing = abs(dot(vNormal, vViewDir));
        float glow = pow(facing, 1.5) * 0.3 * (0.7 + n * 0.3);
        gl_FragColor = vec4(uColor, glow);
      }
    `,
  });
  group.add(new THREE.Mesh(gasGeo, gasMat));

  // ── Central compact remnant (tiny bright point) ──
  const remnantGeo = new THREE.SphereGeometry(r * 0.08, 16, 16);
  const remnantMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  group.add(new THREE.Mesh(remnantGeo, remnantMat));

  // ── Remnant glow ──
  const remnantGlowGeo = new THREE.SphereGeometry(r * 0.2, 12, 12);
  const remnantGlowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    uniforms: { uColor: { value: new THREE.Color(0xaaccff).multiplyScalar(0.5) } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec3 vNormal; varying vec3 vViewDir;
      void main() {
        float rim = 1.0 - abs(dot(vNormal, vViewDir));
        gl_FragColor = vec4(uColor, pow(rim, 2.0) * 0.5);
      }
    `,
  });
  group.add(new THREE.Mesh(remnantGlowGeo, remnantGlowMat));

  return group;
}
