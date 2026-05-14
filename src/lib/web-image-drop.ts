/** 从拖拽的 DataTransfer 里收集常见「网页图片」外链（http(s)） */
export function extractWebImageDropUrls(dataTransfer: DataTransfer | null): string[] {
  if (!dataTransfer) return [];
  const out: string[] = [];

  const push = (s: string) => {
    const t = s.trim();
    if (!t || out.includes(t)) return;
    if (t.startsWith("http://") || t.startsWith("https://")) out.push(t);
    else if (t.startsWith("//") && t.length > 2) out.push(`https:${t}`);
  };

  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const x = line.trim();
      if (!x || x.startsWith("#")) continue;
      push(x.split("#")[0] ?? x);
    }
  }

  const plain = dataTransfer.getData("text/plain").trim();
  if (plain) {
    for (const line of plain.split(/\r?\n/)) push(line);
  }

  const html = dataTransfer.getData("text/html");
  if (html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("img[src]").forEach((el) => {
        const s = el.getAttribute("src");
        if (s) push(s);
      });
    } catch {
      /* ignore */
    }
  }

  return out;
}

export function filterDroppedImageFiles(files: File[]): File[] {
  return files.filter(
    (f) =>
      (Boolean(f.type) && f.type.startsWith("image/")) ||
      /\.(jpe?g|png|gif|webp|avif|hei[c|f]|heic)$/i.test(f.name)
  );
}

function fileListFromArray(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) dt.items.add(f);
  return dt.files;
}

/** 从 text/html 里解析 data:image/* 并转成 File（仅处理内嵌图，不走服务端拉取） */
export async function extractDataUrlImageFiles(dataTransfer: DataTransfer | null): Promise<File[]> {
  if (!dataTransfer) return [];
  const html = dataTransfer.getData("text/html");
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const files: File[] = [];
  let i = 0;
  for (const el of doc.querySelectorAll("img[src]")) {
    const s = el.getAttribute("src");
    if (!s || !s.startsWith("data:image/")) continue;
    try {
      const res = await fetch(s);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) continue;
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      files.push(new File([blob], `web-paste-${i++}.${ext}`, { type: blob.type }));
    } catch {
      /* skip broken data url */
    }
  }
  return files;
}

export function mergeToFileList(files: File[]): FileList | null {
  const img = filterDroppedImageFiles(files);
  if (!img.length) return null;
  return fileListFromArray(img);
}
