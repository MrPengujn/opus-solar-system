import {
  Component,
  signal,
  computed,
  ElementRef,
  viewChild,
  afterNextRender,
  OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SOLAR_SYSTEM, CelestialBody } from './data/solar-system.data';
import { GALAXIES, Galaxy } from './data/galaxies.data';
import { GALAXY_SYSTEMS, GalacticObject } from './data/galaxy-systems.data';
import { buildSatelliteModel } from './scene/satellite-models';
import { buildGalaxyMesh, buildGalaxyStarfield } from './scene/galaxy-builder';
import { buildGalacticObjectMesh } from './scene/galactic-object-builder';
import { Lang, UI, FACT_LABELS, DESCRIPTIONS } from './i18n/translations';

interface SceneObject {
  mesh: THREE.Object3D;
  data: CelestialBody;
  pivot: THREE.Object3D;
  angle: number;
}

interface GalacticSceneObject {
  mesh: THREE.Object3D;
  data: GalacticObject;
  pivot: THREE.Object3D;
  angle: number;
}

interface SearchResult {
  kind: 'galaxy' | 'galactic' | 'body';
  galaxy?: Galaxy;
  galacticObj?: GalacticObject;
  galaxyName?: string;
  body?: CelestialBody;
  label: string;
  icon: string;
  typeLabel: string;
  subtitle?: string;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  searchQuery = signal('');
  selectedBody = signal<CelestialBody | null>(null);
  showResults = signal(false);
  paused = signal(false);
  lightMode = signal(false);
  galaxyView = signal(true);
  selectedGalaxy = signal<Galaxy | null>(null);
  selectedGalacticObject = signal<GalacticObject | null>(null);
  insideGalaxy = signal(false);
  followMode = signal(false);
  showChangelog = signal(false);
  showWelcome = signal(!localStorage.getItem('welcomeDismissed'));
  showMobileMenu = signal(false);
  lang = signal<Lang>('en');

  changelog = [
    { version: '1.0', icon: '🌍', key: 'cl.solar', prompt: 'In this directory, initialize and write an entire Angular project with the following requirements:\n\nThe project must be a single web page project.\nThe page must contain a 3d rendered interface of our solar system.\nThe solar system must include all the planets, the sun, and moons.\nInside of the 3d rendered page, the user must be able to zoom in, search plantes that will then zoom on them and view information about each selected object.\n\nMake sure to test everything to make sure it works as intended' },
    { version: '1.1', icon: '🛰️', key: 'cl.satellites', prompt: 'Can you now add all the known to us NASA satellites? Can you make custom models and textures for each satellite?' },
    { version: '1.2', icon: '🌌', key: 'cl.galaxyView', prompt: 'Now I want a new major feature — Make it so that when I zoom out enough, the view changes to show all the galaxies in the milky way.' },
    { version: '1.3', icon: '🔭', key: 'cl.galaxyInternal', prompt: 'Now, can you add planets and everything else to each galaxy, so that each one of them has their own view. Add all the information we know about them.' },
    { version: '1.4', icon: '🎨', key: 'cl.theme', prompt: 'Can you add a button that will act like a "theme change" button that switches between dark and light mode so that I can see objects better?' },
    { version: '1.5', icon: '🌐', key: 'cl.i18n', prompt: 'Now add translations in romanian and russian.' },
    { version: '1.6', icon: '🕳️', key: 'cl.blackHole', prompt: 'Black holes look good, but I want them to look a bit more realistic. I want them to have the same distortion effect around as real ones do. Can you make it look even more realistic and better than this?' },
    { version: '1.7', icon: '✨', key: 'cl.lensing', prompt: 'Can you also add the distortion effect around it so that when other objects are behind it, they look distorted?' },
    { version: '1.8', icon: '📹', key: 'cl.follow', prompt: 'Can you add a button that will switch between the current object following mode, and enable a secondary object following mode that will keep the object within view and follow it around?' },
    { version: '1.9', icon: '💫', key: 'cl.galacticBodies', prompt: 'Can you now work on all the other galactic bodies to make them look much better too?' },
    { version: '2.0', icon: '📋', key: 'cl.changelog', prompt: 'Can you add a button that will open a modal and will describe, step by step, all the major features that you implemented/changes in this entire editor instance and also make sure to add all future major changes in the future (changelog).' },
    { version: '2.1', icon: '🐳', key: 'cl.docker', prompt: 'Now create a docker-compose to build the project so that I can put it on my server, it must run on port 50001, make sure to also include this in the changelog.' },
    { version: '2.2', icon: '🌌', key: 'cl.galaxyMain', prompt: 'Now make the galaxies view to be the main view instead of the solar system one. Fix search to show proper results because now it only shows milky way results. Add the option to search by keywords such as "black hole" etc. Add a new box on the left side that will show information about the currently open galaxy, together with a back button to go to the galaxies view.' },
    { version: '2.3', icon: '❓', key: 'cl.welcome', prompt: 'Now when entering the page for the first time, show the user a modal where it\'s described how to use the app and all the key binds and mouse movements they can do. After the user closes this modal, add a button to let them re-open it. Make sure to include this in the changelog.' },
    { version: '2.4', icon: '📱', key: 'cl.responsive', prompt: 'When entering a galaxy and clicking on an object inside of that galaxy, the left window for going back to the main view disappears and there is no way of going back, please fix that so that it does not disappear. Also make the UI responsive so that it renders properly on mobile etc. Also include this in the changelog.' },
    { version: '2.5', icon: '🌌', key: 'cl.milkyWay', prompt: 'Now make the milky way display all the other known astronomical objects that it has besides our solar system. Include this in the changelog.' },
    { version: '2.6', icon: '📱', key: 'cl.mobileFix', prompt: 'On mobile, the screen extends too much and gets out of the normal view, tested on iOS, because of that, the gear icon is not visible and the scrollable information container is also half out of view, fix that. Also the planets seem to be moving at different speeds on different devices, make it move equal on all devices. Include this in the changelog.' },
  ];

