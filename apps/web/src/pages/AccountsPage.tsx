import { useState } from "react";
import { useParams, useOutletContext } from "react-router-dom";
import {
  Share2,
  Plus,
  Trash2,
  Unlink,
  AlertTriangle,
  Check,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { useChannels } from "../hooks/useChannels.js";
import { usePublishingStatus } from "../hooks/usePublishingStatus.js";
import { Button } from "../components/ui/Button.js";
import { Badge } from "../components/ui/Badge.js";
import type {
  Workspace,
  WorkspaceChannel,
  AvailableChannel,
} from "../api/types.js";

const PROVIDER_INFO: Record<string, { label: string; color: string }> = {
  facebook: { label: "Facebook Page", color: "#1877F2" },
  instagram: { label: "Instagram", color: "#E4405F" },
  linkedin: { label: "LinkedIn Profile", color: "#0A66C2" },
  "linkedin-page": { label: "LinkedIn Page", color: "#0A66C2" },
  x: { label: "X (Twitter)", color: "#000000" },
  devto: { label: "Dev.to", color: "#0A0A0A" },
  pinterest: { label: "Pinterest", color: "#BD081C" },
  youtube: { label: "YouTube", color: "#FF0000" },
  reddit: { label: "Reddit", color: "#FF4500" },
};

function formatProvider(provider: string): { label: string; color: string } {
  const norm = provider.toLowerCase();
  return PROVIDER_INFO[norm] || { label: provider, color: "#4c5359" };
}

export function AccountsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspace } = useOutletContext<{ workspace?: Workspace }>();
  const isOwner = workspace?.role === "OWNER";

  const {
    channels,
    isLoading,
    availableChannels,
    isEngineOffline,
    isLoadingAvailable,
    assignChannel,
    isAssigning,
    removeChannel,
    isRemoving,
    disconnectChannel,
    isDisconnecting,
    getConnectUrl,
    isGettingConnectUrl,
  } = useChannels(workspaceId);

  const { isConnected: isEngineConnected } = usePublishingStatus();

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [disconnectConfirmChannel, setDisconnectConfirmChannel] =
    useState<WorkspaceChannel | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<string>("linkedin-page");
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleAssign(channel: AvailableChannel) {
    setActionError(null);
    try {
      await assignChannel({
        postizIntegrationId: channel.id,
        provider: channel.provider,
        name: channel.name,
        pictureUrl: channel.pictureUrl,
      });
      setIsAssignModalOpen(false);
    } catch (err: any) {
      setActionError(err.message || "Failed to assign channel.");
    }
  }

  async function handleRemove(channelId: string) {
    setActionError(null);
    try {
      await removeChannel(channelId);
    } catch (err: any) {
      setActionError(err.message || "Failed to remove channel.");
    }
  }

  async function handleDisconnectConfirm() {
    if (!disconnectConfirmChannel) return;
    setActionError(null);
    try {
      await disconnectChannel(disconnectConfirmChannel.id);
      setDisconnectConfirmChannel(null);
    } catch (err: any) {
      setActionError(err.message || "Failed to disconnect integration.");
    }
  }

  async function handleInitiateOAuth() {
    setActionError(null);
    try {
      const res = await getConnectUrl(selectedProvider);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setActionError(
        err.message ||
          "Could not obtain connection URL from publishing engine. Verify provider credentials in Postiz.",
      );
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#c9c5bb]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-serif font-bold text-[#161a1d]">
              Workspace Channels
            </h1>
            {isEngineConnected ? (
              <Badge variant="published">Engine Connected</Badge>
            ) : (
              <Badge variant="failed">Engine Offline</Badge>
            )}
          </div>
          <p className="text-xs text-[#6b706f] mt-1">
            Social publishing destinations assigned to this workspace from the
            shared organization.
          </p>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignModalOpen(true)}
              className="gap-1 text-xs"
              disabled={!isEngineConnected}
            >
              <Share2 className="h-3.5 w-3.5" />
              Assign From Org
            </Button>
            <Button
              size="sm"
              onClick={() => setIsConnectModalOpen(true)}
              className="gap-1 text-xs"
              disabled={!isEngineConnected}
            >
              <Plus className="h-3.5 w-3.5" />
              Connect New Account
            </Button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 rounded text-xs flex items-center justify-between border bg-[#fbeeed] text-[#b23a24] border-[#f4c6bf]">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="font-bold opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Engine Offline Warning */}
      {!isEngineConnected && (
        <div className="p-4 rounded border border-[#f4c6bf] bg-[#fbeeed] text-xs text-[#b23a24] flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Publishing Engine Unavailable</p>
            <p className="opacity-90">
              The underlying Postiz publishing engine is currently unreachable.
              You can continue authoring and saving drafts, but connecting or
              publishing to social channels is paused.
            </p>
          </div>
        </div>
      )}

      {/* Channels List */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-mono text-[#6b706f]">
          Loading assigned channels...
        </div>
      ) : channels.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[#c9c5bb] rounded bg-[#faf9f5] space-y-4">
          <div className="h-12 w-12 rounded-full bg-[#e8e6df] text-[#6b706f] flex items-center justify-center mx-auto">
            <Share2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#161a1d]">
              No Channels Assigned
            </h3>
            <p className="text-xs text-[#6b706f] max-w-sm mx-auto">
              This workspace has no active social channels. Workspace owners can
              assign existing accounts from the organization or connect a new
              provider.
            </p>
          </div>
          {isOwner && (
            <div className="flex justify-center gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAssignModalOpen(true)}
                disabled={!isEngineConnected}
              >
                Assign Existing Account
              </Button>
              <Button
                size="sm"
                onClick={() => setIsConnectModalOpen(true)}
                disabled={!isEngineConnected}
              >
                Connect New Provider
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {channels.map((channel) => {
            const providerInfo = formatProvider(channel.provider);
            return (
              <div
                key={channel.id}
                className="p-4 rounded border border-[#c9c5bb] bg-[#faf9f5] flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {channel.pictureUrl ? (
                      <img
                        src={channel.pictureUrl}
                        alt={channel.name}
                        className="h-10 w-10 rounded-full object-cover border border-[#c9c5bb]"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#161a1d] text-white flex items-center justify-center text-sm font-semibold font-serif">
                        {channel.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-semibold text-[#161a1d]">
                        {channel.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-[#6b706f]">
                          {providerInfo.label}
                        </span>
                        <span className="text-[#c9c5bb]">•</span>
                        <span className="text-[11px] font-mono text-[#24613b] font-medium">
                          Assigned
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#e8e6df] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#6b706f]">
                    ID:{" "}
                    <code className="font-mono">
                      {channel.postizIntegrationId.slice(0, 10)}...
                    </code>
                  </span>

                  {isOwner && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRemove(channel.id)}
                        disabled={isRemoving}
                        className="text-[#6b706f] hover:text-[#161a1d] transition-colors cursor-pointer text-xs underline"
                        title="Remove assignment from this workspace"
                      >
                        Remove from Workspace
                      </button>
                      <button
                        onClick={() => setDisconnectConfirmChannel(channel)}
                        disabled={isDisconnecting}
                        className="p-1 rounded text-[#6b706f] hover:text-[#b23a24] hover:bg-[#fbeeed] transition-colors cursor-pointer"
                        title="Permanently disconnect provider from engine"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Assign Integration from Organization */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/40 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] border border-[#c9c5bb] rounded max-w-lg w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#c9c5bb] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#161a1d]">
                  Assign Account from Organization
                </h3>
                <p className="text-xs text-[#6b706f]">
                  Select a connected Postiz integration for this workspace.
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-[#6b706f] hover:text-[#161a1d] text-lg font-bold"
              >
                ×
              </button>
            </div>

            {isLoadingAvailable ? (
              <div className="py-8 text-center text-xs font-mono text-[#6b706f]">
                Fetching available organization integrations...
              </div>
            ) : availableChannels.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6b706f] space-y-2">
                <p>
                  No social accounts have been connected in the organization
                  Postiz instance yet.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setIsConnectModalOpen(true);
                  }}
                >
                  Connect an Account
                </Button>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableChannels.map((item) => {
                  const providerInfo = formatProvider(item.provider);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded border border-[#c9c5bb] bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        {item.pictureUrl ? (
                          <img
                            src={item.pictureUrl}
                            alt={item.name}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-7 w-7 rounded-full bg-[#161a1d] text-white flex items-center justify-center text-xs font-serif">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-[#161a1d]">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-[#6b706f]">
                            {providerInfo.label}
                          </p>
                        </div>
                      </div>

                      <div>
                        {item.isAssignedToCurrent ? (
                          <span className="px-2 py-0.5 rounded bg-[#e9f2eb] text-[#24613b] font-mono text-[10px]">
                            Assigned
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAssign(item)}
                            isLoading={isAssigning}
                            className="text-xs h-7 px-2.5"
                          >
                            Assign
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAssignModalOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Connect New Account (OAuth) */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/40 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] border border-[#c9c5bb] rounded max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-[#c9c5bb] pb-3">
              <div>
                <h3 className="text-base font-semibold text-[#161a1d]">
                  Connect Provider via OAuth
                </h3>
                <p className="text-xs text-[#6b706f]">
                  Initiate official OAuth connection with Postiz publishing
                  engine.
                </p>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-[#6b706f] hover:text-[#161a1d] text-lg font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-[#4c5359]">
                Select Social Provider:
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded border border-[#c9c5bb] bg-white text-[#161a1d] focus:outline-none focus:ring-1 focus:ring-[#161a1d]"
              >
                <option value="linkedin-page">LinkedIn Company Page</option>
                <option value="linkedin">LinkedIn Member Profile</option>
                <option value="facebook">Facebook Page</option>
                <option value="instagram">Instagram Professional</option>
                <option value="x">X / Twitter</option>
                <option value="devto">Dev.to Community</option>
                <option value="pinterest">Pinterest</option>
                <option value="youtube">YouTube</option>
                <option value="reddit">Reddit</option>
              </select>

              <div className="p-3 rounded bg-[#f4f2ec] border border-[#d4d0c5] text-xs text-[#6b706f] space-y-1">
                <p className="font-semibold text-[#161a1d]">
                  Single-Organization OAuth Contract:
                </p>
                <p>
                  Connecting a provider authorizes the shared Postiz
                  installation. Once authorized, you can assign the channel to
                  this workspace.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConnectModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleInitiateOAuth}
                isLoading={isGettingConnectUrl}
                className="gap-1.5"
              >
                Continue to Provider <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Disconnect Confirmation */}
      {disconnectConfirmChannel && (
        <div className="fixed inset-0 z-50 bg-[#161a1d]/40 flex items-center justify-center p-4">
          <div className="bg-[#faf9f5] border border-[#b23a24]/30 rounded max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-3 text-[#b23a24]">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-semibold text-[#161a1d]">
                Disconnect Social Account?
              </h3>
            </div>

            <p className="text-xs text-[#4c5359] leading-relaxed">
              Are you sure you want to permanently disconnect{" "}
              <strong>{disconnectConfirmChannel.name}</strong> from the
              publishing engine?
            </p>
            <p className="text-xs text-[#b23a24] font-medium leading-relaxed">
              This will remove the credentials from Postiz and unlink this
              channel from all SociaMesh workspaces.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisconnectConfirmChannel(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={handleDisconnectConfirm}
                isLoading={isDisconnecting}
                className="gap-1"
              >
                <Unlink className="h-3.5 w-3.5" />
                Disconnect Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
