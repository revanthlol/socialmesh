import { Link, useParams } from "react-router-dom";
import {
  PenSquare,
  Image,
  Calendar,
  Layers,
  ShieldCheck,
  ArrowRight,
  Clock,
  Share2,
  Send,
  AlertCircle,
} from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspaces.js";
import { usePosts } from "../hooks/usePosts.js";
import { useMediaList } from "../hooks/useMedia.js";
import { useChannels } from "../hooks/useChannels.js";
import { usePublishingStatus } from "../hooks/usePublishingStatus.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { Badge, type BadgeVariant } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { PostStatus } from "../api/types.js";

function getStatusBadgeVariant(status: PostStatus): BadgeVariant {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "SCHEDULED":
      return "scheduled";
    case "PROCESSING":
      return "processing";
    case "PUBLISHING":
      return "publishing";
    case "PUBLISHED":
      return "published";
    case "PARTIAL":
      return "partial";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "neutral";
  }
}

export function OverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { posts, isLoading: postsLoading } = usePosts(workspaceId);
  const { data: media = [], isLoading: mediaLoading } =
    useMediaList(workspaceId);
  const { channels = [], isLoading: channelsLoading } =
    useChannels(workspaceId);
  const { isConnected: isEngineConnected } = usePublishingStatus();

  if (wsLoading || postsLoading || mediaLoading || channelsLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#c9c5bb] dark:border-white/[0.08]">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48 sm:w-64" />
            <Skeleton className="h-4 w-60 sm:w-80" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>

        {/* Banner Skeleton */}
        <Skeleton className="h-20 w-full rounded border border-[#c9c5bb] dark:border-white/[0.08]" />

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded border border-[#c9c5bb] dark:border-white/[0.08]" />
          ))}
        </div>

        {/* Recent Posts Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-48 w-full rounded border border-[#c9c5bb] dark:border-white/[0.08]" />
        </div>
      </div>
    );
  }

  const drafts = posts.filter((p) => p.status === "DRAFT");
  const scheduled = posts.filter((p) => p.status === "SCHEDULED");
  const published = posts.filter((p) => p.status === "PUBLISHED");
  const failed = posts.filter((p) => p.status === "FAILED");

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#161a1d] dark:text-white">
              {workspace?.name}
            </h1>
            {workspace?.role && <Badge variant="owner">{workspace.role}</Badge>}
          </div>
          <p className="text-xs text-[#6b706f] dark:text-zinc-500 mt-1">
            Publishing overview and workspace performance • Timezone:{" "}
            {workspace?.timezone || "UTC"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/app/${workspaceId}/compose`}>
            <Button size="sm" className="gap-2">
              <PenSquare className="h-3.5 w-3.5" />
              Compose Post
            </Button>
          </Link>
          <Link to={`/app/${workspaceId}/media`}>
            <Button variant="secondary" size="sm" className="gap-2">
              <Image className="h-3.5 w-3.5" />
              Media Library
            </Button>
          </Link>
        </div>
      </div>

      {/* Publishing Status Banner */}
      <div
        className={`p-4 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isEngineConnected
            ? "border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f]"
            : "border-[#f4c6bf] bg-[#fbeeed]"
        }`}
      >
        <div className="flex items-start gap-3">
          {isEngineConnected ? (
            <ShieldCheck className="h-5 w-5 text-[#24613b] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-[#b23a24] dark:text-[#e05a3a] shrink-0 mt-0.5" />
          )}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#161a1d] dark:text-white">
              {isEngineConnected
                ? "Publishing & Scheduling Ready"
                : "Publishing Temporarily Paused"}
            </h4>
            <p className="text-xs text-[#4c5359] dark:text-zinc-400 mt-0.5">
              {isEngineConnected
                ? "All social channels are connected and ready. Your scheduled posts will publish automatically."
                : "Publishing to social channels is temporarily unavailable. Your drafts and media remain safely saved."}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
              isEngineConnected
                ? "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]"
                : "bg-[#fbeeed] text-[#b23a24] dark:text-[#e05a3a] border-[#f4c6bf]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isEngineConnected ? "bg-[#24613b]" : "bg-[#b23a24]"
              }`}
            />
            {isEngineConnected ? "Operational" : "Temporarily Offline"}
          </span>
          {isEngineConnected && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#f4f2ec] dark:bg-white/[0.04] text-[#4c5359] dark:text-zinc-400 border border-[#c9c5bb] dark:border-white/[0.08]">
              Auto-Publish Enabled
            </span>
          )}
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Drafts */}
        <div className="p-4 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f] dark:text-zinc-500">
            <span>Active Drafts</span>
            <PenSquare className="h-4 w-4 text-[#6b706f] dark:text-zinc-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] dark:text-white mt-2">
            {drafts.length}
          </p>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#161a1d] dark:text-white font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View drafts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 2: Scheduled */}
        <div className="p-4 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f] dark:text-zinc-500">
            <span>Scheduled Posts</span>
            <Calendar className="h-4 w-4 text-[#6b706f] dark:text-zinc-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] dark:text-white mt-2">
            {scheduled.length}
          </p>
          <Link
            to={`/app/${workspaceId}/calendar`}
            className="text-xs text-[#161a1d] dark:text-white font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 3: Published */}
        <div className="p-4 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f] dark:text-zinc-500">
            <span>Published</span>
            <Send className="h-4 w-4 text-[#6b706f] dark:text-zinc-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] dark:text-white mt-2">
            {published.length}
          </p>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#161a1d] dark:text-white font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View published <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 4: Assigned Channels */}
        <div className="p-4 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f] dark:text-zinc-500">
            <span>Assigned Channels</span>
            <Share2 className="h-4 w-4 text-[#6b706f] dark:text-zinc-500" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] dark:text-white mt-2">
            {channels.length}
          </p>
          <Link
            to={`/app/${workspaceId}/accounts`}
            className="text-xs text-[#161a1d] dark:text-white font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            Manage channels <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Recent Publications Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif font-bold text-[#161a1d] dark:text-white">
            Recent Publications & Drafts
          </h2>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#6b706f] dark:text-zinc-500 hover:text-[#161a1d] dark:text-white"
          >
            View all ({posts.length})
          </Link>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            icon={<PenSquare className="h-8 w-8" />}
            title="No publication activity yet"
            description="Create your first post or upload media to start using this workspace."
            action={
              <Link to={`/app/${workspaceId}/compose`}>
                <Button size="sm">Create First Post</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] dark:border-white/[0.08] rounded bg-[#faf9f5] dark:bg-[#1c1c1f]">
            {posts.slice(0, 5).map((post) => (
              <div
                key={post.id}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getStatusBadgeVariant(post.status)}>
                      {post.status}
                    </Badge>

                    {post.scheduledFor && post.status === "SCHEDULED" && (
                      <span className="text-[11px] font-mono text-[#1e4d7b]">
                        Scheduled:{" "}
                        {new Date(post.scheduledFor).toLocaleDateString()}
                      </span>
                    )}

                    <span className="text-[11px] text-[#6b706f] dark:text-zinc-500 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-[#161a1d] dark:text-white truncate font-medium">
                    {post.content}
                  </p>

                  {post.targets && post.targets.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[#6b706f] dark:text-zinc-500">
                      <span>Channels:</span>
                      {post.targets.map((t) => (
                        <span key={t.id} className="font-mono text-[#161a1d] dark:text-white">
                          {t.channel?.name || "Channel"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Link to={`/app/${workspaceId}/posts`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
