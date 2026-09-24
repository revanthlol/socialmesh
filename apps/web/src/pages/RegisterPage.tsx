import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { register, isRegistering } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    try {
      const result = await register({
        email,
        password,
        displayName,
        workspaceName: workspaceName || undefined,
      });

      if (result.workspace?.id) {
        navigate(`/app/${result.workspace.id}`);
      } else {
        navigate("/app");
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to register. Please check your information.",
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f2f0e9]">
      <div className="w-full max-w-sm border-t-4 border-[#161a1d] bg-[#faf9f5] border border-[#c9c5bb] p-6 md:p-8 shadow-sm rounded-sm">
        <div className="mb-6">
          <p className="text-[11px] font-mono font-bold tracking-widest text-[#b23a24] uppercase">
            SociaMesh Onboarding
          </p>
          <h1 className="text-2xl font-serif font-semibold text-[#161a1d] mt-1">
            Create Account
          </h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Set up your organization workspace and owner account.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 rounded bg-[#fbeeed] border border-[#f4c6bf] text-xs text-[#b23a24]">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Your Full Name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Jane Doe"
          />

          <Input
            label="Workspace Name"
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Acme Publishing"
            helperText="Can be changed later in settings"
          />

          <Input
            label="Email Address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />

          <Input
            label="Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
          />

          <Button
            type="submit"
            className="w-full mt-2"
            isLoading={isRegistering}
          >
            Register & Continue
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#c9c5bb] text-center text-xs text-[#6b706f]">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-[#161a1d] underline hover:text-[#b23a24]"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
