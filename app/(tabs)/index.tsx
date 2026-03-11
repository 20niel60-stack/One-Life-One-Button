import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

// Use Dimensions so the game scales to different screen sizes
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const FLOOR_HEIGHT = 80;
const PLAYER_SIZE = 40;
const PLAYER_X = 50; // fixed x position of the player

// Slightly softer gravity and jump so up/down speeds feel similar and not too fast
const GRAVITY = 0.45; // how fast player falls
const JUMP_VELOCITY = -10; // how strong the jump is
const OBSTACLE_WIDTH = 40;
// Make spacing a bit farther and still random
const OBSTACLE_GAP_MIN = 280; // min distance between obstacles
const OBSTACLE_GAP_MAX = 420; // max distance between obstacles
// Obstacle speed will ramp from slow to fast over time
const OBSTACLE_SPEED_MIN = 3;
const OBSTACLE_SPEED_MAX = 8;

const CAR_VARIANTS = [
  {
    topColor: '#f97316',
    bodyColor: '#ea580c',
    wheelColor: '#020617',
  },
  {
    topColor: '#22c55e',
    bodyColor: '#16a34a',
    wheelColor: '#020617',
  },
  {
    topColor: '#3b82f6',
    bodyColor: '#1d4ed8',
    wheelColor: '#020617',
  },
  {
    topColor: '#e5e7eb',
    bodyColor: '#9ca3af',
    wheelColor: '#020617',
  },
];

