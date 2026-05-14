"use client";

import { useCallback, useRef, useState, type DragEvent } from "react";
import { useLocale } from "@/contexts/LocaleProvider";
import { cn } from "@/lib/utils";
import { IMGBB_DEFAULT_EXPIRATION_SECONDS, IMGBB_UPLOAD_MAX_BYTES } from "@/lib/imgbb";
import {
  extractDataUrlImageFiles,
  extractWebImageDropUrls,
  filterDroppedImageFiles,
  mergeToFileList,
} from "@/lib/web-image-drop";

const MB = IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024);
const DEFAULT_DAYS = Math.round(IMGBB_DEFAULT_EXPIRATION_SECONDS / 86_400);

function FullHintList() {
  const { t } = useLocale();
  return (
    <ul className="mt-1.5 list-inside list-disc space-y-1 text-cyan-100/80">
      <li>{t("hints.li1", { mb: MB })}</li>
      <li>{t("hints.li2", { days: DEFAULT_DAYS })}</li>
      <li>{t("hints.li3")}</li>
    </ul>
  );
}

/** 与 `POST /api/upload-image`、imgbb `expiration` 策略一致的用户可见说明 */
export function ImageUploadHints({
  className,
  /** 创建页等场景：只显示一两句，细节收进「展开」 */
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useLocale();
  return (
    <div
      className={cn(
        "rounded-xl border border-cyan-500/25 bg-cyan-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-cyan-100/85",
        className
      )}
    >
      <p className="font-medium text-cyan-200/95">{t("hints.title")}</p>
      {compact ? (
        <>
          <p className="mt-1.5 text-cyan-100/85">{t("hints.compactLine", { mb: MB, days: DEFAULT_DAYS })}</p>
          <details className="mt-2 group">
            <summary className="cursor-pointer list-none text-cyan-200/90 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-cyan-400/40 underline-offset-2 group-open:decoration-cyan-300/60">
                {t("hints.expand")}
              </span>
            </summary>
            <FullHintList />
          </details>
        </>
      ) : (
        <FullHintList />
      )}
    </div>
  );
}

type PickProps = {
  id?: string;
  disabled?: boolean;
  busy?: boolean;
  multiple?: boolean;
  accept?: string;
  onFiles: (files: FileList | null) => void;
  /** 从其它网页拖入时解析出的 http(s) 图片地址，由页面调用上传接口（服务端拉取） */
  onWebImageUrls?: (urls: string[]) => void;
  label: string;
  subLabel?: string;
  className?: string;
  /** 是否支持把文件拖进选区（默认开启） */
  enableDragDrop?: boolean;
};

/** 大尺寸、易发现的上传触发器（隐藏原生 input），可选拖拽添加 */
export function ImagePickButton({
  id = "image-pick-input",
  disabled,
  busy,
  multiple = true,
  accept = "image/*",
  onFiles,
  onWebImageUrls,
  label,
  subLabel,
  className,
  enableDragDrop = true,
}: PickProps) {
  const { t } = useLocale();
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);

  const endDrag = useCallback(() => {
    dragDepth.current = 0;
    setDragActive(false);
  }, []);

  const handleDragEnter = (e: DragEvent) => {
    if (!enableDragDrop || disabled || busy) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (!enableDragDrop || disabled || busy) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) endDrag();
  };

  const handleDragOver = (e: DragEvent) => {
    if (!enableDragDrop || disabled || busy) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent) => {
    if (!enableDragDrop || disabled || busy) return;
    e.preventDefault();
    e.stopPropagation();
    endDrag();
    const dt = e.dataTransfer;
    if (!dt) return;

    const fromPicker = dt.files?.length ? Array.from(dt.files) : [];
    const droppedFiles = filterDroppedImageFiles(fromPicker);
    const dataUrlFiles = await extractDataUrlImageFiles(dt);
    const mergedLocal = [...droppedFiles, ...dataUrlFiles];
    const list = mergeToFileList(mergedLocal);
    if (list?.length) onFiles(list);

    const urls = extractWebImageDropUrls(dt);
    if (urls.length && onWebImageUrls && !list?.length) onWebImageUrls(urls);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "rounded-2xl transition",
          dragActive && enableDragDrop && !disabled && !busy && "ring-2 ring-cyan-300/80 ring-offset-2 ring-offset-slate-950"
        )}
      >
        <label
          htmlFor={id}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-400/50 bg-gradient-to-b from-cyan-500/20 to-teal-900/20 px-6 py-5 text-center shadow-lg shadow-cyan-900/20 transition hover:border-cyan-300/70 hover:from-cyan-500/30 hover:to-teal-900/30",
            (disabled || busy) && "pointer-events-none opacity-45",
            dragActive && enableDragDrop && !disabled && !busy && "border-cyan-200/70 from-cyan-500/35 to-teal-900/35"
          )}
        >
          <span className="text-base font-semibold tracking-wide text-white">
            {busy ? t("hints.pickBusy") : label}
          </span>
          {subLabel ? <span className="mt-1 text-xs text-white/55">{subLabel}</span> : null}
          {enableDragDrop && !disabled && !busy ? (
            <span className="mt-2 text-[11px] text-cyan-200/75">{t("hints.dragHint")}</span>
          ) : null}
          <input
            id={id}
            type="file"
            accept={accept}
            multiple={multiple}
            className="sr-only"
            disabled={disabled || busy}
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
