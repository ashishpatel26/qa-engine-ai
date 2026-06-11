import { useState, useEffect, useRef } from 'react';

const DEMO_MODE = import.meta.env.VITE_QA_ENGINE_DEMO_MODE === 'true';

const PROVIDER_STATE = Object.freeze({
  IDLE: 'idle',
  CHECKING: 'checking',
  CONNECTED: 'connected',
  FAILED: 'failed',
  DISCONNECTED: 'disconnected',
});

const PROVIDER_STATE_META = {
  [PROVIDER_STATE.IDLE]: {
    label: 'Not Verified',
    dotClass: 'bg-slate-600',
    textClass: 'text-slate-500',
  },
  [PROVIDER_STATE.CHECKING]: {
    label: 'Checking',
    dotClass: 'bg-amber-400 animate-pulse',
    textClass: 'text-amber-300',
  },
  [PROVIDER_STATE.CONNECTED]: {
    label: 'Connected',
    dotClass: 'bg-emerald-400 animate-pulse',
    textClass: 'text-emerald-400',
  },
  [PROVIDER_STATE.FAILED]: {
    label: 'Failed',
    dotClass: 'bg-red-400',
    textClass: 'text-red-400',
  },
  [PROVIDER_STATE.DISCONNECTED]: {
    label: 'Disconnected',
    dotClass: 'bg-slate-600',
    textClass: 'text-slate-500',
  },
};

function getProviderStateMeta(state) {
  return PROVIDER_STATE_META[state] || PROVIDER_STATE_META[PROVIDER_STATE.IDLE];
}

function ProviderStatusBadge({ state, label }) {
  const meta = getProviderStateMeta(state);

  return (
    <div className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
      <span className={`text-xs font-bold uppercase tracking-wide ${meta.textClass}`}>
        {label || meta.label}
      </span>
    </div>
  );
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch (error) {
    console.warn('Could not parse backend response as JSON.', error);
    return {};
  }
}

function getErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isCurrentOAuthResult(data, service, stateToken) {
  return Boolean(data && data.service === service && stateToken && data.state === stateToken);
}

/* ─── OAuth popup helper ─────────────────────────────────────────────────── */
function openOAuthPopup(url, name = 'oauth') {
  const w = 480, h = 660;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top  = window.screenY + (window.outerHeight - h) / 2;
  return window.open(
    url, name,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
  );
}

/* ─── SVG brand logos ────────────────────────────────────────────────────── */
const OpenAILogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 41 41" fill="currentColor">
    <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.525-3.499 10.079 10.079 0 0 0-10.42 4.963 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.525 3.499 10.079 10.079 0 0 0 10.42-4.963 9.967 9.967 0 0 0 6.664-4.834 10.079 10.079 0 0 0-1.24-11.818zm-17.208 23.596a7.476 7.476 0 0 1-4.801-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.487 7.077zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103L16.759 33.6a7.504 7.504 0 0 1-10.367-2.594zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.51a7.504 7.504 0 0 1-2.747-9.89zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.048-4.648a7.498 7.498 0 0 1 11.136 7.766zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.997l-4.331 2.5-4.331-2.5V18z"/>
  </svg>
);

const AnthropicLogo = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
    <path d="M66.7 20H80L53.3 80H40L66.7 20Z"/>
    <path d="M33.3 20H20L46.7 80H60L33.3 20Z"/>
  </svg>
);

