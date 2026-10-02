import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, CalendarClock, Check, ChevronDown, ChevronUp, Clock3, Copy, ExternalLink, FileText, Image as ImageIcon, LoaderCircle, PenLine, Trash2, Video, X } from "lucide-react";
import { usePosts } from "../hooks/usePosts.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { Post, PostStatus } from "../api/types.js";
import { ConfirmDialog } from "../components/ui/ConfirmDialog.js";

const FILTERS = [
  { label: "All", value: "ALL" },
  { label: "Drafts", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Published", value: "PUBLISHED" },
  { label: "Failed", value: "FAILED" },
  { label: "Cancelled", value: "CANCELLED" },
 ] as const satisfies readonly { label: string; value: PostStatus | "ALL" }[];
type PostFilter = (typeof FILTERS)[number]["value"];

function statusLabel(status: PostStatus) {
  return ({ DRAFT: "Draft", SCHEDULED: "Scheduled", PROCESSING: "Processing", PUBLISHING: "Processing", PUBLISHED: "Published", FAILED: "Failed", CANCELLED: "Cancelled", PARTIAL: "Partial" })[status];
}

function statusTime(post: Post) {
  const when = post.status === "SCHEDULED" ? post.scheduledFor : post.publishedAt;
  if (when) return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(when));
  if (post.status === "PROCESSING" || post.status === "PUBLISHING") return "Publishing now";
  if (post.status === "FAILED" || post.status === "PARTIAL") return "Action needed";
  if (post.status === "DRAFT") return "Needs completion";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(post.createdAt));
}

