export class TerrainManager {
  public readonly width: number = 2400;
  public readonly height: number = 900;
  public readonly waterLevel: number = 830;

  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public alphaMap: Uint8Array;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to create 2d context for terrain');
    }
    this.ctx = context;
    this.alphaMap = new Uint8Array(this.width * this.height);
    this.generateIsland(12345);
  }

  public generateIsland(seed: number = 12345) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.alphaMap.fill(0);

    const sOffset = (seed % 1000) * 0.1;
    // Multi-harmonic procedural height curve
    const heights: number[] = new Array(this.width);
    const islandStart = 180;
    const islandEnd = this.width - 180;

    for (let x = 0; x < this.width; x++) {
      if (x < islandStart || x > islandEnd) {
        heights[x] = this.height + 50; // Below water
        continue;
      }

      // Smooth cliff dropoffs at the edges
      const distFromEdge = Math.min(x - islandStart, islandEnd - x);
      const edgeFactor = Math.min(1, distFromEdge / 180);
      const edgeCurve = Math.sin((edgeFactor * Math.PI) / 2);

      // Procedural undulating hills & valleys
      const baseH = 560;
      const h1 = Math.sin((x + sOffset) * 0.005) * 80;
      const h2 = Math.sin((x + sOffset) * 0.012 + 1.2) * 55;
      const h3 = Math.cos((x + sOffset) * 0.024 + 0.5) * 35;
      const h4 = Math.sin((x + sOffset) * 0.048) * 15;
      const h5 = Math.cos((x + sOffset) * 0.09) * 8;

      // Small central plateau or gentle dip
      const rawY = baseH + (h1 + h2 + h3 + h4 + h5);
      // Apply edge dropoff into ocean
      const finalY = (this.waterLevel + 40) * (1 - edgeCurve) + rawY * edgeCurve;
      heights[x] = Math.round(Math.min(this.waterLevel + 40, Math.max(340, finalY)));
    }

    // Draw the dirt and rock layers onto the offscreen canvas
    for (let x = 0; x < this.width; x++) {
      const topY = heights[x];
      if (topY >= this.height) continue;

      for (let y = topY; y < this.height; y++) {
        const depth = y - topY;

        // Pixel-art dirt texturing
        let fillStyle = '#8c502b'; // Medium earth

        if (depth < 6) {
          // Lush top grass
          fillStyle = '#22c55e'; // Bright green
        } else if (depth < 12) {
          // Darker green grass root soil
          fillStyle = '#15803d';
        } else if (depth < 70) {
          // Rich topsoil with dithered speckles
          const dither = (x * 7 + y * 13) % 17;
          fillStyle = dither < 4 ? '#78350f' : dither < 8 ? '#9a3412' : '#8c502b';
        } else {
          // Deeper rock and compacted stratum
          const dither = (x * 11 + y * 19) % 23;
          if (dither === 0 || dither === 1) {
            fillStyle = '#475569'; // Slate rock boulder
          } else if (dither === 2) {
            fillStyle = '#334155'; // Dark granite
          } else if (dither === 3) {
            fillStyle = '#b45309'; // Clay deposit
          } else {
            fillStyle = '#5c2c16'; // Deep earth
          }
        }

        this.ctx.fillStyle = fillStyle;
        this.ctx.fillRect(x, y, 1, 1);
        this.alphaMap[y * this.width + x] = 1;
      }

      // Add charming pixel-art grass blades and tiny flowers on top
      if (topY < this.waterLevel - 10 && x % 4 === 0) {
        this.ctx.fillStyle = '#4ade80';
        this.ctx.fillRect(x, topY - 2, 1, 2);
        this.alphaMap[(topY - 2) * this.width + x] = 1;
        this.alphaMap[(topY - 1) * this.width + x] = 1;

        if (x % 24 === 0) {
          // Tiny red or yellow blossom
          this.ctx.fillStyle = x % 48 === 0 ? '#ef4444' : '#facc15';
          this.ctx.fillRect(x, topY - 3, 2, 2);
          this.alphaMap[(topY - 3) * this.width + x] = 1;
        }
      }
    }
  }

  public isSolid(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) {
      return false;
    }
    return this.alphaMap[iy * this.width + ix] === 1;
  }

  public getGroundY(x: number, startY: number): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return this.height + 100;

    const clampStartY = Math.max(0, Math.min(this.height - 1, Math.floor(startY)));
    for (let y = clampStartY; y < this.height; y++) {
      if (this.alphaMap[y * this.width + ix] === 1) {
        return y;
      }
    }
    return this.height + 100; // In water or void
  }

  public carveHole(cx: number, cy: number, radius: number): { x: number; y: number }[] {
    const intRadius = Math.ceil(radius);
    const minX = Math.max(0, Math.floor(cx - intRadius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + intRadius));
    const minY = Math.max(0, Math.floor(cy - intRadius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + intRadius));

    // Cut hole from canvas using destination-out cleanly without artificial circle outline
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Update alphaMap
    const rSq = radius * radius;
    const removedPixels: { x: number; y: number }[] = [];

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      const rowOffset = y * this.width;

      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        if (dx * dx + dySq <= rSq) {
          const idx = rowOffset + x;
          if (this.alphaMap[idx] === 1) {
            this.alphaMap[idx] = 0;
            if ((x + y) % 6 === 0) {
              removedPixels.push({ x, y });
            }
          }
        }
      }
    }

    return removedPixels;
  }

  public raycast(
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): { hit: boolean; x: number; y: number } | null {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy);
    const steps = Math.ceil(distance * 1.5);
    if (steps <= 0) return null;

    const stepX = dx / steps;
    const stepY = dy / steps;

    let currX = x0;
    let currY = y0;

    for (let i = 0; i <= steps; i++) {
      if (this.isSolid(currX, currY)) {
        return { hit: true, x: currX, y: currY };
      }
      currX += stepX;
      currY += stepY;
    }

    return null;
  }

  public getSpawnPoints(): { left: { x: number; y: number }; right: { x: number; y: number } } {
    const leftX = 520;
    const rightX = 1880;
    const leftY = this.getGroundY(leftX, 200);
    const rightY = this.getGroundY(rightX, 200);

    return {
      left: { x: leftX, y: leftY },
      right: { x: rightX, y: rightY },
    };
  }
}
