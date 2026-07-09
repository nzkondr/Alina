import * as THREE from "three";

export function makeTextTexture(text, options = {}) {
  const {
    width = 1024,
    height = 512,
    background = "#fff8ec",
    color = "#3b2a1d",
    accent = "#d7a96e",
    font = "64px Inter, Arial, sans-serif",
    subtitle = ""
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 18;
  ctx.strokeRect(28, 28, width - 56, height - 56);

  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2 - (subtitle ? 36 : 0));

  if (subtitle) {
    ctx.font = "36px Inter, Arial, sans-serif";
    ctx.fillStyle = "#7d6a57";
    ctx.fillText(subtitle, width / 2, height / 2 + 56);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function makeGradientTexture(top, bottom) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeWrappedTextTexture(text, options = {}) {
  const {
    width = 900,
    height = 520,
    background = "#fff9ef",
    color = "#3b2a1d",
    accent = "#d8ad72",
    font = "44px Inter, Arial, sans-serif",
    lineHeight = 62,
    padding = 72,
    transparent = false,
    border = true
  } = options;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!transparent) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  if (border) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 12;
    ctx.strokeRect(30, 30, width - 60, height - 60);
  }

  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const lines = wrapText(ctx, text, width - padding * 2);
  const totalHeight = lines.length * lineHeight;
  let y = (height - totalHeight) / 2;
  lines.forEach((line) => {
    ctx.fillText(line, padding, y);
    y += lineHeight;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });

  if (line) lines.push(line);
  return lines;
}
