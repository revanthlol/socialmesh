import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  LayoutDashboard,
  PenSquare,
  Calendar,
  FileText,
  Image,
  Share2,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  Sun,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useTheme } from "../../hooks/useTheme.js";
import { Spinner } from "@/components/ui/spinner.js";
import { Switch } from "@/components/ui/switch.js";

export function AppLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, workspaces, isLoading, isAuthenticated, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [isPinned, setIsPinned] = useState(() => {
    try {
      const v = localStorage.getItem("socialmesh_sidebar_pinned");
      return v === null ? true : v === "true";
    } catch { return true; }
  });
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pillTouchStartX = useRef<number>(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("socialmesh_sidebar_pinned", String(isPinned)); } catch {}
  }, [isPinned]);

  useEffect(() => { setIsMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login", { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  const isExpanded = isMobile ? false : (isPinned || isSidebarHovered);

  if (isLoading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#f2f0e9] dark:bg-[#0d0d0f] dark:bg-[#0d0d0f]">
        <div className="flex flex-col items-center gap-4 p-8 rounded-xl border border-[#c9c5bb] dark:border-white/[0.08] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f] dark:bg-[#18181b] shadow-lg max-w-xs w-full text-center">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.svg" alt="SocialMesh" className="h-7 w-7 object-contain" />
            <span className="font-serif text-2xl font-bold tracking-tight text-[#161a1d] dark:text-white dark:text-white">SocialMesh</span>
          </div>
          <Spinner size="lg" />
          <p className="text-xs font-mono tracking-wider uppercase text-[#6b706f] dark:text-zinc-500 dark:text-zinc-500">Loading Workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId) || workspaces[0];

  const navItems = [
    { label: "Overview",            path: `/app/${currentWorkspace?.id || ""}`,           icon: LayoutDashboard, end: true },
    { label: "Compose",             path: `/app/${currentWorkspace?.id || ""}/compose`,    icon: PenSquare },
    { label: "Calendar",            path: `/app/${currentWorkspace?.id || ""}/calendar`,   icon: Calendar },
    { label: "Posts",               path: `/app/${currentWorkspace?.id || ""}/posts`,      icon: FileText },
    { label: "Media Library",       path: `/app/${currentWorkspace?.id || ""}/media`,      icon: Image },
    { label: "Connected Accounts",  path: `/app/${currentWorkspace?.id || ""}/accounts`,   icon: Share2 },
    { label: "Workspace Settings",  path: `/app/${currentWorkspace?.id || ""}/settings`,   icon: Settings },
  ];

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const workspaceInitial = currentWorkspace?.name?.trim()?.[0]?.toUpperCase() || "W";
  const userInitial = user.displayName?.trim()?.[0]?.toUpperCase() || "U";

  // ── Sidebar shared content ──────────────────────────────────────────────────
  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    const expanded = mobile ? true : isExpanded;

    return (
      <>
        {/* ── Logo header — fixed h-14 ── */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#c9c5bb] dark:border-white/[0.08]/50 dark:border-white/[0.06] px-3">
          <Link
            to="/app"
            onClick={() => mobile && setIsMobileOpen(false)}
            className="flex items-center gap-2.5 overflow-hidden min-w-0"
          >
            <img src="/logo-icon.svg" alt="SocialMesh" className="h-7 w-7 shrink-0 object-contain" />
            <span
              className={cn(
                "font-serif font-bold text-[#161a1d] dark:text-white dark:text-white text-sm tracking-tight whitespace-nowrap transition-opacity duration-200",
                expanded ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              SocialMesh
            </span>
          </Link>

          {mobile ? (
            <button
              onClick={() => setIsMobileOpen(false)}
              className="p-1.5 rounded-md text-[#6b706f] dark:text-zinc-500 dark:text-zinc-400 hover:text-[#161a1d] dark:text-white dark:hover:text-white hover:bg-[#e8e6df] dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            expanded && (
              <button
                onClick={() => setIsPinned(v => !v)}
                title={isPinned ? "Collapse sidebar" : "Keep expanded"}
                className="p-1.5 rounded-md text-[#6b706f] dark:text-zinc-500 dark:text-zinc-400 hover:text-[#161a1d] dark:text-white dark:hover:text-white hover:bg-[#e8e6df] dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              >
                {isPinned ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
              </button>
            )
          )}
        </div>

        {/* ── Workspace section — fixed h-[52px] so it NEVER changes height ── */}
        <div className="h-[52px] shrink-0 flex items-center border-b border-[#c9c5bb] dark:border-white/[0.08]/50 dark:border-white/[0.06] bg-[#f4f2ec] dark:bg-white/[0.04]/60 dark:bg-white/[0.015] px-2.5">
          {expanded ? (
            /* Expanded: label + dropdown in a row, same 52px height */
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="relative flex-1 min-w-0">
                <select
                  value={currentWorkspace?.id || ""}
                  onChange={(e) => { navigate(`/app/${e.target.value}`); if (mobile) setIsMobileOpen(false); }}
                  className="w-full h-7 px-2 pr-6 text-xs font-medium rounded-md border border-[#c9c5bb] dark:border-white/[0.08] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] text-[#161a1d] dark:text-white dark:text-white appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#161a1d] dark:focus:ring-white/30 transition-colors"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-[#6b706f] dark:text-zinc-500 dark:text-zinc-400 pointer-events-none" />
              </div>
            </div>
          ) : (
            /* Collapsed: centered workspace initial badge — same 52px height */
            <div className="flex w-full justify-center">
              <div
                title={currentWorkspace?.name}
                className="h-8 w-8 rounded-md bg-[#161a1d] dark:bg-white/[0.1] text-white dark:text-white flex items-center justify-center text-xs font-bold select-none border border-[#161a1d]/20 dark:border-white/[0.08] cursor-default"
              >
                {workspaceInitial}
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation — fixed icon slot, label fades ── */}
        <nav className="flex-1 px-2 py-2.5 overflow-y-auto overflow-x-hidden space-y-px">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                onClick={() => mobile && setIsMobileOpen(false)}
                title={!expanded ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "flex items-center rounded-md h-9 transition-colors duration-150 text-xs font-medium relative overflow-hidden group",
                    isActive
                      ? "bg-[#161a1d] dark:bg-white/[0.1] text-white dark:text-white font-semibold"
                      : "text-[#4c5359] dark:text-zinc-400 dark:text-zinc-400 hover:bg-[#e8e6df] dark:hover:bg-white/[0.05] hover:text-[#161a1d] dark:text-white dark:hover:text-white"
                  )
                }
              >
                {/* Fixed 44px icon slot — position NEVER changes */}
                <div className="w-11 h-9 shrink-0 flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                {/* Label: opacity only, zero layout impact */}
                <span
                  className={cn(
                    "truncate pr-3 transition-opacity duration-200 whitespace-nowrap",
                    expanded ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* ── Theme switch — compact row ── */}
        <div className="px-2 py-2 border-t border-[#c9c5bb] dark:border-white/[0.08]/50 dark:border-white/[0.06] shrink-0">
          {expanded ? (
            /* Expanded: Sun icon + "Dark mode" label + Switch */
            <div className="flex items-center h-9 px-2.5 gap-2.5 rounded-md text-xs text-[#4c5359] dark:text-zinc-400 dark:text-zinc-400">
              <Sun className="h-4 w-4 shrink-0" />
              <span className="flex-1 font-medium whitespace-nowrap">Dark Mode</span>
              <Switch
                checked={resolvedTheme === "dark"}
                onCheckedChange={toggleTheme}
                aria-label="Toggle dark mode"
              />
            </div>
          ) : (
            /* Collapsed: just a sun/moon icon button centered */
            <button
              onClick={toggleTheme}
              title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="flex items-center justify-center w-full h-9 rounded-md text-[#4c5359] dark:text-zinc-400 dark:text-zinc-400 hover:bg-[#e8e6df] dark:hover:bg-white/[0.05] hover:text-[#161a1d] dark:text-white dark:hover:text-white transition-colors cursor-pointer"
            >
              <Sun className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* ── User footer ── */}
        <div className="px-2.5 py-2.5 border-t border-[#c9c5bb] dark:border-white/[0.08]/50 dark:border-white/[0.06] bg-[#f4f2ec] dark:bg-white/[0.04]/60 dark:bg-white/[0.015] shrink-0">
          <div className={cn("flex items-center", expanded ? "gap-2.5" : "justify-center")}>
            <div
              title={!expanded ? user!.displayName : undefined}
              className="h-7 w-7 rounded-full bg-[#161a1d] dark:bg-white/[0.12] text-white dark:text-white flex items-center justify-center text-xs font-semibold shrink-0 border border-[#161a1d]/20 dark:border-white/[0.08] select-none cursor-default"
            >
              {userInitial}
            </div>
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#161a1d] dark:text-white dark:text-white truncate leading-tight">
                    {user!.displayName}
                  </p>
                  <p className="text-[10px] text-[#6b706f] dark:text-zinc-500 dark:text-zinc-500 truncate leading-tight mt-0.5 font-mono">
                    {user!.email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1.5 rounded-md text-[#6b706f] dark:text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-[#e8e6df] dark:hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f2f0e9] dark:bg-[#0d0d0f] dark:bg-[#0d0d0f] text-[#161a1d] dark:text-white dark:text-white flex relative">
      <a className="skip-link" href="#main-content">Skip to content</a>

      {/* ── Desktop Sidebar ───────────────────────────────────────────────────── */}
      {!isMobile && (
        <aside
          onMouseEnter={() => { if (!isPinned) setIsSidebarHovered(true); }}
          onMouseLeave={() => { if (!isPinned) setIsSidebarHovered(false); }}
          className={cn(
            "fixed top-0 left-0 bottom-0 z-40 flex flex-col select-none overflow-hidden",
            "bg-[#faf9f5] dark:bg-[#1c1c1f] dark:bg-[#141517]",
            "border-r border-[#c9c5bb] dark:border-white/[0.08] dark:border-white/[0.07]",
            "shadow-[1px_0_0_0_rgba(0,0,0,0.04)] dark:shadow-[1px_0_0_0_rgba(255,255,255,0.03)]",
            "transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
            isExpanded ? "w-56" : "w-[60px]"
          )}
        >
          <SidebarContent />
        </aside>
      )}

      {/* ── Mobile ───────────────────────────────────────────────────────────── */}
      {isMobile && (
        <>
          <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-[#faf9f5] dark:bg-[#1c1c1f]/90 dark:bg-[#141517]/90 backdrop-blur-md border-b border-[#c9c5bb] dark:border-white/[0.08] dark:border-white/[0.07] flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="p-1.5 -ml-1 rounded-md text-[#161a1d] dark:text-white dark:text-white hover:bg-[#e8e6df] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                aria-label="Open menu"
                aria-expanded={isMobileOpen}
                aria-controls="mobile-navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <Link to="/app" className="flex items-center gap-2">
                <img src="/logo-icon.svg" alt="SocialMesh" className="h-6 w-6 shrink-0 object-contain" />
                <span className="font-serif text-lg font-bold tracking-tight text-[#161a1d] dark:text-white dark:text-white">SocialMesh</span>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-2">
                <Sun className="h-3.5 w-3.5 text-[#6b706f] dark:text-zinc-500 dark:text-zinc-400" />
                <Switch checked={resolvedTheme === "dark"} onCheckedChange={toggleTheme} aria-label="Toggle dark mode" />
              </div>
              <div className="h-8 w-8 rounded-full bg-[#161a1d] dark:bg-white/[0.12] text-white flex items-center justify-center text-xs font-semibold border border-[#161a1d]/20 dark:border-white/[0.08]">
                {userInitial}
              </div>
            </div>
          </header>

          <AnimatePresence>
            {isMobileOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setIsMobileOpen(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                />
                <motion.aside
                  id="mobile-navigation"
                  initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                  className="fixed inset-y-0 left-0 w-64 z-50 flex flex-col bg-[#faf9f5] dark:bg-[#1c1c1f] dark:bg-[#141517] border-r border-[#c9c5bb] dark:border-white/[0.08] dark:border-white/[0.07] shadow-2xl"
                  onTouchStart={(e) => { pillTouchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    if (pillTouchStartX.current - e.changedTouches[0].clientX > 60) setIsMobileOpen(false);
                  }}
                >
                  <SidebarContent mobile />
                </motion.aside>
              </>
            )}
          </AnimatePresence>

          {!isMobileOpen && (
            <div
              onTouchStart={(e) => { pillTouchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (e.changedTouches[0].clientX - pillTouchStartX.current > 30) setIsMobileOpen(true);
              }}
              className="fixed left-0 top-1/2 -translate-y-1/2 z-30 w-2 h-20 rounded-r-lg bg-[#c9c5bb]/50 dark:bg-white/[0.08] cursor-pointer"
            />
          )}
        </>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 min-h-dvh transition-[padding] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
          isMobile ? "pl-0 pt-14" : isExpanded ? "pl-56" : "pl-[60px]"
        )}
      >
        <AnimatePresence mode="wait">
          <motion.main
            id="main-content"
            tabIndex={-1}
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex-1 flex flex-col min-w-0 overflow-x-hidden"
          >
            <Outlet context={{ workspace: currentWorkspace }} />
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
