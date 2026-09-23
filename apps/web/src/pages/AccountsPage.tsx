import { Share2, Lock, Info } from "lucide-react";
import { Badge } from "../components/ui/Badge.js";

export function AccountsPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-[#c9c5bb]">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-serif font-bold text-[#161a1d]">Connected Social Accounts</h1>
          <Badge variant="warning">Setup Pending</Badge>
        </div>
        <p className="text-xs text-[#6b706f] mt-1">
          Third-party publishing provider connections and credentials.
        </p>
      </div>

      {/* Clean Explanatory State */}
      <div className="p-6 md:p-8 rounded border border-[#c9c5bb] bg-[#faf9f5] space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded bg-[#e8e6df] text-[#161a1d] shrink-0">
            <Share2 className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#161a1d]">
              Social Publishing Integration In Progress
            </h3>
            <p className="text-sm text-[#4c5359] leading-relaxed">
              Social channel authorization (Meta Facebook Pages, Instagram Professional accounts, and LinkedIn Member profiles) is managed through the upcoming publishing engine adapter.
            </p>
            <p className="text-xs text-[#6b706f] leading-relaxed">
              The underlying infrastructure deployment and OAuth orchestration are currently being finalized. Once the publishing adapter is linked, workspace owners will be able to initiate official provider OAuth handshakes from this screen.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#c9c5bb] grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded border border-[#c9c5bb] bg-white opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#161a1d]">Facebook Pages</span>
              <Lock className="h-3.5 w-3.5 text-[#6b706f]" />
            </div>
            <p className="text-[11px] text-[#6b706f]">Official Graph API v21+</p>
          </div>

          <div className="p-3 rounded border border-[#c9c5bb] bg-white opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#161a1d]">Instagram</span>
              <Lock className="h-3.5 w-3.5 text-[#6b706f]" />
            </div>
            <p className="text-[11px] text-[#6b706f]">Professional Accounts</p>
          </div>

          <div className="p-3 rounded border border-[#c9c5bb] bg-white opacity-70">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-[#161a1d]">LinkedIn</span>
              <Lock className="h-3.5 w-3.5 text-[#6b706f]" />
            </div>
            <p className="text-[11px] text-[#6b706f]">Member Profile Sharing</p>
          </div>
        </div>

        <div className="p-3 rounded bg-[#f4f2ec] border border-[#d4d0c5] flex items-center gap-2 text-xs text-[#6b706f]">
          <Info className="h-4 w-4 shrink-0 text-[#161a1d]" />
          <span>
            No social accounts are connected yet. SociaMesh strictly uses official OAuth and will never prompt for or store account passwords.
          </span>
        </div>
      </div>
    </div>
  );
}
