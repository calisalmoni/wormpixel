import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { sound } from './game/audio';
import { GameMode, AIDifficulty, PlayerProfile, GameSettings } from './game/types';
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Home, 
  Smartphone,
  Wind as WindIcon,
  Crosshair,
  Flame,
  User,
  Settings as SettingsIcon,
  Bot,
  Users,
  Globe,
  Check,
  ChevronLeft,
  Copy,
  Vibrate,
  AlertTriangle,
  Maximize,
  Minimize
} from 'lucide-react';

const AVATARS = ['🐛', '🪖', '🪱', '🎖️', '🔥', '👑', '⚡', '💣'];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // App & Navigation State
  const [navScreen, setNavScreen] = useState<
    'MENU' | 'SETUP_AI' | 'SETUP_2P' | 'ONLINE_LOBBY' | 'PROFILE' | 'SETTINGS' | 'PLAYING' | 'GAMEOVER'
  >('MENU');

  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [showFirstProfileModal, setShowFirstProfileModal] = useState<boolean>(false);

  // Player Profile & Settings
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try {
      const saved = localStorage.getItem('pixel_worms_user_profile');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: '',
      avatar: '🐛',
      stats: { played: 0, wins: 0, losses: 0 },
    };
  });

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem('pixel_worms_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { soundEnabled: true, vibrationEnabled: true };
  });

  // Mode Selection States
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIDifficulty>('NORMAL');
  const [player2Name, setPlayer2Name] = useState<string>('OYUNCU 2');

  // Online Multiplayer State
  const [onlineMode, setOnlineMode] = useState<'CHOICE' | 'HOST' | 'JOIN' | 'WAITING' | 'MATCH_FOUND'>('CHOICE');
  const [roomCode, setRoomCode] = useState<string>('');
  const [inputCode, setInputCode] = useState<string>('');
  const [onlineError, setOnlineError] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(true);
  const [opponentName, setOpponentName] = useState<string>('RAKİP');
  const [isOnlineDisconnected, setIsOnlineDisconnected] = useState<boolean>(false);
  const pollIntervalRef = useRef<number | null>(null);
  const lastProcessedActionTime = useRef<number>(0);

  // HUD Game States
  const [leftHp, setLeftHp] = useState<number>(100);
  const [rightHp, setRightHp] = useState<number>(100);
  const [activeTeam, setActiveTeam] = useState<'left' | 'right'>('left');
  const [turnTimer, setTurnTimer] = useState<number>(30);
  const [wind, setWind] = useState<number>(0);
  const [turnPhase, setTurnPhase] = useState<string>('AIM');
  const [chargeRatio, setChargeRatio] = useState<number>(0);
  const [winnerText, setWinnerText] = useState<string>('');
  const [postFireTimer, setPostFireTimer] = useState<number>(0);

  // Touch button states
  const [btnState, setBtnState] = useState<{ [key: string]: boolean }>({
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
    jump: false,
  });

  // Check if first-time user
  useEffect(() => {
    if (!profile.name || profile.name.trim() === '') {
      setShowFirstProfileModal(true);
    }
  }, [profile.name]);

  // Orientation Check
  const checkOrientation = useCallback(() => {
    setIsPortrait(window.innerHeight > window.innerWidth);
  }, []);

  useEffect(() => {
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [checkOrientation]);

  // Vibrate helper
  const triggerVibrate = (pattern: number | number[] = 40) => {
    if (settings.vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Fullscreen State & Change Listener
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    sound.unlock();
    sound.playClick();
    triggerVibrate(30);

    try {
      const doc = document as any;
      const isFs = Boolean(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );

      if (!isFs) {
        const root = document.documentElement as any;
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        } else if (root.mozRequestFullScreen) {
          await root.mozRequestFullScreen();
        } else if (root.msRequestFullscreen) {
          await root.msRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Tam ekran isteği işlenemedi:', err);
    }
  };

  // Sync sound settings
  useEffect(() => {
    sound.isMuted = !settings.soundEnabled;
    localStorage.setItem('pixel_worms_settings', JSON.stringify(settings));
  }, [settings]);

  // Save profile helper
  const saveProfile = (updated: PlayerProfile) => {
    setProfile(updated);
    localStorage.setItem('pixel_worms_user_profile', JSON.stringify(updated));
  };

  // Canvas & GameEngine Setup
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new GameEngine(() => {
      if (engine.isGameOver) {
        setWinnerText(engine.winnerText);
        setNavScreen('GAMEOVER');

        // Update stats
        const isLeftWon = engine.worms.find((w) => w.id === 'left')?.hp ?? 0 > 0;
        const won = (engine.localPlayerTeam === 'left' && isLeftWon) || (engine.localPlayerTeam === 'right' && !isLeftWon);

        setProfile((prev) => {
          const updated = {
            ...prev,
            stats: {
              played: prev.stats.played + 1,
              wins: prev.stats.wins + (won ? 1 : 0),
              losses: prev.stats.losses + (won ? 0 : 1),
            },
          };
          localStorage.setItem('pixel_worms_user_profile', JSON.stringify(updated));
          return updated;
        });

        triggerVibrate([100, 50, 150]);
      }
    });

    engine.setCanvas(canvasRef.current);
    engineRef.current = engine;

    const resizeCanvas = () => {
      if (!canvasRef.current || !canvasRef.current.parentElement) return;
      const rect = canvasRef.current.parentElement.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    if (canvasRef.current.parentElement) {
      resizeObserver.observe(canvasRef.current.parentElement);
    }

    // Sync HUD state from engine
    const hudInterval = setInterval(() => {
      if (!engineRef.current) return;
      const eng = engineRef.current;
      const leftW = eng.worms.find((w) => w.id === 'left');
      const rightW = eng.worms.find((w) => w.id === 'right');

      if (leftW) setLeftHp(Math.max(0, leftW.hp));
      if (rightW) setRightHp(Math.max(0, rightW.hp));
      setActiveTeam(eng.activeTeam);
      setTurnTimer(Math.ceil(eng.turnTimer));
      setWind(eng.wind);
      setTurnPhase(eng.turnPhase);
      setChargeRatio(eng.chargeRatio);
      setPostFireTimer(Number(eng.postFireMoveTimer.toFixed(1)));
    }, 60);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
      clearInterval(hudInterval);
      engine.stop();
    };
  }, []);

  // Online Action hook: Send action to server when local player fires
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.onFireCallback = (payload) => {
      if (roomCode) {
        fetch(`/api/rooms/${roomCode}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            team: payload.team,
            action: payload,
          }),
        }).catch(() => {});
      }
    };
  }, [roomCode]);

  // Online Polling Loop
  useEffect(() => {
    if (navScreen !== 'PLAYING' || !roomCode) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const myTeam = isHost ? 'left' : 'right';

    pollIntervalRef.current = window.setInterval(async () => {
      try {
        // Send heartbeat ping
        fetch(`/api/rooms/${roomCode}/ping`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team: myTeam }),
        }).catch(() => {});

        // Fetch room state
        const res = await fetch(`/api/rooms/${roomCode}/state`);
        if (!res.ok) return;
        const data = await res.json();
        const room = data.room;

        if (!room) return;

        if (room.status === 'DISCONNECTED') {
          setIsOnlineDisconnected(true);
          return;
        }

        // Check if remote player fired
        if (room.lastAction && room.lastAction.timestamp !== lastProcessedActionTime.current) {
          if (room.lastAction.team !== myTeam) {
            lastProcessedActionTime.current = room.lastAction.timestamp;
            engineRef.current?.applyRemoteFire(room.lastAction);
          }
        }
      } catch {
        // Network flicker
      }
    }, 600);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [navScreen, roomCode, isHost]);

  // Map dragging / touch examination state
  const isDraggingMap = useRef<boolean>(false);
  const dragStartX = useRef<number>(0);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (navScreen !== 'PLAYING') return;
    isDraggingMap.current = true;
    dragStartX.current = e.clientX;
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingMap.current || !engineRef.current || navScreen !== 'PLAYING') return;
    const deltaX = e.clientX - dragStartX.current;
    dragStartX.current = e.clientX;
    if (Math.abs(deltaX) > 0) {
      engineRef.current.panCameraBy(deltaX);
    }
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingMap.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Touch control helper
  const setControl = (key: 'left' | 'right' | 'up' | 'down' | 'fire' | 'jump', active: boolean) => {
    sound.unlock();
    triggerVibrate(20);
    if (!engineRef.current) return;

    // Check if it's currently local player's turn in online/AI match
    if (engineRef.current.gameMode === 'SINGLE' && engineRef.current.activeTeam === 'right') return;
    if (engineRef.current.gameMode === 'ONLINE_1V1' && engineRef.current.activeTeam !== engineRef.current.localPlayerTeam) return;

    if (active) {
      engineRef.current.resetManualPan();
    }

    engineRef.current.controls[key] = active;
    setBtnState((prev) => ({ ...prev, [key]: active }));
  };

  // Keyboard controls for match screen
  useEffect(() => {
    if (navScreen !== 'PLAYING') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setControl('left', true);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') setControl('right', true);
      else if (e.code === 'ArrowUp') setControl('up', true);
      else if (e.code === 'ArrowDown') setControl('down', true);
      else if (e.code === 'KeyW' || e.code === 'KeyJ') setControl('jump', true);
      else if (e.code === 'Space' || e.code === 'Enter') setControl('fire', true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') setControl('left', false);
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') setControl('right', false);
      else if (e.code === 'ArrowUp') setControl('up', false);
      else if (e.code === 'ArrowDown') setControl('down', false);
      else if (e.code === 'KeyW' || e.code === 'KeyJ') setControl('jump', false);
      else if (e.code === 'Space' || e.code === 'Enter') setControl('fire', false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [navScreen]);

  // Launch Matches
  const startSinglePlayer = (diff: AIDifficulty) => {
    sound.unlock();
    sound.playClick();
    triggerVibrate(30);

    const userName = profile.name || 'SOLUCAN';
    const botName = `ROBOT (${diff})`;

    if (engineRef.current) {
      engineRef.current.initGame(
        Math.floor(Math.random() * 999999),
        { left: userName, right: botName },
        'SINGLE',
        diff,
        'left'
      );
      engineRef.current.start();
    }
    setNavScreen('PLAYING');
  };

  const startLocal2Player = () => {
    sound.unlock();
    sound.playClick();
    triggerVibrate(30);

    const p1 = profile.name || 'OYUNCU 1';
    const p2 = player2Name.trim() || 'OYUNCU 2';

    if (engineRef.current) {
      engineRef.current.initGame(
        Math.floor(Math.random() * 999999),
        { left: p1, right: p2 },
        'LOCAL_2P',
        'NORMAL',
        'left'
      );
      engineRef.current.start();
    }
    setNavScreen('PLAYING');
  };

  // Online Room Handlers
  const handleCreateRoom = async () => {
    sound.unlock();
    sound.playClick();
    setOnlineError('');
    setOnlineMode('WAITING');

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: profile.name || 'HOST SOLUCAN',
          avatar: profile.avatar,
        }),
      });

      if (!res.ok) throw new Error('Oda oluşturulamadı');
      const data = await res.json();
      setRoomCode(data.room.code);
      setIsHost(true);

      // Start waiting for guest
      const waitInterval = setInterval(async () => {
        try {
          const sRes = await fetch(`/api/rooms/${data.room.code}/state`);
          if (!sRes.ok) return;
          const sData = await sRes.json();
          if (sData.room.players.right) {
            clearInterval(waitInterval);
            setOpponentName(sData.room.players.right.name);
            setOnlineMode('MATCH_FOUND');
            sound.playTurn();

            setTimeout(() => {
              if (engineRef.current) {
                engineRef.current.initGame(
                  sData.room.seed,
                  { left: sData.room.players.left.name, right: sData.room.players.right.name },
                  'ONLINE_1V1',
                  'NORMAL',
                  'left'
                );
                engineRef.current.wind = sData.room.wind;
                engineRef.current.start();
              }
              setNavScreen('PLAYING');
            }, 1200);
          }
        } catch {}
      }, 800);
    } catch {
      setOnlineError('Sunucu bağlantısı kurulamadı. Lütfen tekrar deneyin.');
      setOnlineMode('CHOICE');
    }
  };

  const handleJoinRoom = async () => {
    if (!inputCode.trim()) {
      setOnlineError('Lütfen bir oda kodu girin!');
      return;
    }

    sound.unlock();
    sound.playClick();
    setOnlineError('');

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inputCode.toUpperCase().trim(),
          guestName: profile.name || 'KONUK SOLUCAN',
          avatar: profile.avatar,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setOnlineError(err.message || 'Odaya bağlanılamadı');
        return;
      }

      const data = await res.json();
      setRoomCode(data.room.code);
      setIsHost(false);
      setOpponentName(data.room.players.left.name);
      setOnlineMode('MATCH_FOUND');
      sound.playTurn();

      setTimeout(() => {
        if (engineRef.current) {
          engineRef.current.initGame(
            data.room.seed,
            { left: data.room.players.left.name, right: data.room.players.right.name },
            'ONLINE_1V1',
            'NORMAL',
            'right'
          );
          engineRef.current.wind = data.room.wind;
          engineRef.current.start();
        }
        setNavScreen('PLAYING');
      }, 1200);
    } catch {
      setOnlineError('Odaya bağlanılamadı. Kodu kontrol edin.');
    }
  };

  // Restart match handler
  const handleRestartMatch = () => {
    sound.playClick();
    if (!engineRef.current) return;

    if (engineRef.current.gameMode === 'SINGLE') {
      startSinglePlayer(selectedDifficulty);
    } else if (engineRef.current.gameMode === 'LOCAL_2P') {
      startLocal2Player();
    } else {
      // In online mode, return to lobby
      setNavScreen('ONLINE_LOBBY');
      setOnlineMode('CHOICE');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 font-mono select-none">
      {/* 1. PORTRAIT ORIENTATION WARNING */}
      {isPortrait && (
        <div className="fixed inset-0 z-50 bg-slate-950/98 flex flex-col items-center justify-center p-6 text-center text-white">
          <div className="w-20 h-20 mb-6 flex items-center justify-center rounded-2xl bg-amber-500/20 border-2 border-amber-400 animate-pulse">
            <Smartphone className="w-12 h-12 text-amber-400 rotate-90" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-amber-400 mb-3 tracking-wider">
            LÜTFEN TELEFONU YATAY ÇEVİRİN
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-md leading-relaxed mb-6 font-sans">
            Pixel Worms mobil yatay (landscape) ekran için özel olarak tasarlanmıştır. Telefonunuzu yana çevirerek tam ekran savaşın keyfini çıkarın.
          </p>
          <button
            onClick={() => setIsPortrait(false)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 rounded border border-slate-600 cursor-pointer"
          >
            Yatay moddayım, devam et
          </button>
        </div>
      )}

      {/* 2. FIRST LAUNCH PROFILE MODAL (SOLUCAN ADIN NE?) */}
      {showFirstProfileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-500 rounded-xl p-6 max-w-sm w-full pixel-box flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-3xl mb-3">
              {profile.avatar}
            </div>
            <h2 className="text-lg font-bold text-amber-400 mb-1 tracking-wider">
              SOLUCAN ADIN NE?
            </h2>
            <p className="text-[10px] text-slate-400 mb-4">
              Arenaya girmeden önce bir solucan adı belirle:
            </p>

            <input
              type="text"
              maxLength={12}
              defaultValue={profile.name || ''}
              id="first-profile-input"
              placeholder="Kullanıcı adını yaz..."
              className="w-full bg-slate-950 border-2 border-slate-700 text-amber-300 px-3 py-2 rounded text-center text-sm font-bold mb-4 focus:border-amber-400 outline-none"
            />

            <div className="flex gap-1.5 mb-5 overflow-x-auto max-w-full py-1">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  onClick={() => setProfile((p) => ({ ...p, avatar: av }))}
                  className={`w-9 h-9 rounded text-lg flex items-center justify-center border ${
                    profile.avatar === av ? 'border-amber-400 bg-amber-400/20' : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const input = (document.getElementById('first-profile-input') as HTMLInputElement)?.value.trim();
                const finalName = input || 'SOLUCAN';
                saveProfile({
                  ...profile,
                  name: finalName,
                });
                sound.playClick();
                setShowFirstProfileModal(false);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:translate-y-1 text-white text-xs font-bold rounded border-2 border-emerald-300 pixel-box cursor-pointer"
            >
              DEVAM ET
            </button>
          </div>
        </div>
      )}

      {/* 3. GAME VIEWPORT (FULL HEIGHT IN MENUS, 74% DURING MATCH) */}
      <div className={`relative w-full overflow-hidden bg-slate-900 ${
        navScreen === 'PLAYING' ? 'h-[74%] border-b-2 border-slate-800' : 'h-full'
      }`}>
        <canvas
          ref={canvasRef}
          className="w-full h-full pixel-art block touch-none select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
        />

        {/* TOP HUD BAR (ONLY VISIBLE IN 'PLAYING' SCREEN) */}
        {navScreen === 'PLAYING' && (
          <div className="absolute top-0 left-0 w-full px-3 py-2 flex items-center justify-between pointer-events-none z-20 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent">
            {/* LEFT PLAYER HP */}
            <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/90 border-2 border-rose-500/80 px-2.5 py-1.5 rounded pixel-box">
              <div className="w-5 h-5 rounded bg-rose-500 flex items-center justify-center text-xs font-bold text-white shadow">
                {profile.avatar}
              </div>
              <div>
                <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-rose-300 font-bold mb-0.5">
                  <span className="truncate max-w-[80px] sm:max-w-[110px]">
                    {engineRef.current?.playerNames.left || 'SOL'}
                  </span>
                  <span>{leftHp} HP</span>
                </div>
                <div className="w-24 sm:w-32 h-2.5 bg-slate-800 border border-slate-950 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-200"
                    style={{ width: `${leftHp}%` }}
                  />
                </div>
              </div>
            </div>

            {/* CENTER: TURN & STRENGTHENED WIND */}
            <div className="flex flex-col items-center pointer-events-auto">
              <div
                className={`px-3 py-1 rounded border-2 text-[10px] sm:text-xs font-bold shadow-md tracking-wider flex items-center gap-2 ${
                  activeTeam === 'left'
                    ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                    : 'bg-sky-950/90 border-sky-500 text-sky-200'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>
                  SIRA: {activeTeam === 'left' ? engineRef.current?.playerNames.left : engineRef.current?.playerNames.right} — {turnTimer}s
                </span>
              </div>

              {/* STRENGTHENED WIND DISPLAY WITH DIRECTIONAL ARROWS */}
              <div className="mt-1 flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-900/90 border border-slate-700 rounded text-[9px] sm:text-[10px] text-sky-300 font-bold">
                <WindIcon className="w-3 h-3 text-sky-400" />
                <span>
                  {wind < 0 ? `← RÜZGAR: ${Math.abs(wind)} m/s` : wind > 0 ? `RÜZGAR: ${wind} m/s →` : `● RÜZGAR: 0.0 m/s`}
                </span>
              </div>
            </div>

            {/* RIGHT PLAYER HP & SETTINGS */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="flex items-center gap-2 bg-slate-900/90 border-2 border-sky-500/80 px-2.5 py-1.5 rounded pixel-box">
                <div className="text-right">
                  <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-sky-300 font-bold mb-0.5">
                    <span>{rightHp} HP</span>
                    <span className="truncate max-w-[80px] sm:max-w-[110px]">
                      {engineRef.current?.playerNames.right || 'SAĞ'}
                    </span>
                  </div>
                  <div className="w-24 sm:w-32 h-2.5 bg-slate-800 border border-slate-950 rounded-xs overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all duration-200"
                      style={{ width: `${rightHp}%` }}
                    />
                  </div>
                </div>
                <div className="w-5 h-5 rounded bg-sky-500 flex items-center justify-center text-xs font-bold text-white shadow">
                  🪖
                </div>
              </div>

              {/* QUICK FULLSCREEN, SOUND & HOME EXIT */}
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded cursor-pointer"
                  title="Tam Ekran Aç/Kapat"
                >
                  {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-emerald-400" /> : <Maximize className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded cursor-pointer"
                  title="Sesi Aç/Kapat"
                >
                  {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-rose-400" />}
                </button>
                <button
                  onClick={() => {
                    sound.playClick();
                    setNavScreen('MENU');
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded cursor-pointer"
                  title="Ana Menüye Dön"
                >
                  <Home className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. MAIN MENU OVERLAY */}
        {navScreen === 'MENU' && (
          <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-md w-full bg-slate-900 border-4 border-amber-500 rounded-lg pixel-box flex flex-col items-center">
              {/* TITLE */}
              <div className="flex items-center gap-2 mb-1 text-rose-500">
                <Flame className="w-6 h-6 animate-bounce" />
                <h1 className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-wider">
                  PIXEL WORMS
                </h1>
                <Flame className="w-6 h-6 animate-bounce" />
              </div>
              <p className="text-[10px] text-slate-400 mb-4">
                1v1 Mobil Yatay Solucan Savaşı
              </p>

              {/* MENU BUTTONS */}
              <div className="w-full flex flex-col gap-2">
                <button
                  onClick={() => {
                    sound.playClick();
                    setNavScreen('SETUP_AI');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border-2 border-slate-600 hover:border-amber-400 rounded text-xs font-bold text-amber-300 flex items-center justify-center gap-2 pixel-box cursor-pointer"
                >
                  <Bot className="w-4 h-4 text-emerald-400" />
                  TEK KİŞİLİK
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setNavScreen('SETUP_2P');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border-2 border-slate-600 hover:border-amber-400 rounded text-xs font-bold text-sky-300 flex items-center justify-center gap-2 pixel-box cursor-pointer"
                >
                  <Users className="w-4 h-4 text-sky-400" />
                  AYNI TELEFONDA 2 KİŞİ
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setOnlineMode('CHOICE');
                    setNavScreen('ONLINE_LOBBY');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border-2 border-slate-600 hover:border-amber-400 rounded text-xs font-bold text-rose-300 flex items-center justify-center gap-2 pixel-box cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-rose-400" />
                  ONLINE 1 VS 1
                </button>

                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => {
                      sound.playClick();
                      setNavScreen('PROFILE');
                    }}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border border-slate-600 rounded text-[10px] text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    PROFİL
                  </button>

                  <button
                    onClick={() => {
                      sound.playClick();
                      setNavScreen('SETTINGS');
                    }}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 active:translate-y-0.5 border border-slate-600 rounded text-[10px] text-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                    AYARLAR
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. SINGLE PLAYER SETUP (DIFFICULTY SELECTION) */}
        {navScreen === 'SETUP_AI' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm w-full bg-slate-900 border-4 border-amber-500 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-base font-bold text-amber-400 mb-2 flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-400" />
                TEK KİŞİLİK ZORLUK
              </h2>
              <p className="text-[10px] text-slate-300 mb-4">
                Yapay zekaya karşı oynayacaksın. Bir zorluk seç:
              </p>

              <div className="w-full flex flex-col gap-2 mb-4">
                {(['KOLAY', 'NORMAL', 'ZOR'] as AIDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`py-2 px-3 rounded text-xs font-bold border-2 cursor-pointer flex items-center justify-between ${
                      selectedDifficulty === diff
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span>{diff}</span>
                    {selectedDifficulty === diff && <Check className="w-4 h-4 text-amber-400" />}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setNavScreen('MENU')}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded border border-slate-600 cursor-pointer"
                >
                  GERİ
                </button>
                <button
                  onClick={() => startSinglePlayer(selectedDifficulty)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded border-2 border-emerald-300 pixel-box cursor-pointer"
                >
                  BAŞLA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. LOCAL 2 PLAYER SETUP */}
        {navScreen === 'SETUP_2P' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm w-full bg-slate-900 border-4 border-sky-500 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-base font-bold text-sky-400 mb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-400" />
                AYNI TELEFONDA 2 KİŞİ
              </h2>
              <p className="text-[10px] text-slate-300 mb-4">
                Sırayla aynı ekrandan oynayın:
              </p>

              <div className="w-full text-left mb-3">
                <label className="text-[9px] text-rose-400 font-bold block mb-1">OYUNCU 1 (SOL):</label>
                <input
                  type="text"
                  readOnly
                  value={profile.name || 'OYUNCU 1'}
                  className="w-full bg-slate-950 border border-slate-700 text-rose-300 px-3 py-1.5 rounded text-xs"
                />
              </div>

              <div className="w-full text-left mb-4">
                <label className="text-[9px] text-sky-400 font-bold block mb-1">OYUNCU 2 (SAĞ):</label>
                <input
                  type="text"
                  maxLength={12}
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  placeholder="İkinci oyuncu adı..."
                  className="w-full bg-slate-950 border border-slate-700 text-sky-300 px-3 py-1.5 rounded text-xs focus:border-sky-400 outline-none"
                />
              </div>

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setNavScreen('MENU')}
                  className="flex-1 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded border border-slate-600 cursor-pointer"
                >
                  GERİ
                </button>
                <button
                  onClick={startLocal2Player}
                  className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded border-2 border-sky-300 pixel-box cursor-pointer"
                >
                  SAVAŞA BAŞLA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 7. ONLINE 1 VS 1 LOBBY */}
        {navScreen === 'ONLINE_LOBBY' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm w-full bg-slate-900 border-4 border-rose-500 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-base font-bold text-rose-400 mb-1 flex items-center gap-2">
                <Globe className="w-5 h-5 text-rose-400" />
                ONLINE 1 VS 1
              </h2>

              {onlineError && (
                <div className="w-full p-2 bg-rose-950/80 border border-rose-500 rounded text-[9px] text-rose-300 mb-3 flex items-center gap-1.5 text-left">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                  <span>{onlineError}</span>
                </div>
              )}

              {onlineMode === 'CHOICE' && (
                <div className="w-full flex flex-col gap-2.5 mt-2">
                  <button
                    onClick={handleCreateRoom}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded border-2 border-rose-300 pixel-box cursor-pointer"
                  >
                    ODA OLUŞTUR
                  </button>

                  <div className="flex items-center gap-2 my-1">
                    <div className="flex-1 h-px bg-slate-700" />
                    <span className="text-[9px] text-slate-500">VEYA</span>
                    <div className="flex-1 h-px bg-slate-700" />
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      value={inputCode}
                      onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                      placeholder="ODA KODU..."
                      className="flex-1 bg-slate-950 border border-slate-700 text-amber-300 px-3 py-2 rounded text-center text-xs font-bold outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleJoinRoom}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded border border-emerald-400 pixel-box cursor-pointer"
                    >
                      KATIL
                    </button>
                  </div>

                  <p className="text-[8px] text-slate-400 mt-2 leading-relaxed">
                    İki farklı cihazdan oda kodunu girerek gerçek zamanlı 1v1 oynayın. Mermi fiziği ve ada deformasyonu senkronizedir.
                  </p>

                  <button
                    onClick={() => setNavScreen('MENU')}
                    className="w-full mt-2 py-1.5 bg-slate-800 text-slate-400 text-[10px] rounded border border-slate-700 cursor-pointer"
                  >
                    ANA MENÜYE DÖN
                  </button>
                </div>
              )}

              {onlineMode === 'WAITING' && (
                <div className="w-full flex flex-col items-center py-2">
                  <p className="text-[10px] text-slate-300 mb-1">ODA KODUN:</p>
                  <div className="px-4 py-2 bg-slate-950 border-2 border-amber-400 rounded text-xl font-extrabold text-amber-400 tracking-widest my-2 select-all flex items-center gap-2">
                    <span>{roomCode}</span>
                    <button
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(roomCode);
                        }
                      }}
                      className="text-xs p-1 bg-slate-800 rounded border border-slate-600 text-slate-300 hover:text-white"
                      title="Kodu Kopyala"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] text-sky-300 animate-pulse my-2">
                    Arkadaşının kodu girmesi bekleniyor...
                  </p>

                  <button
                    onClick={() => {
                      setOnlineMode('CHOICE');
                      setNavScreen('MENU');
                    }}
                    className="mt-3 px-4 py-1.5 bg-slate-800 text-slate-400 text-xs rounded border border-slate-700 cursor-pointer"
                  >
                    İPTAL
                  </button>
                </div>
              )}

              {onlineMode === 'MATCH_FOUND' && (
                <div className="w-full flex flex-col items-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mb-2">
                    <Check className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-bold text-emerald-400 tracking-wider">
                    RAKİP BULUNDU!
                  </h3>
                  <p className="text-[10px] text-slate-300 mt-1">
                    Rakip: <span className="text-sky-300 font-bold">{opponentName}</span>
                  </p>
                  <p className="text-[9px] text-amber-400 mt-3 animate-bounce">
                    Savaş Başlıyor...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. PROFILE VIEW */}
        {navScreen === 'PROFILE' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm w-full bg-slate-900 border-4 border-amber-500 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                SOLUCAN PROFİLİ
              </h2>

              <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-2xl mb-2">
                {profile.avatar}
              </div>

              {/* Edit name */}
              <div className="w-full mb-3">
                <label className="text-[9px] text-slate-400 block mb-1">Kullanıcı Adı:</label>
                <input
                  type="text"
                  maxLength={12}
                  value={profile.name}
                  onChange={(e) => saveProfile({ ...profile, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-amber-300 px-3 py-1.5 rounded text-center text-xs font-bold outline-none focus:border-amber-400"
                />
              </div>

              {/* Avatar Selector */}
              <div className="flex gap-1.5 mb-4">
                {AVATARS.map((av) => (
                  <button
                    key={av}
                    onClick={() => saveProfile({ ...profile, avatar: av })}
                    className={`w-7 h-7 rounded text-sm flex items-center justify-center border ${
                      profile.avatar === av ? 'border-amber-400 bg-amber-400/20' : 'border-slate-700 bg-slate-800'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>

              {/* Stats */}
              <div className="w-full grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded border border-slate-800 mb-4 text-[9px]">
                <div>
                  <div className="text-slate-400">Oynanan</div>
                  <div className="text-xs font-bold text-white mt-0.5">{profile.stats.played}</div>
                </div>
                <div>
                  <div className="text-slate-400">Kazanılan</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">{profile.stats.wins}</div>
                </div>
                <div>
                  <div className="text-slate-400">Kaybedilen</div>
                  <div className="text-xs font-bold text-rose-400 mt-0.5">{profile.stats.losses}</div>
                </div>
              </div>

              <button
                onClick={() => setNavScreen('MENU')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded border border-slate-600 cursor-pointer"
              >
                KAYDET VE DÖN
              </button>
            </div>
          </div>
        )}

        {/* 9. SETTINGS VIEW */}
        {navScreen === 'SETTINGS' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm w-full bg-slate-900 border-4 border-slate-600 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-slate-400" />
                OYUN AYARLARI
              </h2>

              <div className="w-full flex flex-col gap-3 mb-5">
                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>Ses Efektleri</span>
                  </div>
                  <button
                    onClick={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${
                      settings.soundEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {settings.soundEnabled ? 'AÇIK' : 'KAPALI'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Vibrate className="w-4 h-4 text-sky-400" />
                    <span>Titreşim</span>
                  </div>
                  <button
                    onClick={() => {
                      triggerVibrate(50);
                      setSettings((s) => ({ ...s, vibrationEnabled: !s.vibrationEnabled }));
                    }}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${
                      settings.vibrationEnabled ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {settings.vibrationEnabled ? 'AÇIK' : 'KAPALI'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    {isFullscreen ? (
                      <Minimize className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Maximize className="w-4 h-4 text-amber-400" />
                    )}
                    <span>Tam Ekran</span>
                  </div>
                  <button
                    onClick={toggleFullscreen}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                      isFullscreen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isFullscreen ? 'AÇIK' : 'KAPALI'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setNavScreen('MENU')}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded border border-slate-600 cursor-pointer"
              >
                TAMAM
              </button>
            </div>
          </div>
        )}

        {/* 10. GAME OVER OVERLAY (ONLY TEKRAR OYNA & ANA MENÜ - NO DOWNLOAD BUTTON!) */}
        {navScreen === 'GAMEOVER' && (
          <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
            <div className="p-6 max-w-sm bg-slate-900 border-4 border-amber-500 rounded-lg pixel-box flex flex-col items-center">
              <h2 className="text-lg sm:text-xl font-bold text-amber-400 mb-2">
                {winnerText || 'SAVAŞ BİTTİ!'}
              </h2>
              <p className="text-[11px] text-slate-300 mb-5">
                Harika bir mücadele gerçekleşti! Ada arazisi delik deşik oldu.
              </p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleRestartMatch}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:translate-y-1 text-white text-xs font-bold rounded border-2 border-emerald-300 pixel-box cursor-pointer flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  TEKRAR OYNA
                </button>

                <button
                  onClick={() => {
                    sound.playClick();
                    setNavScreen('MENU');
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Home className="w-3.5 h-3.5" />
                  ANA MENÜ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 11. ONLINE DISCONNECTED MODAL */}
        {isOnlineDisconnected && (
          <div className="absolute inset-0 z-40 bg-slate-950/95 flex flex-col items-center justify-center text-center p-4">
            <div className="p-5 max-w-sm bg-slate-900 border-4 border-rose-500 rounded-lg pixel-box flex flex-col items-center">
              <AlertTriangle className="w-10 h-10 text-rose-500 mb-2 animate-bounce" />
              <h2 className="text-base font-bold text-rose-400 mb-1">
                BAĞLANTI KESİLDİ
              </h2>
              <p className="text-[10px] text-slate-300 mb-4">
                Rakibin bağlantısı koptu veya oda sonlandırıldı.
              </p>
              <button
                onClick={() => {
                  setIsOnlineDisconnected(false);
                  setNavScreen('MENU');
                }}
                className="px-6 py-2 bg-slate-800 text-white text-xs font-bold rounded border border-slate-600"
              >
                ANA MENÜYE DÖN
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. BOTTOM TOUCH CONTROLS (ONLY RENDERED DURING 'PLAYING' SCREEN - COMPLETELY HIDDEN IN ALL MENU SCREENS!) */}
      {navScreen === 'PLAYING' && (
        <div className="w-full h-[26%] bg-slate-950 border-t-2 border-slate-800 px-2 sm:px-3 py-1.5 flex items-center justify-between z-20 gap-1.5 sm:gap-4">
          {/* LEFT D-PAD & JUMP CLUSTER: [SOLA] [SAĞA] [AÇI YUKARI] [AÇI AŞAĞI] [ZIPLA] */}
          <div className="flex items-center gap-1.5 sm:gap-3 h-full">
            {/* Walking group */}
            <div className="flex gap-1 sm:gap-1.5">
              <button
                onPointerDown={(e) => { e.preventDefault(); setControl('left', true); }}
                onPointerUp={(e) => { e.preventDefault(); setControl('left', false); }}
                onPointerCancel={(e) => { e.preventDefault(); setControl('left', false); }}
                className={`w-11 sm:w-15 h-11 sm:h-14 bg-slate-800 border-2 border-slate-600 text-white rounded flex flex-col items-center justify-center pixel-box cursor-pointer active:bg-slate-700 ${
                  btnState.left ? 'pixel-box-pressed bg-slate-700' : ''
                }`}
                title="Sola Yürü"
              >
                <span className="text-sm leading-none">◀</span>
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-bold">SOLA</span>
              </button>

              <button
                onPointerDown={(e) => { e.preventDefault(); setControl('right', true); }}
                onPointerUp={(e) => { e.preventDefault(); setControl('right', false); }}
                onPointerCancel={(e) => { e.preventDefault(); setControl('right', false); }}
                className={`w-11 sm:w-15 h-11 sm:h-14 bg-slate-800 border-2 border-slate-600 text-white rounded flex flex-col items-center justify-center pixel-box cursor-pointer active:bg-slate-700 ${
                  btnState.right ? 'pixel-box-pressed bg-slate-700' : ''
                }`}
                title="Sağa Yürü"
              >
                <span className="text-sm leading-none">▶</span>
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-bold">SAĞA</span>
              </button>
            </div>

            {/* Aim Angle group */}
            <div className="flex gap-1 sm:gap-1.5">
              <button
                onPointerDown={(e) => { e.preventDefault(); setControl('up', true); }}
                onPointerUp={(e) => { e.preventDefault(); setControl('up', false); }}
                onPointerCancel={(e) => { e.preventDefault(); setControl('up', false); }}
                className={`w-11 sm:w-15 h-11 sm:h-14 bg-slate-800 border-2 border-slate-600 text-white rounded flex flex-col items-center justify-center pixel-box cursor-pointer active:bg-slate-700 ${
                  btnState.up ? 'pixel-box-pressed bg-slate-700' : ''
                }`}
                title="Açı Yukarı"
              >
                <span className="text-sm leading-none">▲</span>
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-bold">YUKARI</span>
              </button>

              <button
                onPointerDown={(e) => { e.preventDefault(); setControl('down', true); }}
                onPointerUp={(e) => { e.preventDefault(); setControl('down', false); }}
                onPointerCancel={(e) => { e.preventDefault(); setControl('down', false); }}
                className={`w-11 sm:w-15 h-11 sm:h-14 bg-slate-800 border-2 border-slate-600 text-white rounded flex flex-col items-center justify-center pixel-box cursor-pointer active:bg-slate-700 ${
                  btnState.down ? 'pixel-box-pressed bg-slate-700' : ''
                }`}
                title="Açı Aşağı"
              >
                <span className="text-sm leading-none">▼</span>
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-bold">AŞAĞI</span>
              </button>
            </div>

            {/* Jump button */}
            <div className="flex">
              <button
                onPointerDown={(e) => { e.preventDefault(); setControl('jump', true); }}
                onPointerUp={(e) => { e.preventDefault(); setControl('jump', false); }}
                onPointerCancel={(e) => { e.preventDefault(); setControl('jump', false); }}
                className={`w-11 sm:w-15 h-11 sm:h-14 bg-emerald-700 hover:bg-emerald-600 border-2 border-emerald-400 text-white rounded flex flex-col items-center justify-center pixel-box cursor-pointer active:bg-emerald-800 ${
                  btnState.jump ? 'pixel-box-pressed bg-emerald-800' : ''
                }`}
                title="Zıpla"
              >
                <span className="text-sm leading-none font-black">⬆</span>
                <span className="text-[8px] sm:text-[9px] mt-0.5 font-bold tracking-tight text-emerald-100">ZIPLA</span>
              </button>
            </div>
          </div>

          {/* CENTER WEAPON CARD: BAZOOKA GÜCÜ: NAMLUDA UZAR | HASAR: 40 */}
          <div className="flex flex-col items-center px-2 py-1 bg-slate-900 border border-slate-800 rounded min-w-[130px]">
            {postFireTimer > 0 ? (
              <div className="flex flex-col items-center animate-pulse">
                <span className="text-[9px] sm:text-[10px] text-emerald-400 font-black tracking-wide">
                  🏃 KAÇIŞ SÜRESİ: {postFireTimer.toFixed(1)}s
                </span>
                <span className="text-[7px] sm:text-[8px] text-slate-300 font-bold">
                  SOL / SAĞ / ZIPLA AKTİF
                </span>
              </div>
            ) : (
              <>
                <div className="text-[8px] sm:text-[9px] text-amber-400 font-bold">
                  BAZOOKA GÜCÜ: NAMLUDA UZAR
                </div>
                <div className="text-[8px] sm:text-[9px] text-slate-300 font-bold mt-0.5 flex items-center gap-1.5">
                  <span className="text-rose-400">HASAR: 40</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-sky-300">YIKILABİLİR ARAZİ</span>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: GIANT FIRE BUTTON (ATEŞ) */}
          <div className="flex items-center">
            <button
              onPointerDown={(e) => { e.preventDefault(); setControl('fire', true); }}
              onPointerUp={(e) => { e.preventDefault(); setControl('fire', false); }}
              onPointerCancel={(e) => { e.preventDefault(); setControl('fire', false); }}
              className={`w-30 sm:w-38 h-13 sm:h-15 rounded-lg border-3 flex flex-col items-center justify-center cursor-pointer transition-all ${
                postFireTimer > 0
                  ? 'bg-emerald-700 border-emerald-300 pixel-box shadow-lg'
                  : btnState.fire || turnPhase === 'CHARGING'
                  ? 'bg-rose-700 border-yellow-300 pixel-box-pressed shadow-inner'
                  : 'bg-rose-600 hover:bg-rose-500 border-rose-300 pixel-box'
              }`}
            >
              <span className="text-base sm:text-lg font-black tracking-wider text-white">
                {postFireTimer > 0 ? 'HAREKET!' : 'ATEŞ'}
              </span>
              <span className="text-[8px] sm:text-[9px] text-rose-200 uppercase font-bold tracking-tight">
                {postFireTimer > 0
                  ? `${postFireTimer.toFixed(1)}s KALDI`
                  : btnState.fire || turnPhase === 'CHARGING'
                  ? `GÜÇ: ${Math.round(chargeRatio * 100)}%`
                  : 'BASILI TUT'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
