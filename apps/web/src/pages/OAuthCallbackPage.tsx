import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/Button.js";

export function OAuthCallbackPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [isProcessing, setIsProcessing] = useState(true);
  const errorParam =
    searchParams.get("error") || searchParams.get("errorMessage");

  useEffect(() => {
    // Invalidate channels so newly connected accounts in Postiz reflect in available integrations
    queryClient.invalidateQueries({
      queryKey: ["workspaces", workspaceId, "channels"],
    });

    const timer = setTimeout(() => {
      setIsProcessing(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, [workspaceId, queryClient]);

  function handleContinue() {
    navigate(`/app/${workspaceId}/accounts`);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full p-6 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-4 text-center">
        {isProcessing ? (
          <div className="space-y-3">
            <div className="h-8 w-8 border-2 border-[#161a1d] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <h2 className="text-base font-semibold text-[#161a1d]">
              Completing Account Connection
            </h2>
            <p className="text-xs text-[#6b706f]">
              Synchronizing authorization tokens with the publishing engine...
            </p>
          </div>
        ) : errorParam ? (
          <div className="space-y-3">
            <div className="h-10 w-10 rounded-full bg-[#fbeeed] text-[#b23a24] flex items-center justify-center mx-auto">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-[#161a1d]">
              Connection Incomplete
            </h2>
            <p className="text-xs text-[#6b706f] leading-relaxed">
              Provider OAuth authorization could not be completed: {errorParam}
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
            <h2 className="text-base font-semibold text-[#161a1d]">
              Provider Connected
            </h2>
            <p className="text-xs text-[#6b706f] leading-relaxed">
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
