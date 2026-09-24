import { Worm, Projectile, Particle, FloatingText, ExplosionEffect, TurnPhase } from './types';
import { TerrainManager } from './terrain';

export class GameRenderer {
  private clouds: { x: number; y: number; speed: number; width: number; height: number }[] = [];
  private stars: { x: number; y: number; size: number; alpha: number }[] = [];
  private waterTime: number = 0;

  constructor() {
    // Distant pixel clouds
    for (let i = 0; i < 9; i++) {
      this.clouds.push({
        x: Math.random() * 2600,
        y: 60 + Math.random() * 180,
        speed: 0.15 + Math.random() * 0.25,
        width: 80 + Math.random() * 90,
        height: 24 + Math.random() * 20,
      });
    }

    // Twilight twinkle stars in upper sky
    for (let i = 0; i < 40; i++) {
      this.stars.push({
        x: Math.random() * 2400,
        y: Math.random() * 250,
        size: Math.random() > 0.8 ? 2 : 1,
        alpha: 0.4 + Math.random() * 0.6,
      });
    }
  }

  public updateBackground(wind: number, dt: number) {
    this.waterTime += dt * 3;
    const windSpeedFactor = wind * 12;

    for (const cloud of this.clouds) {
      cloud.x += (cloud.speed * 20 + windSpeedFactor) * dt;
      if (cloud.x > 2600) cloud.x = -cloud.width;
      if (cloud.x < -cloud.width) cloud.x = 2600;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    camX: number,
    camY: number,
    zoom: number,
    terrain: TerrainManager,
    worms: Worm[],
    activeWorm: Worm | null,
    projectile: Projectile | null,
    particles: Particle[],
    explosions: ExplosionEffect[],
    floatingTexts: FloatingText[],
    turnPhase: TurnPhase,
    chargeRatio: number,
    wind: number
  ) {
    ctx.save();
    // Clear screen
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Apply Camera Transform
    ctx.save();
    // Center around camera focus
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // 1. Draw Sunset Sky with Parallax
    this.drawSky(ctx, terrain.width, terrain.height, camX, camY);

    // 2. Draw Distant Mountains / Island Silhouettes
    this.drawParallaxMountains(ctx, terrain.width, camX);

    // 3. Draw Sunset Clouds
    this.drawClouds(ctx);

    // 4. Draw Ocean Background Layer
    this.drawWaterBack(ctx, terrain.width, terrain.waterLevel);

    // 5. Draw Island Terrain Canvas
    ctx.drawImage(terrain.canvas, 0, 0);

    // 6. Draw Ocean Foreground & Waves
    this.drawWaterFore(ctx, terrain.width, terrain.waterLevel);

    // 7. Draw Worms
    for (const worm of worms) {
      const isActive = activeWorm?.id === worm.id;
      this.drawWorm(ctx, worm, isActive);
    }

    // 8. Draw Aim Guide & Power Bar (Only for active worm in aiming/charging phase)
    if (activeWorm && !activeWorm.isDead && (turnPhase === 'AIM' || turnPhase === 'CHARGING')) {
      const muzzle = this.getBazookaMuzzle(activeWorm);

      // Trajectory dots (Nişan Çizgisi)
      if (turnPhase === 'AIM' || turnPhase === 'CHARGING') {
        this.drawAimTrajectory(ctx, muzzle.x, muzzle.y, activeWorm, wind, terrain);
      }

      // Güç Barı: Directly from bazooka tip extending outward!
      if (turnPhase === 'CHARGING' || chargeRatio > 0.02) {
        this.drawBazookaPowerBar(ctx, muzzle.x, muzzle.y, activeWorm, chargeRatio);
      }
    }

    // 9. Draw Projectile
    if (projectile && projectile.active) {
      this.drawProjectile(ctx, projectile);
    }

    // 10. Draw Particles
    this.drawParticles(ctx, particles);

    // 11. Draw Explosion Blasts
    this.drawExplosions(ctx, explosions);

    // 12. Draw Floating Damage Text
    this.drawFloatingTexts(ctx, floatingTexts);

    ctx.restore(); // Restore Camera Transform

    ctx.restore(); // Restore Canvas Base
  }

  private drawSky(ctx: CanvasRenderingContext2D, worldW: number, worldH: number, camX: number, camY: number) {
    // Sunset gradient from twilight purple to golden amber
    const skyGrad = ctx.createLinearGradient(0, 0, 0, worldH * 0.85);
    skyGrad.addColorStop(0.0, '#160b2e'); // Deep night purple
    skyGrad.addColorStop(0.28, '#2d144d'); // Violet
    skyGrad.addColorStop(0.55, '#6d2159'); // Wine red
    skyGrad.addColorStop(0.72, '#b83b38'); // Crimson
    skyGrad.addColorStop(0.86, '#e86e30'); // Sunset orange
    skyGrad.addColorStop(1.0, '#f9af3b'); // Golden horizon

    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, worldW, worldH);

    // Pixel stars in upper sky
    ctx.fillStyle = '#ffffff';
    for (const star of this.stars) {
      ctx.globalAlpha = star.alpha * (0.8 + 0.2 * Math.sin(this.waterTime + star.x));
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1.0;

    // Giant Pixel Sun at sunset horizon
    const sunX = worldW * 0.52;
    const sunY = 530;
    const sunRadius = 68;

    // Sun outer glow
    ctx.fillStyle = 'rgba(255, 170, 50, 0.18)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Sun core (pixelated disc)
    ctx.fillStyle = '#ffde59';
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal sunset heat lines slicing across the lower half of the sun
    ctx.fillStyle = '#e86e30';
    for (let i = 0; i < 6; i++) {
      const sliceY = sunY + 8 + i * 9;
      const sliceH = 2 + i * 0.8;
      ctx.fillRect(sunX - sunRadius - 10, sliceY, (sunRadius + 10) * 2, sliceH);
    }
  }

  private drawParallaxMountains(ctx: CanvasRenderingContext2D, worldW: number, camX: number) {
    // Distant mountain ridge (slow parallax)
    const offset = camX * 0.12;

    ctx.fillStyle = '#3a134a';
    ctx.beginPath();
    ctx.moveTo(-100, 720);
    const peaks = [
      [100, 480], [320, 540], [550, 430], [800, 520], [1050, 450],
      [1300, 560], [1600, 420], [1900, 510], [2150, 460], [2400, 530], [2650, 470]
    ];
    for (const [px, py] of peaks) {
      ctx.lineTo(px - offset, py);
    }
    ctx.lineTo(worldW + 200, 750);
    ctx.lineTo(-100, 750);
    ctx.closePath();
    ctx.fill();

    // Mid-distance hills (slightly faster parallax)
    const midOffset = camX * 0.22;
    ctx.fillStyle = '#26113b';
    ctx.beginPath();
    ctx.moveTo(-100, 740);
    const midPeaks = [
      [80, 560], [280, 600], [520, 540], [740, 610], [980, 530],
      [1250, 590], [1520, 530], [1780, 620], [2050, 550], [2300, 610], [2600, 560]
    ];
    for (const [px, py] of midPeaks) {
      ctx.lineTo(px - midOffset, py);
    }
    ctx.lineTo(worldW + 200, 780);
    ctx.lineTo(-100, 780);
    ctx.closePath();
    ctx.fill();
  }

  private drawClouds(ctx: CanvasRenderingContext2D) {
    for (const cloud of this.clouds) {
      ctx.fillStyle = 'rgba(245, 160, 110, 0.45)';
      // Pixel cloud block shape
      const w = cloud.width;
      const h = cloud.height;
      ctx.fillRect(cloud.x, cloud.y, w, h);
      ctx.fillRect(cloud.x + 12, cloud.y - 8, w - 24, 8);
      ctx.fillRect(cloud.x + 24, cloud.y - 14, w - 48, 6);
      ctx.fillStyle = 'rgba(255, 215, 175, 0.6)';
      ctx.fillRect(cloud.x + 8, cloud.y + 4, w - 16, 4);
    }
  }

  private drawWaterBack(ctx: CanvasRenderingContext2D, worldW: number, waterY: number) {
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, 900);
    waterGrad.addColorStop(0, '#1e3a8a'); // Deep navy blue
    waterGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, worldW, 900 - waterY);
  }

  private drawWaterFore(ctx: CanvasRenderingContext2D, worldW: number, waterY: number) {
    // Animated pixel wave crests
    ctx.fillStyle = '#38bdf8'; // Cyan foam
    for (let x = 0; x < worldW; x += 16) {
      const wave = Math.sin(x * 0.04 + this.waterTime) * 3;
      ctx.fillRect(x, waterY + wave, 12, 2);
    }

    ctx.fillStyle = '#1d4ed8'; // Darker blue body wave
    for (let x = 0; x < worldW; x += 24) {
      const wave = Math.sin(x * 0.03 + this.waterTime * 0.8) * 4;
      ctx.fillRect(x + 4, waterY + 4 + wave, 16, 3);
    }
  }

  public getBazookaMuzzle(worm: Worm): { x: number; y: number; angleRad: number } {
    const angleRad = (worm.angle * Math.PI) / 180;
    const barrelLen = 18;
    const shoulderX = worm.x + worm.facing * 3;
    const shoulderY = worm.y - 11;

    const muzzleX = shoulderX + Math.cos(angleRad) * barrelLen * worm.facing;
    const muzzleY = shoulderY - Math.sin(angleRad) * barrelLen;

    return { x: muzzleX, y: muzzleY, angleRad };
  }

  private drawWorm(ctx: CanvasRenderingContext2D, worm: Worm, isActive: boolean) {
    if (worm.isDead) {
      // Draw cute pixel tombstone
      this.drawTombstone(ctx, worm.x, worm.y, worm.id === 'left' ? 'SOL' : 'SAĞ');
      return;
    }

    ctx.save();
    ctx.translate(worm.x, worm.y);

    // Damage flash effect (turns white momentarily)
    const isFlashing = worm.damageFlash > 0;

    // Idle bobbing / walk accordion squeeze
    const bob = Math.sin(worm.animFrame * 0.25) * 1.5;
    const squishX = worm.walkTimer > 0 ? 1 + Math.sin(worm.walkTimer * 10) * 0.15 : 1;
    const squishY = worm.walkTimer > 0 ? 1 - Math.sin(worm.walkTimer * 10) * 0.12 : 1;

    // Active Worm Indicator (little bouncing arrow above head)
    if (isActive) {
      const arrowBob = Math.sin(worm.animFrame * 0.2) * 4;
      ctx.fillStyle = worm.id === 'left' ? '#f43f5e' : '#06b6d4';
      // Triangle down
      ctx.beginPath();
      ctx.moveTo(-6, -34 + arrowBob);
      ctx.lineTo(6, -34 + arrowBob);
      ctx.lineTo(0, -25 + arrowBob);
      ctx.closePath();
      ctx.fill();

      // Border for arrow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Name tag above worm
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText(`${worm.name} (${worm.hp})`, 1, -21);
    ctx.fillStyle = worm.id === 'left' ? '#fca5a5' : '#7dd3fc';
    ctx.fillText(`${worm.name} (${worm.hp})`, 0, -22);

    ctx.scale(worm.facing * squishX, squishY);

    // WORM BODY PIXEL ART
    const bodyColor = isFlashing ? '#ffffff' : (worm.id === 'left' ? '#fb7185' : '#38bdf8');
    const shadowColor = isFlashing ? '#e2e8f0' : (worm.id === 'left' ? '#e11d48' : '#0284c7');
    const outlineColor = '#0f172a';

    // Tail / rear segment
    ctx.fillStyle = shadowColor;
    ctx.fillRect(-12, -7 + bob, 6, 6);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-11, -8 + bob, 5, 5);

    // Middle body segment
    ctx.fillStyle = shadowColor;
    ctx.fillRect(-8, -12 + bob, 8, 10);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-7, -13 + bob, 7, 9);

    // Front / Chest segment
    ctx.fillStyle = shadowColor;
    ctx.fillRect(-3, -15 + bob, 9, 13);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-2, -16 + bob, 8, 12);

    // Headband / Bandana
    ctx.fillStyle = worm.headbandColor;
    ctx.fillRect(-2, -19 + bob, 9, 3);
    // Knot tails blowing slightly in the wind
    ctx.fillRect(-6, -18 + bob, 4, 2);
    ctx.fillRect(-8, -17 + bob, 3, 2);

    // Big expressive cute eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, -16 + bob, 4, 4); // Eye white
    ctx.fillStyle = '#000000';
    ctx.fillRect(4, -15 + bob, 2, 2); // Pupil looking forward

    // Mouth / Cheerful grin
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(3, -9 + bob, 2, 2);

    // BAZOOKA WEAPON
    this.drawWormBazooka(ctx, worm, bob);

    ctx.restore();
  }

  private drawWormBazooka(ctx: CanvasRenderingContext2D, worm: Worm, bob: number) {
    ctx.save();
    // Shoulder pivot point
    const pivotX = 2;
    const pivotY = -11 + bob;
    ctx.translate(pivotX, pivotY);

    // Bazooka rotation (0 to 90 degrees)
    const angleRad = -(worm.angle * Math.PI) / 180;
    ctx.rotate(angleRad);

    // Bazooka barrel body (pixelated tube)
    // Dark olive-grey steel
    ctx.fillStyle = '#334155';
    ctx.fillRect(-4, -4, 20, 7);

    // Bazooka top scope / sight
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(2, -7, 6, 3);
    ctx.fillStyle = '#ef4444'; // Red scope lens
    ctx.fillRect(7, -6, 2, 2);

    // Bazooka wooden shoulder stock & grip
    ctx.fillStyle = '#92400e';
    ctx.fillRect(-7, -1, 5, 5);
    ctx.fillRect(0, 3, 3, 5);

    // Bazooka muzzle flared rim
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(15, -5, 3, 9);

    // Rocket warhead peeking out of the muzzle before firing
    ctx.fillStyle = '#eab308'; // Yellow rocket tip
    ctx.fillRect(17, -3, 3, 5);
    ctx.fillStyle = '#dc2626'; // Red fuse tip
    ctx.fillRect(19, -2, 2, 3);

    ctx.restore();
  }

  private drawBazookaPowerBar(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    worm: Worm,
    chargeRatio: number
  ) {
    const angleRad = (worm.angle * Math.PI) / 180;
    const dirX = Math.cos(angleRad) * worm.facing;
    const dirY = -Math.sin(angleRad);

    const maxBarLength = 80;
    const currentLength = Math.max(6, maxBarLength * chargeRatio);
    const numBlocks = Math.floor(currentLength / 5);

    ctx.save();

    // Draw glowing power bar segments projecting forward from bazooka muzzle
    for (let i = 0; i < numBlocks; i++) {
      const segRatio = i / (maxBarLength / 5);
      const segDist = 4 + i * 5;
      const bx = startX + dirX * segDist;
      const by = startY + dirY * segDist;

      // Color shifts smoothly: Green -> Yellow -> Orange -> Electric Red
      let segColor = '#22c55e'; // Green
      if (segRatio > 0.75) {
        // High power: Flashing red/white if maxed
        segColor = chargeRatio >= 0.98 && Math.floor(Date.now() / 80) % 2 === 0 ? '#ffffff' : '#ef4444';
      } else if (segRatio > 0.45) {
        segColor = '#f97316'; // Orange
      } else if (segRatio > 0.2) {
        segColor = '#eab308'; // Yellow
      }

      ctx.fillStyle = '#0f172a'; // Segment outline
      ctx.fillRect(bx - 3, by - 3, 7, 7);

      ctx.fillStyle = segColor;
      ctx.fillRect(bx - 2, by - 2, 5, 5);
    }

    // Power text label near the tip of the power bar
    const labelX = startX + dirX * (currentLength + 12);
    const labelY = startY + dirY * (currentLength + 12);

    const powerPct = Math.round(chargeRatio * 100);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Label background tag
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(labelX - 18, labelY - 8, 36, 16);
    ctx.strokeStyle = chargeRatio >= 0.98 ? '#ef4444' : '#f59e0b';
    ctx.lineWidth = 1;
    ctx.strokeRect(labelX - 18, labelY - 8, 36, 16);

    ctx.fillStyle = chargeRatio >= 0.98 ? '#f87171' : '#fef08a';
    ctx.fillText(`${powerPct}%`, labelX, labelY);

    ctx.restore();
  }

  private drawAimTrajectory(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    worm: Worm,
    wind: number,
    terrain: TerrainManager
  ) {
    const angleRad = (worm.angle * Math.PI) / 180;
    // Estimated nominal launch speed
    const nominalSpeed = 620;
    const vx0 = Math.cos(angleRad) * nominalSpeed * worm.facing;
    const vy0 = -Math.sin(angleRad) * nominalSpeed;

    const gravity = 460;
    const windAcc = wind * 50;

    const numDots = 15;
    const timeStep = 0.08;

    ctx.save();
    for (let i = 1; i <= numDots; i++) {
      const t = i * timeStep;
      const px = startX + (vx0 + 0.5 * windAcc * t) * t;
      const py = startY + vy0 * t + 0.5 * gravity * t * t;

      if (px < 0 || px >= terrain.width || py >= terrain.height) break;
      if (terrain.isSolid(px, py)) {
        // Impact preview dot
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // Parabolic dotted guide
      const alpha = 1.0 - (i / numDots) * 0.6;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Outer contrasting ring
      ctx.strokeStyle = `rgba(15, 23, 42, ${alpha * 0.7})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawProjectile(ctx: CanvasRenderingContext2D, proj: Projectile) {
    ctx.save();

    // 1. Draw Smoke / Flame Exhaust Trail
    for (const trail of proj.trail) {
      ctx.fillStyle = `rgba(249, 115, 22, ${trail.alpha})`;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(226, 232, 240, ${trail.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(trail.x, trail.y, trail.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Draw Rocket Body
    ctx.translate(proj.x, proj.y);
    ctx.rotate(proj.angle);

    // Rocket body (pixelated missile)
    ctx.fillStyle = '#475569'; // Grey metal fuselage
    ctx.fillRect(-8, -3, 14, 6);

    // Red Warhead cone
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(6, -3);
    ctx.lineTo(12, 0);
    ctx.lineTo(6, 3);
    ctx.closePath();
    ctx.fill();

    // Black stabilization tail fins
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-9, -5, 3, 2);
    ctx.fillRect(-9, 3, 3, 2);

    // Fiery thruster plume at the back
    const flameFlicker = 3 + Math.random() * 4;
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-8 - flameFlicker, 0);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
    ctx.save();
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  private drawExplosions(ctx: CanvasRenderingContext2D, explosions: ExplosionEffect[]) {
    ctx.save();
    for (const exp of explosions) {
      const progress = 1 - exp.life / exp.maxLife;
      const radius = exp.currentRadius;

      // Fiery outer flash
      ctx.fillStyle = progress < 0.4 ? 'rgba(254, 240, 138, 0.9)' : 'rgba(249, 115, 22, 0.7)';
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner white-hot blast core
      if (progress < 0.35) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Outer shockwave ring
      ctx.strokeStyle = `rgba(239, 68, 68, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, radius * 1.15, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[]) {
    ctx.save();
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';

    for (const item of texts) {
      const alpha = Math.max(0, item.life / item.maxLife);
      ctx.globalAlpha = alpha;

      // Shadow
      ctx.fillStyle = '#000000';
      ctx.fillText(item.text, item.x + 1, item.y + 1);

      // Main text
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  private drawTombstone(ctx: CanvasRenderingContext2D, x: number, y: number, label: string) {
    ctx.save();
    ctx.translate(x, y);

    // Stone base
    ctx.fillStyle = '#334155';
    ctx.fillRect(-10, -3, 20, 4);

    // Tombstone arch
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-8, -18, 16, 15);
    ctx.beginPath();
    ctx.arc(0, -18, 8, Math.PI, 0);
    ctx.fill();

    // R.I.P cross
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-1, -19, 2, 8);
    ctx.fillRect(-4, -16, 8, 2);

    // Label
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('R.I.P', 0, -8);
    ctx.fillText(label, 0, -1);

    ctx.restore();
  }
}
