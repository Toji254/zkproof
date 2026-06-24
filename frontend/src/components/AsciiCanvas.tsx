import { useEffect, useRef } from 'react';

const LOCK_CHARS =
  " `.-':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@";
const FIELD_CHARS = '  ..::--==++**##@@'.split('');

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

const smooth = (t: number) => t * t * (3 - 2 * t);

const noise2D = (x: number, y: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);

  const ux = smooth(fx);
  const uy = smooth(fy);

  return (
    a * (1 - ux) * (1 - uy) +
    b * ux * (1 - uy) +
    c * (1 - ux) * uy +
    d * ux * uy
  );
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export default function AsciiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let time = 0;
    let rafId = 0;
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      width = canvas.parentElement!.offsetWidth;
      height = canvas.parentElement!.offsetHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      cols = width < 768 ? 90 : 128;
      const cellW = width / cols;
      const cellH = cellW * 1.18;
      rows = Math.ceil(height / cellH);
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const draw = () => {
      ctx.fillStyle = '#050a0f';
      ctx.fillRect(0, 0, width, height);

      time += 0.012;

      const cellW = width / cols;
      const cellH = cellW * 1.18;

      const lockX = width * 0.5;
      const lockY = height * 0.52;
      const lockScale = Math.min(width, height) * 0.22;

      ctx.font = `${cellH * 0.84}px "Fragment Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Light direction for 3D shading
      let lx = 1.0;
      let ly = 0.2;
      let lz = -0.7;
      const lLen = Math.hypot(lx, ly, lz);
      lx /= lLen;
      ly /= lLen;
      lz /= lLen;

      // Oscillating/swinging angle for the lock
      const swingAngle = Math.sin(time * 0.8) * 0.08;
      const cosS = Math.cos(swingAngle);
      const sinS = Math.sin(swingAngle);

      // Pivot point of the swing (top of shackle)
      const pivotX = lockX;
      const pivotY = lockY - lockScale * 0.7;

      for (let r = 0; r < rows; r++) {
        const rowY = r * cellH + cellH / 2;
        const laneNorm = rowY / height;
        const laneSpeed = 1.75;

        for (let c = 0; c < cols; c++) {
          const x = c * cellW + cellW / 2;
          const y = rowY;

          // Rotate coordinate about the pivot to get lock-space coords
          const dxPivot = x - pivotX;
          const dyPivot = y - pivotY;
          const rx = dxPivot * cosS + dyPivot * sinS;
          const ry = -dxPivot * sinS + dyPivot * cosS;

          const localX = rx;
          const localY = ry - lockScale * 0.15; // Offset to center lock body

          const mouseDistance = Math.hypot(x - mouse.x, y - mouse.y);
          const mouseField = Math.exp(-mouseDistance * 0.0038);

          // ── Padlock Geometry Definition ──
          
          // 1. Lock Body (rounded rectangle)
          const bodyW = lockScale * 1.35;
          const bodyH = lockScale * 0.95;
          const bodyCX = 0;
          const bodyCY = lockScale * 0.2;
          const rCorner = lockScale * 0.15;
          
          const dxBox = Math.abs(localX - bodyCX) - (bodyW / 2 - rCorner);
          const dyBox = Math.abs(localY - bodyCY) - (bodyH / 2 - rCorner);
          const isInsideBody = dxBox <= 0 || dyBox <= 0 || (dxBox > 0 && dyBox > 0 && dxBox * dxBox + dyBox * dyBox <= rCorner * rCorner);

          // 2. Shackle (inverted U shape)
          const shackleCX = 0;
          const shackleCY = -lockScale * 0.2;
          const rOuter = lockScale * 0.45;
          const rInner = lockScale * 0.31;
          const midR = (rOuter + rInner) / 2;
          const tubeRadius = (rOuter - rInner) / 2;

          let isInsideShackle = false;
          let isShackleCurve = false;
          
          if (localY <= shackleCY) {
            // Top curved part of shackle
            const distCenter = Math.hypot(localX - shackleCX, localY - shackleCY);
            if (distCenter >= rInner && distCenter <= rOuter) {
              isInsideShackle = true;
              isShackleCurve = true;
            }
          } else if (localY > shackleCY && localY <= bodyCY - bodyH / 2 + lockScale * 0.1) {
            // Vertical legs of shackle
            const leftLegX = -midR;
            const rightLegX = midR;
            if (Math.abs(localX - leftLegX) <= tubeRadius || Math.abs(localX - rightLegX) <= tubeRadius) {
              isInsideShackle = true;
            }
          }

          // 3. Keyhole (circle + slot)
          const keyholeCX = 0;
          const keyholeCY = bodyCY + lockScale * 0.05;
          const rKey = lockScale * 0.085;
          const isInsideKeyhole = Math.hypot(localX - keyholeCX, localY - keyholeCY) <= rKey || 
            (Math.abs(localX) <= lockScale * 0.04 && localY >= keyholeCY && localY <= keyholeCY + lockScale * 0.22);

          // Combine shapes
          const isInsideLock = (isInsideBody || isInsideShackle) && !isInsideKeyhole;

          // Estimate normalized distance for flow deformation
          const distCenterLock = Math.hypot(localX, localY);
          const normLock = distCenterLock / lockScale;

          let char = '';
          let opacity = 0;
          let drawX = x;
          let drawY = y;

          if (isInsideLock) {
            // ── 3D Normal Computation for Padlock Shading ──
            let nx = 0;
            let ny = 0;
            let nz = 1;

            if (isInsideBody) {
              // Beveled/pillow shape normal for lock body
              const px = (localX - bodyCX) / (bodyW / 2);
              const py = (localY - bodyCY) / (bodyH / 2);
              const power = 4;
              const rPower = Math.pow(Math.abs(px), power) + Math.pow(Math.abs(py), power);
              nz = Math.sqrt(Math.max(0, 1.0 - rPower));
              nx = Math.pow(Math.abs(px), power - 1) * Math.sign(px) * 0.75;
              ny = Math.pow(Math.abs(py), power - 1) * Math.sign(py) * 0.75;
            } else if (isInsideShackle) {
              if (isShackleCurve) {
                // Curved shackle tube normal
                const d = Math.hypot(localX - shackleCX, localY - shackleCY);
                const localR = (d - midR) / tubeRadius;
                nz = Math.sqrt(Math.max(0, 1.0 - localR * localR));
                nx = ((localX - shackleCX) / d) * localR;
                ny = (((localY - shackleCY) / d) * localR);
              } else {
                // Straight shackle leg tube normal
                const sideX = localX < 0 ? -midR : midR;
                const localR = (localX - sideX) / tubeRadius;
                nz = Math.sqrt(Math.max(0, 1.0 - localR * localR));
                nx = localR;
                ny = 0;
              }
            }

            // Diffuse shading + metallic albedo texture
            let diffuse = nx * lx + ny * ly + nz * lz;
            diffuse = Math.max(0, diffuse);

            const metalTexture = noise2D(localX * 0.6, localY * 0.06) * 0.12;
            const albedo = clamp(0.78 + metalTexture, 0.55, 0.95);

            const ambient = 0.03;
            const intensity = ambient + diffuse * albedo * 1.4;
            const charIdx = clamp(
              Math.floor(intensity * (LOCK_CHARS.length - 1)),
              0,
              LOCK_CHARS.length - 1
            );

            char = LOCK_CHARS[charIdx];
            opacity = clamp(0.28 + intensity * 0.72, 0.28, 1);

            // Add interactive mouse disturbance
            drawX += Math.sin(time * 3.6 + r * 0.32 + c * 0.11) * mouseField * 16;
            drawY += Math.cos(time * 2.8 + c * 0.24) * mouseField * 5;
          } else {
            // ── Background Streaming Field ──
            const sampleX =
              c * 0.085 -
              time * (1.8 + laneSpeed * 1.6) +
              Math.sin(time * 4.2 + r * 0.28 + c * 0.08) * mouseField * 1.8;
            const sampleY =
              r * 0.11 +
              Math.sin(c * 0.025 + time * 1.2) * 0.6 +
              Math.cos(time * 3.4 + c * 0.2) * mouseField * 1.1;

            const flowA = noise2D(sampleX, sampleY);
            const flowB = noise2D(sampleX * 1.7 + 20, sampleY * 0.8 - 14);
            const wave =
              Math.sin(sampleX * 1.9 + laneNorm * 14) * 0.5 +
              Math.cos(sampleY * 2.4 - time * 2.1) * 0.5;

            let density = flowA * 0.42 + flowB * 0.28 + (wave * 0.5 + 0.5) * 0.3;

            // Add flow band disturbance around the lock
            const orbitBand = Math.exp(-Math.pow((normLock - 1.15) * 5.0, 2));
            density += orbitBand * 0.18;

            if (density > 0.38) {
              const fieldIdx = clamp(
                Math.floor(density * (FIELD_CHARS.length - 1)),
                0,
                FIELD_CHARS.length - 1
              );
              char = FIELD_CHARS[fieldIdx];
              opacity = 0.035 + density * 0.24;

              // Real horizontal travel
              drawX += (laneSpeed * 8 + flowB * 16) % (cellW * 3);
              drawY += Math.sin(sampleX * 2.2 + time + laneNorm * 8) * 1.8;

              // Flow deflection swirl around lock
              const swirl = orbitBand * 12;
              const angleLock = Math.atan2(localY, localX);
              drawX += -Math.sin(angleLock) * swirl;
              drawY += Math.cos(angleLock) * swirl * 0.6;

              drawX += Math.sin(time * 4.8 + r * 0.35 + c * 0.1) * mouseField * 18;
              drawY += Math.cos(time * 3.2 + c * 0.25) * mouseField * 6;
            }
          }

          if (!char || opacity <= 0.02) continue;

          ctx.fillStyle = `rgba(0, 212, 170, ${opacity * 0.95})`; // subtle green tint fits the Stellar ZK theme
          ctx.fillText(char, drawX, drawY);
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    document.fonts.ready.then(() => {
      resize();
      draw();
    });

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
