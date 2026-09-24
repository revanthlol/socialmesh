import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import type { PublishingStatus } from "../api/types.js";

export function usePublishingStatus() {
  const query = useQuery({
    queryKey: ["publishing", "status"],
    queryFn: async () => {
      try {
        return await api.get<PublishingStatus>("/publishing/status");
      } catch {
        return {
          isConnected: false,
          message: "Publishing temporarily unavailable",
        };
      }
    },
    refetchInterval: 30000, // check every 30 seconds
    staleTime: 10000,
  });

  return {
    status: query.data || {
      isConnected: false,
      message: "Publishing temporarily unavailable",
    },
    isConnected: query.data?.isConnected ?? false,
    latencyMs: query.data?.latencyMs,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
