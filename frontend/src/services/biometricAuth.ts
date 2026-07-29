/**
 * WebAuthn & Device Biometric Authentication Service (Fingerprint / Face ID / Touch ID)
 */

export function isBiometricAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function registerBiometric(username: string): Promise<boolean> {
  if (!isBiometricAvailable()) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const userId = new TextEncoder().encode(username);

    const publicKey: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: {
        name: "Sichai Pani Systems",
      },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // Fingerprint / Face ID
        userVerification: "preferred",
      },
      timeout: 60000,
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (credential) {
      localStorage.setItem(`sichai_biometric_${username}`, "enabled");
      return true;
    }
  } catch (e) {
    console.warn("Biometric enrollment skipped:", e);
  }
  return false;
}

export async function authenticateBiometric(_username?: string): Promise<boolean> {
  if (!isBiometricAvailable()) return false;

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const publicKey: PublicKeyCredentialRequestOptions = {
      challenge,
      timeout: 60000,
      userVerification: "preferred",
    };

    const assertion = await navigator.credentials.get({ publicKey });
    if (assertion) {
      return true;
    }
  } catch (e) {
    console.warn("Biometric authentication cancelled:", e);
  }
  return false;
}
