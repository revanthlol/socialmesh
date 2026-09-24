import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, uploadToPresignedUrl } from "../api/client.js";
import type { MediaAsset, MediaKind } from "../api/types.js";

export function useMediaList(workspaceId?: string, kind?: MediaKind) {
  return useQuery({
    queryKey: ["workspaces", workspaceId, "media", { kind }],
    queryFn: async () => {
      if (!workspaceId) return [];
      return await api.get<MediaAsset[]>(`/workspaces/${workspaceId}/media`, {
        params: { kind },
      });
    },
    enabled: !!workspaceId,
  });
}

export function useMediaActions(workspaceId?: string) {
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!workspaceId) throw new Error("Workspace ID is required");

      setUploadProgress(0);

      // Step 1: Request presigned upload URL
      const { mediaAsset, uploadUrl } = await api.post<{
        mediaAsset: MediaAsset;
        uploadUrl: string;
      }>(`/workspaces/${workspaceId}/media/upload-url`, {
        originalName: file.name,
        mimeType: file.type,
        byteSize: file.size,
      });

      // Step 2: Upload directly to Cloudflare R2
      await uploadToPresignedUrl(uploadUrl, file, (percent) => {
        setUploadProgress(percent);
      });

      // Step 3: Confirm upload with API to verify in storage and mark READY
      const confirmedAsset = await api.post<MediaAsset>(
        `/workspaces/${workspaceId}/media/${mediaAsset.id}/complete`,
      );

      setUploadProgress(null);
      return confirmedAsset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "media"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
    onError: () => {
      setUploadProgress(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      if (!workspaceId) throw new Error("Workspace ID is required");
      return await api.delete(`/workspaces/${workspaceId}/media/${mediaId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "media"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId] });
    },
  });

  return {
    uploadMedia: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error,
    uploadProgress,
    deleteMedia: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