  allBodies: CelestialBody[] = [];

  // Unified search result type
  searchResults = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return [] as SearchResult[];
    const results: SearchResult[] = [];

    // Search galaxies
    for (const g of GALAXIES) {
      if (g.name.toLowerCase().includes(q) || g.type.toLowerCase().includes(q)) {
        results.push({ kind: 'galaxy', galaxy: g, label: g.name, icon: '🌌', typeLabel: 'galtype.' + g.type });
      }
    }

    // Search all galactic objects across all galaxies (by name, type, or keyword)
    for (const sys of GALAXY_SYSTEMS) {
      for (const obj of sys.objects) {
        const typeName = obj.type.replace(/-/g, ' ');
        if (obj.name.toLowerCase().includes(q) || typeName.includes(q)) {
          results.push({ kind: 'galactic', galacticObj: obj, galaxyName: sys.galaxyName, label: obj.name, icon: this.galacticIcon(obj.type), typeLabel: 'type.' + obj.type, subtitle: sys.galaxyName });
        }
      }
    }

    // Search solar system bodies
    for (const b of this.allBodies) {
      if (b.name.toLowerCase().includes(q) || b.type.toLowerCase().includes(q)) {
        results.push({ kind: 'body', body: b, label: b.name, icon: b.type === 'star' ? '☀️' : b.type === 'planet' ? '🪐' : b.type === 'satellite' ? '🛰️' : '🌙', typeLabel: 'type.' + b.type, subtitle: 'Milky Way · Solar System' });
      }
    }

