/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, Star, Zap, Trophy, Play, RotateCcw, Pause, Volume2, VolumeX, MousePointer2, Info, X, Shield, Timer } from 'lucide-react';

// Constants
const GAME_WIDTH = 100; // percentage
const PLAYER_SIZE = 60; // pixels
const ITEM_SIZE = 40;

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface CharacterAttributes {
  speedBonus: number;
  shieldBonus: number;
  scoreBonus: number;
  label: string;
  description: string;
}

interface CharacterAppearance {
  shipColor: string;
  thrusterColor: string;
  trailEffect: 'none' | 'sparkle' | 'glow';
}

interface Character {
  name: string;
  attributes: CharacterAttributes;
  appearance: CharacterAppearance;
}

const CHARACTER_CLASSES: Record<string, CharacterAttributes> = {
  scout: {
    speedBonus: 1.2,
    shieldBonus: 0,
    scoreBonus: 0,
    label: 'Scout',
    description: 'Agile and fast. +20% movement speed.'
  },
  guardian: {
    speedBonus: 1,
    shieldBonus: 4000, // +4 seconds
    scoreBonus: 0,
    label: 'Guardian',
    description: 'Built for survival. +4s shield duration.'
  },
  collector: {
    speedBonus: 0.9,
    shieldBonus: 0,
    scoreBonus: 5, // +5 points per star
    label: 'Collector',
    description: 'Optimized for yield. +5 points per star, but slower.'
  }
};

const APPEARANCE_OPTIONS = {
  shipColors: [
    { name: 'Emerald', value: 'text-emerald-400', glow: 'shadow-emerald-500/50' },
    { name: 'Sky', value: 'text-blue-400', glow: 'shadow-blue-500/50' },
    { name: 'Ruby', value: 'text-red-400', glow: 'shadow-red-500/50' },
    { name: 'Amethyst', value: 'text-purple-400', glow: 'shadow-purple-500/50' },
    { name: 'Gold', value: 'text-yellow-400', glow: 'shadow-yellow-500/50' },
  ],
  thrusterColors: [
    { name: 'Plasma', value: 'bg-orange-500' },
    { name: 'Ion', value: 'bg-cyan-400' },
    { name: 'Fusion', value: 'bg-pink-500' },
  ]
};

const DIFFICULTY_CONFIG = {
  easy: {
    spawnRate: 1400,
    initialSpeed: 1.5,
    starRatio: 0.8,
    speedIncrement: 0.05,
    label: 'Easy',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20'
  },
  medium: {
    spawnRate: 1000,
    initialSpeed: 2.2,
    starRatio: 0.65,
    speedIncrement: 0.1,
    label: 'Medium',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20'
  },
  hard: {
    spawnRate: 700,
    initialSpeed: 3.5,
    starRatio: 0.45,
    speedIncrement: 0.15,
    label: 'Hard',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20'
  }
};

type ItemType = 'star' | 'asteroid' | 'powerup';

