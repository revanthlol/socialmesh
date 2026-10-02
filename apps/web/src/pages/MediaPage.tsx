import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Check, Eye, FileImage, Image as ImageIcon, LoaderCircle, Trash2, Upload, Video, X } from "lucide-react";
import { useMediaActions, useMediaList, isSupportedMediaFile, SUPPORTED_MEDIA_TYPES } from "../hooks/useMedia.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { MediaAsset, MediaKind } from "../api/types.js";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.js";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toFixed(power === 0 ? 0 : 1)} ${units[power]}`;
}

export function MediaPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterKind, setFilterKind] = useState<MediaKind | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ current: number; total: number; name: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: media = [], isLoading, isError } = useMediaList(workspaceId);
  const { uploadMedia, isUploading, uploadProgress, deleteMedia, isDeleting } = useMediaActions(workspaceId);
  const imagesCount = media.filter((asset) => asset.kind === "IMAGE").length;
  const videosCount = media.filter((asset) => asset.kind === "VIDEO").length;
  const visibleMedia = media.filter((asset) => (filterKind === "ALL" || asset.kind === filterKind) && asset.originalName.toLowerCase().includes(query.trim().toLowerCase()));

  async function handleUpload(files: FileList | File[]) {
    const queue = Array.from(files);
    if (!queue.length) return;
    let uploaded = 0;
    const failed: string[] = [];
    for (const [index, file] of queue.entries()) {
      setUploadQueue({ current: index + 1, total: queue.length, name: file.name });
      if (!isSupportedMediaFile(file)) {
        failed.push(`${file.name}: unsupported file type`);
        continue;
      }
      try {
        await uploadMedia(file);
        uploaded += 1;
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }
    setUploadQueue(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (failed.length) setFeedback({ type: "error", text: failed.length === 1 ? failed[0] : `${uploaded} uploaded. ${failed.length} could not be uploaded: ${failed.slice(0, 2).join("; ")}${failed.length > 2 ? "; more files failed" : ""}` });
    else setFeedback({ type: "success", text: uploaded === 1 ? "Media uploaded." : `${uploaded} files uploaded.` });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void handleUpload(event.target.files);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleUpload(event.dataTransfer.files);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const asset = deleteTarget;
    setFeedback(null);
    try {
      await deleteMedia(asset.id);
      setDeleteTarget(null);
      setFeedback({ type: "success", text: `${asset.originalName} deleted.` });
      if (selectedAsset?.id === asset.id) setSelectedAsset(null);
    } catch (error) {
      setDeleteTarget(null);
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Could not delete this media." });
    }
  }

  return <div className="page-shell media-workspace">
    {deleteTarget && <ConfirmDialog title="Delete this media?" description={`“${deleteTarget.originalName}” will be removed from this workspace.`} confirmLabel="Delete media" isBusy={isDeleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
    <header className="media-heading"><div><h1>Media library</h1><p>Find and manage the images and videos used in your posts.</p></div><Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}><Upload size={15} />Upload media</Button></header>

    <input ref={fileInputRef} className="sr-only" type="file" accept={SUPPORTED_MEDIA_TYPES.join(",")} multiple onChange={onFileChange} aria-label="Choose media files to upload" />
    <div className={`media-upload-zone ${isDragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }} onDrop={onDrop}>
      <span className="media-upload-icon"><Upload size={17} /></span><div><strong>Drop files to upload</strong><span>JPG, PNG, WEBP, GIF, MP4, or MOV</span></div><Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>Browse files</Button>
    </div>

    {uploadQueue && <div className="media-upload-progress" role="status" aria-live="polite"><div><LoaderCircle size={15} className="media-spinner" /><span>Uploading {uploadQueue.name}<small>File {uploadQueue.current} of {uploadQueue.total}</small></span><strong>{uploadProgress ?? 0}%</strong></div><progress value={uploadProgress ?? 0} max={100} aria-label="File upload progress" /></div>}
    {feedback && <p className={`media-feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.type === "success" ? <Check size={15} /> : <AlertCircle size={15} />}{feedback.text}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}><X size={14} /></button></p>}

    <div className="media-toolbar">
      <div className="media-filters" role="group" aria-label="Filter media by type">{(["ALL", "IMAGE", "VIDEO"] as const).map((kind) => <button key={kind} type="button" aria-pressed={filterKind === kind} className={filterKind === kind ? "is-selected" : ""} onClick={() => setFilterKind(kind)}>{kind === "ALL" ? "All media" : kind === "IMAGE" ? "Images" : "Videos"}<span>{kind === "ALL" ? media.length : kind === "IMAGE" ? imagesCount : videosCount}</span></button>)}</div>
      <label className="media-search"><span className="sr-only">Search filenames</span><ImageIcon size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a filename" /></label>
    </div>

    {isError ? <div className="media-load-error" role="alert"><AlertCircle size={17} /><div><strong>Media couldn’t be loaded</strong><span>Check your connection and try again.</span></div></div>
      : isLoading ? <div className="media-grid">{Array.from({ length: 10 }, (_, index) => <div className="asset-skeleton" key={index}><Skeleton className="asset-skeleton-thumb" /><Skeleton className="h-3 w-4/5" /><Skeleton className="h-3 w-2/5" /></div>)}</div>
        : visibleMedia.length === 0 ? <div className="media-empty"><EmptyState icon={<FileImage size={27} />} title={query ? "No matching media" : filterKind === "ALL" ? "Your media library is empty" : `No ${filterKind === "IMAGE" ? "images" : "videos"} yet`} description={query ? "Try a different filename." : "Upload images or videos here, then add them to a post from Compose."} action={!query && <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload size={14} />Upload media</Button>} /></div>
          : <div className="media-grid">{visibleMedia.map((asset) => <article key={asset.id} className="asset-item">
            <button type="button" className="asset-preview-button" onClick={() => setSelectedAsset(asset)} aria-label={`Preview ${asset.originalName}`}>
              <span className="asset-preview">{asset.kind === "IMAGE" && asset.viewUrl ? <img src={asset.viewUrl} alt={asset.originalName} loading="lazy" /> : asset.kind === "VIDEO" && asset.viewUrl ? <video src={asset.viewUrl} preload="metadata" muted aria-label={asset.originalName} /> : asset.kind === "VIDEO" ? <Video size={23} /> : <ImageIcon size={23} />}
                {asset.kind === "VIDEO" && <span className="asset-kind-mark"><Video size={13} />Video</span>}
                {asset.status !== "READY" && <span className={`asset-processing ${asset.status.toLowerCase()}`}>{asset.status === "PENDING_UPLOAD" ? "Processing" : asset.status === "REJECTED" ? "Failed" : asset.status}</span>}
              </span>
            </button>
            <div className="asset-details"><strong title={asset.originalName}>{asset.originalName}</strong><div><span>{asset.kind === "IMAGE" ? "Image" : "Video"}</span><span>{formatBytes(asset.byteSize)}</span></div>
              <div className="asset-actions"><button type="button" onClick={() => setSelectedAsset(asset)}><Eye size={14} />Preview</button><button type="button" className="asset-delete-action" onClick={() => setDeleteTarget(asset)}><Trash2 size={14} />Delete</button></div>
            </div>
          </article>)}</div>}

    {selectedAsset && <div className="media-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAsset(null); }}>
      <section className="media-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title">
        <header><div><h2 id="preview-title">{selectedAsset.originalName}</h2><p>{selectedAsset.kind === "IMAGE" ? "Image" : "Video"} · {formatBytes(selectedAsset.byteSize)}</p></div><button type="button" aria-label="Close preview" onClick={() => setSelectedAsset(null)}><X size={18} /></button></header>
        <div className="media-preview-stage">{selectedAsset.kind === "IMAGE" && selectedAsset.viewUrl ? <img src={selectedAsset.viewUrl} alt={selectedAsset.originalName} /> : selectedAsset.kind === "VIDEO" && selectedAsset.viewUrl ? <video src={selectedAsset.viewUrl} controls playsInline /> : <span>Preview unavailable</span>}</div>
      </section>
    </div>}
  </div>;
}
