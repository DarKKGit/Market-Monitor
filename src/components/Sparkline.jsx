import { useEffect, useRef } from 'react';

const UP = 'rgb(63,207,142)';
const DOWN = 'rgb(255,95,109)';

/**
 * Canvas sparkline. Canvas rather than SVG because the global board
 * draws eleven of these on every 30s refresh and re-rendering eleven
 * long path strings through React is wasted work.
 */
export default function Sparkline({ data, up = true, fill = false, height = 78 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !data || data.length < 2) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w) return;
      canvas.width = w * dpr;
      canvas.height = h * dpr;

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;
      const pad = 6;
      const x = (i) => (i / (data.length - 1)) * w;
      const y = (v) => pad + (1 - (v - min) / range) * (h - pad * 2);
      const color = up ? UP : DOWN;

      if (fill) {
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, color.replace('rgb', 'rgba').replace(')', ',.22)'));
        grad.addColorStop(1, color.replace('rgb', 'rgba').replace(')', ',0)'));
        ctx.beginPath();
        ctx.moveTo(0, h);
        data.forEach((v, i) => ctx.lineTo(x(i), y(v)));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }

      ctx.beginPath();
      data.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Emphasised endpoint — the reader's eye needs a "you are here".
      ctx.beginPath();
      ctx.arc(x(data.length - 1), y(data[data.length - 1]), 2.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [data, up, fill]);

  return <canvas ref={ref} style={{ display: 'block', width: '100%', height }} />;
}