    return results;
  });

  private galacticIcon(type: string): string {
    switch (type) {
      case 'black-hole': return '🕳️';
      case 'star': return '⭐';
      case 'nebula': return '🌫️';
      case 'pulsar': return '💫';
      case 'supernova-remnant': return '💥';
      case 'planetary-system': return '🪐';
      case 'quasar': return '✨';
      default: return '🔭';
    }
  }

  filteredBodies = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return [];
    return this.allBodies.filter((b) => b.name.toLowerCase().includes(q));
  });

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private sceneObjects: SceneObject[] = [];
  private meshToBody = new Map<THREE.Object3D, CelestialBody>();
  private ambientLight!: THREE.AmbientLight;
  private starfield!: THREE.Points;
  private bodyNameToSceneObj = new Map<string, SceneObject>();

  // Galaxy view
  private solarSystemGroup!: THREE.Group;
  private galaxyGroup!: THREE.Group;
  private galaxyStarfield!: THREE.Points;
  private galaxyMeshes: THREE.Mesh[] = [];
  private galaxyMeshToData = new Map<THREE.Mesh, Galaxy>();
  private readonly GALAXY_ZOOM_THRESHOLD = 450;
  private currentGalaxyView = false;
  private lockedInGalaxyView = false;
  private galaxyTime = 0;
  private raycaster = new THREE.Raycaster();

  // Galaxy internal view
  private galaxyInternalGroup!: THREE.Group;
  private galacticSceneObjects: GalacticSceneObject[] = [];
  private galacticMeshToData = new Map<THREE.Object3D, GalacticObject>();
  private galacticNameToSceneObj = new Map<string, GalacticSceneObject>();
  private currentInternalGalaxy: string | null = null;
  private mouse = new THREE.Vector2();
  private animationId = 0;
  private clock = new THREE.Clock();

  // Camera animation state
  private isAnimatingCamera = false;
  private cameraTargetPos = new THREE.Vector3();
  private controlsTargetPos = new THREE.Vector3();
  private cameraStartPos = new THREE.Vector3();
  private controlsStartPos = new THREE.Vector3();
  private animProgress = 0;
  private readonly ANIM_DURATION = 1.8;

  // Gravitational lensing render target
  private lensRT!: THREE.WebGLRenderTarget;
  private distortionMeshes: THREE.Mesh[] = [];

  constructor() {
    for (const body of SOLAR_SYSTEM) {
      this.allBodies.push(body);
      if (body.moons) {
        for (const moon of body.moons) {
          this.allBodies.push(moon);
        }
      }
      if (body.satellites) {
        for (const sat of body.satellites) {
          this.allBodies.push(sat);
        }
      }
    }

    afterNextRender(() => {
      this.initScene();
      this.createSolarSystem();
      this.createGalaxies();
      this.currentGalaxyView = true;
      this.starfield.visible = false;
      this.animate();
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.onResize);
    this.renderer?.dispose();
  }

  // ─── Template methods ─────────────────────────────
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    this.showResults.set(value.trim().length > 0);
  }

  onSearchFocus(): void {
    if (this.searchQuery().trim().length > 0) {
      this.showResults.set(true);
    }
  }

  onSearchBlur(): void {
    setTimeout(() => this.showResults.set(false), 200);
  }

  selectFromSearch(body: CelestialBody): void {
    this.selectedBody.set(body);
    this.searchQuery.set('');
    this.showResults.set(false);
    // Make sure we're in solar system view
    if (this.insideGalaxy()) this.exitGalaxyInternalView();
    if (this.currentGalaxyView) this.exitGalaxyView();
    this.zoomToBody(body.name);
  }

  selectSearchResult(result: SearchResult): void {
    this.searchQuery.set('');
    this.showResults.set(false);

    if (result.kind === 'galaxy' && result.galaxy) {
      // Go to galaxy internal view (all galaxies including Milky Way)
      if (this.insideGalaxy()) this.exitGalaxyInternalView();
      if (!this.currentGalaxyView) this.enterGalaxyView();
      this.selectedGalaxy.set(result.galaxy);
      this.selectedBody.set(null);
      this.enterGalaxyInternalView(result.galaxy);
    } else if (result.kind === 'galactic' && result.galacticObj && result.galaxyName) {
      // Navigate to galaxy, then select the object
      const galaxy = GALAXIES.find(g => g.name === result.galaxyName);
      if (galaxy) {
        if (this.currentInternalGalaxy !== galaxy.name) {
          if (this.insideGalaxy()) this.exitGalaxyInternalView();
          if (!this.currentGalaxyView) this.enterGalaxyView();
          this.selectedGalaxy.set(galaxy);
          this.enterGalaxyInternalView(galaxy);
        }
        // After entering, select the galactic object
        setTimeout(() => {
          this.selectedGalacticObject.set(result.galacticObj!);
          this.zoomToGalacticObject(result.galacticObj!.name);
        }, 100);
      }
    } else if (result.kind === 'body' && result.body) {
      this.selectFromSearch(result.body);
    }
  }

  selectFirstResult(): void {
    const results = this.searchResults();
    if (results.length > 0) {
      this.selectSearchResult(results[0]);
    }
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.showResults.set(false);
  }

  closeInfoPanel(): void {
    this.selectedBody.set(null);
  }

  closeGalaxyPanel(): void {
    this.selectedGalaxy.set(null);
  }

  closeGalacticObjectPanel(): void {
    this.selectedGalacticObject.set(null);
  }

  t(key: string): string {
    return UI[this.lang()]?.[key] ?? UI['en'][key] ?? key;
  }

  fl(label: string): string {
    const l = this.lang();
    if (l === 'en') return label;
    return FACT_LABELS[l]?.[label] ?? label;
  }

  getDesc(name: string, fallback: string): string {
    const l = this.lang();
    if (l === 'en') return fallback;
    return DESCRIPTIONS[l]?.[name] ?? fallback;
  }

  setLang(lang: Lang): void {
    this.lang.set(lang);
  }

  togglePause(): void {
    this.paused.update((v) => !v);
  }

  toggleFollowMode(): void {
    this.followMode.update((v) => !v);
  }

  toggleChangelog(): void {
    this.showChangelog.update((v) => !v);
  }

  dismissWelcome(): void {
    this.showWelcome.set(false);
    localStorage.setItem('welcomeDismissed', '1');
  }

  openWelcome(): void {
    this.showWelcome.set(true);
  }

  toggleMobileMenu(): void {
    this.showMobileMenu.update((v) => !v);
  }

  resetView(): void {
    this.selectedBody.set(null);
    this.selectedGalacticObject.set(null);
    this.selectedGalaxy.set(null);
    if (this.insideGalaxy()) {
      this.exitGalaxyInternalView();
    }
    if (!this.currentGalaxyView) {
      this.enterGalaxyView();
    }
    this.animateCameraTo(
      new THREE.Vector3(0, 300, 500),
      new THREE.Vector3(0, 0, 0),
    );
  }

  toggleTheme(): void {
    const light = !this.lightMode();
    this.lightMode.set(light);
    if (light) {
      this.scene.background = new THREE.Color(0x1a1a2e);
      this.ambientLight.color.set(0x8888aa);
      this.ambientLight.intensity = 2.4;
      this.starfield.visible = false;
    } else {
      this.scene.background = new THREE.Color(0x000008);
      this.ambientLight.color.set(0x333344);
      this.ambientLight.intensity = 0.6;
      this.starfield.visible = true;
    }
  }

  // ─── Scene setup ──────────────────────────────────
  private initScene(): void {
    const canvas = this.canvasRef().nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000008);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      10000,
    );
    this.camera.position.set(0, 300, 500);
    this.camera.far = 20000;
    this.camera.updateProjectionMatrix();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Render target for gravitational lensing background capture
    const pr = Math.min(window.devicePixelRatio, 2);
    this.lensRT = new THREE.WebGLRenderTarget(
      window.innerWidth * pr,
      window.innerHeight * pr,
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    );

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 2000;

    this.solarSystemGroup = new THREE.Group();
    this.solarSystemGroup.visible = false;
    this.scene.add(this.solarSystemGroup);
    this.galaxyGroup = new THREE.Group();
    this.galaxyGroup.visible = true;
    this.scene.add(this.galaxyGroup);

    this.galaxyInternalGroup = new THREE.Group();
    this.galaxyInternalGroup.visible = false;
    this.scene.add(this.galaxyInternalGroup);

    this.ambientLight = new THREE.AmbientLight(0x333344, 0.6);
    this.scene.add(this.ambientLight);

    this.createStarfield();

    window.addEventListener('resize', this.onResize);
    canvas.addEventListener('click', this.onClick);
  }

  // ─── Starfield ────────────────────────────────────
  private createStarfield(): void {
    const count = 6000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 800 + Math.random() * 400;
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      const b = 0.5 + Math.random() * 0.5;
      colors[i3] = b;
      colors[i3 + 1] = b;
      colors[i3 + 2] = b + Math.random() * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.7,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });

    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
  }

  // ─── Solar system creation ────────────────────────
  private createSolarSystem(): void {
    for (const body of SOLAR_SYSTEM) {
      if (body.type === 'star') {
        this.createSun(body);
      } else {
        this.createPlanet(body);
      }
    }
  }

  private createSun(data: CelestialBody): void {
    const geo = new THREE.SphereGeometry(data.radius, 64, 64);
    const mat = new THREE.MeshBasicMaterial({ color: data.color });
    const mesh = new THREE.Mesh(geo, mat);
    this.solarSystemGroup.add(mesh);

    // Inner glow
    const glowGeo = new THREE.SphereGeometry(data.radius * 1.15, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
    });
    this.solarSystemGroup.add(new THREE.Mesh(glowGeo, glowMat));

    // Outer glow
    const outerGeo = new THREE.SphereGeometry(data.radius * 1.5, 32, 32);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    this.solarSystemGroup.add(new THREE.Mesh(outerGeo, outerMat));

    // Sun light
    const light = new THREE.PointLight(0xffffff, 2.5, 600, 0.08);
    this.solarSystemGroup.add(light);

    const pivot = new THREE.Object3D();
    this.solarSystemGroup.add(pivot);

    const obj: SceneObject = { mesh, data, pivot, angle: 0 };
    this.sceneObjects.push(obj);
    this.meshToBody.set(mesh, data);
    this.bodyNameToSceneObj.set(data.name, obj);

    // Sun satellites (deep space probes)
    if (data.satellites) {
      for (const satData of data.satellites) {
        this.createSunSatellite(satData);
      }
    }
  }

  private createPlanet(data: CelestialBody): void {
    const pivot = new THREE.Object3D();
    this.solarSystemGroup.add(pivot);

    const geo = new THREE.SphereGeometry(data.radius, 32, 32);
    const mat = this.buildMaterial(data);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = data.orbitalRadius;
    if (data.tilt) mesh.rotation.z = data.tilt;
    pivot.add(mesh);

    const startAngle = Math.random() * Math.PI * 2;
    pivot.rotation.y = startAngle;

    this.createOrbitLine(data.orbitalRadius);

    const obj: SceneObject = { mesh, data, pivot, angle: startAngle };
    this.sceneObjects.push(obj);
    this.meshToBody.set(mesh, data);
    this.bodyNameToSceneObj.set(data.name, obj);

    // Rings
    if (data.rings) {
      const ringGeo = new THREE.RingGeometry(data.rings.innerRadius, data.rings.outerRadius, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: data.rings.color,
        transparent: true,
        opacity: data.rings.opacity,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2 + 0.3;
      ring.position.x = data.orbitalRadius;
      pivot.add(ring);
    }

    // Moons
    if (data.moons) {
      for (const moonData of data.moons) {
        this.createMoon(moonData, mesh, pivot);
      }
    }

    // Satellites
    if (data.satellites) {
      for (const satData of data.satellites) {
        this.createSatellite(satData, mesh, pivot);
      }
    }
  }

  private createMoon(
    data: CelestialBody,
    parentMesh: THREE.Mesh,
    parentPivot: THREE.Object3D,
  ): void {
    const moonPivot = new THREE.Object3D();
    moonPivot.position.x = parentMesh.position.x;
    parentPivot.add(moonPivot);

    const geo = new THREE.SphereGeometry(data.radius, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: data.color,
      roughness: 0.8,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = data.orbitalRadius;

    const startAngle = Math.random() * Math.PI * 2;
    moonPivot.rotation.y = startAngle;
    moonPivot.add(mesh);

    const obj: SceneObject = { mesh, data, pivot: moonPivot, angle: startAngle };
    this.sceneObjects.push(obj);
    this.meshToBody.set(mesh, data);
    this.bodyNameToSceneObj.set(data.name, obj);
  }

  private createSatellite(
    data: CelestialBody,
    parentMesh: THREE.Mesh,
    parentPivot: THREE.Object3D,
  ): void {
    const satPivot = new THREE.Object3D();
    satPivot.position.x = parentMesh.position.x;
    parentPivot.add(satPivot);

    const model = buildSatelliteModel(data.name, data.radius * 3);
    model.position.x = data.orbitalRadius;

    const startAngle = Math.random() * Math.PI * 2;
    satPivot.rotation.y = startAngle;
    satPivot.add(model);

    const obj: SceneObject = { mesh: model, data, pivot: satPivot, angle: startAngle };
    this.sceneObjects.push(obj);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.meshToBody.set(child, data);
      }
    });
    this.bodyNameToSceneObj.set(data.name, obj);
  }

  private createSunSatellite(data: CelestialBody): void {
    const pivot = new THREE.Object3D();
    this.solarSystemGroup.add(pivot);

    const model = buildSatelliteModel(data.name, data.radius * 3);
    model.position.x = data.orbitalRadius;
    if (data.tilt) model.rotation.z = data.tilt;

    const startAngle = Math.random() * Math.PI * 2;
    pivot.rotation.y = startAngle;
    pivot.add(model);

    const obj: SceneObject = { mesh: model, data, pivot, angle: startAngle };
    this.sceneObjects.push(obj);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.meshToBody.set(child, data);
      }
    });
    this.bodyNameToSceneObj.set(data.name, obj);
  }

  // ─── Materials ────────────────────────────────────
  private buildMaterial(data: CelestialBody): THREE.Material {
    if (data.name === 'Jupiter' || data.name === 'Saturn') {
      return new THREE.MeshStandardMaterial({
        map: this.bandedTexture(data),
        roughness: 0.65,
        metalness: 0.05,
      });
    }
    if (data.name === 'Earth') {
      return new THREE.MeshStandardMaterial({
        map: this.earthTexture(),
        roughness: 0.5,
        metalness: 0.1,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: data.color,
      roughness: 0.8,
      metalness: 0.1,
    });
  }

  private bandedTexture(data: CelestialBody): THREE.CanvasTexture {
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    const base = new THREE.Color(data.color);
    const dark = base.clone().multiplyScalar(0.55);
    const light = base.clone().lerp(new THREE.Color(0xffffff), 0.25);

    for (let y = 0; y < h; y++) {
      const t = Math.sin((y / h) * Math.PI * 14) + Math.sin((y / h) * Math.PI * 37) * 0.15;
      const c = t > 0.25 ? light : t > -0.25 ? base : dark;
      ctx.fillStyle = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
      ctx.fillRect(0, y, w, 1);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }

  private earthTexture(): THREE.CanvasTexture {
    const w = 512, h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1a4488';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#2d8844';
    const landMasses = [
      { x: 240, y: 55, rx: 45, ry: 50 },
      { x: 280, y: 45, rx: 35, ry: 25 },
      { x: 340, y: 50, rx: 40, ry: 35 },
      { x: 85, y: 65, rx: 30, ry: 50 },
      { x: 95, y: 120, rx: 18, ry: 35 },
      { x: 370, y: 170, rx: 28, ry: 22 },
      { x: 220, y: 20, rx: 60, ry: 12 },
    ];
    for (const lm of landMasses) {
      ctx.beginPath();
      ctx.ellipse(lm.x, lm.y, lm.rx, lm.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#dde8ee';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 18, w, 18);

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(
        Math.random() * w, Math.random() * h,
        25 + Math.random() * 35, 4 + Math.random() * 8,
        0, 0, Math.PI * 2,
      );
      ctx.fill();
    }
    return new THREE.CanvasTexture(canvas);
  }

  // ─── Orbit lines ──────────────────────────────────
  private createOrbitLine(radius: number): void {
    const segs = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x334466,
      transparent: true,
      opacity: 0.35,
    });
    this.solarSystemGroup.add(new THREE.Line(geo, mat));
  }

  // ─── Galaxy creation ──────────────────────────────
  private createGalaxies(): void {
    for (const galaxy of GALAXIES) {
      const mesh = buildGalaxyMesh(galaxy);
      this.galaxyGroup.add(mesh);
      this.galaxyMeshes.push(mesh);
      this.galaxyMeshToData.set(mesh, galaxy);
    }
    this.galaxyStarfield = buildGalaxyStarfield();
    this.galaxyGroup.add(this.galaxyStarfield);
  }

  // ─── Animation loop ───────────────────────────────
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();

    if (!this.paused()) {
      // Normalize to 60fps so speed is consistent across all refresh rates
      const speed = dt * 60;
      for (const obj of this.sceneObjects) {
        obj.angle += obj.data.orbitalSpeed * speed;
        obj.pivot.rotation.y = obj.angle;
        obj.mesh.rotation.y += obj.data.rotationSpeed * speed;
      }

      // Animate galactic objects when inside a galaxy
      if (this.insideGalaxy()) {
        for (const obj of this.galacticSceneObjects) {
          obj.angle += obj.data.orbitalSpeed * speed;
          obj.pivot.rotation.y = obj.angle;
          obj.mesh.rotation.y += obj.data.rotationSpeed * speed;
        }
        // Update black hole shader effects
        this.updateBlackHoleEffects(dt);
      }
    }

    // Smooth camera follow for selected body
    const sel = this.selectedBody();
    const lerpFollow = 1 - Math.pow(1 - 0.08, dt * 60);
    const lerpTrack = 1 - Math.pow(1 - 0.04, dt * 60);
    if (sel && !this.isAnimatingCamera) {
      const so = this.bodyNameToSceneObj.get(sel.name);
      if (so) {
        const wp = new THREE.Vector3();
        so.mesh.getWorldPosition(wp);
        if (this.followMode()) {
          const offset = this.camera.position.clone().sub(this.controls.target);
          this.controls.target.lerp(wp, lerpFollow);
          this.camera.position.copy(this.controls.target).add(offset);
        } else {
          this.controls.target.lerp(wp, lerpTrack);
        }
      }
    }

    // Smooth camera follow for selected galactic object
    const selGal = this.selectedGalacticObject();
    if (selGal && !this.isAnimatingCamera) {
      const so = this.galacticNameToSceneObj.get(selGal.name);
      if (so) {
        const wp = new THREE.Vector3();
        so.mesh.getWorldPosition(wp);
        if (this.followMode()) {
          const offset = this.camera.position.clone().sub(this.controls.target);
          this.controls.target.lerp(wp, lerpFollow);
          this.camera.position.copy(this.controls.target).add(offset);
        } else {
          this.controls.target.lerp(wp, lerpTrack);
        }
      }
    }

    // Camera tween
    if (this.isAnimatingCamera) {
      this.animProgress += dt / this.ANIM_DURATION;
      if (this.animProgress >= 1) {
        this.animProgress = 1;
        this.isAnimatingCamera = false;
      }
      const t = this.easeInOutCubic(this.animProgress);
      this.camera.position.lerpVectors(this.cameraStartPos, this.cameraTargetPos, t);
      this.controls.target.lerpVectors(this.controlsStartPos, this.controlsTargetPos, t);
    }

    this.controls.update();

    // Galaxy view transition based on camera distance (skip when inside a galaxy)
    // Only auto-transition BACK to galaxy view when zooming out from solar system
    if (!this.insideGalaxy()) {
      const camDist = this.camera.position.length();
      if (!this.currentGalaxyView && camDist > this.GALAXY_ZOOM_THRESHOLD) {
        this.enterGalaxyView();
      }
    }

    // Galaxy animations
    if (this.currentGalaxyView && !this.paused()) {
      this.galaxyTime += dt;
      for (let i = 0; i < this.galaxyMeshes.length; i++) {
        const mesh = this.galaxyMeshes[i];
        const galaxy = this.galaxyMeshToData.get(mesh)!;
        // Slow rotation based on galaxy type
        const rotSpeed = galaxy.type === 'spiral' ? 0.03 : galaxy.type === 'lenticular' ? 0.02 : 0.008;
        mesh.rotation.z += rotSpeed * dt;
        // Gentle floating motion
        const phase = i * 1.7;
        mesh.position.y = galaxy.position[1] + Math.sin(this.galaxyTime * 0.3 + phase) * 2;
      }
      // Slowly rotate intergalactic starfield
      this.galaxyStarfield.rotation.y += 0.002 * dt;
    }

    // ── Two-pass render for gravitational lensing ──
    if (this.insideGalaxy() && this.distortionMeshes.length > 0) {
      // Pass 1: Render scene without distortion spheres → render target
      for (const dm of this.distortionMeshes) dm.visible = false;
      this.renderer.setRenderTarget(this.lensRT);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setRenderTarget(null);
      // Pass 2: Enable distortion spheres with the captured background
      const res = new THREE.Vector2(
        this.lensRT.width, this.lensRT.height
      );
      for (const dm of this.distortionMeshes) {
        dm.visible = true;
        const mat = dm.material as THREE.ShaderMaterial;
        mat.uniforms['uScreenTex'].value = this.lensRT.texture;
        mat.uniforms['uResolution'].value = res;
      }
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private blackHoleTime = 0;

  private updateBlackHoleEffects(dt: number): void {
    this.blackHoleTime += dt;
    for (const obj of this.galacticSceneObjects) {
      const g = obj.mesh as THREE.Group;
      if (!g.children) continue;
      for (const child of g.children) {
        // Billboard elements toward camera
        if (child.userData['photonRing'] || child.userData['lensingBand'] || child.userData['starSpike']) {
          child.lookAt(this.camera.position);
        }
        // Update time uniforms on all shader materials
        const mat = (child as THREE.Mesh).material;
        if (mat && 'uniforms' in mat) {
          const sm = mat as THREE.ShaderMaterial;
          if (sm.uniforms['uTime']) {
            sm.uniforms['uTime'].value = this.blackHoleTime;
          }
        }
      }
    }
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ─── Events ───────────────────────────────────────
  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    const pr = Math.min(window.devicePixelRatio, 2);
    this.lensRT.setSize(window.innerWidth * pr, window.innerHeight * pr);
  };

  private onClick = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Inside a galaxy internal view
    if (this.insideGalaxy()) {
      const targets = Array.from(this.galacticMeshToData.keys());
      const hits = this.raycaster.intersectObjects(targets, true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        let galObj: GalacticObject | undefined;
        while (obj) {
          galObj = this.galacticMeshToData.get(obj);
          if (galObj) break;
          obj = obj.parent;
        }
        if (galObj) {
          if (galObj.name === 'Solar System') {
            // Transition to the solar system view
            this.exitGalaxyInternalView();
            this.exitGalaxyView();
            this.animateCameraTo(
              new THREE.Vector3(0, 100, 180),
              new THREE.Vector3(0, 0, 0),
            );
          } else {
            this.selectedGalacticObject.set(galObj);
            this.zoomToGalacticObject(galObj.name);
          }
        }
      }
      return;
    }

    if (this.currentGalaxyView) {
      // Check galaxy meshes
      const hits = this.raycaster.intersectObjects(this.galaxyMeshes);
      if (hits.length > 0) {
        const galaxy = this.galaxyMeshToData.get(hits[0].object as THREE.Mesh);
        if (galaxy) {
          // Enter internal view of this galaxy (including Milky Way)
          this.selectedGalaxy.set(galaxy);
          this.selectedBody.set(null);
          this.enterGalaxyInternalView(galaxy);
        }
      }
      return;
    }

    const targets = Array.from(this.meshToBody.keys());
    const hits = this.raycaster.intersectObjects(targets, true);

    if (hits.length > 0) {
      // Walk up parent chain to find the mapped mesh
      let obj: THREE.Object3D | null = hits[0].object;
      let body: CelestialBody | undefined;
      while (obj) {
        body = this.meshToBody.get(obj);
        if (body) break;
        obj = obj.parent;
      }
      if (body) {
        this.selectedBody.set(body);
        this.zoomToBody(body.name);
      }
    }
  };

  // ─── Camera navigation ────────────────────────────
  private zoomToBody(name: string): void {
    const so = this.bodyNameToSceneObj.get(name);
    if (!so) return;

    const wp = new THREE.Vector3();
    so.mesh.getWorldPosition(wp);

    const r = so.data.radius;
    const dist = Math.max(r * 6, 3);
    const offset = new THREE.Vector3(dist * 0.7, dist * 0.5, dist * 0.7);

    this.animateCameraTo(wp.clone().add(offset), wp);
  }

  private animateCameraTo(camPos: THREE.Vector3, target: THREE.Vector3): void {
    this.cameraStartPos.copy(this.camera.position);
    this.controlsStartPos.copy(this.controls.target);
    this.cameraTargetPos.copy(camPos);
    this.controlsTargetPos.copy(target);
    this.animProgress = 0;
    this.isAnimatingCamera = true;
  }

  // ─── Galaxy view transitions ──────────────────────
  private enterGalaxyView(): void {
    this.currentGalaxyView = true;
    this.lockedInGalaxyView = false;
    this.galaxyView.set(true);
    this.solarSystemGroup.visible = false;
    this.starfield.visible = false;
    this.galaxyGroup.visible = true;
    this.selectedBody.set(null);
  }

  private exitGalaxyView(): void {
    this.currentGalaxyView = false;
    this.lockedInGalaxyView = false;
    this.galaxyView.set(false);
    this.solarSystemGroup.visible = true;
    this.starfield.visible = !this.lightMode();
    this.galaxyGroup.visible = false;
    this.selectedGalaxy.set(null);
  }

  // ─── Galaxy internal view ─────────────────────────
  private enterGalaxyInternalView(galaxy: Galaxy): void {
    // Clear any previous internal view
    this.clearGalaxyInternalView();

    this.currentInternalGalaxy = galaxy.name;
    this.insideGalaxy.set(true);
    this.lockedInGalaxyView = true;

    // Hide galaxy meshes, show internal group
    this.galaxyGroup.visible = false;
    this.galaxyInternalGroup.visible = true;

    // Add a point light at center for this galaxy's internal view
    const internalLight = new THREE.PointLight(0xffffff, 2, 500, 0.08);
    this.galaxyInternalGroup.add(internalLight);

    // Add ambient glow
    const ambientInternal = new THREE.AmbientLight(0x222244, 0.4);
    this.galaxyInternalGroup.add(ambientInternal);

    // Create internal starfield
    this.createGalaxyInternalStarfield();

    // Find the galaxy system data
    const system = GALAXY_SYSTEMS.find((s) => s.galaxyName === galaxy.name);
    if (!system) return;

    for (const galObj of system.objects) {
      this.createGalacticObject(galObj);
    }

    // Animate camera to overview of internal view
    this.animateCameraTo(
      new THREE.Vector3(0, 60, 120),
      new THREE.Vector3(0, 0, 0),
    );
  }

  private exitGalaxyInternalView(): void {
    this.clearGalaxyInternalView();
    this.insideGalaxy.set(false);
    this.currentInternalGalaxy = null;
    this.selectedGalacticObject.set(null);

    // Restore galaxy group view
    this.galaxyGroup.visible = true;
    this.galaxyInternalGroup.visible = false;
  }

  private clearGalaxyInternalView(): void {
    // Remove all children from internal group
    while (this.galaxyInternalGroup.children.length > 0) {
      this.galaxyInternalGroup.remove(this.galaxyInternalGroup.children[0]);
    }
    this.galacticSceneObjects = [];
    this.galacticMeshToData.clear();
    this.galacticNameToSceneObj.clear();
    this.distortionMeshes = [];
  }

  private createGalaxyInternalStarfield(): void {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 300 + Math.random() * 200;
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      const b = 0.3 + Math.random() * 0.5;
      colors[i3] = b;
      colors[i3 + 1] = b;
      colors[i3 + 2] = b + Math.random() * 0.15;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
    });

    this.galaxyInternalGroup.add(new THREE.Points(geo, mat));
  }

  private createGalacticObject(data: GalacticObject): void {
    const pivot = new THREE.Object3D();
    this.galaxyInternalGroup.add(pivot);

    const mesh = buildGalacticObjectMesh(data);
    mesh.position.x = data.orbitalRadius;

    const startAngle = Math.random() * Math.PI * 2;
    pivot.rotation.y = startAngle;
    pivot.add(mesh);

    // Create orbit line for orbiting objects
    if (data.orbitalRadius > 0) {
      this.createGalacticOrbitLine(data.orbitalRadius);
    }

    const obj: GalacticSceneObject = { mesh, data, pivot, angle: startAngle };
    this.galacticSceneObjects.push(obj);
    this.galacticNameToSceneObj.set(data.name, obj);

    // Collect distortion spheres for two-pass lensing render
    if (data.type === 'black-hole' || data.type === 'quasar') {
      if (mesh instanceof THREE.Group) {
        mesh.traverse((child) => {
          if (child.userData['distortionSphere']) {
            this.distortionMeshes.push(child as THREE.Mesh);
          }
        });
      }
    }

    // Map all child meshes for raycasting (exclude distortion spheres)
    if (mesh instanceof THREE.Group) {
      mesh.traverse((child) => {
        if ((child instanceof THREE.Mesh || child instanceof THREE.Points) && !child.userData['distortionSphere']) {
          this.galacticMeshToData.set(child, data);
        }
      });
    } else {
      this.galacticMeshToData.set(mesh, data);
    }
  }

  private createGalacticOrbitLine(radius: number): void {
    const segs = 128;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, 0, Math.sin(t) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x443366,
      transparent: true,
      opacity: 0.25,
    });
    this.galaxyInternalGroup.add(new THREE.Line(geo, mat));
  }

  private zoomToGalacticObject(name: string): void {
    const so = this.galacticNameToSceneObj.get(name);
    if (!so) return;

    const wp = new THREE.Vector3();
    so.mesh.getWorldPosition(wp);

    const r = so.data.radius;
    const dist = Math.max(r * 6, 8);
    const offset = new THREE.Vector3(dist * 0.7, dist * 0.5, dist * 0.7);

    this.animateCameraTo(wp.clone().add(offset), wp);
  }

  backToGalaxyView(): void {
    if (this.insideGalaxy()) {
      this.exitGalaxyInternalView();
      this.animateCameraTo(
        new THREE.Vector3(0, 300, 500),
        new THREE.Vector3(0, 0, 0),
      );
    }
  }

  backToGalaxies(): void {
    this.selectedBody.set(null);
    this.enterGalaxyView();
    this.animateCameraTo(
      new THREE.Vector3(0, 300, 500),
      new THREE.Vector3(0, 0, 0),
    );
  }
}
