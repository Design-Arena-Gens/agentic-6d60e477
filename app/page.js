"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CANVAS_WIDTH = 420;
const CANVAS_HEIGHT = 640;
const GROUND_HEIGHT = 88;
const BIRD_RADIUS = 18;
const FRAME_TIME = 1000 / 60;
const GRAVITY = 0.45;
const JUMP_STRENGTH = -7.2;
const PIPE_WIDTH = 74;
const PIPE_GAP_BASE = 160;
const PIPE_INTERVAL = 1550;
const PIPE_SPEED = 2.75;

function createPipe(score) {
  const gap = Math.max(110, PIPE_GAP_BASE - score * 4);
  const safeTop = 80;
  const safeBottom = CANVAS_HEIGHT - GROUND_HEIGHT - 80;
  const gapCenter =
    Math.random() * (safeBottom - safeTop - gap) + safeTop + gap / 2;

  return {
    x: CANVAS_WIDTH + PIPE_WIDTH,
    gapCenter,
    gap,
    width: PIPE_WIDTH,
    scored: false,
  };
}

export default function Home() {
  const canvasRef = useRef(null);
  const animationRef = useRef(0);
  const lastTimeRef = useRef(0);
  const spawnTimerRef = useRef(PIPE_INTERVAL * 0.65);
  const pipesRef = useRef([createPipe(0)]);
  const birdRef = useRef({
    x: CANVAS_WIDTH / 3,
    y: CANVAS_HEIGHT / 2,
    velocity: 0,
    idleBase: CANVAS_HEIGHT / 2,
  });

  const [status, setStatus] = useState("ready");
  const statusRef = useRef(status);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(score);
  const [bestScore, setBestScore] = useState(() => {
    if (typeof window !== "undefined") {
      const storedBest = Number(window.localStorage.getItem("flappy-bird-best"));
      if (!Number.isNaN(storedBest)) {
        return storedBest;
      }
    }
    return 0;
  });
  const bestScoreRef = useRef(bestScore);

  const resetGame = useCallback(() => {
    const startBirdY = CANVAS_HEIGHT / 2;
    birdRef.current = {
      x: CANVAS_WIDTH / 3,
      y: startBirdY,
      velocity: 0,
      idleBase: startBirdY,
    };
    pipesRef.current = [createPipe(0)];
    spawnTimerRef.current = PIPE_INTERVAL * 0.65;
    setScore(0);
    scoreRef.current = 0;
    setStatus("ready");
    statusRef.current = "ready";
  }, []);

  const flap = useCallback(() => {
    birdRef.current.velocity = JUMP_STRENGTH;
  }, []);

  const gameOver = useCallback(() => {
    if (statusRef.current !== "running") {
      return;
    }
    statusRef.current = "gameover";
    setStatus("gameover");

    if (scoreRef.current > bestScoreRef.current) {
      bestScoreRef.current = scoreRef.current;
      setBestScore(scoreRef.current);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "flappy-bird-best",
          String(scoreRef.current),
        );
      }
    }
  }, []);

  const handleInput = useCallback(() => {
    if (statusRef.current === "ready") {
      statusRef.current = "running";
      setStatus("running");
      flap();
      return;
    }

    if (statusRef.current === "running") {
      flap();
      return;
    }

    if (statusRef.current === "gameover") {
      resetGame();
    }
  }, [flap, resetGame]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    bestScoreRef.current = bestScore;
  }, [bestScore]);

  const drawFrame = useCallback(
    (context, time, dt, delta) => {
      const bird = birdRef.current;

      if (statusRef.current === "ready") {
        bird.y = bird.idleBase + Math.sin(time / 325) * 12;
        bird.velocity = 0;
      }

      if (statusRef.current === "running") {
        bird.velocity += GRAVITY * dt;
        bird.y += bird.velocity * dt;

        spawnTimerRef.current += delta;
        if (spawnTimerRef.current >= PIPE_INTERVAL) {
          spawnTimerRef.current = 0;
          pipesRef.current.push(createPipe(scoreRef.current));
        }

        pipesRef.current = pipesRef.current
          .map((pipe) => ({
            ...pipe,
            x: pipe.x - PIPE_SPEED * dt,
          }))
          .filter((pipe) => pipe.x + pipe.width > -10);

        pipesRef.current.forEach((pipe) => {
          if (!pipe.scored && pipe.x + pipe.width < bird.x - BIRD_RADIUS) {
            pipe.scored = true;
            const nextScore = scoreRef.current + 1;
            scoreRef.current = nextScore;
            setScore(nextScore);
          }
        });

        if (detectCollision(bird, pipesRef.current)) {
          gameOver();
        }
      } else if (statusRef.current === "gameover") {
        bird.velocity = Math.min(bird.velocity + GRAVITY * dt, 12);
        bird.y += bird.velocity * dt;
      }

      if (bird.y + BIRD_RADIUS >= CANVAS_HEIGHT - GROUND_HEIGHT) {
        bird.y = CANVAS_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS;
        bird.velocity = 0;
      } else if (bird.y - BIRD_RADIUS <= 0) {
        bird.y = BIRD_RADIUS;
        bird.velocity = Math.max(0, bird.velocity);
      }

      paintScene(context, bird, pipesRef.current, time);
    },
    [gameOver, setScore],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");

    function configureCanvas() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      canvas.style.width = `${CANVAS_WIDTH}px`;
      canvas.style.height = `${CANVAS_HEIGHT}px`;
      if (typeof context.resetTransform === "function") {
        context.resetTransform();
      } else {
        context.setTransform(1, 0, 0, 1, 0, 0);
      }
      context.scale(dpr, dpr);
    }

    configureCanvas();
    window.addEventListener("resize", configureCanvas);

    const render = (time) => {
      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      const dt = Math.min(delta, 34) / FRAME_TIME;

      drawFrame(context, time, dt, delta);
      animationRef.current = window.requestAnimationFrame(render);
    };

    lastTimeRef.current = 0;
    animationRef.current = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", configureCanvas);
    };
  }, [drawFrame]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        event.preventDefault();
        handleInput();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleInput]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-200 px-4 py-8">
      <div className="flex w-full max-w-2xl flex-col items-center gap-6">
        <header className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-black uppercase tracking-[0.3em] text-sky-900 drop-shadow-sm sm:text-5xl">
            Flappy Flight
          </h1>
          <p className="text-base text-sky-800 sm:text-lg">
            Tap, click, or press space to keep your bird soaring through the
            pipes.
          </p>
        </header>

        <div className="relative w-full max-w-[420px] rounded-3xl border border-white/70 bg-white/40 p-4 shadow-lg shadow-emerald-900/20 backdrop-blur">
          <div className="flex justify-between px-1 pb-3 text-sm font-semibold uppercase tracking-wide text-sky-900">
            <span>Score: {score}</span>
            <span>Best: {bestScore}</span>
          </div>
          <div className="relative flex justify-center">
            <canvas
              ref={canvasRef}
              className="h-auto w-full cursor-pointer rounded-2xl border border-sky-300/60 bg-sky-200 shadow-inner"
              onClick={handleInput}
              onTouchStart={handleInput}
            />

            {status !== "running" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-sky-900/40 text-center text-white backdrop-blur-sm">
                {status === "ready" ? (
                  <>
                    <span className="text-2xl font-bold uppercase tracking-widest">
                      Tap to Start
                    </span>
                    <span className="text-sm uppercase tracking-widest">
                      Space · Click · Touch
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-black uppercase tracking-[0.4em]">
                      Crash!
                    </span>
                    <span className="text-base">
                      Score {score} · Best {bestScore}
                    </span>
                    <button
                      className="rounded-full bg-yellow-400 px-6 py-2 text-sm font-semibold uppercase tracking-wider text-sky-900 shadow-lg shadow-yellow-900/20 transition hover:bg-yellow-300"
                      onClick={resetGame}
                    >
                      Play Again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <footer className="text-center text-xs uppercase tracking-wide text-sky-900/80">
          Built with Next.js · Inspired by the classic arcade challenge
        </footer>
      </div>
    </div>
  );
}

function detectCollision(bird, pipes) {
  const birdBox = {
    top: bird.y - BIRD_RADIUS,
    bottom: bird.y + BIRD_RADIUS,
    left: bird.x - BIRD_RADIUS,
    right: bird.x + BIRD_RADIUS,
  };

  return pipes.some((pipe) => {
    const pipeLeft = pipe.x;
    const pipeRight = pipe.x + pipe.width;
    const gapTop = pipe.gapCenter - pipe.gap / 2;
    const gapBottom = pipe.gapCenter + pipe.gap / 2;

    const withinPipe = birdBox.right > pipeLeft && birdBox.left < pipeRight;
    const hitsPipe = withinPipe && (birdBox.top < gapTop || birdBox.bottom > gapBottom);
    return hitsPipe;
  });
}

function paintScene(context, bird, pipes, time) {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const gradient = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#8ec5fc");
  gradient.addColorStop(0.6, "#e0f2ff");
  gradient.addColorStop(1, "#b8f3c9");
  context.fillStyle = gradient;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawParallax(context, time);
  drawPipes(context, pipes);
  drawBird(context, bird, time);
  drawGround(context, time);
}

function drawBird(context, bird, time) {
  context.save();
  context.translate(bird.x, bird.y);
  context.rotate(Math.min(Math.max(bird.velocity / 12, -0.5), 0.6));
  context.fillStyle = "#ffce3b";
  context.beginPath();
  context.ellipse(0, 0, BIRD_RADIUS + 2, BIRD_RADIUS, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#fda726";
  context.beginPath();
  context.arc(-6, -4, 8, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#f57f17";
  context.beginPath();
  context.moveTo(BIRD_RADIUS - 2, -2);
  context.lineTo(BIRD_RADIUS + 10, 0);
  context.lineTo(BIRD_RADIUS - 2, 2);
  context.closePath();
  context.fill();

  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(6, -6, 7, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1e272e";
  context.beginPath();
  context.arc(8, -6, 3, 0, Math.PI * 2);
  context.fill();

  const wingOffset = Math.sin(time / 150) * 4;
  context.fillStyle = "#ffb300";
  context.beginPath();
  context.ellipse(-4, 10 + wingOffset, 14, 9, -0.3, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPipes(context, pipes) {
  pipes.forEach((pipe) => {
    const gapTop = pipe.gapCenter - pipe.gap / 2;
    const gapBottom = pipe.gapCenter + pipe.gap / 2;

    const pipeGradient = context.createLinearGradient(pipe.x, 0, pipe.x + pipe.width, 0);
    pipeGradient.addColorStop(0, "#2ec27e");
    pipeGradient.addColorStop(0.5, "#26a269");
    pipeGradient.addColorStop(1, "#2ec27e");

    context.fillStyle = pipeGradient;
    context.fillRect(pipe.x, 0, pipe.width, gapTop);
    context.fillRect(pipe.x, gapBottom, pipe.width, CANVAS_HEIGHT - gapBottom - GROUND_HEIGHT);

    context.fillStyle = "#1b7f4b";
    context.fillRect(pipe.x - 4, gapTop - 20, pipe.width + 8, 20);
    context.fillRect(pipe.x - 4, gapBottom, pipe.width + 8, 20);
  });
}

function drawGround(context, time) {
  const patternWidth = 48;
  const offset = ((time / 20) % patternWidth) * -1;

  context.fillStyle = "#8bc34a";
  context.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);

  context.fillStyle = "#689f38";
  for (let x = offset; x < CANVAS_WIDTH + patternWidth; x += patternWidth) {
    context.beginPath();
    context.moveTo(x, CANVAS_HEIGHT - GROUND_HEIGHT);
    context.lineTo(x + patternWidth / 2, CANVAS_HEIGHT - GROUND_HEIGHT + 18);
    context.lineTo(x + patternWidth, CANVAS_HEIGHT - GROUND_HEIGHT);
    context.closePath();
    context.fill();
  }

  context.fillStyle = "#a1887f";
  context.fillRect(0, CANVAS_HEIGHT - 32, CANVAS_WIDTH, 32);
}

function drawParallax(context, time) {
  context.fillStyle = "#ffffff";
  const slowOffset = (time / 90) % CANVAS_WIDTH;
  const fastOffset = (time / 60) % CANVAS_WIDTH;

  for (let i = 0; i < 4; i++) {
    const x = (i * 130 + slowOffset) % (CANVAS_WIDTH + 130) - 130;
    context.globalAlpha = 0.12;
    drawCloud(context, x, 110);
  }
  for (let i = 0; i < 3; i++) {
    const x = (i * 170 + fastOffset) % (CANVAS_WIDTH + 170) - 170;
    context.globalAlpha = 0.18;
    drawCloud(context, x, 220);
  }
  context.globalAlpha = 1;
}

function drawCloud(context, x, y) {
  context.beginPath();
  context.ellipse(x + 30, y, 34, 18, 0, 0, Math.PI * 2);
  context.ellipse(x + 54, y - 12, 24, 16, 0, 0, Math.PI * 2);
  context.ellipse(x + 80, y, 30, 20, 0, 0, Math.PI * 2);
  context.ellipse(x + 54, y + 8, 28, 18, 0, 0, Math.PI * 2);
  context.fill();
}
