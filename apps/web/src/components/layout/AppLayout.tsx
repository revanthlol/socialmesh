import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
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
  Building2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth.js";
import { Badge } from "../ui/Badge.js";

export function AppLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user, workspaces, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f0e9]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-[#161a1d] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-mono tracking-widest uppercase text-[#6b706f]">
            Loading SociaMesh
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const currentWorkspace =
    workspaces.find((w) => w.id === workspaceId) || workspaces[0];

  const navItems = [
    {
      label: "Overview",
      path: `/app/${currentWorkspace?.id || ""}`,
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: "Compose",
      path: `/app/${currentWorkspace?.id || ""}/compose`,
      icon: PenSquare,
    },
    {
      label: "Calendar",
      path: `/app/${currentWorkspace?.id || ""}/calendar`,
      icon: Calendar,
    },
    {
      label: "Posts",
      path: `/app/${currentWorkspace?.id || ""}/posts`,
      icon: FileText,
    },
    {
      label: "Media Library",
      path: `/app/${currentWorkspace?.id || ""}/media`,
      icon: Image,
    },
    {
      label: "Connected Accounts",
      path: `/app/${currentWorkspace?.id || ""}/accounts`,
      icon: Share2,
    },
    {
      label: "Workspace Settings",
      path: `/app/${currentWorkspace?.id || ""}/settings`,
      icon: Settings,
    },
  ];

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f2f0e9] text-[#161a1d]">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#faf9f5] border-r border-[#c9c5bb] flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="p-4 border-b border-[#c9c5bb]">
          <Link to="/app" className="flex items-center gap-2">
            <span className="font-serif text-xl font-bold tracking-tight text-[#161a1d]">
              SociaMesh
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#e8e6df] text-[#6b706f]">
              Core
            </span>
          </Link>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-[#c9c5bb] bg-[#f4f2ec]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#6b706f] mb-1.5 px-1">
            <span>Workspace</span>
            {currentWorkspace?.role && (
              <Badge variant="neutral">{currentWorkspace.role}</Badge>
            )}
          </div>
          <div className="relative">
            <select
              value={currentWorkspace?.id || ""}
              onChange={(e) => navigate(`/app/${e.target.value}`)}
              className="w-full h-8 px-2.5 pr-8 text-xs font-medium rounded border border-[#c9c5bb] bg-white text-[#161a1d] appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#161a1d]"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-2.5 h-3.5 w-3.5 text-[#6b706f] pointer-events-none" />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors ${
                    isActive
                      ? "bg-[#161a1d] text-white"
                      : "text-[#4c5359] hover:bg-[#e8e6df] hover:text-[#161a1d]"
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Account / Sign Out Footer */}
        <div className="p-3 border-t border-[#c9c5bb] bg-[#f4f2ec] flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-[#161a1d] truncate">
              {user.displayName}
            </p>
            <p className="text-[11px] text-[#6b706f] truncate">{user.email}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded text-[#6b706f] hover:text-[#b23a24] hover:bg-[#e8e6df] transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>

      {/* Main Workspace Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Outlet context={{ workspace: currentWorkspace }} />
      </main>
    </div>
  );
}
