import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { Post, PostStatus } from "../api/types.js";

export function usePosts(workspaceId?: string, status?: PostStatus) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["workspaces", workspaceId, "posts", { status }],
    queryFn: async () => {
      if (!workspaceId) return [];
      return await api.get<Post[]>(`/workspaces/${workspaceId}/posts`, {
        params: { status },
      });
    },
    enabled: !!workspaceId,
  });

  const createDraftMutation = useMutation({
    mutationFn: async (data: {
      content: string;
      mediaAssetIds?: string[];
      channelIds?: string[];
      scheduledFor?: string | null;
      timezone?: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<Post>(`/workspaces/${workspaceId}/posts`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({
      postId,
      data,
    }: {
      postId: string;
      data: {
        content?: string;
        mediaAssetIds?: string[];
        channelIds?: string[];
        scheduledFor?: string | null;
        timezone?: string;
      };
    }) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.patch<Post>(
        `/workspaces/${workspaceId}/posts/${postId}`,
        data,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.delete(`/workspaces/${workspaceId}/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<Post>(
        `/workspaces/${workspaceId}/posts/${postId}/publish`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async ({
      postId,
      scheduledFor,
    }: {
      postId: string;
      scheduledFor?: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<Post>(
        `/workspaces/${workspaceId}/posts/${postId}/schedule`,
        {
          scheduledFor,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.post<Post>(
        `/workspaces/${workspaceId}/posts/${postId}/cancel`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["workspaces", workspaceId, "posts"],
      });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  return {
    posts: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    createDraft: createDraftMutation.mutateAsync,
    isCreating: createDraftMutation.isPending,
    createError: createDraftMutation.error,
    updateDraft: updateDraftMutation.mutateAsync,
    isUpdating: updateDraftMutation.isPending,
    deleteDraft: deleteDraftMutation.mutateAsync,
    isDeleting: deleteDraftMutation.isPending,
    publishPost: publishMutation.mutateAsync,
    isPublishing: publishMutation.isPending,
    schedulePost: scheduleMutation.mutateAsync,
    isScheduling: scheduleMutation.isPending,
    cancelPost: cancelMutation.mutateAsync,
    isCancelling: cancelMutation.isPending,
  };
}

export function usePost(workspaceId?: string, postId?: string) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "posts", postId],
    queryFn: async () => {
      if (!workspaceId || !postId) return null;
      return await api.get<Post>(`/workspaces/${workspaceId}/posts/${postId}`);
    },
    enabled: !!workspaceId && !!postId,
  });
}
