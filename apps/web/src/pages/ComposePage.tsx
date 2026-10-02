import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, CalendarClock, Check, Image as ImageIcon, LoaderCircle, Plus, Send, Trash2, Upload, Video, X } from "lucide-react";
import { usePost, usePosts } from "../hooks/usePosts.js";
import { isSupportedMediaFile, SUPPORTED_MEDIA_TYPES, useMediaActions, useMediaList } from "../hooks/useMedia.js";
import { useChannels } from "../hooks/useChannels.js";
import { usePublishingStatus } from "../hooks/usePublishingStatus.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { Textarea } from "../components/ui/Textarea.js";
import type { MediaAsset, WorkspaceChannel } from "../api/types.js";

const MAX_MEDIA = 10;

function formatProvider(provider: string) {
  const labels: Record<string, string> = { x: "X", twitter: "X", "linkedin-page": "LinkedIn Page", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", pinterest: "Pinterest", reddit: "Reddit", devto: "Dev.to" };
  return labels[provider.toLowerCase()] || provider;
}

export function ComposePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get("postId");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadBatchActive, setIsUploadBatchActive] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: existingPost, isLoading: postLoading } = usePost(workspaceId, editPostId || undefined);
  const { data: mediaLibrary = [], isLoading: mediaLoading, isError: mediaLoadError } = useMediaList(workspaceId);
  const { channels = [], isLoading: channelsLoading } = useChannels(workspaceId);
  const { isConnected: isPublishingAvailable } = usePublishingStatus();
  const { uploadMedia, isUploading, uploadProgress } = useMediaActions(workspaceId);
  const { createDraft, isCreating, updateDraft, isUpdating, publishPost, isPublishing, schedulePost, isScheduling: isSchedulePending } = usePosts(workspaceId);

  useEffect(() => {
    if (!existingPost) return;
    setContent(existingPost.content);
    setSelectedMedia(existingPost.media.map(({ asset }) => asset).filter((asset): asset is MediaAsset => Boolean(asset)));
    setSelectedChannelIds(existingPost.targets.map(({ channelId }) => channelId).filter((id): id is string => Boolean(id)));
    if (existingPost.scheduledFor) {
      setIsScheduling(true);
      const date = new Date(existingPost.scheduledFor);
      setScheduledDateTime(new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16));
    }
  }, [existingPost]);

  const hasImages = selectedMedia.some((asset) => asset.kind === "IMAGE");
  const videoCount = selectedMedia.filter((asset) => asset.kind === "VIDEO").length;
  const mediaValidation = hasImages && videoCount > 0
    ? "Facebook and most social platforms don’t allow photos and videos in the same post. Choose one media type."
    : videoCount > 1
      ? "Facebook does not support uploading multiple videos in one post. Remove extra videos to continue."
      : null;
  const isBusy = isCreating || isUpdating || isPublishing || isSchedulePending || isUploading || isUploadBatchActive;
  const readyMedia = mediaLibrary.filter((asset) => asset.status === "READY");

  function toggleChannel(channelId: string) {
    setSelectedChannelIds((current) => current.includes(channelId) ? current.filter((id) => id !== channelId) : [...current, channelId]);
  }

  function toggleMediaSelection(asset: MediaAsset) {
    setSelectedMedia((current) => {
      if (current.some((item) => item.id === asset.id)) return current.filter((item) => item.id !== asset.id);
      if (current.length >= MAX_MEDIA) {
        setStatusMessage({ type: "error", text: "A post can include up to 10 media items." });
        return current;
      }
      return [...current, asset];
    });
  }

  async function handleUpload(files: FileList | File[]) {
    const queue = Array.from(files);
    if (!queue.length) return;
    setStatusMessage(null);
    setIsUploadBatchActive(true);
    let attached = 0;
    const errors: string[] = [];
    try {
      for (const file of queue) {
        if (selectedMedia.length + attached >= MAX_MEDIA) {
          errors.push("A post can include up to 10 media items. The remaining files were not uploaded.");
          break;
        }
        if (!isSupportedMediaFile(file)) {
          errors.push(`${file.name} isn’t a supported file. Choose JPG, PNG, WEBP, GIF, MP4, or MOV.`);
          continue;
        }
        try {
          const asset = await uploadMedia(file);
          setSelectedMedia((current) => current.length < MAX_MEDIA ? [...current, asset] : current);
          attached += 1;
        } catch (error) {
          errors.push(error instanceof Error ? `${file.name}: ${error.message}` : `Could not upload ${file.name}.`);
        }
      }
    } finally {
      setIsUploadBatchActive(false);
    }
    if (errors.length) setStatusMessage({ type: "error", text: `${attached ? `${attached} file${attached === 1 ? "" : "s"} added. ` : ""}${errors.slice(0, 2).join(" ")}${errors.length > 2 ? " More files could not be uploaded." : ""}` });
    else if (attached) setStatusMessage({ type: "success", text: attached === 1 ? "Media uploaded and added to this post." : `${attached} files uploaded and added to this post.` });
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void handleUpload(event.target.files);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleUpload(event.dataTransfer.files);
  }

  async function handleSaveDraft(event?: FormEvent) {
    event?.preventDefault();
    if (!content.trim()) {
      setStatusMessage({ type: "error", text: "Write some post text before saving." });
      return null;
    }
    setStatusMessage(null);
    try {
      const data = { content: content.trim(), mediaAssetIds: selectedMedia.map((asset) => asset.id), channelIds: selectedChannelIds, scheduledFor: null };
      const post = editPostId
        ? await updateDraft({ postId: editPostId, data })
        : await createDraft(data);
      setStatusMessage({ type: "success", text: editPostId ? "Draft updated." : "Draft saved." });
      return post;
    } catch (error) {
      setStatusMessage({ type: "error", text: error instanceof Error ? error.message : "Could not save this draft." });
      return null;
    }
  }

  async function handlePublishNow() {
    if (!selectedChannelIds.length) {
      setStatusMessage({ type: "error", text: "Choose at least one destination to publish." });
      return;
    }
    if (mediaValidation) {
      setStatusMessage({ type: "error", text: mediaValidation });
      return;
    }
    setStatusMessage(null);
    try {
      const post = await handleSaveDraft();
      if (!post) return;
      await publishPost(post.id);
      setStatusMessage({ type: "success", text: "Post submitted for publishing." });
      window.setTimeout(() => navigate(`/app/${workspaceId}/posts`), 900);
    } catch (error) {
      setStatusMessage({ type: "error", text: error instanceof Error ? error.message : "Publishing failed. Check the selected account connections." });
    }
  }

  async function handleSchedulePost() {
    if (!selectedChannelIds.length) {
      setStatusMessage({ type: "error", text: "Choose at least one destination to schedule." });
      return;
    }
    if (mediaValidation) {
      setStatusMessage({ type: "error", text: mediaValidation });
      return;
    }
    if (!scheduledDateTime || new Date(scheduledDateTime).getTime() <= Date.now()) {
      setStatusMessage({ type: "error", text: "Choose a future date and time." });
      return;
    }
    setStatusMessage(null);
    try {
      const post = await handleSaveDraft();
      if (!post) return;
      await schedulePost({ postId: post.id, scheduledFor: new Date(scheduledDateTime).toISOString() });
      setStatusMessage({ type: "success", text: "Post scheduled." });
      window.setTimeout(() => navigate(`/app/${workspaceId}/posts`), 900);
    } catch (error) {
      setStatusMessage({ type: "error", text: error instanceof Error ? error.message : "Could not schedule this post." });
    }
  }

  if (editPostId && postLoading) return <div className="page-shell space-y-4" aria-label="Loading post"><Skeleton className="h-10 w-52" /><Skeleton className="h-72 w-full" /></div>;

  return (
    <div className="page-shell compose-workspace">
      <header className="compose-heading">
        <div><h1>{editPostId ? "Edit post" : "Compose post"}</h1><p>Write once, then choose where and when it goes out.</p></div>
        <Link to={`/app/${workspaceId}/posts`} className="compose-cancel">Close</Link>
      </header>

      {!isPublishingAvailable && <p className="compose-offline" role="status"><AlertCircle size={15} /> Publishing is unavailable right now. You can still save this as a draft.</p>}
      {statusMessage && <p className={`compose-feedback ${statusMessage.type}`} role={statusMessage.type === "error" ? "alert" : "status"} aria-live="polite">{statusMessage.type === "error" ? <AlertCircle size={16} /> : <Check size={16} />}{statusMessage.text}<button type="button" aria-label="Dismiss message" onClick={() => setStatusMessage(null)}><X size={15} /></button></p>}

      <form className="compose-layout" onSubmit={handleSaveDraft}>
        <section className="compose-editor">
          <label className="compose-field-label" htmlFor="post-content">Post</label>
          <Textarea id="post-content" rows={10} value={content} onChange={(event) => setContent(event.target.value)} placeholder="What would you like to share?" className="compose-textarea" />
          <div className="compose-editor-meta"><span>{content.length > 0 ? `${content.length} characters` : "Your post text"}</span><span>Up to 10 media items</span></div>

          <section className="compose-media" aria-labelledby="compose-media-heading">
            <div className="compose-section-heading"><h2 id="compose-media-heading">Media</h2><span>{selectedMedia.length}/{MAX_MEDIA}</span></div>
            <div className={`compose-dropzone ${isDragging ? "is-dragging" : ""}`} onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false); }} onDrop={onDrop}>
              <input ref={uploadInputRef} className="sr-only" type="file" accept={SUPPORTED_MEDIA_TYPES.join(",")} multiple onChange={onFileChange} aria-label="Choose media files to upload" />
              <div className="dropzone-copy"><span className="dropzone-icon"><Upload size={17} /></span><div><strong>Drop media here</strong><span>Images and videos, up to {MAX_MEDIA} items</span></div></div>
              <div className="dropzone-actions"><Button type="button" variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()} disabled={isBusy}><Upload size={14} />Upload from device</Button><Button type="button" variant="ghost" size="sm" onClick={() => setIsMediaPickerOpen((open) => !open)}><ImageIcon size={14} />{isMediaPickerOpen ? "Close library" : "Choose from library"}</Button></div>
              {isUploading && <div className="compose-upload-progress" role="status"><div><LoaderCircle size={14} className="compose-spin" />Uploading media<span>{uploadProgress ?? 0}%</span></div><progress value={uploadProgress ?? 0} max={100} aria-label="Media upload progress" /></div>}
            </div>

            {mediaValidation && <p className="compose-validation" role="alert"><AlertCircle size={15} />{mediaValidation}</p>}
            {selectedMedia.length > 0 && <ol className="compose-attachments" aria-label="Attached media in publishing order">{selectedMedia.map((asset, index) => <li key={asset.id}>
              <span className="attachment-order">{index + 1}</span>
              <div className="attachment-preview">{asset.kind === "IMAGE" && asset.viewUrl ? <img src={asset.viewUrl} alt={asset.originalName} /> : asset.kind === "VIDEO" && asset.viewUrl ? <video src={asset.viewUrl} preload="metadata" aria-label={asset.originalName} /> : asset.kind === "VIDEO" ? <Video size={20} /> : <ImageIcon size={20} />}</div>
              <div className="attachment-info"><strong title={asset.originalName}>{asset.originalName}</strong><span>{asset.kind === "VIDEO" ? "Video" : "Image"}</span></div>
              <button type="button" className="attachment-remove" aria-label={`Remove ${asset.originalName} from this post`} onClick={() => setSelectedMedia((items) => items.filter((item) => item.id !== asset.id))}><X size={16} /></button>
            </li>)}</ol>}

            {isMediaPickerOpen && <div className="compose-library" aria-label="Choose from media library">
              <div className="compose-library-heading"><strong>Media library</strong><span>{mediaLoading ? "Loading…" : `${readyMedia.length} ready`}</span></div>
              {mediaLoading ? <div className="compose-library-loading"><Skeleton className="h-16 w-16" /><Skeleton className="h-16 w-16" /><Skeleton className="h-16 w-16" /></div> : mediaLoadError ? <p className="compose-library-empty" role="alert">Couldn’t load your media library. You can still upload files from your device.</p> : readyMedia.length === 0 ? <p className="compose-library-empty">No ready media yet. Upload a file above to add it here.</p> : <div className="compose-library-grid">{readyMedia.map((asset) => {
                const selected = selectedMedia.some((item) => item.id === asset.id);
                return <button type="button" key={asset.id} className={`library-asset ${selected ? "is-selected" : ""}`} onClick={() => toggleMediaSelection(asset)} aria-pressed={selected} aria-label={`${selected ? "Remove" : "Add"} ${asset.originalName}`}>
                  <span className="library-asset-preview">{asset.kind === "IMAGE" && asset.viewUrl ? <img src={asset.viewUrl} alt="" /> : asset.kind === "VIDEO" && asset.viewUrl ? <video src={asset.viewUrl} preload="metadata" aria-hidden="true" /> : <Video size={18} />}{selected && <span className="library-check"><Check size={13} /></span>}</span><span className="library-asset-name">{asset.originalName}</span>
                </button>;
              })}</div>}
            </div>}
          </section>
        </section>

        <aside className="compose-publishing">
          <section className="compose-destinations" aria-labelledby="destinations-heading">
            <div className="compose-section-heading"><h2 id="destinations-heading">Publish to</h2><span>{selectedChannelIds.length} selected</span></div>
            {channelsLoading ? <div className="destination-skeleton"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /></div> : channels.length === 0 ? <div className="destination-empty"><p>No connected accounts are assigned to this workspace.</p><Link to={`/app/${workspaceId}/accounts`}>Manage accounts</Link></div> : <div className="destination-list">{channels.map((channel: WorkspaceChannel) => {
              const selected = selectedChannelIds.includes(channel.id);
              return <button type="button" key={channel.id} className={`destination-option ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => toggleChannel(channel.id)}>
                {channel.pictureUrl ? <img className="destination-avatar" src={channel.pictureUrl} alt="" /> : <span className="destination-avatar destination-initial">{channel.name.slice(0, 1).toUpperCase()}</span>}
                <span className="destination-details"><strong>{channel.name}</strong><span>{formatProvider(channel.provider)}</span></span>
                <span className="destination-check" aria-hidden="true">{selected && <Check size={13} />}</span>
              </button>;
            })}</div>}
            {channels.length > 0 && <Link className="destination-manage" to={`/app/${workspaceId}/accounts`}>Manage connected accounts</Link>}
          </section>

          <section className="compose-timing" aria-labelledby="timing-heading">
            <div className="compose-section-heading"><h2 id="timing-heading">When</h2></div>
            <div className="publish-mode" role="group" aria-label="Choose when to publish">
              <button type="button" aria-pressed={!isScheduling} className={!isScheduling ? "is-active" : ""} onClick={() => setIsScheduling(false)}><Send size={14} />Publish now</button>
              <button type="button" aria-pressed={isScheduling} className={isScheduling ? "is-active" : ""} onClick={() => setIsScheduling(true)}><CalendarClock size={14} />Schedule</button>
            </div>
            {isScheduling && <div className="schedule-input"><label htmlFor="scheduled-date">Date and time</label><input id="scheduled-date" type="datetime-local" value={scheduledDateTime} onChange={(event) => setScheduledDateTime(event.target.value)} /><span>Time uses your device’s local timezone.</span></div>}
          </section>

          <div className="compose-actions">
            <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={isBusy} className="compose-save">Save draft</Button>
            {isScheduling ? <Button type="button" onClick={() => void handleSchedulePost()} disabled={isBusy || !isPublishingAvailable || !selectedChannelIds.length} isLoading={isSchedulePending} className="compose-submit"><CalendarClock size={15} />Schedule post</Button> : <Button type="button" onClick={() => void handlePublishNow()} disabled={isBusy || !isPublishingAvailable || !selectedChannelIds.length} isLoading={isPublishing} className="compose-submit"><Send size={15} />Publish now</Button>}
          </div>
          {!selectedChannelIds.length && channels.length > 0 && <p className="compose-action-hint">Choose a destination to continue.</p>}
        </aside>
      </form>
    </div>
  );
}
