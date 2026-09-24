import { Link, useParams } from "react-router-dom";
import { Calendar as CalendarIcon, Clock, PenSquare } from "lucide-react";
import { usePosts } from "../hooks/usePosts.js";
import { Button } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";

export function CalendarPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { posts } = usePosts(workspaceId);

  const scheduledOrDrafts = posts.filter((p) => p.status === "SCHEDULED" || p.status === "DRAFT");

  return (
    <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">Editorial Calendar</h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Timeline of scheduled publications, pending dispatches, and draft release dates.
          </p>
        </div>

        <Link to={`/app/${workspaceId}/compose`}>
          <Button size="sm" className="gap-2">
            <PenSquare className="h-3.5 w-3.5" />
            Schedule Publication
          </Button>
        </Link>
      </div>

      {scheduledOrDrafts.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-8 w-8" />}
          title="No scheduled posts in the calendar"
          description="Draft or schedule posts to see upcoming release slots across the publishing timeline."
          action={
            <Link to={`/app/${workspaceId}/compose`}>
              <Button size="sm">Create First Post</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-[#faf9f5] border border-[#c9c5bb] rounded text-xs text-[#6b706f] flex items-center justify-between">
            <span>Showing editorial queue ordered by creation date</span>
            <span className="font-mono">{scheduledOrDrafts.length} items</span>
          </div>

          <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-[#faf9f5]">
            {scheduledOrDrafts.map((post) => (
              <div key={post.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={post.status === "DRAFT" ? "draft" : "warning"}>
                      {post.status}
                    </Badge>
                    <span className="text-xs text-[#6b706f] font-mono flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#161a1d] truncate">{post.content}</p>
                </div>

                <Link to={`/app/${workspaceId}/compose?postId=${post.id}`}>
                  <Button variant="outline" size="sm">
                    Open
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