/* ─── Animated spinner ring ──────────────────────────────────────────────── */
const SpinnerRing = ({ color }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

/* ─── OAuth Provider Card ─────────────────────────────────────────────────── */
function OAuthProviderCard({ service, connected, user, onSuccess, onDisconnect }) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const pollRef  = useRef(null);
  const stateRef = useRef(null);

  const isCodex  = service === 'codex';
  const cfg = isCodex
    ? {
        name:         'Codex',
        company:      'OpenAI',
        tagline:      'Sign in with your OpenAI account',
        Logo:         OpenAILogo,
        gradFrom:     '#10a37f',
        gradTo:       '#1a7f64',
        accentBorder: 'rgba(16,163,127,0.35)',
        accentBg:     'rgba(16,163,127,0.07)',
        accentText:   '#10a37f',
        btnBg:        '#10a37f',
        perms: [
          { icon: 'model_training',    text: 'Read available models (GPT-4o, Codex)' },
          { icon: 'vpn_key',           text: 'Associate your API quota' },
          { icon: 'person',            text: 'Read your account profile' },
        ],
      }
    : {
        name:         'ClaudeCode',
        company:      'Anthropic',
        tagline:      'Sign in with your Anthropic account',
        Logo:         AnthropicLogo,
        gradFrom:     '#cc785c',
        gradTo:       '#b05a3a',
        accentBorder: 'rgba(204,120,92,0.35)',
        accentBg:     'rgba(204,120,92,0.07)',
        accentText:   '#cc785c',
        btnBg:        '#cc785c',
        perms: [
          { icon: 'psychology',        text: 'Run inference with claude-opus / sonnet' },
          { icon: 'code',              text: 'Use Claude for code generation & review' },
          { icon: 'person',            text: 'Read your Anthropic profile' },
        ],
      };

  const { name, company, tagline, Logo, gradFrom, gradTo, accentBorder, accentBg, accentText, btnBg, perms } = cfg;
  const verificationState = loading
    ? PROVIDER_STATE.CHECKING
    : connected
      ? PROVIDER_STATE.CONNECTED
      : error
        ? PROVIDER_STATE.FAILED
        : PROVIDER_STATE.DISCONNECTED;
  const isVerified = verificationState === PROVIDER_STATE.CONNECTED;

  /* postMessage listener (real OAuth callback) */
  useEffect(() => {
    const handler = (e) => {
      if (!e.data || e.data.type !== 'QA_ENGINE_OAUTH') return;
      if (!isCurrentOAuthResult(e.data, service, stateRef.current)) return;
      clearInterval(pollRef.current);
      pollRef.current = null;
      setLoading(false);
      stateRef.current = null;
      if (e.data.success) {
        setError('');
        onSuccess({ user: e.data.user });
      } else {
        setError(e.data.message || 'Authentication failed.');
        onDisconnect();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [service, onSuccess, onDisconnect]);

  /* localStorage listener (same-tab fallback) */
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'qa_oauth_result') return;
      try {
        const data = JSON.parse(e.newValue || '{}');
        if (!isCurrentOAuthResult(data, service, stateRef.current)) return;
        clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);
        stateRef.current = null;
        if (data.success) {
          setError('');
          onSuccess({ user: data.user });
        } else {
          setError(data.message || 'Authentication failed.');
          onDisconnect();
        }
        localStorage.removeItem('qa_oauth_result');
      } catch (storageError) {
        console.warn(`Could not read ${service} OAuth result from localStorage.`, storageError);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [service, onSuccess, onDisconnect]);

  useEffect(() => () => {
    clearInterval(pollRef.current);
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    // Clear any stale result
    try {
      localStorage.removeItem('qa_oauth_result');
    } catch (storageError) {
      console.warn('Could not clear stale OAuth result from localStorage.', storageError);
    }

    try {
      const res  = await fetch(`/api/oauth/${service}/start`);
      const data = await readJsonResponse(res);
      const detail = typeof data.detail === 'string' ? data.detail : '';

      if (!res.ok || !data.auth_url || !data.state) {
        throw new Error(data.error || detail || `Could not start ${company} OAuth.`);
      }

      stateRef.current = data.state;

      const popup = openOAuthPopup(data.auth_url, `qa_${service}`);
      if (!popup || popup.closed) {
        setLoading(false);
        stateRef.current = null;
        setError('Popup blocked — allow popups for localhost:8080 and try again.');
        return;
      }

      const openedAt = Date.now();

      pollRef.current = setInterval(async () => {
        // ── Check stale localStorage result (same popup, different storage event) ──
        try {
          const stored = localStorage.getItem('qa_oauth_result');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (isCurrentOAuthResult(parsed, service, stateRef.current)) {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setLoading(false);
              stateRef.current = null;
              localStorage.removeItem('qa_oauth_result');
              if (parsed.success) {
                setError('');
                onSuccess({ user: parsed.user });
              } else {
                setError(parsed.message || 'Authentication failed.');
                onDisconnect();
              }
              return;
            }
          }
        } catch (storageError) {
          console.warn(`Could not inspect ${service} OAuth localStorage result.`, storageError);
        }

        if (!popup.closed) return; // still open — keep waiting

        clearInterval(pollRef.current);
        pollRef.current = null;
        const elapsed = Date.now() - openedAt;

        // ── Try server-side status first (real callback received) ──
        try {
          const sr = await fetch(`/api/oauth/${service}/status?state_token=${encodeURIComponent(stateRef.current)}`);
          const sd = await readJsonResponse(sr);
          if (!sr.ok) {
            throw new Error(sd.error || `OAuth status check failed (${sr.status}).`);
          }
          if (sd.service && sd.service !== service) {
            setLoading(false);
            setError('OAuth callback service did not match this provider. No account was connected.');
            stateRef.current = null;
            onDisconnect();
            return;
          }
          if (sd.status === 'completed') {
            onSuccess({ user: sd.user });
            setLoading(false);
            setError('');
            stateRef.current = null;
            return;
          }
          if (sd.status === 'error' || sd.status === 'failed') {
            setLoading(false);
            setError(sd.message || 'Authentication failed.');
            stateRef.current = null;
            onDisconnect();
            return;
          }
        } catch (statusError) {
          console.warn(`${company} OAuth status check failed.`, statusError);
          setLoading(false);
          setError('Popup closed before the backend confirmed authorization. No account was connected.');
          stateRef.current = null;
          onDisconnect();
          return;
        }

        // Demo mode may simulate a provider profile; production/default mode never does.
        if (DEMO_MODE && elapsed > 4000) {
          const mockUser = service === 'codex'
            ? { models: ['gpt-4o', 'gpt-4-turbo', 'o1-preview', 'codex-mini-latest'] }
            : { models: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-3-5-haiku-latest'] };
          setError('');
          setLoading(false);
          stateRef.current = null;
          onSuccess({ user: mockUser });
        } else {
          setLoading(false);
          stateRef.current = null;
          onDisconnect();
          setError('Popup closed before authorization was confirmed. No account was connected.');
        }
      }, 700);
    } catch (connectError) {
      setLoading(false);
      stateRef.current = null;
      onDisconnect();
      setError(getErrorMessage(connectError, 'Cannot reach backend server. Make sure it is running on port 8080.'));
    }
  };

  const handleDisconnect = async () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
    setLoading(false);
    setError('');
    stateRef.current = null;
    onDisconnect();

    try {
      const res = await fetch('/api/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: isCodex ? 'Codex' : 'ClaudeCode' })
      });
      if (!res.ok) {
        console.warn(`${name} disconnect request failed with HTTP ${res.status}.`);
      }
    } catch (disconnectError) {
      console.warn(`${name} disconnect request could not reach the backend.`, disconnectError);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col transition-all duration-300"
      style={{
        background: 'linear-gradient(160deg, #15171f 0%, #0f1117 100%)',
        border: `1px solid ${isVerified ? accentBorder : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isVerified
          ? `0 0 0 1px ${accentBorder}, 0 8px 32px rgba(0,0,0,0.5)`
          : '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Branded gradient header ── */}
      <div
        className="relative px-6 pt-7 pb-6 flex flex-col items-center text-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${gradFrom}22 0%, ${gradTo}10 100%)` }}
      >
        {/* Glow blob */}
        <div
          className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: gradFrom }}
        />

        {/* Logo circle */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative z-10"
          style={{
            background: isVerified
              ? `linear-gradient(135deg, ${gradFrom}, ${gradTo})`
              : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isVerified ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
            color: isVerified ? '#fff' : accentText,
            boxShadow: isVerified ? `0 4px 20px ${gradFrom}55` : 'none',
          }}
        >
          <Logo size={30} />
        </div>

        <h3 className="text-white font-bold text-lg leading-tight relative z-10">{name}</h3>
        <p className="text-sm mt-0.5 relative z-10" style={{ color: 'rgba(255,255,255,0.5)' }}>{company}</p>

        <div className="mt-3 relative z-10">
          <ProviderStatusBadge state={verificationState} />
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 px-6 pb-6 pt-5 space-y-5">

        {!isVerified ? (
          <>
            {/* Scope label */}
            <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.45)' }}>{tagline}</p>

            {/* Permission list */}
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
                This will allow QA Engine to:
              </p>
              {perms.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                  >
                    <span className="material-symbols-outlined text-[14px]" style={{ color: accentText }}>{p.icon}</span>
                  </div>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{p.text}</span>
                </div>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2 rounded-xl p-3 text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">error_outline</span>
                <span>{error}</span>
              </div>
            )}

            {/* Connect button */}
            <button
              onClick={handleConnect}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: loading
                  ? `${btnBg}88`
                  : `linear-gradient(135deg, ${gradFrom}, ${gradTo})`,
                boxShadow: loading ? 'none' : `0 4px 20px ${gradFrom}50`,
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.filter = 'brightness(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)'; }}
            >
              {loading ? (
                <>
                  <SpinnerRing color={gradFrom} />
                  <span>Waiting for {company}…</span>
                </>
              ) : (
                <>
                  <Logo size={17} />
                  <span>Continue with {company}</span>
                </>
              )}
            </button>

            {loading && (
              <p className="text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Complete sign-in in the {company} popup window
              </p>
            )}

            {DEMO_MODE && (
              <p className="text-center text-[11px]" style={{ color: 'rgba(251,191,36,0.75)' }}>
                Demo mode is enabled; popup waits may use sample provider profiles.
              </p>
            )}

            <p className="text-center text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              By connecting, you agree to {company}'s Terms of Service
            </p>
          </>
        ) : (
          /* ── Connected state ── */
          <>
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: accentText }}>
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>Provider connected after backend verification</span>
              </div>
              {user?.models && user.models.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    Available models
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.models.slice(0, 4).map((m, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono"
                        style={{ background: accentBg, border: `1px solid ${accentBorder}`, color: accentText }}
                      >
                        {m}
                      </span>
                    ))}
                    {user.models.length > 4 && (
                      <span className="text-[10px] self-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        +{user.models.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            >
              <span className="material-symbols-outlined text-[15px]">link_off</span>
              Disconnect Account
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main SettingsPane ──────────────────────────────────────────────────── */
export default function SettingsPane({
  servicesConnected,
  ollamaHost,
  setOllamaHost,
  ollamaConnected,
  setOllamaConnected,
  ollamaModels,
  setOllamaModels,
  setServicesConnected
}) {
  const [syncEnabled,       setSyncEnabled]       = useState(false);
  const [openaiEnabled,     setOpenaiEnabled]     = useState(true);
  const [anthropicEnabled,  setAnthropicEnabled]  = useState(false);
  const [openaiKey,         setOpenaiKey]         = useState('');
  const [openaiKeyVisible,  setOpenaiKeyVisible]  = useState(false);
  const [anthropicKey,      setAnthropicKey]      = useState('');
  const [anthropicKeyVis,   setAnthropicKeyVis]   = useState(false);
  const [codexUser,         setCodexUser]         = useState(null);
  const [claudeUser,        setClaudeUser]        = useState(null);
  const [apiVerification,   setApiVerification]   = useState({
    openai: {
      state: PROVIDER_STATE.IDLE,
      message: '',
      models: [],
    },
    anthropic: {
      state: PROVIDER_STATE.DISCONNECTED,
      message: '',
      models: [],
    },
  });
  const [detecting,         setDetecting]         = useState(false);
  const [detectError,       setDetectError]       = useState('');
  const [settingsLoaded,    setSettingsLoaded]    = useState(false);
  const [settingsSaving,    setSettingsSaving]    = useState('idle');

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.detail || 'Could not load saved settings.');
        }

        if (!cancelled) {
          setSyncEnabled(Boolean(data.sync_enabled));
          setOpenaiEnabled(data.openai_enabled !== false);
          setAnthropicEnabled(Boolean(data.anthropic_enabled));
          if (data.ollama_host) setOllamaHost(data.ollama_host);
          setSettingsSaving('saved');
        }
      } catch (settingsError) {
        if (!cancelled) {
          console.warn('Could not load saved provider settings.', settingsError);
          setSettingsSaving('offline');
        }
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [setOllamaHost]);

  useEffect(() => {
    if (!settingsLoaded) return undefined;

    const timeoutId = window.setTimeout(async () => {
      setSettingsSaving('saving');
      try {
        const response = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sync_enabled: syncEnabled,
            openai_enabled: openaiEnabled,
            anthropic_enabled: anthropicEnabled,
            ollama_host: ollamaHost,
          }),
        });
        const data = await readJsonResponse(response);

        if (!response.ok) {
          throw new Error(data.detail || 'Could not save settings.');
        }

        setSettingsSaving('saved');
      } catch (settingsError) {
        console.warn('Could not save provider settings.', settingsError);
        setSettingsSaving('offline');
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [settingsLoaded, syncEnabled, openaiEnabled, anthropicEnabled, ollamaHost]);

  const updateApiVerification = (provider, update) => {
    setApiVerification(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        ...update,
      },
    }));
  };

  const handleApiKeyChange = (provider, value) => {
    if (provider === 'openai') {
      setOpenaiKey(value);
      setServicesConnected(prev => ({ ...prev, OpenAI: false }));
    } else {
      setAnthropicKey(value);
      setServicesConnected(prev => ({ ...prev, Anthropic: false }));
    }

    updateApiVerification(provider, {
      state: PROVIDER_STATE.IDLE,
      message: '',
      models: [],
    });
  };

  const handleApiProviderToggle = (provider) => {
    const isOpenAI = provider === 'openai';
    const nextEnabled = isOpenAI ? !openaiEnabled : !anthropicEnabled;
    const serviceKey = isOpenAI ? 'OpenAI' : 'Anthropic';

    if (isOpenAI) {
      setOpenaiEnabled(nextEnabled);
    } else {
      setAnthropicEnabled(nextEnabled);
    }

    if (!nextEnabled) {
      updateApiVerification(provider, {
        state: PROVIDER_STATE.DISCONNECTED,
        message: '',
        models: [],
      });
      setServicesConnected(prev => ({ ...prev, [serviceKey]: false }));
      return;
    }

    updateApiVerification(provider, {
      state: PROVIDER_STATE.IDLE,
      message: '',
      models: [],
    });
  };

  const verifyApiKey = async (provider) => {
    const isOpenAI = provider === 'openai';
    const apiKey = (isOpenAI ? openaiKey : anthropicKey).trim();
    const endpoint = isOpenAI ? '/api/auth/codex' : '/api/auth/claude';
    const serviceKey = isOpenAI ? 'OpenAI' : 'Anthropic';
    const providerLabel = isOpenAI ? 'OpenAI' : 'Anthropic';

    if (!apiKey) {
      updateApiVerification(provider, {
        state: PROVIDER_STATE.FAILED,
        message: `Enter a ${providerLabel} API key before verifying.`,
        models: [],
      });
      setServicesConnected(prev => ({ ...prev, [serviceKey]: false }));
      return;
    }

    updateApiVerification(provider, {
      state: PROVIDER_STATE.CHECKING,
      message: `Checking ${providerLabel} credentials with the backend...`,
      models: [],
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await readJsonResponse(response);
      const detail = typeof data.detail === 'string' ? data.detail : '';

      if (!response.ok || !data.success) {
        throw new Error(data.error || detail || `${providerLabel} verification failed.`);
      }

      updateApiVerification(provider, {
        state: PROVIDER_STATE.CONNECTED,
        message: data.message || `${providerLabel} credentials verified for this session.`,
        models: Array.isArray(data.user?.models) ? data.user.models : [],
      });
      setServicesConnected(prev => ({ ...prev, [serviceKey]: true }));
    } catch (verificationError) {
      updateApiVerification(provider, {
        state: PROVIDER_STATE.FAILED,
        message: getErrorMessage(verificationError, `${providerLabel} verification failed.`),
        models: [],
      });
      setServicesConnected(prev => ({ ...prev, [serviceKey]: false }));
    }
  };

  const handleDetectOllama = async () => {
    const host = ollamaHost.trim();

    if (!host) {
      setOllamaConnected(false);
      setOllamaModels([]);
      setServicesConnected(prev => ({ ...prev, Ollama: false }));
      setDetectError('Enter an Ollama host before detecting models.');
      return;
    }

    setDetecting(true);
    setDetectError('');
    setOllamaConnected(false);
    setOllamaModels([]);
    setServicesConnected(prev => ({ ...prev, Ollama: false }));

    try {
      const response = await fetch('/api/ollama/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      const data = await readJsonResponse(response);
      const detail = typeof data.detail === 'string' ? data.detail : '';

      if (!response.ok || !data.success) {
        throw new Error(data.error || detail || 'Failed to detect Ollama models.');
      }

      setOllamaConnected(true);
      setOllamaModels(Array.isArray(data.models) ? data.models : []);
      setServicesConnected(prev => ({ ...prev, Ollama: true }));
    } catch (detectErrorResult) {
      setOllamaConnected(false);
      setOllamaModels([]);
      setServicesConnected(prev => ({ ...prev, Ollama: false }));
      setDetectError(getErrorMessage(detectErrorResult, 'Connection failed.'));
    } finally {
      setDetecting(false);
    }
  };

  const handleToggleOllama = () => {
    if (detecting) return;

    if (ollamaConnected) {
      setOllamaConnected(false);
      setOllamaModels([]);
      setServicesConnected(prev => ({ ...prev, Ollama: false }));
      setDetectError('');
      return;
    }

    handleDetectOllama();
  };

  const handleOllamaHostChange = (value) => {
    setOllamaHost(value);
    setDetectError('');

    if (ollamaConnected) {
      setOllamaConnected(false);
      setOllamaModels([]);
      setServicesConnected(prev => ({ ...prev, Ollama: false }));
    }
  };

  const openaiVerificationState = openaiEnabled
    ? apiVerification.openai.state
    : PROVIDER_STATE.DISCONNECTED;
  const anthropicVerificationState = anthropicEnabled
    ? apiVerification.anthropic.state
    : PROVIDER_STATE.DISCONNECTED;
  const ollamaVerificationState = detecting
    ? PROVIDER_STATE.CHECKING
    : ollamaConnected
      ? PROVIDER_STATE.CONNECTED
      : detectError
        ? PROVIDER_STATE.FAILED
        : PROVIDER_STATE.DISCONNECTED;

  return (
    <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-surface-container-lowest h-full text-on-surface">
      <div className="max-w-4xl w-full flex flex-col space-y-10 pb-20">

        {/* Header */}
        <header>
          <h1 className="font-headline-lg text-headline-lg font-bold">Model Providers</h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <p className="text-sm text-on-surface-variant">
              Connect your AI accounts and configure API keys for the QA Engine.
            </p>
            <span className="rounded-sm border border-outline-variant bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              {settingsSaving === 'saving' ? 'Saving settings' : settingsSaving === 'offline' ? 'Settings offline' : 'Settings saved'}
            </span>
          </div>
        </header>

        {/* ── OAuth Cards Section ───────────────────────────────────── */}
        <section className="space-y-5">
          <div>
            <h2 className="font-headline-md text-headline-md font-semibold">Authentication &amp; Sync</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              OAuth providers are marked connected only after the backend confirms the callback.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <OAuthProviderCard
              service="codex"
              connected={servicesConnected.Codex}
              user={codexUser}
              onSuccess={({ user }) => { setCodexUser(user); setServicesConnected(p => ({ ...p, Codex: true })); }}
              onDisconnect={() => { setCodexUser(null); setServicesConnected(p => ({ ...p, Codex: false })); }}
            />
            <OAuthProviderCard
              service="claude"
              connected={servicesConnected.ClaudeCode}
              user={claudeUser}
              onSuccess={({ user }) => { setClaudeUser(user); setServicesConnected(p => ({ ...p, ClaudeCode: true })); }}
              onDisconnect={() => { setClaudeUser(null); setServicesConnected(p => ({ ...p, ClaudeCode: false })); }}
            />
          </div>

          {/* Workspace sync toggle */}
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-on-surface-variant">sync</span>
              <div>
                <p className="text-sm font-medium text-on-surface">Workspace Sync</p>
                <p className="text-xs text-on-surface-variant">Prototype toggle only; cross-device sync is not implemented yet.</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input checked={syncEnabled} onChange={() => setSyncEnabled(v => !v)} className="sr-only peer" type="checkbox" />
              <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary-container peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border after:border-outline-variant after:rounded-full after:h-4 after:w-4 after:transition-all" />
            </label>
          </div>
        </section>

        {/* ── OpenAI API Key ────────────────────────────────────────── */}
        <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface text-sm leading-none">OpenAI</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">api.openai.com — direct API key</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProviderStatusBadge state={openaiVerificationState} label={openaiEnabled ? undefined : 'Disabled'} />
              <div className="w-px h-4 bg-outline-variant mx-2" />
              <label className="relative inline-flex items-center cursor-pointer">
                <input checked={openaiEnabled} onChange={() => handleApiProviderToggle('openai')} className="sr-only peer" type="checkbox" />
                <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary-container peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border after:border-outline-variant after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>
          {openaiEnabled && (
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block">API Key</label>
                <div className="relative">
                  <input
                    value={openaiKey}
                    onChange={e => handleApiKeyChange('openai', e.target.value)}
                    placeholder="Paste API key for this session"
                    type={openaiKeyVisible ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none text-xs font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setOpenaiKeyVisible(v => !v)}
                    aria-label={openaiKeyVisible ? 'Hide OpenAI API key' : 'Show OpenAI API key'}
                    className="absolute inset-y-0 right-2 flex items-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">{openaiKeyVisible ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <p className="text-xs text-outline">Used only in this local browser session; secure secret storage is not implemented yet.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <button
                  type="button"
                  onClick={() => verifyApiKey('openai')}
                  disabled={apiVerification.openai.state === PROVIDER_STATE.CHECKING}
                  className="h-10 px-5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {apiVerification.openai.state === PROVIDER_STATE.CHECKING ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">verified_user</span>
                      <span>Verify Key</span>
                    </>
                  )}
                </button>
                {apiVerification.openai.message && (
                  <div
                    className="flex items-start gap-2 rounded-lg p-3 text-xs flex-1"
                    style={{
                      background: apiVerification.openai.state === PROVIDER_STATE.FAILED ? 'rgba(239,68,68,0.1)' : 'rgba(16,163,127,0.08)',
                      border: apiVerification.openai.state === PROVIDER_STATE.FAILED ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,163,127,0.2)',
                      color: apiVerification.openai.state === PROVIDER_STATE.FAILED ? '#f87171' : '#34d399',
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">
                      {apiVerification.openai.state === PROVIDER_STATE.FAILED ? 'error_outline' : 'info'}
                    </span>
                    <span>{apiVerification.openai.message}</span>
                  </div>
                )}
              </div>
              {apiVerification.openai.models.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
                    Verified models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {apiVerification.openai.models.slice(0, 5).map(model => (
                      <span key={model} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 text-primary text-xs font-mono">
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {[['Organization ID', 'Optional organization ID'], ['Base URL Override', 'https://api.openai.com/v1']].map(([lbl, ph]) => (
                  <div key={lbl} className="space-y-1.5">
                    <label className="text-xs text-on-surface-variant block">{lbl}</label>
                    <input placeholder={ph} type="text" className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 text-on-surface focus:border-primary focus:outline-none text-xs" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Anthropic API Key ─────────────────────────────────────── */}
        <section className={`bg-surface-container border border-outline-variant rounded-xl overflow-hidden transition-opacity ${anthropicEnabled ? '' : 'opacity-70'}`}>
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">psychology</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface text-sm leading-none">Anthropic</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">api.anthropic.com — direct API key</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProviderStatusBadge state={anthropicVerificationState} label={anthropicEnabled ? undefined : 'Disabled'} />
              <div className="w-px h-4 bg-outline-variant mx-2" />
              <label className="relative inline-flex items-center cursor-pointer">
                <input checked={anthropicEnabled} onChange={() => handleApiProviderToggle('anthropic')} className="sr-only peer" type="checkbox" />
                <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary-container peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border after:border-outline-variant after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>
          {anthropicEnabled && (
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block">API Key</label>
                <div className="relative">
                  <input
                    value={anthropicKey}
                    onChange={e => handleApiKeyChange('anthropic', e.target.value)}
                    placeholder="Paste API key for this session"
                    type={anthropicKeyVis ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none text-xs font-mono pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setAnthropicKeyVis(v => !v)}
                    aria-label={anthropicKeyVis ? 'Hide Anthropic API key' : 'Show Anthropic API key'}
                    className="absolute inset-y-0 right-2 flex items-center text-on-surface-variant hover:text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px]">{anthropicKeyVis ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <p className="text-xs text-outline">Used only in this local browser session; secure secret storage is not implemented yet.</p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <button
                  type="button"
                  onClick={() => verifyApiKey('anthropic')}
                  disabled={apiVerification.anthropic.state === PROVIDER_STATE.CHECKING}
                  className="h-10 px-5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {apiVerification.anthropic.state === PROVIDER_STATE.CHECKING ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
                      <span>Verifying…</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">verified_user</span>
                      <span>Verify Key</span>
                    </>
                  )}
                </button>
                {apiVerification.anthropic.message && (
                  <div
                    className="flex items-start gap-2 rounded-lg p-3 text-xs flex-1"
                    style={{
                      background: apiVerification.anthropic.state === PROVIDER_STATE.FAILED ? 'rgba(239,68,68,0.1)' : 'rgba(16,163,127,0.08)',
                      border: apiVerification.anthropic.state === PROVIDER_STATE.FAILED ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(16,163,127,0.2)',
                      color: apiVerification.anthropic.state === PROVIDER_STATE.FAILED ? '#f87171' : '#34d399',
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px] flex-shrink-0 mt-0.5">
                      {apiVerification.anthropic.state === PROVIDER_STATE.FAILED ? 'error_outline' : 'info'}
                    </span>
                    <span>{apiVerification.anthropic.message}</span>
                  </div>
                )}
              </div>
              {apiVerification.anthropic.models.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
                    Verified models
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {apiVerification.anthropic.models.slice(0, 5).map(model => (
                      <span key={model} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 text-primary text-xs font-mono">
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ── Ollama ────────────────────────────────────────────────── */}
        <section className="bg-surface-container border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-bright flex items-center justify-center text-on-surface">
                <span className="material-symbols-outlined text-[18px]">dns</span>
              </div>
              <div>
                <h3 className="font-semibold text-on-surface text-sm leading-none">Ollama</h3>
                <p className="text-xs text-on-surface-variant mt-0.5">Local LLM — offline-first</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ProviderStatusBadge state={ollamaVerificationState} />
              <div className="w-px h-4 bg-outline-variant mx-2" />
              <label className={`relative inline-flex items-center ${detecting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input
                  checked={ollamaConnected}
                  onChange={handleToggleOllama}
                  disabled={detecting}
                  className="sr-only peer" type="checkbox"
                />
                <div className="w-9 h-5 bg-surface-variant rounded-full peer peer-checked:bg-primary-container peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:border after:border-outline-variant after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-on-surface-variant uppercase tracking-widest font-semibold block">Host Address</label>
                <input
                  value={ollamaHost} onChange={e => handleOllamaHostChange(e.target.value)}
                  placeholder="http://localhost:11434" type="text"
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none text-xs font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={detecting} onClick={handleDetectOllama}
                  className="h-10 w-full md:w-auto px-5 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {detecting
                    ? <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span><span>Detecting…</span></>
                    : <><span className="material-symbols-outlined text-[14px]">search_check</span><span>Auto-Detect Models</span></>
                  }
                </button>
              </div>
            </div>
            {detectError && (
              <div className="flex items-center gap-2 rounded-xl p-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <span className="material-symbols-outlined text-[14px]">error_outline</span>
                <span>{detectError}</span>
              </div>
            )}
            {ollamaConnected && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
                  Detected models ({ollamaModels.length})
                </p>
                {ollamaModels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ollamaModels.map((m, i) => (
                      <span key={i} className="flex items-center gap-1.5 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-1 text-primary text-xs font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant italic">No models. Run <code className="bg-surface-container-highest px-1 rounded">ollama pull llama3</code></p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant">
          <button type="button" className="px-5 py-2.5 text-sm font-semibold text-on-surface bg-surface-container border border-outline-variant rounded-xl hover:bg-surface-container-highest transition-colors">
            Discard Changes
          </button>
          <button
            type="button"
            onClick={() => alert('Settings apply in memory only for this prototype. Secrets are not persisted.')}
            className="px-5 py-2.5 text-sm font-semibold text-on-primary bg-primary rounded-xl hover:bg-primary-fixed transition-colors"
          >
            Apply Session Settings
          </button>
        </div>
      </div>
    </div>
  );
}
