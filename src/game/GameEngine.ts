import { Worm, Projectile, Particle, FloatingText, ExplosionEffect, TurnPhase, ControlState, GameMode, AIDifficulty } from './types';
import { TerrainManager } from './terrain';
import { GameRenderer } from './renderer';
import { sound } from './audio';

export class GameEngine {
  public terrain: TerrainManager;
  public renderer: GameRenderer;

  public worms: Worm[] = [];
  public activeTeam: 'left' | 'right' = 'left';
  public turnPhase: TurnPhase = 'AIM';

  public gameMode: GameMode = 'SINGLE';
  public aiDifficulty: AIDifficulty = 'NORMAL';
  public localPlayerTeam: 'left' | 'right' = 'left';

  public playerNames: { left: string; right: string } = {
    left: 'SOLUCAN 1',
    right: 'ROBOT (NORMAL)',
  };

  public turnTimer: number = 30.0;
  public wind: number = 0; // -4.0 to +4.0 m/s
  public chargeRatio: number = 0;
  public chargeSpeed: number = 0.58; // Takes ~1.7s to reach 100%

  public projectile: Projectile | null = null;
  public particles: Particle[] = [];
  public explosions: ExplosionEffect[] = [];
  public floatingTexts: FloatingText[] = [];
  private nextTextId: number = 1;

  public camX: number = 600;
  public camY: number = 550;
  public targetCamX: number = 600;
  public targetCamY: number = 550;
  public zoom: number = 1.0;
  public targetZoom: number = 1.0;
  public screenShake: number = 0;

  public isGameOver: boolean = false;
  public winnerText: string = '';

  // 2-Second Post-Fire Retreat Movement Window (2000ms)
  public postFireMoveTimer: number = 0;

  // Manual panning by player inspection
  public isManualPanning: boolean = false;
  private manualPanTimer: number = 0;

  public controls: ControlState = {
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
    jump: false,
  };

  public panCameraBy(deltaScreenX: number) {
    if (this.projectile && this.projectile.active) return;
    if (this.turnPhase === 'PROJECTILE_FLYING' || this.turnPhase === 'EXPLOSION') return;

    this.isManualPanning = true;
    this.manualPanTimer = 5.0; // Stay at inspected location for 5s of inactivity unless player moves/fires/switches turn

    // Convert screen pixel delta to world space delta based on current zoom
    const worldDeltaX = deltaScreenX / Math.max(0.5, this.zoom);
    this.targetCamX = this.targetCamX - worldDeltaX;

    const minCamX = 350;
    const maxCamX = this.terrain.width - 350;
    this.targetCamX = Math.max(minCamX, Math.min(maxCamX, this.targetCamX));
  }

  public resetManualPan() {
    this.isManualPanning = false;
    this.manualPanTimer = 0;
  }

  // AI State Machine for Single Player
  private aiState: 'IDLE' | 'THINKING' | 'AIMING' | 'CHARGING' | 'FIRED' = 'IDLE';
  private aiTargetAngle: number = 45;
  private aiTargetPower: number = 0.5;
  private aiTimer: number = 0;

  // Online Multiplayer Action Hook
  public onFireCallback?: (payload: {
    team: 'left' | 'right';
    angle: number;
    facing: 1 | -1;
    powerRatio: number;
    wind: number;
    x: number;
    y: number;
  }) => void;

  private lastTime: number = 0;
  private animFrameId: number | null = null;
  private isRunning: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private onStateChangeCallback?: () => void;

  constructor(onStateChange?: () => void) {
    this.onStateChangeCallback = onStateChange;
    this.terrain = new TerrainManager();
    this.renderer = new GameRenderer();
    this.initGame();
  }

