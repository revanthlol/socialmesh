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
  const {
    isConnected: isEngineConnected,
    latencyMs,
    status: engineStatus,
  } = usePublishingStatus();

  if (wsLoading || postsLoading || mediaLoading || channelsLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-[#e8e6df] rounded w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#e8e6df] rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const drafts = posts.filter((p) => p.status === "DRAFT");
  const scheduled = posts.filter((p) => p.status === "SCHEDULED");
  const published = posts.filter((p) => p.status === "PUBLISHED");
  const failed = posts.filter((p) => p.status === "FAILED");

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
              {workspace?.name}
            </h1>
            {workspace?.role && <Badge variant="owner">{workspace.role}</Badge>}
          </div>
          <p className="text-xs text-[#6b706f] mt-1">
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

      {/* Publishing Engine Status Banner */}
      <div
        className={`p-4 rounded border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isEngineConnected
            ? "border-[#c9c5bb] bg-[#faf9f5]"
            : "border-[#f4c6bf] bg-[#fbeeed]"
        }`}
      >
        <div className="flex items-start gap-3">
          {isEngineConnected ? (
            <ShieldCheck className="h-5 w-5 text-[#24613b] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-[#b23a24] shrink-0 mt-0.5" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#161a1d]">
                {isEngineConnected
                  ? "Publishing Engine Connected"
                  : "Publishing Temporarily Unavailable"}
              </h4>
              {isEngineConnected && latencyMs !== undefined && (
                <span className="text-[10px] font-mono text-[#6b706f]">
                  ({latencyMs}ms)
                </span>
              )}
            </div>
            <p className="text-xs text-[#4c5359] mt-0.5">
              {isEngineConnected
                ? "Direct Postiz REST backend is responsive. Social publishing and scheduling are operational."
                : "Postiz service is currently unreachable. SociaMesh local drafts and media uploads remain functional."}
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
              isEngineConnected
                ? "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]"
                : "bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]"
            }`}
          >
            {isEngineConnected ? "Engine Online" : "Engine Offline"}
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e8e6df] text-[#4c5359] border border-[#c9c5bb]">
            Neon DB
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e8e6df] text-[#4c5359] border border-[#c9c5bb]">
            R2 Active
          </span>
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Drafts */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Active Drafts</span>
            <PenSquare className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">
            {drafts.length}
          </p>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#161a1d] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View drafts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 2: Scheduled */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Scheduled Posts</span>
            <Calendar className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">
            {scheduled.length}
          </p>
          <Link
            to={`/app/${workspaceId}/calendar`}
            className="text-xs text-[#161a1d] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View calendar <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 3: Published */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Published</span>
            <Send className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">
            {published.length}
          </p>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#161a1d] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View published <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Metric 4: Assigned Channels */}
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Assigned Channels</span>
            <Share2 className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">
            {channels.length}
          </p>
          <Link
            to={`/app/${workspaceId}/accounts`}
            className="text-xs text-[#161a1d] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            Manage channels <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Recent Publications Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif font-bold text-[#161a1d]">
            Recent Publications & Drafts
          </h2>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#6b706f] hover:text-[#161a1d]"
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
          <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-[#faf9f5]">
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

                    <span className="text-[11px] text-[#6b706f] flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-sm text-[#161a1d] truncate font-medium">
                    {post.content}
                  </p>

                  {post.targets && post.targets.length > 0 && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[#6b706f]">
                      <span>Channels:</span>
                      {post.targets.map((t) => (
                        <span key={t.id} className="font-mono text-[#161a1d]">
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
