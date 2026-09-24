import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  PenSquare,
  Image as ImageIcon,
  Save,
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Share2,
  Plus,
  X,
  ExternalLink,
} from "lucide-react";
import { usePost, usePosts } from "../hooks/usePosts.js";
import { useMediaList } from "../hooks/useMedia.js";
import { useChannels } from "../hooks/useChannels.js";
import { usePublishingStatus } from "../hooks/usePublishingStatus.js";
import { Button } from "../components/ui/Button.js";
import { Textarea } from "../components/ui/Textarea.js";
import { Input } from "../components/ui/Input.js";
import { Badge } from "../components/ui/Badge.js";
import type { MediaAsset, WorkspaceChannel } from "../api/types.js";

export function ComposePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get("postId");

  const [content, setContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const { data: existingPost, isLoading: postLoading } = usePost(
    workspaceId,
    editPostId || undefined,
  );
  const { data: mediaLibrary = [], isLoading: mediaLoading } =
    useMediaList(workspaceId);
  const { channels = [], isLoading: channelsLoading } =
    useChannels(workspaceId);
  const { isConnected: isEngineConnected } = usePublishingStatus();

  const {
    createDraft,
    isCreating,
    updateDraft,
    isUpdating,
    publishPost,
    isPublishing,
    schedulePost,
    isScheduling: isSchedulePending,
  } = usePosts(workspaceId);

  useEffect(() => {
    if (existingPost) {
      setContent(existingPost.content);
      const attached = existingPost.media
        .map((m) => m.asset)
        .filter(Boolean) as MediaAsset[];
      setSelectedMedia(attached);

      const channelIds = (existingPost.targets || [])
        .map((t) => t.channelId)
        .filter(Boolean) as string[];
      setSelectedChannelIds(channelIds);

      if (existingPost.scheduledFor) {
        setIsScheduling(true);
        // format ISO date to YYYY-MM-DDTHH:mm for datetime-local input
        const d = new Date(existingPost.scheduledFor);
        const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setScheduledDateTime(localIso);
      }
    }
  }, [existingPost]);

  function toggleChannel(channelId: string) {
    if (selectedChannelIds.includes(channelId)) {
      setSelectedChannelIds(
        selectedChannelIds.filter((id) => id !== channelId),
      );
    } else {
      setSelectedChannelIds([...selectedChannelIds, channelId]);
    }
  }

  function toggleMediaSelection(asset: MediaAsset) {
    if (selectedMedia.some((m) => m.id === asset.id)) {
      setSelectedMedia(selectedMedia.filter((m) => m.id !== asset.id));
    } else {
      if (selectedMedia.length >= 10) {
        alert("Maximum 10 media items can be attached to a post.");
        return;
      }
      setSelectedMedia([...selectedMedia, asset]);
    }
  }

  async function handleSaveDraft(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!content.trim()) {
      setStatusMessage({
        type: "error",
        text: "Please enter some content for your draft.",
      });
      return null;
    }

    setStatusMessage(null);

    try {
      const mediaAssetIds = selectedMedia.map((m) => m.id);
      const scheduledIso =
        isScheduling && scheduledDateTime
          ? new Date(scheduledDateTime).toISOString()
          : null;

      if (editPostId) {
        const updated = await updateDraft({
          postId: editPostId,
          data: {
            content: content.trim(),
            mediaAssetIds,
            channelIds: selectedChannelIds,
            scheduledFor: scheduledIso,
          },
        });
        setStatusMessage({
          type: "success",
          text: "Draft updated successfully.",
        });
        return updated;
      } else {
        const created = await createDraft({
          content: content.trim(),
          mediaAssetIds,
          channelIds: selectedChannelIds,
          scheduledFor: scheduledIso,
        });
        setStatusMessage({
          type: "success",
          text: "Draft saved successfully.",
        });
        return created;
      }
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to save draft.",
      });
      return null;
    }
  }

  async function handlePublishNow() {
    if (selectedChannelIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Please select at least one channel to publish to.",
      });
      return;
    }

    setStatusMessage(null);

    try {
      // First save draft with current content & channels
      const post = await handleSaveDraft();
      if (!post) return;

      // Now publish immediately through engine
      await publishPost(post.id);
      setStatusMessage({
        type: "success",
        text: "Post published successfully!",
      });
      setTimeout(() => navigate(`/app/${workspaceId}/posts`), 1200);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text:
          err.message ||
          "Publishing failed. Please check your social channel credentials in Postiz.",
      });
    }
  }

  async function handleSchedulePost() {
    if (selectedChannelIds.length === 0) {
      setStatusMessage({
        type: "error",
        text: "Please select at least one channel to schedule for.",
      });
      return;
    }

    if (!scheduledDateTime) {
      setStatusMessage({
        type: "error",
        text: "Please select a date and time for scheduling.",
      });
      return;
    }

    const scheduledDate = new Date(scheduledDateTime);
    if (scheduledDate.getTime() <= Date.now()) {
      setStatusMessage({
        type: "error",
        text: "Scheduled date and time must be in the future.",
      });
      return;
    }

    setStatusMessage(null);

    try {
      // First save draft
      const post = await handleSaveDraft();
      if (!post) return;

      // Schedule through Postiz/Temporal
      await schedulePost({
        postId: post.id,
        scheduledFor: scheduledDate.toISOString(),
      });

      setStatusMessage({
        type: "success",
        text: "Post scheduled successfully!",
      });
      setTimeout(() => navigate(`/app/${workspaceId}/posts`), 1200);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "Failed to schedule post.",
      });
    }
  }

  if (editPostId && postLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-[#6b706f]">
        Loading draft details...
      </div>
    );
  }

  const isBusy = isCreating || isUpdating || isPublishing || isSchedulePending;

  return (
    <div className="p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
              {editPostId ? "Edit Publication" : "Compose Publication"}
            </h1>
            {isEngineConnected ? (
              <Badge variant="published">Engine Ready</Badge>
            ) : (
              <Badge variant="warning">Offline Mode</Badge>
            )}
          </div>
          <p className="text-xs text-[#6b706f] mt-1">
            Author and refine post copy, attach media, select workspace
            channels, and publish.
          </p>
        </div>

        <Badge variant="draft">Editorial Composer</Badge>
      </div>

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
            className="text-current font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Offline Notice banner if publishing engine is down */}
      {!isEngineConnected && (
        <div className="p-3 rounded border border-[#f4c6bf] bg-[#fbeeed] text-xs text-[#b23a24] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Publishing engine is offline. You can save drafts locally, but
            immediate publishing and scheduling are disabled until the engine
            reconnects.
          </span>
        </div>
      )}

      <div className="space-y-6">
        {/* Workspace Channels Picker */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5359] flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5" /> Target Workspace Channels (
              {selectedChannelIds.length} selected)
            </span>
            <button
              type="button"
              onClick={() => navigate(`/app/${workspaceId}/accounts`)}
              className="text-[11px] text-[#6b706f] hover:text-[#161a1d] underline cursor-pointer"
            >
              Manage Channels
            </button>
          </div>

          {channelsLoading ? (
            <p className="text-xs font-mono text-[#6b706f]">
              Loading channels...
            </p>
          ) : channels.length === 0 ? (
            <div className="p-3 rounded border border-dashed border-[#c9c5bb] bg-white text-xs text-[#6b706f] flex items-center justify-between">
              <span>No channels assigned to this workspace yet.</span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigate(`/app/${workspaceId}/accounts`)}
              >
                Assign Channels
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {channels.map((ch) => {
                const isSelected = selectedChannelIds.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => toggleChannel(ch.id)}
                    className={`px-3 py-1.5 rounded border text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#161a1d] text-white border-[#161a1d]"
                        : "bg-white text-[#4c5359] border-[#c9c5bb] hover:border-[#161a1d]"
                    }`}
                  >
                    {ch.pictureUrl ? (
                      <img
                        src={ch.pictureUrl}
                        alt={ch.name}
                        className="h-4 w-4 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    )}
                    <span>{ch.name}</span>
                    <span className="text-[10px] opacity-70 uppercase font-mono">
                      ({ch.provider})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Textarea */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#4c5359]">
              Publication Copy
            </label>
            <span className="text-xs font-mono text-[#6b706f]">
              {content.length} characters
            </span>
          </div>
          <Textarea
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your update, announcement, or thought piece..."
            className="font-sans text-sm leading-relaxed"
          />
        </div>

        {/* Attached Media Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5359] flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5" /> Attached Media (
              {selectedMedia.length})
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsMediaPickerOpen(!isMediaPickerOpen)}
              className="gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              {isMediaPickerOpen ? "Close Picker" : "Attach from Media Library"}
            </Button>
          </div>

          {/* Attached Media Previews */}
          {selectedMedia.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {selectedMedia.map((asset) => (
                <div
                  key={asset.id}
                  className="relative rounded border border-[#c9c5bb] bg-white overflow-hidden aspect-video group"
                >
                  {asset.kind === "IMAGE" && asset.viewUrl ? (
                    <img
                      src={asset.viewUrl}
                      alt={asset.originalName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#f2f0e9] text-xs font-mono text-[#6b706f]">
                      {asset.originalName}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleMediaSelection(asset)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-[#161a1d]/80 text-white hover:bg-[#b23a24] transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline Media Library Picker Drawer */}
          {isMediaPickerOpen && (
            <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-3">
              <div className="flex items-center justify-between border-b border-[#c9c5bb] pb-2">
                <span className="text-xs font-medium text-[#161a1d]">
                  Select media assets to attach:
                </span>
                <span className="text-[11px] font-mono text-[#6b706f]">
                  {mediaLibrary.length} available in library
                </span>
              </div>

              {mediaLibrary.length === 0 ? (
                <p className="text-xs text-[#6b706f] py-4 text-center">
                  No media uploaded yet. Visit the Media Library to upload
                  images or videos.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                  {mediaLibrary.map((asset) => {
                    const isSelected = selectedMedia.some(
                      (m) => m.id === asset.id,
                    );
                    return (
                      <div
                        key={asset.id}
                        onClick={() => toggleMediaSelection(asset)}
                        className={`relative aspect-square rounded border cursor-pointer overflow-hidden transition-all ${
                          isSelected
                            ? "border-[#161a1d] ring-2 ring-[#161a1d]"
                            : "border-[#c9c5bb] hover:border-[#161a1d]"
                        }`}
                      >
                        {asset.viewUrl ? (
                          <img
                            src={asset.viewUrl}
                            alt={asset.originalName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#e8e6df] text-[10px] text-[#6b706f]">
                            {asset.kind}
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-[#161a1d]/30 flex items-center justify-center">
                            <span className="p-1 rounded-full bg-[#161a1d] text-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scheduling Section */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#4c5359] flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isScheduling}
                onChange={(e) => setIsScheduling(e.target.checked)}
                className="rounded border-[#c9c5bb] text-[#161a1d]"
              />
              Schedule for Later (Postiz / Temporal)
            </label>
            <span className="text-[11px] font-mono text-[#6b706f]">
              Workspace Timezone: UTC
            </span>
          </div>

          {isScheduling && (
            <div className="pt-2">
              <Input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                className="max-w-xs text-xs font-mono"
              />
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="pt-4 border-t border-[#c9c5bb] flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/app/${workspaceId}/posts`)}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {/* Action 1: Save Draft (always available, offline safe) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSaveDraft()}
              isLoading={isCreating || isUpdating}
              disabled={isBusy}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </Button>

            {/* Action 2: Schedule Post */}
            {isScheduling ? (
              <Button
                type="button"
                size="sm"
                onClick={handleSchedulePost}
                isLoading={isSchedulePending}
                disabled={
                  isBusy ||
                  !isEngineConnected ||
                  selectedChannelIds.length === 0
                }
                className="gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </Button>
            ) : (
              /* Action 3: Publish Now */
              <Button
                type="button"
                size="sm"
                onClick={handlePublishNow}
                isLoading={isPublishing}
                disabled={
                  isBusy ||
                  !isEngineConnected ||
                  selectedChannelIds.length === 0
                }
                className="gap-1.5 bg-[#161a1d] text-white hover:bg-[#2b3035]"
              >
                <Send className="h-3.5 w-3.5" />
                Publish Now
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