function App() {
  const initialPlayerY = SCREEN_HEIGHT - FLOOR_HEIGHT - PLAYER_SIZE;

  const [playerY, setPlayerY] = useState(initialPlayerY);
  const [velocityY, setVelocityY] = useState(0);
  const [obstacles, setObstacles] = useState([
    {
      id: 1,
      x: SCREEN_WIDTH + 100,
      variant: Math.floor(Math.random() * CAR_VARIANTS.length),
    },
    {
      id: 2,
      x: SCREEN_WIDTH + 100 + OBSTACLE_GAP_MIN,
      variant: Math.floor(Math.random() * CAR_VARIANTS.length),
    },
  ]);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [runPhase, setRunPhase] = useState(0);
  const [bgOffset, setBgOffset] = useState(0);

  const gameLoopRef = useRef<number | null>(null);
  const playerYRef = useRef(initialPlayerY);
  const velocityYRef = useRef(0);
  const isOnGroundRef = useRef(true);
  const gameStartTimeRef = useRef(Date.now());
  const bgOffsetRef = useRef(0);

  // Start / restart game
  const resetGame = () => {
    playerYRef.current = initialPlayerY;
    velocityYRef.current = 0;
    isOnGroundRef.current = true;
    gameStartTimeRef.current = Date.now();
    bgOffsetRef.current = 0;
    setBgOffset(0);
    setPlayerY(initialPlayerY);
    setVelocityY(0);
    setObstacles([
      {
        id: 1,
        x: SCREEN_WIDTH + 100,
        variant: Math.floor(Math.random() * CAR_VARIANTS.length),
      },
      {
        id: 2,
        x:
          SCREEN_WIDTH +
          100 +
          (OBSTACLE_GAP_MIN +
            Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN)),
        variant: Math.floor(Math.random() * CAR_VARIANTS.length),
      },
    ]);
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
  };

  // Start game from initial screen
  const startGame = () => {
    resetGame();
  };

  // Handle tap: jump, start game, or restart
  const handleTap = () => {
    if (!gameStarted) {
      startGame();
      return;
    }
    if (gameOver) {
      resetGame();
      return;
    }

    // Single jump only: only jump when on/very near the ground
    const groundY = SCREEN_HEIGHT - FLOOR_HEIGHT - PLAYER_SIZE;
    const distanceFromGround = Math.abs(playerYRef.current - groundY);
    // Allow a small tolerance so it feels more responsive when landing
    if (isOnGroundRef.current || distanceFromGround < 6) {
      velocityYRef.current = JUMP_VELOCITY;
      setVelocityY(JUMP_VELOCITY);
    }
  };

  // Main game loop
  useEffect(() => {
    const loop = () => {
      // How long has this run been going?
      const elapsedMs = Date.now() - gameStartTimeRef.current;
      const elapsedSeconds = Math.floor(elapsedMs / 1000); // Convert to seconds
      // Speed up by 0.1 every second, but cap at OBSTACLE_SPEED_MAX
      const currentSpeed = Math.min(
        OBSTACLE_SPEED_MIN + (elapsedSeconds * 0.1),
        OBSTACLE_SPEED_MAX
      );

      let newVel = velocityYRef.current + GRAVITY;
      let newY = playerYRef.current + newVel;

      const groundY = SCREEN_HEIGHT - FLOOR_HEIGHT - PLAYER_SIZE;

      // Clamp to ground
      if (newY > groundY) {
        newY = groundY;
        newVel = 0;
      }

      // Track if we're on the ground for more responsive jump checks
      isOnGroundRef.current = newY === groundY;

      velocityYRef.current = newVel;
      playerYRef.current = newY;

      setVelocityY(newVel);
      setPlayerY(newY);

      // Advance running animation phase while the game is active (smooth loop)
      if (!gameOver) {
        setRunPhase(prev => (prev + 0.25) % (Math.PI * 2));
      }

      // Scroll background for a parallax effect
      const bgSpeed = currentSpeed * 0.3;
      const newBgOffset = bgOffsetRef.current - bgSpeed;
      bgOffsetRef.current = newBgOffset;
      setBgOffset(newBgOffset);

      setObstacles(prevObs => {
        let updated = prevObs.map(o => ({ ...o, x: o.x - currentSpeed }));

        // Recycle obstacles that went off-screen and increase score
        updated = updated.map(o => {
          if (o.x + OBSTACLE_WIDTH < 0) {
            const maxX = Math.max(...updated.map(x => x.x));
            const randomGap =
              OBSTACLE_GAP_MIN +
              Math.random() * (OBSTACLE_GAP_MAX - OBSTACLE_GAP_MIN);
            const newX = maxX + randomGap;
            setScore(s => s + 1);
            return {
              ...o,
              x: newX,
              variant: Math.floor(Math.random() * CAR_VARIANTS.length),
            };
          }
          return o;
        });

        // Collision detection
        const playerRect = {
          x: PLAYER_X,
          y: playerYRef.current,
          width: PLAYER_SIZE,
          height: PLAYER_SIZE,
        };

        for (const o of updated) {
          const obstacleRect = {
            x: o.x,
            y: SCREEN_HEIGHT - FLOOR_HEIGHT - PLAYER_SIZE, // same ground level
            width: OBSTACLE_WIDTH,
            height: PLAYER_SIZE, // height of the obstacle
          };

          if (rectsOverlap(playerRect, obstacleRect)) {
            setGameOver(true);
            return updated;
          }
        }

        return updated;
      });

      if (!gameOver) {
        gameLoopRef.current = requestAnimationFrame(loop);
      }
    };

    if (!gameOver && gameStarted) {
      gameLoopRef.current = requestAnimationFrame(loop);
    }

    return () => {
      if (gameLoopRef.current != null) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
    // We intentionally leave velocityY and playerY out to avoid restarting the loop every frame
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, gameStarted]);

  // Normalize background offset so we can tile strips seamlessly
  const bgOffsetNormalized =
    ((bgOffset % SCREEN_WIDTH) + SCREEN_WIDTH) % SCREEN_WIDTH;

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={styles.container}>
        {/* Score - only show when game is active */}
        {gameStarted && !gameOver && (
          <Text style={styles.scoreText}>{score}</Text>
        )}

        {/* Game area */}
        <View style={styles.gameArea}>
          {/* Start Screen */}
          {!gameStarted && (
            <View style={styles.startScreen}>
              <Text style={styles.titleText}>Jumpy</Text>
              <Text style={styles.subtitleText}>Jump over the cars!</Text>
              <Text style={styles.startButtonText}>TAP TO START</Text>
            </View>
          )}

          {/* Game Over Screen */}
          {gameStarted && gameOver && (
            <View style={styles.gameOverScreen}>
              <Text style={styles.gameOverTitleText}>Game Over</Text>
              <Text style={styles.finalScoreText}>Score: {score}</Text>
              <View style={styles.restartButton}>
                <Text style={styles.restartButtonText}>RESTART</Text>
              </View>
            </View>
          )}

          {/* Game elements - only show when game is active */}
          {gameStarted && !gameOver && (
            <>
              {/* Background buildings (two strips tiled for continuous scroll) */}
              <View
                style={[
                  styles.buildingLayer,
                  { transform: [{ translateX: bgOffsetNormalized }] },
                ]}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const mod = idx % 4;
                  const buildingStyle =
                    mod === 0
                      ? styles.buildingTall
                      : mod === 1
                        ? styles.buildingMedium
                        : mod === 2
                          ? styles.buildingSmall
                          : styles.buildingWide;
                  const windowCount =
                    mod === 0 ? 14 : mod === 1 ? 10 : mod === 2 ? 8 : 16;
                  return (
                    <View key={`b1-${idx}`} style={buildingStyle}>
                      <View style={styles.windowGrid}>
                        {Array.from({ length: windowCount }).map((_, i) => (
                          <View key={`b1-${idx}-w-${i}`} style={styles.window} />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
              <View
                style={[
                  styles.buildingLayer,
                  {
                    transform: [
                      { translateX: bgOffsetNormalized - SCREEN_WIDTH },
                    ],
                  },
                ]}>
                {Array.from({ length: 12 }).map((_, idx) => {
                  const mod = idx % 4;
                  const buildingStyle =
                    mod === 0
                      ? styles.buildingTall
                      : mod === 1
                        ? styles.buildingMedium
                        : mod === 2
                          ? styles.buildingSmall
                          : styles.buildingWide;
                  const windowCount =
                    mod === 0 ? 14 : mod === 1 ? 10 : mod === 2 ? 8 : 16;
                  return (
                    <View key={`b2-${idx}`} style={buildingStyle}>
                      <View style={styles.windowGrid}>
                        {Array.from({ length: windowCount }).map((_, i) => (
                          <View key={`b2-${idx}-w-${i}`} style={styles.window} />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Street lamps behind the road (occasional, tiled strips) */}
              <View
                style={[
                  styles.streetLampLayer,
                  { transform: [{ translateX: bgOffsetNormalized * 1.1 }] },
                ]}>
                {Array.from({ length: 8 }).map((_, i) => {
                  // Only some indices get a lamp so they appear occasionally
                  if (i % 3 !== 0) {
                    return null;
                  }
                  const x = 40 + i * 80;
                  return (
                    <View key={`lamp1-${i}`} style={[styles.streetLamp, { left: x }]}>
                      <View style={styles.streetLampHead} />
                      <View style={styles.streetLampGlow} />
                    </View>
                  );
                })}
              </View>
              <View
                style={[
                  styles.streetLampLayer,
                  {
                    transform: [
                      { translateX: bgOffsetNormalized * 1.1 - SCREEN_WIDTH },
                    ],
                  },
                ]}>
                {Array.from({ length: 8 }).map((_, i) => {
                  if (i % 3 !== 0) {
                    return null;
                  }
                  const x = 40 + i * 80;
                  return (
                    <View key={`lamp2-${i}`} style={[styles.streetLamp, { left: x }]}>
                      <View style={styles.streetLampHead} />
                      <View style={styles.streetLampGlow} />
                    </View>
                  );
                })}
              </View>

              {/* Player */}
              <View style={[styles.player, { left: PLAYER_X, top: playerY }]}>
                <View
                  style={[
                    styles.playerBody,
                    {
                      transform: [
                        {
                          translateY:
                            !gameOver && isOnGroundRef.current
                              ? Math.sin(runPhase) * 2
                              : 0,
                        },
                      ],
                    },
                  ]}>
                  <View
                    style={[
                      styles.playerHead,
                      {
                        transform: [
                          {
                            translateX:
                              !gameOver && isOnGroundRef.current
                                ? Math.cos(runPhase) * 1.5
                                : 0,
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Obstacles */}
              {obstacles.map(o => {
                const variant =
                  CAR_VARIANTS[o.variant % CAR_VARIANTS.length] ??
                  CAR_VARIANTS[0];
                return (
                  <View
                    key={o.id}
                    style={[
                      styles.car,
                      {
                        left: o.x,
                        top: SCREEN_HEIGHT - FLOOR_HEIGHT - PLAYER_SIZE + 8,
                      },
                    ]}>
                    <View
                      style={[
                        styles.carTop,
                        { backgroundColor: variant.topColor },
                      ]}
                    />
                    <View
                      style={[
                        styles.carBody,
                        { backgroundColor: variant.bodyColor },
                      ]}
                    />
                    <View style={styles.carWheelRow}>
                      <View
                        style={[
                          styles.carWheel,
                          { backgroundColor: variant.wheelColor },
                        ]}
                      />
                      <View
                        style={[
                          styles.carWheel,
                          { backgroundColor: variant.wheelColor },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}

              {/* Road / Floor */}
              <View style={styles.floor}>
                <View style={styles.roadCenterLine} />
              </View>
            </>
          )}
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

function rectsOverlap(a: {
  x: number;
  y: number;
  width: number;
  height: number;
}, b: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return !(
    a.x + a.width < b.x ||
    a.x > b.x + b.width ||
    a.y + a.height < b.y ||
    a.y > b.y + b.height
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#141414',
  },
  gameArea: {
    flex: 1,
    backgroundColor: '#020617', // night sky
  },
  buildingLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: FLOOR_HEIGHT + 10,
    gap: 12,
  },
  buildingTall: {
    width: 60,
    height: 180,
    backgroundColor: '#1f2937',
    borderRadius: 6,
  },
  buildingMedium: {
    width: 50,
    height: 140,
    backgroundColor: '#111827',
    borderRadius: 6,
  },
  buildingSmall: {
    width: 40,
    height: 110,
    backgroundColor: '#020617',
    borderRadius: 6,
  },
  buildingWide: {
    width: 90,
    height: 130,
    backgroundColor: '#0f172a',
    borderRadius: 6,
  },
  windowGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 8,
    gap: 4,
  },
  window: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: '#fbbf24',
    opacity: 0.9,
  },
  player: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE * 1.4,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  playerBody: {
    width: PLAYER_SIZE * 0.6,
    height: PLAYER_SIZE,
    backgroundColor: '#60a5fa', // blue shirt
    borderRadius: 8,
    alignItems: 'center',
  },
  playerHead: {
    position: 'absolute',
    top: -PLAYER_SIZE * 0.5,
    width: PLAYER_SIZE * 0.6,
    height: PLAYER_SIZE * 0.6,
    borderRadius: (PLAYER_SIZE * 0.6) / 2,
    backgroundColor: '#facc15', // skin tone
  },
  car: {
    position: 'absolute',
    width: OBSTACLE_WIDTH * 2,
    height: PLAYER_SIZE,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  carTop: {
    width: OBSTACLE_WIDTH * 1.1,
    height: PLAYER_SIZE * 0.35,
    backgroundColor: '#f97316',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  carBody: {
    width: OBSTACLE_WIDTH * 2,
    height: PLAYER_SIZE * 0.55,
    backgroundColor: '#ea580c',
    borderRadius: 6,
  },
  carWheelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: OBSTACLE_WIDTH * 1.6,
    marginTop: 2,
  },
  carWheel: {
    width: PLAYER_SIZE * 0.35,
    height: PLAYER_SIZE * 0.35,
    borderRadius: (PLAYER_SIZE * 0.35) / 2,
    backgroundColor: '#020617',
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: FLOOR_HEIGHT,
    bottom: 0,
    backgroundColor: '#020617', // road base
    borderTopWidth: 4,
    borderTopColor: '#4b5563',
  },
  roadCenterLine: {
    position: 'absolute',
    top: FLOOR_HEIGHT / 2 - 2,
    left: 20,
    right: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#eab308',
    opacity: 0.7,
  },
  streetLampLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: FLOOR_HEIGHT + 4,
  },
  streetLamp: {
    position: 'absolute',
    width: 6,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  streetLampHead: {
    width: 16,
    height: 10,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  streetLampGlow: {
    position: 'absolute',
    top: 4,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 211, 77, 0.18)',
  },
  scoreText: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    color: '#ffffff',
    fontSize: 42,
    fontWeight: 'bold',
    zIndex: 10,
  },
  startScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },
  titleText: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitleText: {
    color: '#d4d4d4',
    fontSize: 24,
    marginBottom: 40,
  },
  startButtonText: {
    color: '#fbbf24',
    fontSize: 28,
    fontWeight: 'bold',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  gameOverScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  gameOverTitleText: {
    color: '#ef4444',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    textShadowColor: 'rgba(239, 68, 68, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  finalScoreText: {
    color: '#ffffff',
    fontSize: 32,
    marginBottom: 40,
    fontWeight: 'bold',
  },
  restartButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  restartButtonText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  gameOverText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subText: {
    color: '#d4d4d4',
    fontSize: 18,
  },
});

export default App;