  public initGame(
    seed: number = 12345,
    names?: { left: string; right: string },
    mode: GameMode = 'SINGLE',
    diff: AIDifficulty = 'NORMAL',
    localTeam: 'left' | 'right' = 'left'
  ) {
    this.gameMode = mode;
    this.aiDifficulty = diff;
    this.localPlayerTeam = localTeam;

    if (names) {
      this.playerNames = { ...names };
    }

    this.terrain.generateIsland(seed);
    const spawns = this.terrain.getSpawnPoints();

    this.worms = [
      {
        id: 'left',
        name: this.playerNames.left.toUpperCase(),
        x: spawns.left.x,
        y: spawns.left.y,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        angle: 45,
        facing: 1, // Facing right
        isGrounded: true,
        animFrame: 0,
        walkTimer: 0,
        isDead: false,
        drowned: false,
        damageFlash: 0,
        color: '#fb7185',
        headbandColor: '#eab308', // Gold headband
      },
      {
        id: 'right',
        name: this.playerNames.right.toUpperCase(),
        x: spawns.right.x,
        y: spawns.right.y,
        vx: 0,
        vy: 0,
        hp: 100,
        maxHp: 100,
        angle: 45,
        facing: -1, // Facing left
        isGrounded: true,
        animFrame: 0,
        walkTimer: 0,
        isDead: false,
        drowned: false,
        damageFlash: 0,
        color: '#38bdf8',
        headbandColor: '#1d4ed8', // Blue headband
      },
    ];

    this.activeTeam = 'left';
    this.turnPhase = 'AIM';
    this.turnTimer = 30.0;
    this.postFireMoveTimer = 0;
    this.randomizeWind();
    this.chargeRatio = 0;
    this.projectile = null;
    this.particles = [];
    this.explosions = [];
    this.floatingTexts = [];
    this.isGameOver = false;
    this.winnerText = '';

    // Reset AI state
    this.aiState = 'IDLE';
    this.aiTimer = 0;

    const activeW = this.getActiveWorm();
    if (activeW) {
      this.camX = activeW.x;
      this.camY = activeW.y - 80;
      this.targetCamX = this.camX;
      this.targetCamY = this.camY;
    }
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.screenShake = 0;
  }

  public randomizeWind(fixedWind?: number) {
    if (typeof fixedWind === 'number') {
      this.wind = fixedWind;
      return;
    }
    // Generate between -4.0 and +4.0 with 1 decimal place
    const raw = (Math.floor(Math.random() * 81) - 40) / 10;
    this.wind = Number(raw.toFixed(1));
  }

  public getActiveWorm(): Worm | null {
    return this.worms.find((w) => w.id === this.activeTeam) || null;
  }

  public getInactiveWorm(): Worm | null {
    return this.worms.find((w) => w.id !== this.activeTeam) || null;
  }