interface GameItem {
  id: number;
  x: number;
  y: number;
  type: ItemType;
  speed: number;
}

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'characterCreator' | 'playing' | 'gameOver'>('menu');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [playerPosition, setPlayerPosition] = useState(50); // 0 to 100
  const [items, setItems] = useState<GameItem[]>([]);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>('medium');
  const [isPaused, setIsPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [shieldActive, setShieldActive] = useState(false);
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [screenShake, setScreenShake] = useState(false);

  // Character State
  const [character, setCharacter] = useState<Character>({
    name: 'Rookie',
    attributes: CHARACTER_CLASSES.scout,
    appearance: {
      shipColor: APPEARANCE_OPTIONS.shipColors[0].value,
      thrusterColor: APPEARANCE_OPTIONS.thrusterColors[0].value,
      trailEffect: 'none'
    }
  });

  const nextIdRef = useRef(0);
  const gameLoopRef = useRef<number | null>(null);
  const lastSpawnRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load high score and tutorial preference
  useEffect(() => {
    const savedScore = localStorage.getItem('cosmic-catch-highscore');
    if (savedScore) setHighScore(parseInt(savedScore, 10));

    const hasSeenTutorial = localStorage.getItem('cosmic-catch-tutorial-seen');
    if (!hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('cosmic-catch-highscore', score.toString());
    }
  }, [score, highScore]);

  const startGame = () => {
    setScore(0);
    setItems([]);
    setSpeedMultiplier(1);
    setGameState('playing');
    setIsPaused(false);
    setShowTutorial(false);
    setShieldActive(false);
    setSlowMoActive(false);
    setScreenShake(false);
    nextIdRef.current = 0;
    lastSpawnRef.current = performance.now();
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('cosmic-catch-tutorial-seen', 'true');
  };

  const tutorialSteps = [
    {
      title: "Movement",
      icon: <MousePointer2 size={48} className="text-emerald-400" />,
      description: "Move your mouse or slide your finger to navigate your ship through the stars."
    },
    {
      title: "Objective",
      icon: <Star size={48} className="text-yellow-400 fill-yellow-400" />,
      description: "Catch falling stars to earn points and increase your speed multiplier."
    },
    {
      title: "Danger",
      icon: <Zap size={48} className="text-red-500" />,
      description: "Avoid asteroids at all costs! A single collision will end your mission."
    }
  ];

  const spawnItem = useCallback((time: number) => {
    const config = DIFFICULTY_CONFIG[difficultyLevel];
    const currentSpawnRate = slowMoActive ? config.spawnRate * 2 : config.spawnRate;
    
    if (time - lastSpawnRef.current > currentSpawnRate / speedMultiplier) {
      const rand = Math.random();
      let type: ItemType = 'star';
      
      if (rand < 0.05) {
        type = 'powerup';
      } else if (rand < config.starRatio) {
        type = 'star';
      } else {
        type = 'asteroid';
      }

      const newItem: GameItem = {
        id: nextIdRef.current++,
        x: Math.random() * 90 + 5, // 5% to 95%
        y: -10,
        type,
        speed: (config.initialSpeed + Math.random() * 1.5) * speedMultiplier * (slowMoActive ? 0.5 : 1),
      };
      setItems(prev => [...prev, newItem]);
      lastSpawnRef.current = time;
    }
  }, [difficultyLevel, speedMultiplier, slowMoActive]);

  const triggerShake = () => {
    setScreenShake(true);
    if ('vibrate' in navigator) navigator.vibrate(50);
    setTimeout(() => setScreenShake(false), 300);
  };

  const updateGame = useCallback((time: number) => {
    if (gameState !== 'playing' || isPaused) return;

    spawnItem(time);

    const config = DIFFICULTY_CONFIG[difficultyLevel];

    setItems(prev => {
      const nextItems = prev
        .map(item => ({ ...item, y: item.y + item.speed }))
        .filter(item => item.y < 110);

      // Collision detection
      const playerX = playerPosition;
      const playerY = 85; // Fixed vertical position in %

      for (const item of nextItems) {
        const dx = Math.abs(item.x - playerX);
        const dy = Math.abs(item.y - playerY);

        if (dx < 8 && dy < 5) {
          if (item.type === 'star') {
            setScore(s => s + 10 + character.attributes.scoreBonus);
            setSpeedMultiplier(sm => sm + config.speedIncrement);
            if ('vibrate' in navigator) navigator.vibrate(10);
            return nextItems.filter(i => i.id !== item.id);
          } else if (item.type === 'powerup') {
            const isShield = Math.random() > 0.5;
            if (isShield) {
              setShieldActive(true);
              setTimeout(() => setShieldActive(false), 8000 + character.attributes.shieldBonus);
            } else {
              setSlowMoActive(true);
              setTimeout(() => setSlowMoActive(false), 5000);
            }
            if ('vibrate' in navigator) navigator.vibrate(30);
            return nextItems.filter(i => i.id !== item.id);
          } else if (item.type === 'asteroid') {
            if (shieldActive) {
              setShieldActive(false);
              triggerShake();
              return nextItems.filter(i => i.id !== item.id);
            } else {
              setGameState('gameOver');
              if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
              return [];
            }
          }
        }
      }

      return nextItems;
    });

    gameLoopRef.current = requestAnimationFrame(updateGame);
  }, [gameState, isPaused, playerPosition, spawnItem, difficultyLevel, shieldActive]);

  useEffect(() => {
    if (gameState === 'playing' && !isPaused) {
      gameLoopRef.current = requestAnimationFrame(updateGame);
    }
    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [gameState, isPaused, updateGame]);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing' || isPaused || !containerRef.current) return;
    
    let clientX;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const baseMovement = x;
    const currentPos = playerPosition;
    const diff = baseMovement - currentPos;
    
    // Apply character speed bonus to responsiveness
    const responsiveness = 1 * character.attributes.speedBonus;
    const newPos = currentPos + diff * responsiveness;
    
    setPlayerPosition(Math.max(5, Math.min(95, newPos)));
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-screen overflow-hidden font-sans select-none touch-none transition-transform duration-75 ${screenShake ? 'translate-x-1 translate-y-1' : ''}`}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
    >
      {/* Background Stars */}
      <div className="stars-bg">
        {[...Array(50)].map((_, i) => (
          <div 
            key={`bg-star-${i}`}
            className="star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 3}px`,
              height: `${Math.random() * 3}px`,
              animation: `move-stars ${Math.random() * 10 + 5}s linear infinite`
            }}
          />
        ))}
      </div>

      {/* UI Overlay */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-20">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-widest text-slate-400 font-display">Score</span>
          <span className="text-4xl font-bold text-white tabular-nums">{score}</span>
        </div>
        
        <div className="flex gap-4">
          <div className="flex gap-2">
            {shieldActive && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30"
              >
                <Shield size={16} />
              </motion.div>
            )}
            {slowMoActive && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="p-2 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30"
              >
                <Timer size={16} />
              </motion.div>
            )}
          </div>

          <div className="flex flex-col items-end">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-display">Best</span>
            <div className="flex items-center gap-1">
              <Trophy size={14} className="text-yellow-400" />
              <span className="text-xl font-semibold text-white tabular-nums">{highScore}</span>
            </div>
          </div>
          
          <button 
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          >
            {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      </div>

      {/* Game Area */}
      <AnimatePresence>
        {gameState === 'playing' && (
          <React.Fragment key="game-playing">
            {/* Player */}
            <motion.div
              key="player-ship"
              className="absolute bottom-[10%] z-10"
              animate={{ left: `${playerPosition}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ x: '-50%' }}
            >
              <div className="relative">
                <Rocket 
                  size={PLAYER_SIZE} 
                  className={`${shieldActive ? 'text-blue-400' : character.appearance.shipColor} drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-colors`} 
                />
                {shieldActive && (
                  <motion.div 
                    className="absolute inset-0 rounded-full border-2 border-blue-400/50 scale-150 blur-sm"
                    animate={{ scale: [1.4, 1.6, 1.4], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  />
                )}
                <motion.div 
                  className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-8 ${character.appearance.thrusterColor} blur-md rounded-full`}
                  animate={{ scaleY: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 0.2 }}
                />
              </div>
            </motion.div>

            {/* Falling Items */}
            {items.map(item => (
              <div
                key={`game-item-${item.id}`}
                className="absolute z-10"
                style={{ 
                  left: `${item.x}%`, 
                  top: `${item.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                {item.type === 'star' ? (
                  <Star 
                    size={ITEM_SIZE} 
                    className="text-yellow-300 fill-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.6)]" 
                  />
                ) : item.type === 'powerup' ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                      <Zap size={20} className="text-white fill-white" />
                    </div>
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-slate-700 rounded-full border-4 border-slate-600 shadow-inner relative overflow-hidden">
                    <div className="absolute top-1 left-1 w-2 h-2 bg-slate-500 rounded-full opacity-50" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 bg-slate-800 rounded-full opacity-30" />
                  </div>
                )}
              </div>
            ))}
          </React.Fragment>
        )}
      </AnimatePresence>

      {/* Menus */}
      <AnimatePresence>
        {gameState === 'menu' && (
          <motion.div 
            key="main-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="text-center space-y-8 max-w-md px-6">
              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="space-y-2"
              >
                <h1 className="text-6xl font-extrabold tracking-tighter text-white font-display uppercase italic">
                  Cosmic <span className="text-emerald-400">Catch</span>
                </h1>
                <p className="text-slate-400 text-lg">Navigate the void. Collect the light.</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <Star size={20} className="text-yellow-400 mb-2" />
                  <h3 className="text-sm font-semibold text-white">Catch Stars</h3>
                  <p className="text-xs text-slate-500">+10 Points</p>
                </div>
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <Zap size={20} className="text-red-400 mb-2" />
                  <h3 className="text-sm font-semibold text-white">Avoid Rocks</h3>
                  <p className="text-xs text-slate-500">Game Over</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-display font-semibold">Select Difficulty</p>
                <div className="flex gap-2">
                  {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map((level) => {
                    const config = DIFFICULTY_CONFIG[level];
                    const isActive = difficultyLevel === level;
                    return (
                      <button
                        key={level}
                        onClick={() => setDifficultyLevel(level)}
                        className={`flex-1 py-3 rounded-xl border transition-all ${
                          isActive 
                            ? `${config.bg} ${config.border} ${config.color} border-current` 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-sm font-bold uppercase tracking-tight">{config.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setGameState('characterCreator')}
                className={`group relative w-full py-4 text-slate-950 font-bold text-xl rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 overflow-hidden ${
                  difficultyLevel === 'easy' ? 'bg-emerald-500 hover:bg-emerald-400' :
                  difficultyLevel === 'medium' ? 'bg-yellow-500 hover:bg-yellow-400' :
                  'bg-red-500 hover:bg-red-400'
                }`}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <Play fill="currentColor" size={24} className="relative z-10" />
                <span className="relative z-10">CUSTOMIZE & LAUNCH</span>
              </button>

              <button 
                onClick={() => {
                  setTutorialStep(0);
                  setShowTutorial(true);
                }}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
              >
                <Info size={18} />
                <span>How to Play</span>
              </button>
            </div>
          </motion.div>
        )}

        {gameState === 'characterCreator' && (
          <motion.div 
            key="character-creator"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 overflow-y-auto"
          >
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Preview Section */}
              <div className="flex flex-col items-center justify-center space-y-8 p-8 rounded-3xl bg-white/5 border border-white/10">
                <h2 className="text-2xl font-bold text-white font-display uppercase tracking-widest">Vessel Preview</h2>
                
                <div className="relative py-12">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  >
                    <Rocket size={120} className={`${character.appearance.shipColor} drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]`} />
                    <motion.div 
                      className={`absolute -bottom-8 left-1/2 -translate-x-1/2 w-8 h-16 ${character.appearance.thrusterColor} blur-xl rounded-full`}
                      animate={{ scaleY: [1, 1.5, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ repeat: Infinity, duration: 0.2 }}
                    />
                  </motion.div>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-emerald-400 font-bold text-xl uppercase tracking-tight">{character.attributes.label}</p>
                  <p className="text-slate-400 text-sm max-w-xs">{character.attributes.description}</p>
                </div>

                <div className="w-full space-y-4">
                  <div className="flex justify-between text-xs uppercase tracking-widest text-slate-500 font-bold">
                    <span>Speed</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-1.5 rounded-full ${i < (character.attributes.speedBonus * 3) ? 'bg-emerald-500' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-widest text-slate-500 font-bold">
                    <span>Defense</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-1.5 rounded-full ${i < (character.attributes.shieldBonus > 0 ? 4 : 2) ? 'bg-blue-500' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-xs uppercase tracking-widest text-slate-500 font-bold">
                    <span>Yield</span>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`w-3 h-1.5 rounded-full ${i < (character.attributes.scoreBonus > 0 ? 5 : 2) ? 'bg-yellow-500' : 'bg-white/10'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customization Section */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold">1. Choose Your Class</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(CHARACTER_CLASSES).map(([key, attr]) => (
                      <button
                        key={key}
                        onClick={() => setCharacter(prev => ({ ...prev, attributes: attr }))}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          character.attributes.label === attr.label 
                            ? 'bg-emerald-500/20 border-emerald-500 text-white' 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold uppercase tracking-tight">{attr.label}</span>
                          {character.attributes.label === attr.label && <Play size={14} fill="currentColor" />}
                        </div>
                        <p className="text-xs opacity-60 mt-1">{attr.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold">2. Hull Coating</h3>
                  <div className="flex flex-wrap gap-3">
                    {APPEARANCE_OPTIONS.shipColors.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => setCharacter(prev => ({ ...prev, appearance: { ...prev.appearance, shipColor: color.value } }))}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          character.appearance.shipColor === color.value 
                            ? 'border-white scale-110' 
                            : 'border-transparent hover:scale-105'
                        } ${color.value.replace('text-', 'bg-')}`}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold">3. Thruster Core</h3>
                  <div className="flex gap-3">
                    {APPEARANCE_OPTIONS.thrusterColors.map((thruster) => (
                      <button
                        key={thruster.name}
                        onClick={() => setCharacter(prev => ({ ...prev, appearance: { ...prev.appearance, thrusterColor: thruster.value } }))}
                        className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase tracking-tighter transition-all ${
                          character.appearance.thrusterColor === thruster.value 
                            ? 'bg-white text-slate-950 border-white' 
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {thruster.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    onClick={() => setGameState('menu')}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={startGame}
                    className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xl rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                  >
                    START MISSION
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {showTutorial && (
          <motion.div 
            key="tutorial-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6"
          >
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full relative overflow-hidden shadow-2xl">
              <button 
                onClick={closeTutorial}
                className="absolute top-4 right-4 p-2 text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="space-y-8">
                <div className="flex flex-col items-center text-center space-y-4">
                  <motion.div
                    key={tutorialStep}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-6 bg-white/5 rounded-full"
                  >
                    {tutorialSteps[tutorialStep].icon}
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white font-display uppercase italic tracking-tight">
                    {tutorialSteps[tutorialStep].title}
                  </h2>
                  <p className="text-slate-400 leading-relaxed">
                    {tutorialSteps[tutorialStep].description}
                  </p>
                </div>

                <div className="flex gap-2 justify-center">
                  {tutorialSteps.map((_, i) => (
                    <div 
                      key={`tutorial-dot-${i}`}
                      className={`h-1.5 rounded-full transition-all ${
                        i === tutorialStep ? 'w-8 bg-emerald-500' : 'w-2 bg-white/10'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex gap-3">
                  {tutorialStep > 0 && (
                    <button 
                      onClick={() => setTutorialStep(s => s - 1)}
                      className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition-all"
                    >
                      Back
                    </button>
                  )}
                  {tutorialStep < tutorialSteps.length - 1 ? (
                    <button 
                      onClick={() => setTutorialStep(s => s + 1)}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all"
                    >
                      Next
                    </button>
                  ) : (
                    <button 
                      onClick={closeTutorial}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-all"
                    >
                      Got it!
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'gameOver' && (
          <motion.div 
            key="game-over-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/90 backdrop-blur-md"
          >
            <div className="text-center space-y-8">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="space-y-2"
              >
                <h2 className="text-7xl font-black text-white font-display uppercase italic tracking-tighter">
                  Mission <span className="text-red-500 underline decoration-wavy">Failed</span>
                </h2>
                <p className="text-red-200/60 text-xl">Your vessel was destroyed in the belt.</p>
              </motion.div>

              <div className="flex justify-center gap-12">
                <div className="text-center">
                  <p className="text-red-300/50 text-xs uppercase tracking-widest mb-1">Final Score</p>
                  <p className="text-5xl font-bold text-white">{score}</p>
                </div>
                <div className="text-center border-l border-red-800 pl-12">
                  <p className="text-red-300/50 text-xs uppercase tracking-widest mb-1">Best Effort</p>
                  <p className="text-5xl font-bold text-white">{highScore}</p>
                </div>
              </div>

              <button 
                onClick={startGame}
                className="w-full max-w-xs mx-auto py-4 bg-white text-red-950 font-bold text-xl rounded-2xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={24} />
                RETRY MISSION
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pause Button (Only when playing) */}
      {gameState === 'playing' && (
        <button 
          onClick={() => setIsPaused(!isPaused)}
          className="absolute bottom-6 right-6 z-20 p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
        >
          {isPaused ? <Play size={24} fill="currentColor" /> : <Pause size={24} fill="currentColor" />}
        </button>
      )}

      {/* Pause Menu */}
      <AnimatePresence>
        {isPaused && (
          <motion.div 
            key="pause-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm"
          >
            <div className="text-center space-y-6">
              <h2 className="text-5xl font-bold text-white font-display italic uppercase">Mission Paused</h2>
              <button 
                onClick={() => setIsPaused(false)}
                className="px-12 py-4 bg-emerald-500 text-slate-950 font-bold text-xl rounded-2xl hover:bg-emerald-400 transition-all"
              >
                RESUME
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
