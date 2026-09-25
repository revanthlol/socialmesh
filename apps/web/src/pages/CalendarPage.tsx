import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  PenSquare,
  Share2,
} from "lucide-react";
import { usePosts } from "../hooks/usePosts.js";
import { Button } from "../components/ui/Button.js";
import { Skeleton } from "@/components/ui/skeleton.js";
import { Badge } from "../components/ui/Badge.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import type { Post } from "../api/types.js";

export function CalendarPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { posts, isLoading } = usePosts(workspaceId);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month and total days
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Filter posts with scheduledFor
  const scheduledPosts = posts.filter((p) => p.scheduledFor != null);

  // Group scheduled posts by YYYY-MM-DD
  const postsByDate = new Map<string, Post[]>();
  for (const post of scheduledPosts) {
    if (post.scheduledFor) {
      const dateKey = new Date(post.scheduledFor).toISOString().slice(0, 10);
      const list = postsByDate.get(dateKey) || [];
      list.push(post);
      postsByDate.set(dateKey, list);
    }
  }

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#c9c5bb] dark:border-white/[0.08]">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-full rounded border border-[#c9c5bb] dark:border-white/[0.08]" />
        <Skeleton className="h-96 w-full rounded border border-[#c9c5bb] dark:border-white/[0.08]" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#c9c5bb] dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d] dark:text-white">
            Editorial Calendar
          </h1>
          <p className="text-xs text-[#6b706f] dark:text-zinc-500 mt-1">
            Visual publication schedule and upcoming release slots.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/app/${workspaceId}/compose`}>
            <Button size="sm" className="gap-2">
              <PenSquare className="h-3.5 w-3.5" />
              Schedule Post
            </Button>
          </Link>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex items-center justify-between bg-[#faf9f5] dark:bg-[#1c1c1f] border border-[#c9c5bb] dark:border-white/[0.08] rounded p-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-serif font-bold text-[#161a1d] dark:text-white">
            {monthNames[month]} {year}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs h-7 px-2"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded hover:bg-[#e8e6df] text-[#4c5359] dark:text-zinc-400 hover:text-[#161a1d] dark:text-white cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded hover:bg-[#e8e6df] text-[#4c5359] dark:text-zinc-400 hover:text-[#161a1d] dark:text-white cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border border-[#c9c5bb] dark:border-white/[0.08] rounded bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            {/* Day Header */}
            <div className="grid grid-cols-7 border-b border-[#c9c5bb] dark:border-white/[0.08] bg-[#f4f2ec] dark:bg-white/[0.04] text-center text-xs font-semibold text-[#6b706f] dark:text-zinc-500 py-2">
              {dayLabels.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-[#e8e6df]">
              {/* Empty cells before month starts */}
              {[...Array(firstDayIndex)].map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="min-h-24 bg-[#faf9f5] dark:bg-[#1c1c1f]/50 p-1.5"
                ></div>
              ))}

              {/* Days of month */}
              {[...Array(daysInMonth)].map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayPosts = postsByDate.get(dateStr) || [];
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;

                return (
                  <div
                    key={dateStr}
                    className={`min-h-24 p-1.5 flex flex-col justify-between transition-colors ${
                      isToday ? "bg-[#fdfbf7]" : "hover:bg-[#faf9f5] dark:bg-[#1c1c1f]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-xs font-mono font-medium rounded-full h-5 w-5 flex items-center justify-center ${
                          isToday ? "bg-[#161a1d] text-white" : "text-[#4c5359] dark:text-zinc-400"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] font-mono text-[#6b706f] dark:text-zinc-500">
                          {dayPosts.length}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-20">
                      {dayPosts.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPost(p)}
                          className="p-1 rounded text-[11px] border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f] hover:border-[#161a1d] cursor-pointer truncate"
                          title={p.content}
                        >
                          <div className="flex items-center gap-1 font-mono text-[9px] text-[#1e4d7b]">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(p.scheduledFor!).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <p className="truncate text-[#161a1d] dark:text-white font-sans">
                            {p.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Post Modal / Drawer */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/40 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] dark:bg-[#1c1c1f] border border-[#c9c5bb] dark:border-white/[0.08] rounded max-w-lg w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#c9c5bb] dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    selectedPost.status === "SCHEDULED"
                      ? "scheduled"
                      : "published"
                  }
                >
                  {selectedPost.status}
                </Badge>
                <span className="text-xs font-mono text-[#6b706f] dark:text-zinc-500">
                  {selectedPost.scheduledFor &&
                    new Date(selectedPost.scheduledFor).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                </span>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-[#6b706f] dark:text-zinc-500 hover:text-[#161a1d] dark:text-white text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-[#161a1d] dark:text-white whitespace-pre-wrap leading-relaxed">
                {selectedPost.content}
              </p>

              {selectedPost.targets && selectedPost.targets.length > 0 && (
                <div className="pt-2 border-t border-[#c9c5bb] dark:border-white/[0.08]">
                  <span className="text-xs font-semibold text-[#4c5359] dark:text-zinc-400 block mb-1.5">
                    Target Channels:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPost.targets.map((t) => (
                      <span
                        key={t.id}
                        className="px-2 py-0.5 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-white text-xs text-[#161a1d] dark:text-white"
                      >
                        {t.channel?.name || "Channel"} (
                        {t.channel?.provider || "provider"})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#c9c5bb] dark:border-white/[0.08] flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPost(null)}
              >
                Close
              </Button>
              <Link to={`/app/${workspaceId}/posts`}>
                <Button size="sm">View in Posts</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Scheduled Queue summary list */}
      <div className="p-4 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f] space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4c5359] dark:text-zinc-400">
          Upcoming Scheduled Publications ({scheduledPosts.length})
        </h3>

        {scheduledPosts.length === 0 ? (
          <p className="text-xs text-[#6b706f] dark:text-zinc-500">
            No scheduled posts pending in this workspace.
          </p>
        ) : (
          <div className="divide-y divide-[#c9c5bb]">
            {scheduledPosts.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="py-2.5 flex items-center justify-between text-xs gap-3"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-[11px] text-[#1e4d7b] mr-2">
                    {new Date(p.scheduledFor!).toLocaleDateString()}{" "}
                    {new Date(p.scheduledFor!).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="text-[#161a1d] dark:text-white">{p.content}</span>
                </div>
                <Badge variant="scheduled" size="sm">
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
