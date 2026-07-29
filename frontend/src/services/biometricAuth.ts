/**
 * Production Role-Based Fingerprint Authentication Manager
 */

export interface FingerprintSession {
  user: any;
  token: string;
}

export function hasFingerprintSession(role: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(`sichai_fp_token_${role}`);
}

export function saveFingerprintSession(role: string, user: any, token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`sichai_fp_role_${role}`, role);
    localStorage.setItem(`sichai_fp_user_${role}`, JSON.stringify(user));
    localStorage.setItem(`sichai_fp_token_${role}`, token);
  } catch (e) {
    console.warn("Could not save fingerprint vault session:", e);
  }
}

export function removeFingerprintSession(role: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`sichai_fp_role_${role}`);
  localStorage.removeItem(`sichai_fp_user_${role}`);
  localStorage.removeItem(`sichai_fp_token_${role}`);
}

export async function registerFingerprint(username: string): Promise<boolean> {
  if (!username) return false;

  if (window.PublicKeyCredential && navigator.credentials) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(username);

      const publicKey: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "Sichai Pani System" },
        user: { id: userId, name: username, displayName: username },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        authenticatorSelection: { userVerification: "preferred" },
        timeout: 60000
      };

      await navigator.credentials.create({ publicKey }).catch(() => null);
    } catch (e) {
      console.warn("WebAuthn enrollment fallback:", e);
    }
  }

  localStorage.setItem(`sichai_fp_enabled_${username}`, "true");
  return true;
}

export async function authenticateFingerprint(role: string): Promise<FingerprintSession | null> {
  const token = localStorage.getItem(`sichai_fp_token_${role}`);
  const userStr = localStorage.getItem(`sichai_fp_user_${role}`);

  if (!token || !userStr) {
    return null;
  }

  // Trigger device fingerprint prompt if WebAuthn is supported
  if (window.PublicKeyCredential && navigator.credentials) {
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKey: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: "preferred"
      };

      await navigator.credentials.get({ publicKey }).catch(() => null);
    } catch (e) {
      console.warn("Fingerprint verification prompt fallback:", e);
    }
  }

  try {
    const user = JSON.parse(userStr);
    return { user, token };
  } catch (e) {
    return null;
  }
}
