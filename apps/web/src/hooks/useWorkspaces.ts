import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { Workspace, WorkspaceMember } from "../api/types.js";

export function useWorkspaces() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      return await api.get<Workspace[]>("/workspaces");
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; timezone?: string }) => {
      return await api.post<Workspace>("/workspaces", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });

  return {
    workspaces: listQuery.data || [],
    isLoading: listQuery.isLoading,
    refetch: listQuery.refetch,
    createWorkspace: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}

export function useWorkspace(workspaceId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["workspaces", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      return await api.get<Workspace>(`/workspaces/${workspaceId}`);
    },
    enabled: !!workspaceId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; timezone?: string }) => {
      if (!workspaceId) throw new Error("No workspace ID provided");
      return await api.patch<Workspace>(`/workspaces/${workspaceId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  return {
    workspace: query.data || null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    updateWorkspace: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

export function useWorkspaceMembers(workspaceId?: string) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "members"],
    queryFn: async () => {
      if (!workspaceId) return [];
      return await api.get<WorkspaceMember[]>(
        `/workspaces/${workspaceId}/members`,
      );
    },
    enabled: !!workspaceId,
  });
}
