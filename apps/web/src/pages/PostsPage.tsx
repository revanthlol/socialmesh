import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PenSquare, Clock, Trash2, Edit3, Image as ImageIcon } from "lucide-react";
import { usePosts } from "../hooks/usePosts.js";
import { Button } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { PostStatus } from "../api/types.js";

export function PostsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [selectedStatus, setSelectedStatus] = useState<PostStatus | undefined>(undefined);

  const { posts, isLoading, deleteDraft, isDeleting } = usePosts(workspaceId, selectedStatus);

  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      await deleteDraft(postId);
    } catch (err: any) {
      alert(err.message || "Failed to delete post");
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">Publications & Drafts</h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Manage your workspace editorial pipeline, post revisions, and draft history.
          </p>
        </div>

        <Link to={`/app/${workspaceId}/compose`}>
          <Button size="sm" className="gap-2">
            <PenSquare className="h-3.5 w-3.5" />
            Create Draft
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setSelectedStatus(undefined)}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            selectedStatus === undefined
              ? "bg-[#161a1d] text-white border-[#161a1d]"
              : "bg-[#faf9f5] text-[#4c5359] border-[#c9c5bb] hover:bg-[#e8e6df]"
          }`}
        >
          All Items ({posts.length})
        </button>
        <button
          onClick={() => setSelectedStatus("DRAFT")}
          className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
            selectedStatus === "DRAFT"
              ? "bg-[#161a1d] text-white border-[#161a1d]"
              : "bg-[#faf9f5] text-[#4c5359] border-[#c9c5bb] hover:bg-[#e8e6df]"
          }`}
        >
          Drafts Only
        </button>
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-[#e8e6df] rounded border border-[#c9c5bb]"></div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<PenSquare className="h-8 w-8" />}
          title="No posts found"
          description="Create your first publication draft to begin managing your editorial pipeline."
          action={
            <Link to={`/app/${workspaceId}/compose`}>
              <Button size="sm">Create New Post</Button>
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-[#faf9f5]">
          {posts.map((post) => (
            <div key={post.id} className="p-4 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant={post.status === "DRAFT" ? "draft" : "success"}>
                    {post.status}
                  </Badge>
                  <span className="text-xs text-[#6b706f] flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {new Date(post.createdAt).toLocaleDateString()} at{" "}
                    {new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {post.createdBy && (
                    <span className="text-xs text-[#6b706f]">
                      by <span className="text-[#161a1d] font-medium">{post.createdBy.displayName}</span>
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-[#888]">v{post.version}</span>
                </div>

                <p className="text-sm text-[#161a1d] whitespace-pre-wrap font-sans leading-relaxed">
                  {post.content}
                </p>

                {/* Attached Media Previews */}
                {post.media.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    {post.media.map((pm, idx) => (
                      <div
                        key={idx}
                        className="h-14 w-14 rounded border border-[#c9c5bb] bg-[#e8e6df] overflow-hidden shrink-0 flex items-center justify-center"
                      >
                        {pm.asset?.viewUrl && pm.asset.kind === "IMAGE" ? (
                          <img
                            src={pm.asset.viewUrl}
                            alt={pm.asset.originalName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-[#6b706f]" />
                        )}
                      </div>
                    ))}
                    <span className="text-xs text-[#6b706f] font-mono pl-1">
                      {post.media.length} media attached
                    </span>
                  </div>
                )}
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                <Link to={`/app/${workspaceId}/compose?postId=${post.id}`}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                </Link>
                {post.status === "DRAFT" && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={isDeleting}
                    title="Delete draft"
                    className="p-2 text-[#6b706f] hover:text-[#b23a24] hover:bg-[#e8e6df] rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
