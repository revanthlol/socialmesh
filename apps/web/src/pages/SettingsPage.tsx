import { useState, useEffect, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Users, CheckCircle2, AlertCircle, Plus, Building2 } from "lucide-react";
import { useWorkspace, useWorkspaceMembers, useWorkspaces } from "../hooks/useWorkspaces.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { Badge } from "../components/ui/Badge.js";

export function SettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspace, updateWorkspace, isUpdating } = useWorkspace(workspaceId);
  const { data: members = [], isLoading: membersLoading } = useWorkspaceMembers(workspaceId);
  const { createWorkspace, isCreating } = useWorkspaces();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [newWsName, setNewWsName] = useState("");
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setTimezone(workspace.timezone || "UTC");
    }
  }, [workspace]);

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    setStatusMessage(null);

    try {
      await updateWorkspace({ name: name.trim(), timezone: timezone.trim() });
      setStatusMessage({ type: "success", text: "Workspace settings updated successfully." });
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Failed to update workspace." });
    }
  }

  async function handleCreateNewWorkspace(e: FormEvent) {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      const created = await createWorkspace({ name: newWsName.trim() });
      setIsCreatingModal(false);
      setNewWsName("");
      navigate(`/app/${created.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to create workspace");
    }
  }

  const isOwner = workspace?.role === "OWNER";

  return (
    <div className="p-6 md:p-8 max-w-4xl w-full mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">Workspace Settings</h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Configure organization preferences, timezones, and membership roles.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreatingModal(true)}
          className="gap-2 self-start md:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          New Workspace
        </Button>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded text-xs flex items-center justify-between border ${
            statusMessage.type === "success"
              ? "bg-[#e9f2eb] text-[#24613b] border-[#c5e0cb]"
              : "bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-current font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* General Settings Form */}
      <section className="p-6 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#161a1d] flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" /> General Configuration
          </h2>
          <p className="text-xs text-[#6b706f] mt-0.5">
            Basic metadata used for social publication headers and scheduling timestamps.
          </p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="Workspace Name"
            value={name}
            disabled={!isOwner}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Timezone (IANA)"
            value={timezone}
            disabled={!isOwner}
            onChange={(e) => setTimezone(e.target.value)}
            helperText="e.g. UTC, America/New_York, Europe/London"
            required
          />

          {isOwner ? (
            <Button type="submit" size="sm" isLoading={isUpdating}>
              Save Changes
            </Button>
          ) : (
            <p className="text-xs text-[#6b706f] italic">
              Only workspace Owners can modify general organization settings.
            </p>
          )}
        </form>
      </section>

      {/* Membership & RBAC Section */}
      <section className="p-6 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#161a1d] flex items-center gap-2">
              <Users className="h-4 w-4" /> Team Members & Roles ({members.length})
            </h2>
            <p className="text-xs text-[#6b706f] mt-0.5">
              Access control and role assignment for this workspace.
            </p>
          </div>
        </div>

        {membersLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-[#e8e6df] rounded"></div>
            <div className="h-10 bg-[#e8e6df] rounded"></div>
          </div>
        ) : (
          <div className="divide-y divide-[#c9c5bb] border border-[#c9c5bb] rounded bg-white">
            {members.map((member) => (
              <div key={member.membershipId} className="p-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#161a1d] truncate">
                    {member.displayName}
                  </p>
                  <p className="text-xs text-[#6b706f] truncate">{member.email}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-[#6b706f]">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </span>
                  <Badge variant={member.role === "OWNER" ? "owner" : "neutral"}>
                    {member.role}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Workspace Modal */}
      {isCreatingModal && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/75 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] rounded max-w-md w-full border border-[#c9c5bb] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-[#161a1d]">Create New Workspace</h3>
              <button
                onClick={() => setIsCreatingModal(false)}
                className="text-[#6b706f] hover:text-[#161a1d] text-lg font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateNewWorkspace} className="space-y-4">
              <Input
                label="Workspace Name"
                placeholder="e.g. Marketing Team"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                required
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isCreating}>
                  Create Workspace
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
