import "server-only";

/** 与前端 `t("api.NsfwRejected")` 对应；路由返回 JSON `error` 字段。 */
export const NSFW_REJECTED_CODE = "NSFW_REJECTED" as const;

export class NsfwContentRejectedError extends Error {
  readonly code = NSFW_REJECTED_CODE;
  constructor() {
    super(NSFW_REJECTED_CODE);
    this.name = "NsfwContentRejectedError";
  }
}

import type { NSFWJS } from "nsfwjs";

const MODEL_KEY = "__image_match_nsfw_model__" as const;

function getModelPromise(): Promise<NSFWJS> {
  const g = globalThis as unknown as Record<string, Promise<NSFWJS> | undefined>;
  if (!g[MODEL_KEY]) {
    g[MODEL_KEY] = (async () => {
      await import("@tensorflow/tfjs-node");
      const nsfwjs = await import("nsfwjs");
      return nsfwjs.load();
    })();
  }
  return g[MODEL_KEY];
}

/**
 * 在上传至图床前对图片做自动化 NSFW 粗检（基于 nsfwjs + TensorFlow Node）。
 * - 设 `DISABLE_NSFW_SCREENING=1` 可关闭（如无原生 TF 的运行时、或本地调试）。
 * - 模型加载或解码失败时**放行**并打日志，避免误杀全部上传；分类命中阈值则拒绝。
 */
export async function assertImagePassesNsfwScreen(buffer: Buffer): Promise<void> {
  if (process.env.DISABLE_NSFW_SCREENING === "1") return;
  if (buffer.byteLength < 32) return;

  const tf = await import("@tensorflow/tfjs-node");
  let image: import("@tensorflow/tfjs").Tensor3D | null = null;
  try {
    const model = await getModelPromise();
    image = tf.node.decodeImage(buffer, 3) as import("@tensorflow/tfjs").Tensor3D;
    const predictions = await model.classify(image);

    const prob = (name: string) =>
      predictions.find((p) => p.className === name)?.probability ?? 0;
    const porn = prob("Porn");
    const hentai = prob("Hentai");
    const neutral = prob("Neutral");

    const core = Math.max(porn, hentai);
    if (core >= 0.78) {
      throw new NsfwContentRejectedError();
    }
    if (porn + hentai >= 0.92 && neutral < 0.12) {
      throw new NsfwContentRejectedError();
    }
  } catch (e) {
    if (e instanceof NsfwContentRejectedError) throw e;
    console.warn("[nsfw-screen] screening skipped (upload allowed):", e);
  } finally {
    image?.dispose();
  }
}
