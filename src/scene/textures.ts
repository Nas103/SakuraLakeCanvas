import * as THREE from 'three';

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create 2D canvas context for procedural texture');
  }
  return [canvas, ctx];
}

/**
 * Tileable procedural normal map for calm lake water ripples (linear space).
 */
export function createWaterNormalTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const heightAt = (u: number, v: number): number => {
    const a = u * Math.PI * 2;
    const b = v * Math.PI * 2;
    return (
      Math.sin(a * 2 + b * 1) * 0.35 +
      Math.cos(a * 3 - b * 2) * 0.25 +
      Math.sin(a * 5 + b * 4) * 0.16 +
      Math.cos(a * 8 - b * 6) * 0.09 +
      Math.sin(a * 11 + b * 9) * 0.05
    );
  };

  const eps = 1 / size;
  const strength = 2.4;

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const hL = heightAt(u - eps, v);
      const hR = heightAt(u + eps, v);
      const hD = heightAt(u, v - eps);
      const hU = heightAt(u, v + eps);

      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Crisp 5-petal white sakura cluster sprite for canopy accents (sRGB).
 */
export function createBlossomTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    const grad = ctx.createRadialGradient(0, -24, 4, 0, -28, 30);
    grad.addColorStop(0, '#fff9f5');
    grad.addColorStop(0.7, '#ffffff');
    grad.addColorStop(1, 'rgba(255, 238, 232, 0.85)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-18, -12, -20, -44, -4, -50);
    ctx.lineTo(0, -44); // characteristic sakura petal notch
    ctx.lineTo(4, -50);
    ctx.bezierCurveTo(20, -44, 18, -12, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Soft warm stamen center
  const centerGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 12);
  centerGrad.addColorStop(0, 'rgba(255, 206, 175, 0.95)');
  centerGrad.addColorStop(1, 'rgba(255, 230, 215, 0)');
  ctx.fillStyle = centerGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft radial glow sprite for fireflies, shore sparks, and mist layers.
 */
export function createGlowSpriteTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.25, 'rgba(255, 245, 230, 0.72)');
  grad.addColorStop(0.6, 'rgba(255, 220, 190, 0.2)');
  grad.addColorStop(1, 'rgba(255, 210, 180, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Tileable organic bark bump map (linear space) for gnarled sakura limbs and pines.
 */
export function createBarkBumpTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    const v = (y / size) * Math.PI * 2;
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const ridge =
        Math.sin(u * 10 + Math.sin(v * 3) * 1.4) * 0.45 +
        Math.sin(u * 23 - v * 2) * 0.25 +
        Math.cos(v * 8 + u * 4) * 0.2;
      const val = Math.max(0, Math.min(255, Math.round((ridge * 0.5 + 0.5) * 255)));
      const idx = (y * size + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 6);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Soft radial contact shadow disc texture.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(6, 7, 10, 0.72)');
  grad.addColorStop(0.55, 'rgba(6, 7, 10, 0.3)');
  grad.addColorStop(1, 'rgba(6, 7, 10, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
