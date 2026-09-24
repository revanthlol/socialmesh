import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { PenSquare, Image as ImageIcon, Save, CheckCircle2, AlertCircle, Share2, Plus, X } from "lucide-react";
import { usePost, usePosts } from "../hooks/usePosts.js";
import { useMediaList } from "../hooks/useMedia.js";
import { Button } from "../components/ui/Button.js";
import { Textarea } from "../components/ui/Textarea.js";
import { Badge } from "../components/ui/Badge.js";
import type { MediaAsset } from "../api/types.js";

export function ComposePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editPostId = searchParams.get("postId");

  const [content, setContent] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<MediaAsset[]>([]);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const { data: existingPost, isLoading: postLoading } = usePost(workspaceId, editPostId || undefined);
  const { data: mediaLibrary = [], isLoading: mediaLoading } = useMediaList(workspaceId);
  const { createDraft, isCreating, updateDraft, isUpdating } = usePosts(workspaceId);

  useEffect(() => {
    if (existingPost) {
      setContent(existingPost.content);
      const attached = existingPost.media.map((m) => m.asset).filter(Boolean) as MediaAsset[];
      setSelectedMedia(attached);
    }
  }, [existingPost]);

  async function handleSaveDraft(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      setStatusMessage({ type: "error", text: "Please enter some content for your draft." });
      return;
    }

    setStatusMessage(null);

    try {
      const mediaAssetIds = selectedMedia.map((m) => m.id);

      if (editPostId) {
        await updateDraft({
          postId: editPostId,
          data: { content: content.trim(), mediaAssetIds },
        });
        setStatusMessage({ type: "success", text: "Draft updated successfully." });
      } else {
        const created = await createDraft({
          content: content.trim(),
          mediaAssetIds,
        });
        setStatusMessage({ type: "success", text: "Draft saved successfully." });
        navigate(`/app/${workspaceId}/posts`);
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to save draft." });
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

  if (editPostId && postLoading) {
    return (
      <div className="p-8 text-center text-xs font-mono text-[#6b706f]">
        Loading draft details...
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
            {editPostId ? "Edit Draft" : "Compose Publication"}
          </h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Author and refine post content, attach media, and manage editorial drafts.
          </p>
        </div>

        <Badge variant="draft">Editorial Draft</Badge>
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

      <form onSubmit={handleSaveDraft} className="space-y-6">
        {/* Social Targeting Section (Architectural representation - disabled pending Postiz) */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#4c5359] flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5" /> Target Social Destinations
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#e8e6df] text-[#6b706f]">
              Provider Adapter Pending
            </span>
          </div>
          <p className="text-xs text-[#6b706f]">
            Social channel selection will connect to official Meta (Facebook/Instagram) and LinkedIn publishing pipelines once the Postiz adapter is established.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 opacity-60 pointer-events-none">
            <div className="px-3 py-1.5 rounded border border-[#c9c5bb] bg-white text-xs text-[#6b706f] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400"></span> Facebook Page
            </div>
            <div className="px-3 py-1.5 rounded border border-[#c9c5bb] bg-white text-xs text-[#6b706f] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400"></span> Instagram Professional
            </div>
            <div className="px-3 py-1.5 rounded border border-[#c9c5bb] bg-white text-xs text-[#6b706f] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-400"></span> LinkedIn Profile
            </div>
          </div>
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
              <ImageIcon className="h-3.5 w-3.5" /> Attached Media ({selectedMedia.length})
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
                    <img src={asset.viewUrl} alt={asset.originalName} className="w-full h-full object-cover" />
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
                <span className="text-xs font-medium text-[#161a1d]">Select media assets to attach:</span>
                <span className="text-[11px] font-mono text-[#6b706f]">
                  {mediaLibrary.length} available in library
                </span>
              </div>

              {mediaLibrary.length === 0 ? (
                <p className="text-xs text-[#6b706f] py-4 text-center">
                  No media uploaded yet. Visit the Media Library to upload images or videos.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                  {mediaLibrary.map((asset) => {
                    const isSelected = selectedMedia.some((m) => m.id === asset.id);
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
                          <img src={asset.viewUrl} alt={asset.originalName} className="w-full h-full object-cover" />
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

        {/* Action Controls */}
        <div className="pt-4 border-t border-[#c9c5bb] flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/app/${workspaceId}/posts`)}
          >
            Cancel
          </Button>

          <Button type="submit" isLoading={isCreating || isUpdating} className="gap-2">
            <Save className="h-4 w-4" />
            {editPostId ? "Save Changes" : "Save as Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}
