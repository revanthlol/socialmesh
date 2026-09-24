import { Link, useParams } from "react-router-dom";
import { PenSquare, Image, Calendar, Layers, ShieldCheck, ArrowRight, Clock } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspaces.js";
import { usePosts } from "../hooks/usePosts.js";
import { useMediaList } from "../hooks/useMedia.js";
import { Button } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function OverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspace, isLoading: wsLoading } = useWorkspace(workspaceId);
  const { posts, isLoading: postsLoading } = usePosts(workspaceId);
  const { data: media = [], isLoading: mediaLoading } = useMediaList(workspaceId);

  if (wsLoading || postsLoading || mediaLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-[#e8e6df] rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-[#e8e6df] rounded"></div>
          <div className="h-24 bg-[#e8e6df] rounded"></div>
          <div className="h-24 bg-[#e8e6df] rounded"></div>
        </div>
      </div>
    );
  }

  const drafts = posts.filter((p) => p.status === "DRAFT");

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#161a1d]">{workspace?.name}</h1>
            {workspace?.role && <Badge variant="owner">{workspace.role}</Badge>}
          </div>
          <p className="text-xs text-[#6b706f] mt-1">
            Publishing dashboard and editorial pipeline • Timezone: {workspace?.timezone || "UTC"}
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

      {/* Architecture Context Banner */}
      <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-[#24613b] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#161a1d]">
              SociaMesh System Status
            </h4>
            <p className="text-xs text-[#4c5359] mt-0.5">
              Core authentication, workspace RBAC, Cloudflare R2 presigned media pipeline, and post drafts are active. Social publishing provider adapter (Postiz) is intentionally deferred.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e9f2eb] text-[#24613b] border border-[#c5e0cb]">
            R2 Active
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#e9f2eb] text-[#24613b] border border-[#c5e0cb]">
            Neon PostgreSQL
          </span>
        </div>
      </div>

      {/* Real Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Active Drafts</span>
            <PenSquare className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">{drafts.length}</p>
          <Link
            to={`/app/${workspaceId}/posts`}
            className="text-xs text-[#b23a24] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View all posts <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Media Assets</span>
            <Image className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">{media.length}</p>
          <Link
            to={`/app/${workspaceId}/media`}
            className="text-xs text-[#b23a24] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            Manage media <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f]">
            <span>Team Members</span>
            <Layers className="h-4 w-4 text-[#6b706f]" />
          </div>
          <p className="text-3xl font-serif font-bold text-[#161a1d] mt-2">
            {workspace?.stats?.memberCount || 1}
          </p>
          <Link
            to={`/app/${workspaceId}/settings`}
            className="text-xs text-[#b23a24] font-medium hover:underline inline-flex items-center gap-1 mt-2"
          >
            View settings <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Recent Drafts Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-serif font-bold text-[#161a1d]">Recent Drafts</h2>
          <Link to={`/app/${workspaceId}/posts`} className="text-xs text-[#6b706f] hover:text-[#161a1d]">
            View all ({posts.length})
          </Link>
        </div>

        {drafts.length === 0 ? (
          <EmptyState
            icon={<PenSquare className="h-8 w-8" />}
            title="No drafts created yet"
            description="Start preparing your next social publication with text and media assets."
            action={
              <Link to={`/app/${workspaceId}/compose`}>
                <Button size="sm">Create First Draft</Button>
              </Link>
            }
          />
        ) : (
          <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-[#faf9f5]">
            {drafts.slice(0, 5).map((post) => (
              <div key={post.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="draft">Draft</Badge>
                    <span className="text-[11px] text-[#6b706f] flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-[#161a1d] truncate font-medium">{post.content}</p>
                  {post.media.length > 0 && (
                    <span className="inline-block mt-1 text-[11px] text-[#6b706f]">
                      {post.media.length} media attachment{post.media.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <Link to={`/app/${workspaceId}/compose?postId=${post.id}`}>
                  <Button variant="outline" size="sm">
                    Edit
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
