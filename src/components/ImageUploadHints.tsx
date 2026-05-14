import { cn } from "@/lib/utils";
import { IMGBB_DEFAULT_EXPIRATION_SECONDS, IMGBB_UPLOAD_MAX_BYTES } from "@/lib/imgbb";

const MB = IMGBB_UPLOAD_MAX_BYTES / (1024 * 1024);
const DEFAULT_DAYS = Math.round(IMGBB_DEFAULT_EXPIRATION_SECONDS / 86_400);

function FullHintList() {
  return (
    <ul className="mt-1.5 list-inside list-disc space-y-1 text-cyan-100/80">
      <li>
        单张最大 <strong className="text-white">{MB}MB</strong>，超出将上传失败。
      </li>
      <li>
        服务端使用 imgbb 参数 <code className="rounded bg-black/30 px-1">expiration</code>（默认{" "}
        <strong className="text-white">{DEFAULT_DAYS}</strong> 天），到期后由图床<strong>自动删除</strong>
        文件，链接会失效；重要素材请自行备份。
      </li>
      <li>
        部署环境可通过 <code className="rounded bg-black/30 px-1">IMGBB_EXPIRATION_SECONDS</code> 调整（秒，官方允许
        60–15552000）。机器可读说明见 <code className="rounded bg-black/30 px-1">GET /api/upload-image</code>。
      </li>
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
  return (
    <div
      className={cn(
        "rounded-xl border border-cyan-500/25 bg-cyan-950/40 px-3 py-2.5 text-[11px] leading-relaxed text-cyan-100/85",
        className
      )}
    >
      <p className="font-medium text-cyan-200/95">上传说明（图床 imgbb）</p>
      {compact ? (
        <>
          <p className="mt-1.5 text-cyan-100/85">
            每张最大 <strong className="text-white">{MB}MB</strong>；托管约 <strong className="text-white">{DEFAULT_DAYS}</strong>{" "}
            天后会自动删除，重要照片请自己留备份。
          </p>
          <details className="mt-2 group">
            <summary className="cursor-pointer list-none text-cyan-200/90 marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="underline decoration-cyan-400/40 underline-offset-2 group-open:decoration-cyan-300/60">
                展开技术说明
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
  label: string;
  subLabel?: string;
  className?: string;
};

/** 大尺寸、易发现的上传触发器（隐藏原生 input） */
export function ImagePickButton({
  id = "image-pick-input",
  disabled,
  busy,
  multiple = true,
  accept = "image/*",
  onFiles,
  label,
  subLabel,
  className,
}: PickProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-400/50 bg-gradient-to-b from-cyan-500/20 to-teal-900/20 px-6 py-5 text-center shadow-lg shadow-cyan-900/20 transition hover:border-cyan-300/70 hover:from-cyan-500/30 hover:to-teal-900/30",
          (disabled || busy) && "pointer-events-none opacity-45"
        )}
      >
        <span className="text-base font-semibold tracking-wide text-white">{busy ? "处理中…" : label}</span>
        {subLabel ? <span className="mt-1 text-xs text-white/55">{subLabel}</span> : null}
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
  );
}
