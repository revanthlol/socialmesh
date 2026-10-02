import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button.js";
import { api } from "../api/client.js";

export function OAuthCallbackPage() {
  const { workspaceId: paramWorkspaceId } = useParams<{
    workspaceId?: string;
  }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [isProcessing, setIsProcessing] = useState(true);
  const [resolvedWorkspaceId, setResolvedWorkspaceId] = useState<string | null>(
    paramWorkspaceId || null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const err = searchParams.get("error") || searchParams.get("errorMessage");
    const desc = searchParams.get("error_description");
    if (err && desc) return `${err}: ${desc}`;
    return err || null;
  });

  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    if (errorMessage) {
      setIsProcessing(false);
      return;
    }

    if (hasTriggeredRef.current) {
      return;
    }

    const stateParam = searchParams.get("state");
    const codeParam = searchParams.get("code");
    const providerParam = searchParams.get("provider");

    if (!stateParam) {
      setErrorMessage("Missing OAuth state parameter in callback URL");
      setIsProcessing(false);
      return;
    }

    hasTriggeredRef.current = true;

    async function resolveConnection() {
      try {
        const res = await api.post<{
          success: boolean;
          workspaceId: string;
          provider: string;
          channel: any;
        }>("/channels/oauth/resolve", {
          stateToken: stateParam || undefined,
          state: stateParam || undefined,
          code: codeParam || undefined,
          provider: providerParam || undefined,
        });

        const targetWsId = res.workspaceId || paramWorkspaceId || null;
        setResolvedWorkspaceId(targetWsId);

        if (targetWsId) {
          queryClient.invalidateQueries({
            queryKey: ["workspaces", targetWsId, "channels"],
          });
        }
      } catch (err: any) {
        // If resolution fails but workspaceId was in URL, allow manual refresh
        if (paramWorkspaceId) {
          queryClient.invalidateQueries({
            queryKey: ["workspaces", paramWorkspaceId, "channels"],
          });
        } else {
          setErrorMessage(
            err.message || "Failed to resolve OAuth connection context",
          );
        }
      } finally {
        setIsProcessing(false);
      }
    }

    resolveConnection();
  }, [paramWorkspaceId, searchParams, queryClient, errorMessage]);

  function handleContinue() {
    if (resolvedWorkspaceId) {
      navigate(`/app/${resolvedWorkspaceId}/accounts`);
    } else {
      navigate("/app");
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full p-6 rounded border border-[#c9c5bb] dark:border-white/[0.08] bg-[#faf9f5] dark:bg-[#1c1c1f] space-y-4 text-center">
        {isProcessing ? (
          <div className="space-y-3">
            <div className="h-8 w-8 border-2 border-[#161a1d] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-base font-semibold text-[#161a1d] dark:text-white">
              Completing Account Connection
            </h2>
            <p className="text-xs text-[#6b706f] dark:text-zinc-500">
              Synchronizing authorization tokens with the publishing engine...
            </p>
          </div>
        ) : errorMessage ? (
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-full bg-[#fbeeed] text-[#b23a24] dark:text-[#e05a3a] flex items-center justify-center mx-auto">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-[#161a1d] dark:text-white">
              Connection Incomplete
            </h2>
            <p className="text-xs text-[#6b706f] dark:text-zinc-500 leading-relaxed">
              Provider OAuth authorization could not be completed:{" "}
              {errorMessage}
            </p>
            <Button onClick={handleContinue} className="w-full gap-2">
              Back to Accounts <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-full bg-[#e9f2eb] text-[#24613b] flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-[#161a1d] dark:text-white">
              Provider Connected
            </h2>
            <p className="text-xs text-[#6b706f] dark:text-zinc-500 leading-relaxed">
              Your social account authorization has returned to SociaMesh. You
              can now assign this channel to your workspace.
            </p>
            <Button onClick={handleContinue} className="w-full gap-2">
              Continue to Accounts <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
