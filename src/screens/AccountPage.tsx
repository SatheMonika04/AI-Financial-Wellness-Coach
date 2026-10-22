import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import workspaceImage from "@/assets/welcome-workspace.jpg";
import { apiClient, ApiError, ENDPOINTS } from "@/services/apiClient";
import { useAuth } from "@/auth/AuthContext";

export function AccountPage({ mode }: { mode: "login" | "signup" }) {
  const signup = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const auth = useAuth();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordOk = password.length >= 8;

    if (signup && name.length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!emailOk) {
      setError("Enter a valid email address.");
      return;
    }
    if (!passwordOk) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      if (signup) {
        await apiClient.post(ENDPOINTS.signup, { name, email, password });
        setSubmitted(true);
        formElement.reset();
      } else {
        await auth.login(email, password);
        const requested = sessionStorage.getItem("auth_redirect");
        sessionStorage.removeItem("auth_redirect");
        if (requested?.startsWith("/") && !requested.startsWith("/login")) {
          await navigate({ to: requested as never });
        } else {
          await navigate({ to: "/overview" });
        }
      }
    } catch (err) {
      const apiError = err instanceof ApiError ? err : null;
      setError(
        apiError?.status === 401
          ? "Email or password is incorrect."
          : (apiError?.message ?? "Could not complete your request. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[740px] max-w-7xl lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r lg:block">
        <img
          src={workspaceImage}
          alt="A calm workspace for planning your financial future"
          width={1536}
          height={1024}
          className="absolute inset-0 h-full w-full object-cover object-[65%_center]"
        />
        <div className="account-image-overlay absolute inset-0" />
        <div className="relative p-12">
          <span className="inline-flex items-center gap-2 text-xs font-semibold text-success">
            <Sparkles className="size-4" /> A LITTLE CLARITY GOES A LONG WAY
          </span>
          <h2 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
            A healthier relationship with your money.
          </h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">
            Understand today. Plan for tomorrow.
            <br />
            Make room for the things that matter.
          </p>
          <div className="mt-7 flex items-center gap-2 text-xs text-success">
            <HeartPulse className="size-4" /> Financial wellness, one step at a time.
          </div>
        </div>
      </aside>
      <section className="flex items-center justify-center px-5 py-14 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm">
          <span className="mb-6 grid size-11 place-items-center rounded-lg bg-ai-soft text-ai">
            <LockKeyhole className="size-5" />
          </span>
          <h1 className="text-3xl font-semibold">
            {signup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {signup
              ? "Your next chapter starts with a clearer picture."
              : "A little more clarity. A little closer to your goals."}
          </p>
          {submitted ? (
            <div className="mt-8 space-y-5" role="status">
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-left">
                <h2 className="text-lg font-semibold text-foreground">Account created</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Your account was created successfully. You can now log in with your email and
                  password.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link to="/login">
                  Continue to log in <ArrowRight />
                </Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSubmitted(false)}>
                Back to form
              </Button>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={submit} noValidate>
              {signup && (
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    name="name"
                    placeholder="Your full name"
                    autoComplete="name"
                    className="h-11 bg-card"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="h-11 bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={signup ? "Create a password" : "Enter your password"}
                    autoComplete={signup ? "new-password" : "current-password"}
                    className="h-11 bg-card pr-12"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? "Please wait…" : signup ? "Create account" : "Log in"}
                <ArrowRight />
              </Button>
            </form>
          )}
          <div className="mt-7 border-t pt-6 text-center text-sm text-muted-foreground">
            {signup ? "Already have an account?" : "New to MoneyMind AI?"}{" "}
            <Button asChild variant="link" className="h-auto p-0">
              <Link to={signup ? "/login" : "/signup"}>{signup ? "Log in" : "Sign up"}</Link>
            </Button>
          </div>
          <div className="mt-5 text-center">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">
                Log in to explore your workspace <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