  public setCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (time: number) => {
    if (!this.isRunning) return;
    const dt = Math.min(0.08, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  public update(dt: number) {
    const activeWorm = this.getActiveWorm();

    // 1. Screen Shake Decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // 2. Damage Flash Decay & Animations
    for (const worm of this.worms) {
      worm.animFrame += dt * 8;
      if (worm.damageFlash > 0) {
        worm.damageFlash = Math.max(0, worm.damageFlash - dt * 4);
      }
    }

    // 3. Update Background Environment
    this.renderer.updateBackground(this.wind, dt);

    // 4. Update Game by Turn Phase
    if (!this.isGameOver) {
      this.updateTurnPhase(activeWorm, dt);
    }

    // 5. Update Worm Physics (Gravity & Slopes)
    this.updateWormPhysics(dt);

    // 6. Update Projectile Physics
    this.updateProjectilePhysics(dt);

    // 7. Update Particles
    this.updateParticles(dt);

    // 8. Update Explosions
    this.updateExplosions(dt);

    // 9. Update Floating Texts
    this.updateFloatingTexts(dt);

    // 10. Update Camera Lerp & Clamping
    this.updateCamera(dt);
  }

  private updateTurnPhase(activeWorm: Worm | null, dt: number) {
    if (!activeWorm || activeWorm.isDead) return;

    if (this.turnPhase === 'AIM' || this.turnPhase === 'CHARGING') {
      // 30s Turn countdown timer
      this.turnTimer = Math.max(0, this.turnTimer - dt);
      if (this.turnTimer <= 0) {
        this.addFloatingText(activeWorm.x, activeWorm.y - 40, 'SÜRE BİTTİ!', '#f59e0b');
        this.switchTurn();
        return;
      }

      // Check if this turn is controlled by the AI bot in Single Player
      const isAITurn = this.gameMode === 'SINGLE' && this.activeTeam === 'right';
      // In online mode, controls are only active for local player
      const isRemoteTurn = this.gameMode === 'ONLINE_1V1' && this.activeTeam !== this.localPlayerTeam;

      if (isAITurn) {
        this.updateAIBot(activeWorm, dt);
        return;
      }

      if (isRemoteTurn) {
        // Local user cannot control remote player
        return;
      }

      // Human Player Controls (Local Player / Pass & Play)
      if (this.controls.left || this.controls.right || this.controls.up || this.controls.down || this.controls.fire || this.controls.jump) {
        this.resetManualPan();
      }

      // Jump Control (Single upward leap when grounded, cannot jump again until landing)
      if (this.controls.jump && activeWorm.isGrounded && !this.controls.fire && this.turnPhase === 'AIM') {
        this.executeJump(activeWorm);
      }

      // Ground walking: ONLY call moveWorm when activeWorm.isGrounded!
      if (activeWorm.isGrounded) {
        if (this.controls.left && !this.controls.fire) {
          this.moveWorm(activeWorm, -1, dt);
        } else if (this.controls.right && !this.controls.fire) {
          this.moveWorm(activeWorm, 1, dt);
        } else {
          activeWorm.walkTimer = 0;
        }
      }

      // Angle Controls (Aim elevation -15 to 90 degrees)
      if (this.controls.up) {
        activeWorm.angle = Math.min(90, activeWorm.angle + dt * 45);
      }
      if (this.controls.down) {
        activeWorm.angle = Math.max(-15, activeWorm.angle - dt * 45);
      }

      // Power Charging Controls (Press and hold FIRE)
      if (this.controls.fire) {
        if (this.turnPhase === 'AIM') {
          this.turnPhase = 'CHARGING';
          this.chargeRatio = 0.05;
        }
        // Increment charge
        this.chargeRatio = Math.min(1.0, this.chargeRatio + this.chargeSpeed * dt);
        sound.playCharge(this.chargeRatio);
      } else if (this.turnPhase === 'CHARGING') {
        // Released FIRE button -> Launch Bazooka!
        this.fireBazooka(activeWorm);
      }
    }

    // 2-Second Post-Fire Maneuver & Retreat Window (Exactly 2000ms)
    if (this.turnPhase === 'PROJECTILE_FLYING' && this.postFireMoveTimer > 0) {
      this.postFireMoveTimer = Math.max(0, this.postFireMoveTimer - dt);

      const isAITurn = this.gameMode === 'SINGLE' && this.activeTeam === 'right';
      const isRemoteTurn = this.gameMode === 'ONLINE_1V1' && this.activeTeam !== this.localPlayerTeam;

      if (!isAITurn && !isRemoteTurn) {
        // Jump input during retreat
        if (this.controls.jump && activeWorm.isGrounded) {
          this.executeJump(activeWorm);
        }

        // Ground walking input during retreat (ONLY when grounded!)
        if (activeWorm.isGrounded) {
          if (this.controls.left) {
            this.moveWorm(activeWorm, -1, dt);
          } else if (this.controls.right) {
            this.moveWorm(activeWorm, 1, dt);
          } else {
            activeWorm.walkTimer = 0;
          }
        }
      }

      if (this.postFireMoveTimer <= 0) {
        activeWorm.walkTimer = 0;
        this.controls.left = false;
        this.controls.right = false;
        this.controls.jump = false;
      }
    }
  }

  private updateAIBot(aiWorm: Worm, dt: number) {
    const targetWorm = this.worms.find((w) => w.id === 'left');
    if (!targetWorm || targetWorm.isDead) return;

    if (this.aiState === 'IDLE') {
      this.aiState = 'THINKING';
      this.aiTimer = 0.7; // 0.7s delay to feel human-like
    } else if (this.aiState === 'THINKING') {
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        // Calculate ballistic trajectory towards player
        const dx = targetWorm.x - aiWorm.x;
        aiWorm.facing = dx >= 0 ? 1 : -1;
        const dist = Math.abs(dx);

        // Select nominal launch angle (35 to 60 deg)
        let chosenAngle = 45;
        if (dist > 800) chosenAngle = 40;
        else if (dist < 300) chosenAngle = 55;

        // Ballistic physics compensation:
        // Nominal speed = sqrt(dist * g / sin(2*theta)) - wind * 20 * facing
        const g = 460;
        const rad = (chosenAngle * Math.PI) / 180;
        const sin2 = Math.max(0.2, Math.sin(2 * rad));
        const idealSpeed = Math.sqrt((dist * g) / sin2) - this.wind * 25 * aiWorm.facing;

        // Map speed (280 to 950) to chargeRatio (0 to 1.0)
        let rawPower = (idealSpeed - 280) / (950 - 280);
        rawPower = Math.max(0.15, Math.min(0.98, rawPower));

        // Apply difficulty error:
        let angleError = 0;
        let powerError = 0;
        if (this.aiDifficulty === 'KOLAY') {
          angleError = (Math.random() - 0.5) * 22; // ±11 deg
          powerError = (Math.random() - 0.5) * 0.32; // ±16%
        } else if (this.aiDifficulty === 'NORMAL') {
          angleError = (Math.random() - 0.5) * 8; // ±4 deg
          powerError = (Math.random() - 0.5) * 0.12; // ±6%
        } else if (this.aiDifficulty === 'ZOR') {
          angleError = (Math.random() - 0.5) * 2.5; // ±1.25 deg
          powerError = (Math.random() - 0.5) * 0.04; // ±2%
        }

        this.aiTargetAngle = Math.max(10, Math.min(80, Math.round(chosenAngle + angleError)));
        this.aiTargetPower = Math.max(0.12, Math.min(1.0, rawPower + powerError));
        this.aiState = 'AIMING';
      }
    } else if (this.aiState === 'AIMING') {
      // Smoothly rotate bazooka to target angle
      const diff = this.aiTargetAngle - aiWorm.angle;
      if (Math.abs(diff) < 2) {
        aiWorm.angle = this.aiTargetAngle;
        this.aiState = 'CHARGING';
        this.turnPhase = 'CHARGING';
        this.chargeRatio = 0.05;
      } else {
        aiWorm.angle += Math.sign(diff) * dt * 50;
      }
    } else if (this.aiState === 'CHARGING') {
      this.chargeRatio = Math.min(1.0, this.chargeRatio + this.chargeSpeed * dt);
      sound.playCharge(this.chargeRatio);

      if (this.chargeRatio >= this.aiTargetPower) {
        this.fireBazooka(aiWorm);
        this.aiState = 'FIRED';
      }
    }
  }

  public executeJump(worm: Worm) {
    if (!worm.isGrounded || worm.isDead) return;
    worm.isGrounded = false;
    worm.vy = -285; // Clean parabolic leap

    // Horizontal momentum preservation
    if (this.controls.left) {
      worm.vx = -80;
      worm.facing = -1;
    } else if (this.controls.right) {
      worm.vx = 80;
      worm.facing = 1;
    } else {
      if (Math.abs(worm.vx) > 10) {
        worm.vx = Math.sign(worm.vx) * 80;
      } else {
        worm.vx = worm.facing * 40;
      }
    }

    sound.playJump();

    // Jump dust particles
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: worm.x + (Math.random() - 0.5) * 12,
        y: worm.y,
        vx: (Math.random() - 0.5) * 35 - worm.vx * 0.2,
        vy: -Math.random() * 25,
        color: '#cbd5e1',
        size: 2.5 + Math.random() * 2,
        life: 0.3,
        maxLife: 0.3,
      });
    }
  }

  private moveWorm(worm: Worm, dir: 1 | -1, dt: number) {
    if (!worm.isGrounded) return; // STRICT SAFETY: Never snap Y or override physics while airborne!

    worm.facing = dir;
    worm.walkTimer += dt;
    const moveDist = 55 * dt;
    const targetX = worm.x + dir * moveDist;

    // Check climbable step or slope
    const currentGroundY = this.terrain.getGroundY(targetX, worm.y - 12);
    const heightDiff = currentGroundY - worm.y;

    // Climb slope if not too steep (up to 7px per step)
    if (heightDiff >= -8 && currentGroundY < this.terrain.waterLevel + 10) {
      worm.x = targetX;
      worm.y = currentGroundY;
      worm.isGrounded = true;

      if (Math.floor(worm.walkTimer * 5) % 2 === 0) {
        sound.playWalk();
      }
    }
  }

  public fireBazooka(worm: Worm) {
    if (this.turnPhase !== 'CHARGING' && this.turnPhase !== 'AIM') return;

    this.turnPhase = 'PROJECTILE_FLYING';
    sound.playFire();

    // Initiate 2000 ms movement window for firing player to retreat/reposition
    this.postFireMoveTimer = 2.0;
    this.addFloatingText(worm.x, worm.y - 45, '2s HAREKET!', '#38bdf8');

    const muzzle = this.renderer.getBazookaMuzzle(worm);
    const angleRad = (worm.angle * Math.PI) / 180;

    // Initial speed based on charged power (from 280 to 950 px/s)
    const baseSpeed = 280;
    const maxSpeed = 950;
    const speed = baseSpeed + this.chargeRatio * (maxSpeed - baseSpeed);

    const vx = Math.cos(angleRad) * speed * worm.facing;
    const vy = -Math.sin(angleRad) * speed;

    this.projectile = {
      x: muzzle.x,
      y: muzzle.y,
      vx,
      vy,
      radius: 4,
      active: true,
      team: worm.id,
      angle: -angleRad * worm.facing,
      trail: [],
    };

    // If local player in online mode, notify online listener
    if (this.gameMode === 'ONLINE_1V1' && worm.id === this.localPlayerTeam && this.onFireCallback) {
      this.onFireCallback({
        team: worm.id,
        angle: worm.angle,
        facing: worm.facing,
        powerRatio: this.chargeRatio,
        wind: this.wind,
        x: worm.x,
        y: worm.y,
      });
    }

    // Muzzle flash / smoke puff particles
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: (Math.random() - 0.5) * 60 + vx * 0.1,
        vy: (Math.random() - 0.5) * 60 + vy * 0.1,
        color: Math.random() > 0.5 ? '#f59e0b' : '#64748b',
        size: 3 + Math.random() * 4,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
      });
    }

    // Camera zooms in closely and tracks projectile
    this.resetManualPan();
    this.targetZoom = 1.7; // Prominently zoomed in to track rocket flight & target approach
    this.targetCamX = muzzle.x;
    this.targetCamY = muzzle.y;
    this.chargeRatio = 0;
  }

  // Execute remote player shot deterministically in online mode
  public applyRemoteFire(data: {
    team: 'left' | 'right';
    angle: number;
    facing: 1 | -1;
    powerRatio: number;
    wind: number;
    x?: number;
    y?: number;
  }) {
    const worm = this.worms.find((w) => w.id === data.team);
    if (!worm) return;

    if (data.x !== undefined && data.y !== undefined) {
      worm.x = data.x;
      worm.y = data.y;
    }
    worm.facing = data.facing;
    worm.angle = data.angle;
    this.chargeRatio = data.powerRatio;
    this.wind = data.wind;

    this.turnPhase = 'CHARGING';
    this.fireBazooka(worm);
  }

  private updateProjectilePhysics(dt: number) {
    if (!this.projectile || !this.projectile.active) return;

    const proj = this.projectile;
    const prevX = proj.x;
    const prevY = proj.y;

    // Wind applies horizontal acceleration:
    // wind (-4 to +4) * 50 px/s^2 for prominent drift!
    const windAcc = this.wind * 50;
    proj.vx += windAcc * dt;

    // Gravity
    const gravity = 460;
    proj.vy += gravity * dt;

    // Move projectile
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    // Update rocket flight angle
    proj.angle = Math.atan2(proj.vy, proj.vx);

    // Record trail
    proj.trail.unshift({ x: proj.x, y: proj.y, alpha: 0.8, size: 4 });
    if (proj.trail.length > 18) {
      proj.trail.pop();
    }
    for (const t of proj.trail) {
      t.alpha -= dt * 1.5;
    }

    // Exhaust particle
    if (Math.random() < 0.85) {
      this.particles.push({
        x: proj.x - Math.cos(proj.angle) * 8,
        y: proj.y - Math.sin(proj.angle) * 8,
        vx: (Math.random() - 0.5) * 20 - proj.vx * 0.1,
        vy: (Math.random() - 0.5) * 20 - proj.vy * 0.1,
        color: Math.random() > 0.4 ? '#f97316' : '#cbd5e1',
        size: 2.5 + Math.random() * 2,
        life: 0.4,
        maxLife: 0.4,
      });
    }

    // Check direct worm collision
    for (const worm of this.worms) {
      if (worm.isDead) continue;
      const dist = Math.hypot(proj.x - worm.x, proj.y - (worm.y - 10));
      if (dist < 16) {
        this.triggerExplosion(proj.x, proj.y);
        return;
      }
    }

    // Check terrain collision
    const hit = this.terrain.raycast(prevX, prevY, proj.x, proj.y);
    if (hit) {
      this.triggerExplosion(hit.x, hit.y);
      return;
    }

    // Check water impact
    if (proj.y >= this.terrain.waterLevel) {
      this.triggerWaterSplash(proj.x, this.terrain.waterLevel);
      return;
    }

    // Check world bounds exit
    if (proj.x < -100 || proj.x > this.terrain.width + 100 || proj.y > this.terrain.height + 150) {
      this.projectile.active = false;
      this.projectile = null;
      this.addFloatingText(this.camX, this.camY - 30, 'ISKA!', '#94a3b8');
      this.beginSettling();
    }
  }

  private triggerExplosion(x: number, y: number) {
    if (!this.projectile) return;
    this.projectile.active = false;
    this.projectile = null;

    this.turnPhase = 'EXPLOSION';
    this.postFireMoveTimer = 0; // End post-fire move on impact
    sound.playExplosion();
    this.screenShake = 16;
    this.targetCamX = x;
    this.targetCamY = y;
    this.targetZoom = 1.45; // Hold focus on explosion area

    const explosionRadius = 40;

    // 1. Physically Deform Terrain! (Cut out hole cleanly without outline circles)
    const removedDebris = this.terrain.carveHole(x, y, explosionRadius);

    // 2. Add Explosion Effect
    this.explosions.push({
      x,
      y,
      radius: explosionRadius,
      currentRadius: 8,
      maxRadius: explosionRadius,
      life: 0.55,
      maxLife: 0.55,
    });

    // 3. Blast Particles (Fire & Dirt)
    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      this.particles.push({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        color: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#f59e0b' : '#78350f',
        size: 3 + Math.random() * 4,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2,
        gravity: 400,
      });
    }

    // Dirt clods from crater
    for (const deb of removedDebris.slice(0, 16)) {
      this.particles.push({
        x: deb.x,
        y: deb.y,
        vx: (deb.x - x) * 4 + (Math.random() - 0.5) * 40,
        vy: (deb.y - y) * 4 - 80 - Math.random() * 80,
        color: '#5c2c16',
        size: 3,
        life: 0.8,
        maxLife: 0.8,
        gravity: 480,
      });
    }

    // 4. Calculate Damage & Knockback to Nearby Worms (Base weapon damage 40)
    for (const worm of this.worms) {
      if (worm.isDead) continue;
      const dist = Math.hypot(worm.x - x, (worm.y - 10) - y);
      const maxBlastDist = explosionRadius * 1.5;

      if (dist < maxBlastDist) {
        // Falloff with ~40-45 max damage
        const falloff = 1 - dist / maxBlastDist;
        const damage = Math.max(8, Math.round(falloff * 45));

        worm.hp = Math.max(0, worm.hp - damage);
        worm.damageFlash = 1.0;
        sound.playHit();

        this.addFloatingText(worm.x, worm.y - 30, `-${damage} HP`, '#ef4444');

        // Knockback physics impulse
        const angle = Math.atan2((worm.y - 10) - y, worm.x - x);
        const impulse = falloff * 280;
        worm.vx = Math.cos(angle) * impulse;
        worm.vy = Math.min(-90, Math.sin(angle) * impulse - 80);
        worm.isGrounded = false;

        if (worm.hp <= 0) {
          worm.isDead = true;
          this.addFloatingText(worm.x, worm.y - 50, 'YENİLDİ!', '#e11d48');
        }
      }
    }

    this.beginSettling();
  }

  private triggerWaterSplash(x: number, y: number) {
    if (this.projectile) {
      this.projectile.active = false;
      this.projectile = null;
    }
    this.postFireMoveTimer = 0;
    sound.playWaterSplash();
    this.screenShake = 6;

    // Splash water particles
    for (let i = 0; i < 24; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = 100 + Math.random() * 160;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#38bdf8',
        size: 3 + Math.random() * 3,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1.0,
        gravity: 420,
      });
    }

    this.addFloatingText(x, y - 25, 'SPLASH!', '#38bdf8');
    this.beginSettling();
  }

  private beginSettling() {
    this.turnPhase = 'SETTLING';
    setTimeout(() => {
      this.checkSettlingAndNextTurn();
    }, 1400);
  }

  private checkSettlingAndNextTurn() {
    const leftWorm = this.worms.find((w) => w.id === 'left');
    const rightWorm = this.worms.find((w) => w.id === 'right');

    if (leftWorm && leftWorm.isDead && rightWorm && rightWorm.isDead) {
      this.isGameOver = true;
      this.winnerText = 'BERABERE!';
      sound.playWin();
      if (this.onStateChangeCallback) this.onStateChangeCallback();
      return;
    }

    if (leftWorm && leftWorm.isDead) {
      this.isGameOver = true;
      this.winnerText = `${this.playerNames.right.toUpperCase()} KAZANDI!`;
      sound.playWin();
      if (this.onStateChangeCallback) this.onStateChangeCallback();
      return;
    }

    if (rightWorm && rightWorm.isDead) {
      this.isGameOver = true;
      this.winnerText = `${this.playerNames.left.toUpperCase()} KAZANDI!`;
      sound.playWin();
      if (this.onStateChangeCallback) this.onStateChangeCallback();
      return;
    }

    // Switch turn
    this.switchTurn();
  }

  public switchTurn() {
    this.activeTeam = this.activeTeam === 'left' ? 'right' : 'left';
    this.turnPhase = 'AIM';
    this.turnTimer = 30.0;
    this.postFireMoveTimer = 0;
    this.chargeRatio = 0;
    this.randomizeWind();
    this.targetZoom = 1.0;
    this.resetManualPan();

    // Reset controls
    this.controls.left = false;
    this.controls.right = false;
    this.controls.up = false;
    this.controls.down = false;
    this.controls.fire = false;
    this.controls.jump = false;

    // Reset AI state
    this.aiState = 'IDLE';
    this.aiTimer = 0;

    sound.playTurn();

    const activeW = this.getActiveWorm();
    if (activeW) {
      this.addFloatingText(
        activeW.x,
        activeW.y - 45,
        `SIRA: ${activeW.id === 'left' ? this.playerNames.left.toUpperCase() : this.playerNames.right.toUpperCase()}`,
        activeW.id === 'left' ? '#f43f5e' : '#0ea5e9'
      );
    }

    if (this.onStateChangeCallback) this.onStateChangeCallback();
  }

  private updateWormPhysics(dt: number) {
    const gravity = 480;

    for (const worm of this.worms) {
      if (worm.drowned) continue;

      // Check if worm fell into ocean
      if (worm.y >= this.terrain.waterLevel) {
        worm.hp = 0;
        worm.isDead = true;
        worm.drowned = true;
        this.triggerWaterSplash(worm.x, this.terrain.waterLevel);
        this.addFloatingText(worm.x, this.terrain.waterLevel - 30, 'BOĞULDU!', '#38bdf8');
        continue;
      }

      // If in air, apply physical gravity and momentum-based horizontal movement
      if (!worm.isGrounded) {
        // Continuous gravity acceleration
        worm.vy += gravity * dt;

        // In-air steering for controlled active worm (in AIM, CHARGING, or post-fire 2s move window)
        const canControl = worm.id === this.activeTeam &&
          (this.turnPhase === 'AIM' || this.turnPhase === 'CHARGING' || (this.turnPhase === 'PROJECTILE_FLYING' && this.postFireMoveTimer > 0));

        const isAITurn = this.gameMode === 'SINGLE' && this.activeTeam === 'right';
        const isRemoteTurn = this.gameMode === 'ONLINE_1V1' && this.activeTeam !== this.localPlayerTeam;

        if (canControl && !isAITurn && !isRemoteTurn) {
          if (this.controls.left && !this.controls.fire) {
            worm.facing = -1;
            // Smooth gradual acceleration in air towards left
            worm.vx = Math.max(-85, worm.vx - 320 * dt);
          } else if (this.controls.right && !this.controls.fire) {
            worm.facing = 1;
            // Smooth gradual acceleration in air towards right
            worm.vx = Math.min(85, worm.vx + 320 * dt);
          } else {
            // Gentle air drag when no horizontal key is held
            worm.vx *= Math.max(0, 1 - dt * 1.5);
          }
        } else {
          // Passive air drag on blast knockback
          worm.vx *= Math.max(0, 1 - dt * 2.0);
        }

        // 1. Horizontal movement with solid wall / cliff collision
        const nextX = worm.x + worm.vx * dt;
        const sideCheckX = worm.vx > 0 ? nextX + 5 : nextX - 5;
        if (this.terrain.isSolid(sideCheckX, worm.y - 8)) {
          worm.vx = 0;
        } else {
          worm.x = nextX;
        }

        // 2. Vertical movement with ceiling and ground contact checks
        const nextY = worm.y + worm.vy * dt;

        if (worm.vy < 0) {
          // Worm is rising upwards in parabola: check ceiling
          if (this.terrain.isSolid(worm.x, nextY - 14)) {
            worm.vy = 0;
          }
          worm.y = nextY;
        } else {
          // Worm is falling downwards: check ground contact
          const groundY = this.terrain.getGroundY(worm.x, worm.y - 6);
          if (nextY >= groundY) {
            // Physical contact with ground established!
            worm.y = groundY;
            worm.vy = 0;
            worm.vx = 0;
            worm.isGrounded = true;
          } else {
            // Still descending in mid-air
            worm.y = nextY;
          }
        }
      } else {
        // Worm is grounded: check if the ground beneath it was blasted away!
        if (!this.terrain.isSolid(worm.x, worm.y + 1)) {
          // Ground fell away -> worm starts falling
          worm.isGrounded = false;
        }
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.gravity) {
        p.vy += p.gravity * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private updateExplosions(dt: number) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.life -= dt;
      const progress = 1 - exp.life / exp.maxLife;
      exp.currentRadius = exp.maxRadius * Math.min(1, progress * 1.4);

      if (exp.life <= 0) {
        this.explosions.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= dt;
      t.y -= dt * 24; // Rise upward
      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({
      id: this.nextTextId++,
      x,
      y,
      text,
      color,
      life: 1.5,
      maxLife: 1.5,
    });
  }

  private updateCamera(dt: number) {
    // Determine Target Camera Position
    if (this.projectile && this.projectile.active) {
      this.targetCamX = this.projectile.x;
      this.targetCamY = this.projectile.y;
      this.targetZoom = 1.7; // Closer zoom to showcase rocket flight and impact
    } else if (this.explosions.length > 0) {
      this.targetCamX = this.explosions[0].x;
      this.targetCamY = this.explosions[0].y;
      this.targetZoom = 1.45; // Hold focus on explosion zone
    } else if (this.isManualPanning) {
      this.manualPanTimer -= dt;
      if (this.manualPanTimer <= 0) {
        this.isManualPanning = false;
      }
      this.targetZoom = 1.0;
      const activeWorm = this.getActiveWorm();
      this.targetCamY = activeWorm ? activeWorm.y - 70 : 550;
    } else {
      const activeWorm = this.getActiveWorm();
      if (activeWorm) {
        this.targetCamX = activeWorm.x + activeWorm.facing * 40;
        this.targetCamY = activeWorm.y - 70;
      }
      this.targetZoom = 1.0;
    }

    // Clamp camera within world bounds so world does not go offscreen
    const minCamX = 220;
    const maxCamX = this.terrain.width - 220;
    const minCamY = 160;
    const maxCamY = 740;

    this.targetCamX = Math.max(minCamX, Math.min(maxCamX, this.targetCamX));
    this.targetCamY = Math.max(minCamY, Math.min(maxCamY, this.targetCamY));

    // Smooth lerping: tight tracking for projectile so it remains centered
    const isProjectile = Boolean(this.projectile && this.projectile.active);
    const lerpSpeed = isProjectile ? 14.0 * dt : (this.isManualPanning ? 12.0 * dt : 5.0 * dt);
    this.camX += (this.targetCamX - this.camX) * lerpSpeed;
    this.camY += (this.targetCamY - this.camY) * lerpSpeed;

    const zoomLerpSpeed = isProjectile ? 6.0 * dt : 4.0 * dt;
    this.zoom += (this.targetZoom - this.zoom) * zoomLerpSpeed;
  }

  public render() {
    if (!this.canvas || !this.ctx) return;

    let finalCamX = this.camX;
    let finalCamY = this.camY;

    if (this.screenShake > 0) {
      finalCamX += (Math.random() - 0.5) * this.screenShake;
      finalCamY += (Math.random() - 0.5) * this.screenShake;
    }

    this.renderer.render(
      this.ctx,
      this.canvas.width,
      this.canvas.height,
      finalCamX,
      finalCamY,
      this.zoom,
      this.terrain,
      this.worms,
      this.getActiveWorm(),
      this.projectile,
      this.particles,
      this.explosions,
      this.floatingTexts,
      this.turnPhase,
      this.chargeRatio,
      this.wind
    );
  }
}
