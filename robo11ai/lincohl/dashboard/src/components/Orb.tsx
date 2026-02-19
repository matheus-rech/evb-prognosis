"use client";

import { useEffect, useRef } from "react";

/**
 * Animated orb visualization that responds to audio volume.
 * Inspired by ElevenLabs Orb component.
 */
interface OrbProps {
  isActive: boolean;
  isSpeaking: boolean;
  volume: number; // 0-1
  size?: number;
}

export default function Orb({
  isActive,
  isSpeaking,
  volume,
  size = 200,
}: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const center = size / 2;
    const baseRadius = size * 0.3;

    let phase = 0;

    function draw() {
      ctx.clearRect(0, 0, size, size);

      phase += 0.02;
      const vol = Math.max(0.05, volume);

      // Outer glow
      if (isActive) {
        const glowRadius = baseRadius + vol * 40;
        const gradient = ctx.createRadialGradient(
          center, center, baseRadius * 0.5,
          center, center, glowRadius + 20
        );
        gradient.addColorStop(0, isSpeaking ? "rgba(92, 124, 250, 0.4)" : "rgba(92, 124, 250, 0.2)");
        gradient.addColorStop(1, "rgba(92, 124, 250, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(center, center, glowRadius + 20, 0, Math.PI * 2);
        ctx.fill();
      }

      // Morphing blob
      ctx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = isActive
          ? Math.sin(angle * 3 + phase) * vol * 15 +
            Math.sin(angle * 5 + phase * 1.3) * vol * 8
          : Math.sin(angle * 2 + phase * 0.5) * 2;
        const r = baseRadius + wobble;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      // Gradient fill
      const fillGrad = ctx.createRadialGradient(
        center - 20, center - 20, 0,
        center, center, baseRadius + 20
      );
      if (isActive) {
        fillGrad.addColorStop(0, "#748ffc");
        fillGrad.addColorStop(0.5, "#5c7cfa");
        fillGrad.addColorStop(1, "#4263eb");
      } else {
        fillGrad.addColorStop(0, "#495057");
        fillGrad.addColorStop(1, "#343a40");
      }
      ctx.fillStyle = fillGrad;
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, isSpeaking, volume, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="mx-auto"
    />
  );
}
