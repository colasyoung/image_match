/**
 * 首页封面「裁切锚点」：优先浏览器原生人脸检测；否则用轻量视觉显著性（边缘能量质心），
 * 尽量把人像脸部或纹理密集的主体留在 `object-fit: cover` 的可见区内。
 */

export type CoverFocal = { xPct: number; yPct: number };

const cache = new Map<string, CoverFocal | "fail">();

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 多张脸的合并框几何中心（像素） */
function faceUnionCenter(
  faces: readonly { boundingBox: DOMRectReadOnly }[],
  iw: number,
  ih: number
): { cx: number; cy: number } | null {
  if (!faces.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of faces) {
    const b = f.boundingBox;
    minX = Math.min(minX, b.left);
    minY = Math.min(minY, b.top);
    maxX = Math.max(maxX, b.right);
    maxY = Math.max(maxY, b.bottom);
  }
  const padX = (maxX - minX) * 0.12;
  const padY = (maxY - minY) * 0.15;
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(iw, maxX + padX);
  maxY = Math.min(ih, maxY + padY);
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

function pixelsToPercent(cx: number, cy: number, iw: number, ih: number): CoverFocal {
  return {
    xPct: clamp((cx / iw) * 100, 8, 92),
    yPct: clamp((cy / ih) * 100, 8, 92),
  };
}

async function loadImageForAnalysis(src: string): Promise<HTMLImageElement | null> {
  const attempt = (crossOrigin: boolean) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = "async";
      if (crossOrigin) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const withCors = await attempt(true);
  if (withCors) return withCors;
  return attempt(false);
}

async function tryFaceFocal(img: HTMLImageElement): Promise<CoverFocal | null> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (w < 16 || h < 16) return null;

  const ctor = (globalThis as unknown as { FaceDetector?: new (opts?: object) => { detect: (img: HTMLImageElement) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
  if (!ctor) return null;
  try {
    const detector = new ctor({ fastMode: true, maxDetectedFaces: 6 });
    const faces = await detector.detect(img);
    const c = faceUnionCenter(faces, w, h);
    if (c) return pixelsToPercent(c.cx, c.cy, w, h);
  } catch {
    return null;
  }
  return null;
}

/** 降采样后按块梯度能量估显著性质心；衣物/主体常与高纹理区域重合 */
function saliencyFocalFromImageData(imageData: ImageData): CoverFocal {
  const { width, height, data: buf } = imageData;
  const block = Math.max(4, Math.floor(Math.min(width, height) / 24));
  const nx = Math.ceil(width / block);
  const ny = Math.ceil(height / block);
  const energy = new Float64Array(nx * ny);
  let maxE = 1e-6;

  const grayAt = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return buf[i] * 0.299 + buf[i + 1] * 0.587 + buf[i + 2] * 0.114;
  };

  for (let by = 0; by < ny; by++) {
    for (let bx = 0; bx < nx; bx++) {
      let sx = 0;
      const x0 = bx * block;
      const y0 = by * block;
      const x1 = Math.min(width - 1, x0 + block - 1);
      const y1 = Math.min(height - 1, y0 + block - 1);
      for (let y = y0 + 1; y < y1; y++) {
        for (let x = x0 + 1; x < x1; x++) {
          const g = grayAt(x, y);
          const gx = g - grayAt(x - 1, y);
          const gy = g - grayAt(x, y - 1);
          sx += gx * gx + gy * gy;
        }
      }
      const idx = by * nx + bx;
      energy[idx] = sx;
      maxE = Math.max(maxE, sx);
    }
  }

  let wx = 0;
  let wy = 0;
  let sum = 0;
  for (let by = 0; by < ny; by++) {
    for (let bx = 0; bx < nx; bx++) {
      const e = energy[by * nx + bx] / maxE;
      const cx = (bx + 0.5) * block;
      const cy = (by + 0.5) * block;
      wx += cx * e;
      wy += cy * e;
      sum += e;
    }
  }

  if (sum < 1e-6) {
    return pixelsToPercent(width / 2, height / 2, width, height);
  }

  const cx = wx / sum;
  const cy = wy / sum;
  /** 略向上拉回：全身/服装图重心偏中下部时仍多留住上半身 */
  const biasedY = clamp(cy - height * 0.04, 0, height);
  return pixelsToPercent(cx, biasedY, width, height);
}

async function trySaliencyFocal(img: HTMLImageElement): Promise<CoverFocal | null> {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (iw < 32 || ih < 32) return null;

  const long = Math.max(iw, ih);
  const scale = long > 256 ? 256 / long : 1;
  const tw = Math.max(16, Math.round(iw * scale));
  const th = Math.max(16, Math.round(ih * scale));

  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, tw, th);
    const idata = ctx.getImageData(0, 0, tw, th);
    return saliencyFocalFromImageData(idata);
  } catch {
    return null;
  } finally {
    canvas?.remove();
  }
}

/**
 * 对给定可访问的 src（已含镜像等最终 URL）计算封面裁切锚点；失败时返回 null。
 * 结果按 src 缓存，避免同图多卡片重复计算。
 */
export async function detectCoverFocalPoint(imageSrc: string): Promise<CoverFocal | null> {
  const key = imageSrc.trim();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit === "fail") return null;
  if (hit) return hit;

  const img = await loadImageForAnalysis(key);
  if (!img) {
    cache.set(key, "fail");
    return null;
  }

  let focal = await tryFaceFocal(img);
  if (!focal) focal = await trySaliencyFocal(img);
  if (!focal) {
    cache.set(key, "fail");
    return null;
  }

  cache.set(key, focal);
  return focal;
}

export function coverFocalToObjectPosition(f: CoverFocal): string {
  return `${f.xPct.toFixed(1)}% ${f.yPct.toFixed(1)}%`;
}
