import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

export function WorkspaceRedirect() {
  const { workspaces, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }

    if (workspaces.length > 0 && workspaces[0]?.id) {
      navigate(`/app/${workspaces[0].id}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, workspaces, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f0e9] dark:bg-[#0d0d0f]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 border-2 border-[#161a1d] border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-mono tracking-widest uppercase text-[#6b706f] dark:text-zinc-500">
          Loading Workspace
        </span>
      </div>
    </div>
  );
}
