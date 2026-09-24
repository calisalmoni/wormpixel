export type Team = 'left' | 'right';

export interface Worm {
  id: Team;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  angle: number; // in degrees, e.g. 45
  facing: 1 | -1; // 1 = right, -1 = left
  isGrounded: boolean;
  animFrame: number;
  walkTimer: number;
  isDead: boolean;
  drowned: boolean;
  damageFlash: number;
  color: string;
  headbandColor: string;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  active: boolean;
  team: Team;
  angle: number;
  trail: { x: number; y: number; alpha: number; size: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  gravity?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ExplosionEffect {
  x: number;
  y: number;
  radius: number;
  currentRadius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

export type GameMode = 'SINGLE' | 'LOCAL_2P' | 'ONLINE_1V1';

export type AIDifficulty = 'KOLAY' | 'NORMAL' | 'ZOR';

export interface PlayerProfile {
  name: string;
  avatar: string;
  stats: {
    played: number;
    wins: number;
    losses: number;
  };
}

export interface GameSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface OnlineRoom {
  code: string;
  status: 'WAITING' | 'PLAYING' | 'FINISHED' | 'DISCONNECTED';
  players: {
    left: { name: string; avatar: string; ready: boolean };
    right: { name: string; avatar: string; ready: boolean } | null;
  };
  currentTurn: Team;
  seed: number;
  wind: number;
  lastAction?: {
    type: 'FIRE' | 'MOVE' | 'ANGLE';
    team: Team;
    angle: number;
    facing: 1 | -1;
    powerRatio?: number;
    wind?: number;
    x?: number;
    y?: number;
    timestamp: number;
  } | null;
  lastUpdated: number;
}

export type TurnPhase = 
  | 'AIM' 
  | 'CHARGING' 
  | 'FIRING' 
  | 'PROJECTILE_FLYING' 
  | 'EXPLOSION' 
  | 'SETTLING' 
  | 'TURN_TRANSITION';

export interface ControlState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  jump: boolean;
}
