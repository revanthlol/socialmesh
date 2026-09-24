import { useState, useRef, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import {
  UploadCloud,
  Image as ImageIcon,
  Video,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { useMediaList, useMediaActions } from "../hooks/useMedia.js";
import { Button } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { MediaAsset } from "../api/types.js";

export function MediaPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterKind, setFilterKind] = useState<"IMAGE" | "VIDEO" | undefined>(
    undefined,
  );
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { data: media = [], isLoading } = useMediaList(workspaceId, filterKind);
  const { uploadMedia, isUploading, uploadProgress, deleteMedia, isDeleting } =
    useMediaActions(workspaceId);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);

    // Validate client-side
    const validMimes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ];
    if (!validMimes.includes(file.type)) {
      setStatusMessage({
        type: "error",
        text: `File type '${file.type || "unknown"}' is not supported. Please choose JPG, PNG, WEBP, GIF, or MP4.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      await uploadMedia(file);
      setStatusMessage({
        type: "success",
        text: `Successfully uploaded ${file.name} directly to Cloudflare R2.`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Upload failed. Please try again.",
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(mediaId: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}" from storage?`))
      return;

    try {
      await deleteMedia(mediaId);
      setStatusMessage({ type: "success", text: `Deleted "${name}".` });
      if (selectedAsset?.id === mediaId) {
        setSelectedAsset(null);
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to delete asset",
      });
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
            Media Library
          </h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Private Cloudflare R2 bucket with secure direct browser uploads and
            signed view tokens.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            isLoading={isUploading}
            className="gap-2"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Media
          </Button>
        </div>
      </div>

      {/* Progress Bar during upload */}
      {isUploading && (
        <div className="p-4 rounded border border-[#c9c5bb] bg-white space-y-2">
          <div className="flex justify-between text-xs font-medium text-[#161a1d]">
            <span>Uploading directly to Cloudflare R2...</span>
            <span>{uploadProgress ?? 0}%</span>
          </div>
          <div className="w-full bg-[#f2f0e9] h-2 rounded overflow-hidden">
            <div
              className="bg-[#161a1d] h-full transition-all duration-150"
              style={{ width: `${uploadProgress ?? 0}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status Notifications */}
      {statusMessage && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between border ${
            statusMessage.type === "success"
              ? "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]"
              : "bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-current font-bold opacity-60 hover:opacity-100 cursor-pointer ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterKind(undefined)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            filterKind === undefined
              ? "bg-[#161a1d] text-white border-[#161a1d]"
              : "bg-[#faf9f5] text-[#4c5359] border-[#c9c5bb] hover:bg-[#e8e6df]"
          }`}
        >
          All Assets ({media.length})
        </button>
        <button
          onClick={() => setFilterKind("IMAGE")}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            filterKind === "IMAGE"
              ? "bg-[#161a1d] text-white border-[#161a1d]"
              : "bg-[#faf9f5] text-[#4c5359] border-[#c9c5bb] hover:bg-[#e8e6df]"
          }`}
        >
          Images
        </button>
        <button
          onClick={() => setFilterKind("VIDEO")}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            filterKind === "VIDEO"
              ? "bg-[#161a1d] text-white border-[#161a1d]"
              : "bg-[#faf9f5] text-[#4c5359] border-[#c9c5bb] hover:bg-[#e8e6df]"
          }`}
        >
          Videos
        </button>
      </div>

      {/* Media Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square bg-[#e8e6df] rounded border border-[#c9c5bb]"
            ></div>
          ))}
        </div>
      ) : media.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-10 w-10 text-[#6b706f]" />}
          title="No media in this library"
          description="Upload images (JPG, PNG, WEBP, GIF) or videos (MP4) for your social posts."
          action={
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              Upload First Asset
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {media.map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded border border-[#c9c5bb] bg-[#faf9f5] overflow-hidden flex flex-col transition-shadow hover:shadow-md"
            >
              {/* Media Thumbnail Container */}
              <div className="aspect-square bg-[#e8e6df] relative flex items-center justify-center overflow-hidden">
                {asset.kind === "IMAGE" && asset.viewUrl ? (
                  <img
                    src={asset.viewUrl}
                    alt={asset.originalName}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : asset.kind === "VIDEO" && asset.viewUrl ? (
                  <video
                    src={asset.viewUrl}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-[#6b706f]">
                    {asset.kind === "IMAGE" ? (
                      <ImageIcon className="h-8 w-8" />
                    ) : (
                      <Video className="h-8 w-8" />
                    )}
                    <span className="text-[10px] font-mono">
                      {asset.status}
                    </span>
                  </div>
                )}

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-[#161a1d]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {asset.viewUrl && (
                    <button
                      onClick={() => setSelectedAsset(asset)}
                      title="View preview"
                      className="p-2 rounded bg-white text-[#161a1d] hover:bg-[#f2f0e9] transition-colors cursor-pointer"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(asset.id, asset.originalName)}
                    title="Delete asset"
                    disabled={isDeleting}
                    className="p-2 rounded bg-[#b23a24] text-white hover:bg-[#962f1c] transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Asset Metadata */}
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <p
                  className="text-xs font-medium text-[#161a1d] truncate"
                  title={asset.originalName}
                >
                  {asset.originalName}
                </p>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#e8e6df] text-[10px] text-[#6b706f] font-mono">
                  <span>{formatBytes(asset.byteSize)}</span>
                  <Badge
                    variant={asset.status === "READY" ? "success" : "neutral"}
                    size="sm"
                  >
                    {asset.kind}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/75 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] rounded max-w-2xl w-full border border-[#c9c5bb] overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#c9c5bb] flex items-center justify-between">
              <div className="min-w-0 pr-4">
                <h3 className="text-sm font-semibold text-[#161a1d] truncate">
                  {selectedAsset.originalName}
                </h3>
                <p className="text-xs text-[#6b706f] font-mono mt-0.5">
                  {selectedAsset.mimeType} •{" "}
                  {formatBytes(selectedAsset.byteSize)}
                </p>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="text-[#6b706f] hover:text-[#161a1d] text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="p-4 bg-[#e8e6df] flex items-center justify-center max-h-[60vh] overflow-hidden">
              {selectedAsset.kind === "IMAGE" && selectedAsset.viewUrl ? (
                <img
                  src={selectedAsset.viewUrl}
                  alt={selectedAsset.originalName}
                  className="max-h-[55vh] object-contain rounded"
                />
              ) : selectedAsset.kind === "VIDEO" && selectedAsset.viewUrl ? (
                <video
                  src={selectedAsset.viewUrl}
                  controls
                  className="max-h-[55vh] rounded"
                />
              ) : null}
            </div>

            <div className="p-4 border-t border-[#c9c5bb] flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#6b706f]">
                Signed URL valid for 1 hour
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAsset(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
