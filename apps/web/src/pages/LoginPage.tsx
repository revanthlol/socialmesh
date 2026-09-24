import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const { login, isLoggingIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    try {
      const result = await login({ email, password });
      const firstWs = result.workspaces?.[0]?.id;
      if (firstWs) {
        navigate(`/app/${firstWs}`);
      } else {
        navigate("/app");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid credentials. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f2f0e9]">
      <div className="w-full max-w-sm border-t-4 border-[#161a1d] bg-[#faf9f5] border border-[#c9c5bb] p-6 md:p-8 shadow-sm rounded-sm">
        <div className="mb-6">
          <p className="text-[11px] font-mono font-bold tracking-widest text-[#b23a24] uppercase">
            SociaMesh Auth
          </p>
          <h1 className="text-2xl font-serif font-semibold text-[#161a1d] mt-1">
            Sign In
          </h1>
          <p className="text-xs text-[#6b706f] mt-1">
            Access your social publishing workspaces.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2.5 rounded bg-[#fbeeed] border border-[#f4c6bf] text-xs text-[#b23a24]">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" className="w-full mt-2" isLoading={isLoggingIn}>
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-[#c9c5bb] text-center text-xs text-[#6b706f]">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="font-semibold text-[#161a1d] underline hover:text-[#b23a24]"
          >
            Create Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
