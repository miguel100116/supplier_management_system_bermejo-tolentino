import { PublicClientApplication, type AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser';

// Build-time values support static hosting; configureMsal() can replace them
// with values supplied by the server at runtime before App is imported.
let CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined;
let TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID as string | undefined;
// Dedicated redirect/callback URL that Microsoft returns the sign-in response
// to. It resolves to /public/auth/callback/index.html - a tiny same-origin
// landing page the sign-in popup briefly lands on before MSAL reads the
// response and closes it. Register this exact URL (per environment) as a
// Single-page application (SPA) redirect URI in the Entra app registration.
// Override with VITE_AZURE_REDIRECT_URI only if a different path is required.
let REDIRECT_URI =
  (import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined) ||
  `${window.location.origin}/auth/callback`;

export interface RuntimeMsalConfig {
  azureClientId?: string;
  azureTenantId?: string;
  azureRedirectUri?: string;
}

export function configureMsal(config: RuntimeMsalConfig): void {
  if (config.azureClientId?.trim()) CLIENT_ID = config.azureClientId.trim();
  if (config.azureTenantId?.trim()) TENANT_ID = config.azureTenantId.trim();
  if (config.azureRedirectUri?.trim()) REDIRECT_URI = config.azureRedirectUri.trim();
}

// Delegated scopes: User.Read to read the signed-in profile, Mail.Send to
// send partner reports as that same signed-in mailbox. Both require only
// user consent (no admin consent, no client secret) since this is a
// delegated-permission, browser-only flow - nothing server-side to secure.
export const GRAPH_SCOPES = ['User.Read', 'Mail.Send'];

export function isMsalConfigured(): boolean {
  return Boolean(CLIENT_ID && TENANT_ID);
}

let msalInstance: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: REDIRECT_URI,
      },
      cache: {
        cacheLocation: 'localStorage',
      },
    });
  }
  return msalInstance;
}

async function ensureInitialized(): Promise<PublicClientApplication> {
  const instance = getMsalInstance();
  if (!initPromise) initPromise = instance.initialize();
  await initPromise;
  return instance;
}

export interface MicrosoftLoginResult {
  email: string;
  name?: string;
  account: AccountInfo;
  // The raw OpenID Connect ID token (JWT) and the nonce it was minted with.
  // These are what we hand to Supabase (supabase.auth.signInWithIdToken) so
  // Supabase issues its own session and Postgres RLS can enforce access
  // server-side. Kept together because Supabase re-validates the nonce.
  idToken: string;
  nonce: string;
}

// Cryptographically-random nonce, bound into the ID token by Microsoft and
// re-checked by Supabase when we exchange the token. Prevents a token minted
// for a different request from being replayed into our Supabase session.
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Opens the Microsoft sign-in popup and requests the scopes above up front,
// so a Graph access token is available immediately without a second consent
// prompt later at send-time.
export async function loginWithMicrosoft(): Promise<MicrosoftLoginResult> {
  const instance = await ensureInitialized();
  const nonce = generateNonce();
  const result = await instance.loginPopup({ scopes: GRAPH_SCOPES, prompt: 'select_account', nonce });
  instance.setActiveAccount(result.account);
  const email = result.account.username;
  return { email, name: result.account.name, account: result.account, idToken: result.idToken, nonce };
}

// Returns the Microsoft account already cached from a previous sign-in, or
// null if there is none. Restoring identity from this (rather than from a
// plain localStorage string) is what makes the app's login gate real: an
// account only exists in the MSAL cache if a genuine Microsoft sign-in
// actually happened, so it cannot be forged by editing localStorage by hand.
export async function restoreMicrosoftAccount(): Promise<AccountInfo | null> {
  if (!isMsalConfigured()) return null;
  const instance = await ensureInitialized();
  return instance.getActiveAccount() || instance.getAllAccounts()[0] || null;
}

export async function logoutMicrosoft(): Promise<void> {
  if (!isMsalConfigured()) return;
  const instance = await ensureInitialized();
  const account = instance.getActiveAccount();
  if (account) {
    await instance.logoutPopup({ account });
  }
}

// Silently gets a Graph access token for the currently signed-in Microsoft
// account (refreshing via the cached refresh token behind the scenes if
// needed). Falls back to an interactive popup only if silent acquisition
// genuinely requires it (e.g. first-time consent for a scope, or an expired
// session) - this is what the real "Send" action calls right before
// building the Graph API request.
export async function getGraphAccessToken(): Promise<string> {
  const instance = await ensureInitialized();
  const account = instance.getActiveAccount() || instance.getAllAccounts()[0];
  if (!account) {
    throw new Error('No signed-in Microsoft account. Please sign in with Microsoft again.');
  }
  try {
    const result = await instance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await instance.acquireTokenPopup({ scopes: GRAPH_SCOPES, account });
      return result.accessToken;
    }
    throw err;
  }
}