function providerLabel(provider?: string) {
  if (!provider) return "social platform";
  const labels: Record<string, string> = { x: "X", twitter: "X", "linkedin-page": "LinkedIn", linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", pinterest: "Pinterest", reddit: "Reddit", devto: "Dev.to" };
  return labels[provider.toLowerCase()] || provider;
}

function targetStatusDiffers(post: Post) {
  return new Set(post.targets.map((target) => target.status)).size > 1;
}

export function PostsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFilter = searchParams.get("status")?.toUpperCase();
  const [selectedFilter, setSelectedFilter] = useState<PostFilter>((FILTERS.find((filter) => filter.value === initialFilter)?.value as PostFilter) || "ALL");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ kind: "delete" | "cancel"; postId: string } | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { posts, isLoading, deleteDraft, isDeleting, cancelPost, isCancelling } = usePosts(workspaceId);

  const counts = useMemo(() => {
    const byStatus = (status: PostStatus) => posts.filter((post) => post.status === status).length;
    return { ALL: posts.length, DRAFT: byStatus("DRAFT"), SCHEDULED: byStatus("SCHEDULED"), PROCESSING: byStatus("PROCESSING") + byStatus("PUBLISHING"), PUBLISHED: byStatus("PUBLISHED"), FAILED: byStatus("FAILED") + byStatus("PARTIAL"), CANCELLED: byStatus("CANCELLED") };
  }, [posts]);

  const visiblePosts = useMemo(() => posts
    .filter((post) => selectedFilter === "ALL" || (selectedFilter === "PROCESSING" ? post.status === "PROCESSING" || post.status === "PUBLISHING" : selectedFilter === "FAILED" ? post.status === "FAILED" || post.status === "PARTIAL" : post.status === selectedFilter))
    .sort((a, b) => {
      const aTime = a.status === "SCHEDULED" && a.scheduledFor ? new Date(a.scheduledFor).getTime() : new Date(a.updatedAt).getTime();
      const bTime = b.status === "SCHEDULED" && b.scheduledFor ? new Date(b.scheduledFor).getTime() : new Date(b.updatedAt).getTime();
      return a.status === "SCHEDULED" && b.status === "SCHEDULED" ? aTime - bTime : bTime - aTime;
    }), [posts, selectedFilter]);

  async function confirmDelete(postId: string) {
    setFeedback(null);
    try {
      await deleteDraft(postId);
      setConfirmation(null);
      setFeedback({ type: "success", text: "Post deleted." });
    } catch (error) {
      setConfirmation(null);
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Could not delete this post." });
    }
  }

  async function confirmCancel(postId: string) {
    setFeedback(null);
    try {
      await cancelPost(postId);
      setConfirmation(null);
      setFeedback({ type: "success", text: "Schedule cancelled." });
    } catch (error) {
      setConfirmation(null);
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "Could not cancel this schedule." });
    }
  }

  async function copyPost(content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setFeedback({ type: "success", text: "Post text copied." });
    } catch {
      setFeedback({ type: "error", text: "Could not access the clipboard." });
    }
  }

  return <div className="page-shell posts-workspace">
    {confirmation && <ConfirmDialog title={confirmation.kind === "delete" ? "Delete this post?" : "Cancel this schedule?"} description={confirmation.kind === "delete" ? "This post will be removed from the workspace." : "This post will no longer publish at its scheduled time."} confirmLabel={confirmation.kind === "delete" ? "Delete post" : "Cancel schedule"} isBusy={confirmation.kind === "delete" ? isDeleting : isCancelling} onCancel={() => setConfirmation(null)} onConfirm={() => confirmation.kind === "delete" ? void confirmDelete(confirmation.postId) : void confirmCancel(confirmation.postId)} />}
    <header className="posts-heading"><div><h1>Posts</h1><p>Review what’s published, scheduled, and still in progress.</p></div><Link to={`/app/${workspaceId}/compose`}><Button><PenLine size={15} />New post</Button></Link></header>

    {feedback && <div className={`posts-feedback ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.type === "success" ? <Check size={15} /> : <AlertCircle size={15} />}{feedback.text}<button type="button" aria-label="Dismiss message" onClick={() => setFeedback(null)}><X size={14} /></button></div>}

    <nav className="post-filters" aria-label="Filter posts">{FILTERS.map((filter) => <button key={filter.value} type="button" aria-pressed={selectedFilter === filter.value} className={selectedFilter === filter.value ? "is-selected" : ""} onClick={() => setSelectedFilter(filter.value)}>{filter.label}<span>{counts[filter.value]}</span></button>)}</nav>

    {isLoading ? <div className="post-list-skeleton" aria-label="Loading posts">{[0, 1, 2, 3].map((n) => <div key={n} className="post-skeleton"><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-1/3" /></div>)}</div>
      : visiblePosts.length === 0 ? <div className="posts-empty"><EmptyState icon={<FileText size={28} />} title={selectedFilter === "ALL" ? "No posts yet" : `No ${FILTERS.find((item) => item.value === selectedFilter)?.label.toLowerCase()} posts`} description={selectedFilter === "ALL" ? "Create a draft or schedule a post to start your publishing history." : "Posts with this status will appear here."} action={selectedFilter === "ALL" ? <Link to={`/app/${workspaceId}/compose`}><Button><PenLine size={15} />Compose a post</Button></Link> : undefined} /></div>
      : <div className="post-feed">{visiblePosts.map((post) => {
        const failedTargets = post.targets.filter((target) => target.status === "FAILED");
        const statusClass = post.status.toLowerCase();
        const schedule = post.status === "SCHEDULED" && post.scheduledFor;
        const publishedLinks = post.targets.filter((target) => Boolean(target.providerPostUrl));
        const needsAttention = post.status === "FAILED" || post.status === "PARTIAL";
        const canDelete = post.status === "DRAFT" || post.status === "FAILED" || post.status === "PARTIAL" || post.status === "CANCELLED";
        return <article key={post.id} className={`post-row ${statusClass} ${needsAttention ? "needs-attention" : ""}`}>
          <div className="post-row-main">
            <div className="post-preview-column">
              <p className="post-content-preview">{post.content || <span className="post-empty-copy">No text added</span>}</p>
              {post.media.length > 0 && <div className="post-media-strip" aria-label={`${post.media.length} attached ${post.media.length === 1 ? "media item" : "media items"}`}>{post.media.slice(0, 4).map((item, index) => <span className="post-media-thumb" key={`${post.id}-media-${index}`}>{item.asset?.kind === "IMAGE" && item.asset.viewUrl ? <img src={item.asset.viewUrl} alt={item.asset.originalName} loading="lazy" /> : item.asset?.kind === "VIDEO" && item.asset.viewUrl ? <video src={item.asset.viewUrl} preload="metadata" aria-label={item.asset.originalName} /> : <Video size={18} />}</span>)}{post.media.length > 4 && <span className="post-media-more">+{post.media.length - 4}</span>}</div>}
            </div>
            <div className="post-row-info">
              <span className={`post-status ${statusClass}`}><span className="post-status-dot" />{statusLabel(post.status)}</span>
              <span className={`post-time ${schedule ? "scheduled-time" : ""}`}>{schedule ? <CalendarClock size={14} /> : post.status === "PROCESSING" || post.status === "PUBLISHING" ? <LoaderCircle className="post-processing-icon" size={14} /> : post.status === "PUBLISHED" ? <Clock3 size={14} /> : needsAttention ? <AlertCircle size={14} /> : null}{schedule ? `Publishes ${statusTime(post)}` : statusTime(post)}</span>
              <span className="post-destinations" title={post.targets.map((target) => target.channel?.name || providerLabel(target.channel?.provider)).join(", ")}>{post.targets.length ? <>{post.targets.slice(0, 2).map((target) => <span className="post-destination" key={target.id}>{target.channel?.pictureUrl ? <img src={target.channel.pictureUrl} alt="" /> : <span className="post-destination-initial">{(target.channel?.name || providerLabel(target.channel?.provider)).slice(0, 1).toUpperCase()}</span>}<span>{target.channel?.name || providerLabel(target.channel?.provider)}</span></span>)}{post.targets.length > 2 && <span className="destination-overflow">+{post.targets.length - 2}</span>}</> : <span className="no-destinations">No destinations</span>}</span>
              {needsAttention && (post.lastError || failedTargets[0]?.lastError) && <p className="post-failure-summary"><AlertCircle size={14} />{post.lastError || failedTargets[0]?.lastError}</p>}
            </div>
            <div className="post-row-actions">
              {post.status === "DRAFT" && <Link className="post-action-link" to={`/app/${workspaceId}/compose?postId=${post.id}`}><PenLine size={14} />Edit</Link>}
              {post.status === "SCHEDULED" && <button type="button" className="post-action-link" onClick={() => setConfirmation({ kind: "cancel", postId: post.id })}>Cancel</button>}
              {post.status === "PUBLISHED" && publishedLinks[0] && <a className="post-action-link provider-link" href={publishedLinks[0].providerPostUrl!} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />View on {providerLabel(publishedLinks[0].channel?.provider)}</a>}
              <button type="button" className="post-details-toggle" aria-expanded={expandedPost === post.id} onClick={() => setExpandedPost((current) => current === post.id ? null : post.id)}>{expandedPost === post.id ? "Hide details" : "Details"}{expandedPost === post.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              {canDelete && <button type="button" className="post-delete" aria-label="Delete post" onClick={() => setConfirmation({ kind: "delete", postId: post.id })}><Trash2 size={15} /></button>}
            </div>
          </div>
          {expandedPost === post.id && <div className="post-details">
            <div className="post-detail-head"><span>Destinations</span>{post.createdBy && <span>Created by {post.createdBy.displayName}</span>}</div>
            {post.targets.length ? <div className="post-target-list">{post.targets.map((target) => <div className="post-target-row" key={target.id}><span className="post-target-name">{target.channel?.name || providerLabel(target.channel?.provider)}</span><span className={`post-target-status ${target.status.toLowerCase()}`}>{statusLabel(target.status)}</span>{target.lastError && <span className="post-target-error">{target.lastError}</span>}{target.providerPostUrl && <a href={target.providerPostUrl} target="_blank" rel="noopener noreferrer">View on {providerLabel(target.channel?.provider)} <ExternalLink size={13} /></a>}</div>)}</div> : <p className="post-details-empty">No destinations selected.</p>}
            {post.lastError && !failedTargets.some((target) => target.lastError === post.lastError) && <p className="post-details-error"><AlertCircle size={15} />{post.lastError}</p>}
            {post.targets.length > 1 && targetStatusDiffers(post) && <p className="post-details-note">This post has different results across destinations.</p>}
            <div className="post-details-footer"><span>Created {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(post.createdAt))}</span><button type="button" onClick={() => void copyPost(post.content)}><Copy size={13} />Copy text</button>{post.status === "DRAFT" && <button type="button" onClick={() => navigate(`/app/${workspaceId}/compose?postId=${post.id}`)}><PenLine size={13} />Edit draft</button>}</div>
          </div>}
        </article>;
      })}</div>}
  </div>;
}
