/** Draws some placeholder receipt content (text + shapes) so there's real
 * "large print data" to exercise the canvas print path with. */
export function drawDemoCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 384; // typical 58mm-at-203dpi receipt width
  canvas.height = 220;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('@epos/printer', canvas.width / 2, 40);

  ctx.font = '16px sans-serif';
  ctx.fillText('Canvas print job demo', canvas.width / 2, 68);

  for (let i = 0; i < 6; i++) {
    ctx.fillRect(20, 90 + i * 18, canvas.width - 40, 10);
  }

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height - 30, 20, 0, Math.PI * 2);
  ctx.stroke();

  return canvas;
}
