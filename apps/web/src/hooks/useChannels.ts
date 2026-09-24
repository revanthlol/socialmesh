import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { WorkspaceChannel, AvailableChannel } from "../api/types.js";

export function useChannels(workspaceId?: string) {
  const queryClient = useQueryClient();

  const assignedQuery = useQuery({
    queryKey: ["workspaces", workspaceId, "channels"],
    queryFn: async () => {
      if (!workspaceId) return [];
      return await api.get<WorkspaceChannel[]>(
        `/workspaces/${workspaceId}/channels`,
      );
    },
    enabled: !!workspaceId,
  });

  const availableQuery = useQuery({
    queryKey: ["workspaces", workspaceId, "channels", "available"],
    queryFn: async () => {
      if (!workspaceId) return { channels: [], isEngineOffline: false };
      return await api.get<{
        channels: AvailableChannel[];
        isEngineOffline: boolean;
      }>(`/workspaces/${workspaceId}/channels/available`);
    },
    enabled: !!workspaceId,
  });

  const assignMutation = useMutation({
    mutationFn: async (data: {
      postizIntegrationId: string;
      provider: string;
      name: string;
      pictureUrl?: string | null;
    }) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<WorkspaceChannel>(
        `/workspaces/${workspaceId}/channels`,
        data,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels", "available"],
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (channelId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.delete(
        `/workspaces/${workspaceId}/channels/${channelId}`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels", "available"],
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.delete(
        `/workspaces/${workspaceId}/channels/${channelId}/disconnect`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels"],
      });
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "channels", "available"],
      });
    },
  });

  const getConnectUrlMutation = useMutation({
    mutationFn: async (provider: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<{ url: string }>(
        `/workspaces/${workspaceId}/channels/connect-url`,
        { provider },
      );
    },
  });

  return {
    channels: assignedQuery.data || [],
    isLoading: assignedQuery.isLoading,
    refetchChannels: assignedQuery.refetch,

    availableChannels: availableQuery.data?.channels || [],
    isEngineOffline: availableQuery.data?.isEngineOffline || false,
    isLoadingAvailable: availableQuery.isLoading,
    refetchAvailable: availableQuery.refetch,

    assignChannel: assignMutation.mutateAsync,
    isAssigning: assignMutation.isPending,

    removeChannel: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,

    disconnectChannel: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    getConnectUrl: getConnectUrlMutation.mutateAsync,
    isGettingConnectUrl: getConnectUrlMutation.isPending,
  };
}
