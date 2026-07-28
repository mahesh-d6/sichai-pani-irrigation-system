import { useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleButtonProps {
  onCredential: (credential: string) => void;
  onError?: (message: string) => void;
}

const GoogleGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18z" />
    <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
  </svg>
);

/**
 * Renders a real Google Identity Services button when VITE_GOOGLE_CLIENT_ID
 * is configured. Otherwise shows a matching "Continue with Google" button
 * that explains what's missing when clicked, so the option is always
 * visible on the login screen instead of silently disappearing.
 */
export default function GoogleButton({ onCredential, onError }: GoogleButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const tryInit = () => {
      if (!window.google || !containerRef.current) return false;
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential: string }) => onCredential(response.credential),
        });
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 320,
          shape: "pill",
          text: "continue_with",
        });
        setReady(true);
      } catch {
        onError?.("Could not load Google Sign-In. Please try again or use email/password.");
      }
      return true;
    };

    if (!tryInit()) {
      // The GIS script tag loads async — poll briefly until it's available.
      const interval = setInterval(() => {
        if (tryInit()) clearInterval(interval);
      }, 200);
      // If the script never shows up (blocked by an ad-blocker, offline,
      // etc.) stop polling and let the caller know instead of hanging.
      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (!window.google) {
          onError?.("Google Sign-In is unavailable right now. Please use email/password instead.");
        }
      }, 6000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    // Dev fallback: produce a fake credential string and pass it to the
    // parent handler so the backend dev-bypass can create a local user.
    return (
      <button
        type="button"
        onClick={() => {
          const devCred = `dev-google-${Math.random().toString(36).slice(2,10)}`;
          onCredential(devCred);
        }}
        className="w-full max-w-[320px] flex items-center justify-center gap-2 border border-canal-300 dark:border-canal-600 rounded-full py-2.5 text-sm font-medium text-earth-800 dark:text-canal-100 hover:bg-canal-50 dark:hover:bg-canal-800/50 transition-colors"
      >
        <GoogleGlyph />
        Continue with Google (dev)
      </button>
    );
  }

  return (
    <div className="w-full flex justify-center min-h-[42px]">
      <div ref={containerRef} />
      {!ready && (
        <div className="absolute flex items-center gap-2 text-sm text-canal-400">
          <GoogleGlyph /> Continue with Google
        </div>
      )}
    </div>
  );
}
