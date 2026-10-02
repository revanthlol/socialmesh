import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowRight, CalendarClock, Check, CircleDashed, Clock3, Image, PenLine, Radio, Send } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspaces.js";
import { usePosts } from "../hooks/usePosts.js";
import { useChannels } from "../hooks/useChannels.js";
import { usePublishingStatus } from "../hooks/usePublishingStatus.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { Badge, type BadgeVariant } from "../components/ui/Badge.js";
import type { PostStatus } from "../api/types.js";

const badgeVariant: Record<string, BadgeVariant> = {
  DRAFT: "draft", SCHEDULED: "scheduled", PROCESSING: "processing",
  PUBLISHING: "publishing", PUBLISHED: "published", PARTIAL: "partial",
  FAILED: "failed", CANCELLED: "cancelled",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function OverviewPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspace, isLoading: workspaceLoading } = useWorkspace(workspaceId);
  const { posts, isLoading: postsLoading } = usePosts(workspaceId);
  const { channels, isLoading: channelsLoading } = useChannels(workspaceId);
  const { isConnected, isLoading: statusLoading } = usePublishingStatus();

  if (workspaceLoading || postsLoading || channelsLoading || statusLoading) {
    return <div className="page-shell space-y-6" aria-label="Loading workspace overview">
      <Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-72 w-full" />
    </div>;
  }

  const count = (status: PostStatus) => posts.filter((post) => post.status === status).length;
  const upcoming = posts.filter((post) => post.status === "SCHEDULED" && post.scheduledFor)
    .sort((a, b) => new Date(a.scheduledFor!).getTime() - new Date(b.scheduledFor!).getTime()).slice(0, 5);
  const recent = [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const attention = posts.filter((post) => post.status === "FAILED" || post.status === "PARTIAL");

  const metrics = [
    { label: "Drafts", value: count("DRAFT"), icon: PenLine, href: "posts?status=DRAFT" },
    { label: "Scheduled", value: count("SCHEDULED"), icon: CalendarClock, href: "calendar" },
    { label: "In progress", value: count("PROCESSING") + count("PUBLISHING"), icon: CircleDashed, href: "posts?status=PROCESSING" },
    { label: "Published", value: count("PUBLISHED"), icon: Check, href: "posts?status=PUBLISHED" },
    { label: "Needs attention", value: attention.length, icon: AlertCircle, href: "posts?status=FAILED" },
  ];

  return (
    <div className="page-shell space-y-7">
      <header className="page-heading">
        <div className="min-w-0">
          <p className="page-kicker">Workspace overview</p>
          <h1>{workspace?.name || "Workspace"}</h1>
          <p className="page-description">Publishing activity and what’s coming up next.</p>
        </div>
        <Link to={`/app/${workspaceId}/compose`}><Button className="gap-2"><PenLine size={16} />Compose post</Button></Link>
      </header>

      <section className="overview-health" aria-label="Publishing connection status">
        <span className={`health-mark ${isConnected ? "is-ready" : "is-offline"}`}><Radio size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="health-title">{isConnected ? "Publishing is ready" : "Publishing is unavailable"}</p>
          <p className="health-copy">{isConnected ? `${channels.length} connected ${channels.length === 1 ? "account" : "accounts"} · Scheduled posts will publish automatically` : "Your drafts are saved. Reconnect the publishing service to resume scheduled posts."}</p>
        </div>
        {!isConnected && <Link className="text-link" to={`/app/${workspaceId}/accounts`}>Review accounts <ArrowRight size={14} /></Link>}
        {isConnected && <span className="health-state"><span />Connected</span>}
      </section>

      <section className="metric-strip" aria-label="Post totals">
        {metrics.map(({ label, value, icon: Icon, href }, index) => (
          <Link key={label} to={`/app/${workspaceId}/${href}`} className={`metric-cell ${index === 4 && value ? "metric-alert" : ""}`}>
            <span className="metric-label"><Icon size={14} />{label}</span>
            <span className="metric-value">{value}</span>
          </Link>
        ))}
      </section>

      <div className="overview-columns">
        <section className="workspace-section">
          <div className="section-heading"><div><p className="page-kicker">Queue</p><h2>Coming up</h2></div><Link className="text-link" to={`/app/${workspaceId}/calendar`}>Open calendar <ArrowRight size={14} /></Link></div>
          {upcoming.length ? <div className="activity-list">{upcoming.map((post) => (
            <article className="activity-row" key={post.id}>
              <time className="activity-time" dateTime={post.scheduledFor!}>{formatDate(post.scheduledFor!)}</time>
              <div className="activity-main"><p className="activity-content">{post.content || "Untitled post"}</p><div className="activity-meta">{post.targets?.length ? post.targets.map((target) => <span key={target.id} className="channel-label">{target.channel?.name || target.channel?.provider || "Account"}</span>) : <span>No accounts selected</span>}</div></div>
              <Badge variant={badgeVariant[post.status] || "neutral"}>{post.status}</Badge>
            </article>
          ))}</div> : <div className="inline-empty"><CalendarClock size={18} /><div><strong>No posts scheduled</strong><span>Plan your next post and it will appear here.</span></div><Link to={`/app/${workspaceId}/compose`}>Schedule one</Link></div>}
        </section>

        <aside className="overview-aside">
          <section className="workspace-section">
            <div className="section-heading"><div><p className="page-kicker">Channels</p><h2>Connected accounts</h2></div><Link className="icon-link" aria-label="Manage connected accounts" to={`/app/${workspaceId}/accounts`}><ArrowRight size={16} /></Link></div>
            {channels.length ? <div className="channel-list">{channels.slice(0, 4).map((channel) => <div className="channel-row" key={channel.id}>{channel.pictureUrl ? <img src={channel.pictureUrl} alt="" /> : <span className="channel-initial">{(channel.name || channel.provider).slice(0, 1).toUpperCase()}</span>}<div className="channel-info"><strong>{channel.name}</strong><span>{channel.provider}</span></div><span className="connected-dot" title="Connected" /></div>)}</div> : <div className="inline-empty compact"><Image size={17} /><div><strong>No accounts yet</strong><span>Connect a channel to start publishing.</span></div></div>}
          </section>
          {attention.length > 0 && <section className="attention-section"><div className="section-heading"><div><p className="page-kicker">Action required</p><h2>{attention.length} {attention.length === 1 ? "post" : "posts"}</h2></div><AlertCircle size={17} /></div><p>Some destinations did not publish. Check the failure details and try again.</p><Link to={`/app/${workspaceId}/posts?status=FAILED`}>Review failed posts <ArrowRight size={14} /></Link></section>}
        </aside>
      </div>

      <section className="workspace-section recent-section">
        <div className="section-heading"><div><p className="page-kicker">Latest activity</p><h2>Recent posts</h2></div><Link className="text-link" to={`/app/${workspaceId}/posts`}>View all posts <ArrowRight size={14} /></Link></div>
        {recent.length ? <div className="activity-list">{recent.map((post) => <article className="activity-row" key={post.id}><span className="activity-time">{post.publishedAt ? formatDate(post.publishedAt) : formatDate(post.createdAt)}</span><div className="activity-main"><p className="activity-content">{post.content || "Untitled post"}</p><div className="activity-meta"><span>{post.targets?.length || 0} {(post.targets?.length || 0) === 1 ? "destination" : "destinations"}</span>{post.lastError && post.status === "FAILED" && <span className="failure-copy">{post.lastError}</span>}</div></div><Badge variant={badgeVariant[post.status] || "neutral"}>{post.status}</Badge></article>)}</div> : <div className="inline-empty"><Send size={18} /><div><strong>No post activity yet</strong><span>Create a draft or schedule your first publication.</span></div><Link to={`/app/${workspaceId}/compose`}>Create a post</Link></div>}
      </section>
    </div>
  );
}
