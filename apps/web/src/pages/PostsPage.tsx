import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  PenSquare,
  Clock,
  Trash2,
  Edit3,
  Image as ImageIcon,
  Share2,
  Calendar,
  XCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { usePosts } from "../hooks/usePosts.js";
import { Button } from "../components/ui/Button.js";
import { Badge, type BadgeVariant } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { PostStatus } from "../api/types.js";

const STATUS_TABS: { label: string; value?: PostStatus }[] = [
  { label: "All Items" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
];

function getStatusBadgeVariant(status: PostStatus): BadgeVariant {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "SCHEDULED":
      return "scheduled";
    case "PUBLISHING":
      return "publishing";
    case "PUBLISHED":
      return "published";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "neutral";
  }
}

export function PostsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [selectedStatus, setSelectedStatus] = useState<PostStatus | undefined>(
    undefined,
  );
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const {
    posts,
    isLoading,
    deleteDraft,
    isDeleting,
    cancelPost,
    isCancelling,
  } = usePosts(workspaceId, selectedStatus);

  async function handleDelete(postId: string) {
    if (!confirm("Are you sure you want to delete this publication record?"))
      return;
    setActionMessage(null);
    try {
      await deleteDraft(postId);
      setActionMessage({
        type: "success",
        text: "Publication deleted successfully.",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to delete post",
      });
    }
  }

  async function handleCancel(postId: string) {
    if (!confirm("Are you sure you want to cancel this scheduled publication?"))
      return;
    setActionMessage(null);
    try {
      await cancelPost(postId);
      setActionMessage({
        type: "success",
        text: "Scheduled publication cancelled.",
      });
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to cancel post",
      });
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
            Publications & History
          </h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Track and manage drafts, scheduled social releases, and publishing
            logs.
          </p>
        </div>

        <Link to={`/app/${workspaceId}/compose`}>
          <Button size="sm" className="gap-2">
            <PenSquare className="h-3.5 w-3.5" />
            New Publication
          </Button>
        </Link>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between border ${
            actionMessage.type === "success"
              ? "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]"
              : "bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="font-bold opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#c9c5bb] pb-2">
        {STATUS_TABS.map((tab) => {
          const isActive = selectedStatus === tab.value;
          return (
            <button
              key={tab.label}
              onClick={() => setSelectedStatus(tab.value)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-[#161a1d] text-white"
                  : "bg-transparent text-[#4c5359] hover:bg-[#e8e6df] hover:text-[#161a1d]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Posts List */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-[#e8e6df] rounded border border-[#c9c5bb]"
            ></div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<PenSquare className="h-8 w-8" />}
          title={
            selectedStatus
              ? `No ${selectedStatus.toLowerCase()} posts`
              : "No posts found"
          }
          description="Create your first publication to begin managing your social publishing pipeline."
          action={
            <Link to={`/app/${workspaceId}/compose`}>
              <Button size="sm">Create New Post</Button>
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-[#faf9f5]">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-4 md:p-6 flex flex-col md:flex-row md:items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getStatusBadgeVariant(post.status)}>
                    {post.status}
                  </Badge>

                  {/* Scheduled or Published Timestamp */}
                  {post.scheduledFor && post.status === "SCHEDULED" && (
                    <span className="text-xs text-[#1e4d7b] flex items-center gap-1 font-mono font-medium">
                      <Calendar className="h-3 w-3" />
                      Scheduled for{" "}
                      {new Date(post.scheduledFor).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}

                  {post.publishedAt && (
                    <span className="text-xs text-[#24613b] flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      Published{" "}
                      {new Date(post.publishedAt).toLocaleDateString()} at{" "}
                      {new Date(post.publishedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}

                  <span className="text-xs text-[#6b706f] flex items-center gap-1 font-mono">
                    Created {new Date(post.createdAt).toLocaleDateString()}
                  </span>

                  {post.createdBy && (
                    <span className="text-xs text-[#6b706f]">
                      by{" "}
                      <span className="text-[#161a1d] font-medium">
                        {post.createdBy.displayName}
                      </span>
                    </span>
                  )}
                </div>

                {/* Target Channels */}
                {post.targets && post.targets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] uppercase tracking-wider text-[#6b706f] font-mono flex items-center gap-1">
                      <Share2 className="h-3 w-3" /> Destinations:
                    </span>
                    {post.targets.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[#c9c5bb] bg-white text-[11px] font-medium text-[#161a1d]"
                      >
                        {t.channel?.name || "Channel"}
                        <span className="text-[10px] text-[#6b706f] uppercase font-mono">
                          ({t.channel?.provider || "provider"})
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Post Content */}
                <p className="text-sm text-[#161a1d] whitespace-pre-wrap font-sans leading-relaxed">
                  {post.content}
                </p>

                {/* Error Banner if Failed */}
                {post.status === "FAILED" && post.lastError && (
                  <div className="p-2.5 rounded bg-[#fbeeed] border border-[#f4c6bf] text-xs text-[#b23a24] flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Publishing Error: {post.lastErrorCode || "ERROR"}
                      </p>
                      <p className="opacity-90">{post.lastError}</p>
                    </div>
                  </div>
                )}

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
                {post.status === "DRAFT" && (
                  <Link to={`/app/${workspaceId}/compose?postId=${post.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </Link>
                )}

                {post.status === "SCHEDULED" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancel(post.id)}
                    disabled={isCancelling}
                    className="gap-1 text-xs text-[#b23a24] hover:bg-[#fbeeed]"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel Schedule
                  </Button>
                )}

                {(post.status === "DRAFT" ||
                  post.status === "FAILED" ||
                  post.status === "CANCELLED") && (
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={isDeleting}
                    title="Delete post record"
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
