const RUN_STATUS_META = {
  completed: {
    label: 'COMPLETED',
    text: 'text-secondary',
    border: 'border-secondary/30',
    bg: 'bg-secondary-container/20',
    icon: 'check_circle'
  },
  running: {
    label: 'RUNNING',
    text: 'text-tertiary',
    border: 'border-tertiary/40',
    bg: 'bg-tertiary/10',
    icon: 'pending'
  },
  failed: {
    label: 'FAILED',
    text: 'text-error',
    border: 'border-error/40',
    bg: 'bg-error-container/10',
    icon: 'cancel'
  },
  queued: {
    label: 'QUEUED',
    text: 'text-tertiary',
    border: 'border-tertiary/40',
    bg: 'bg-tertiary/10',
    icon: 'schedule'
  },
  unknown: {
    label: 'UNKNOWN',
    text: 'text-on-surface-variant',
    border: 'border-outline-variant',
    bg: 'bg-surface-variant/30',
    icon: 'help'
  }
};

function pickRunValue(source, keys) {
  if (!source) return undefined;
  return keys.map((key) => source[key]).find((value) => value !== undefined && value !== null && value !== '');
}

function toRunNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRunExitCode(run) {
  return toRunNumber(pickRunValue(run, ['exit_code', 'exitCode', 'code']));
}

function normalizeRunStatus(run) {
  const exitCode = getRunExitCode(run);
  const rawStatus = String(pickRunValue(run, ['status', 'state']) || '').toLowerCase();

  if (['queued', 'pending', 'waiting'].some((term) => rawStatus.includes(term))) return 'queued';
  if (['running', 'in_progress', 'in-progress', 'started'].some((term) => rawStatus.includes(term))) return 'running';
  if (exitCode !== null && exitCode !== 0) return 'failed';
  if (['fail', 'error', 'cancel', 'timeout'].some((term) => rawStatus.includes(term))) return 'failed';
  if (exitCode === 0 || ['success', 'pass', 'complete'].some((term) => rawStatus.includes(term))) return 'completed';
  return 'unknown';
}

function formatRunDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatRunDuration(run) {
  const durationMs = toRunNumber(pickRunValue(run, ['duration_ms', 'durationMs', 'elapsed_ms', 'elapsedMs']));
  if (durationMs !== null) {
    if (durationMs < 1000) return `${durationMs}ms`;
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const durationSeconds = toRunNumber(pickRunValue(run, ['duration_seconds', 'durationSeconds', 'elapsed_seconds', 'elapsedSeconds']));
  if (durationSeconds !== null) return `${durationSeconds.toFixed(durationSeconds >= 10 ? 0 : 1)}s`;

  const duration = pickRunValue(run, ['duration', 'elapsed']);
  if (typeof duration === 'number') return `${duration.toFixed(duration >= 10 ? 0 : 1)}s`;
  return duration || '--';
}

function normalizeRun(run) {
  const statusKey = normalizeRunStatus(run);
  const exitCode = getRunExitCode(run);
  const command = pickRunValue(run, ['command', 'cmd', 'script']) || '--';
  const startedAt = pickRunValue(run, ['started_at', 'startedAt', 'created_at', 'createdAt']);
  const suiteName = pickRunValue(run, ['suite_name', 'suiteName', 'suite', 'name']) || 'Test Run';
  const runId = pickRunValue(run, ['id', 'run_id', 'runId', 'number']);

  return {
    idLabel: runId ? `#${runId}` : '',
    title: `${runId ? `Run #${runId}` : 'Latest Run'} - ${suiteName}`,
    statusKey,
    statusMeta: RUN_STATUS_META[statusKey] || RUN_STATUS_META.unknown,
    statusLabel: pickRunValue(run, ['status', 'state']) || RUN_STATUS_META[statusKey]?.label || RUN_STATUS_META.unknown.label,
    exitCodeLabel: exitCode === null ? '--' : String(exitCode),
    command,
    stdout: pickRunValue(run, ['stdout', 'standard_output', 'output']) || '',
    stderr: pickRunValue(run, ['stderr', 'standard_error', 'error_output']) || '',
    duration: formatRunDuration(run),
    startedAt: formatRunDate(startedAt)
  };
}

function splitOutput(text) {
  return String(text || '').split(/\r?\n/);
}

function LiveRunResults({ run, setActiveView }) {
  const normalized = normalizeRun(run);
  const hasStdout = normalized.stdout.trim().length > 0;
  const hasStderr = normalized.stderr.trim().length > 0;
  const outputBlocks = [
    hasStdout ? { label: 'stdout', text: normalized.stdout, color: 'text-on-surface-variant' } : null,
    hasStderr ? { label: 'stderr', text: normalized.stderr, color: 'text-error' } : null
  ].filter(Boolean);
  const details = [
    ['Status', normalized.statusLabel],
    ['Exit code', normalized.exitCodeLabel],
    ['Started', normalized.startedAt],
    ['Duration', normalized.duration],
    ['Command', normalized.command]
  ];

  return (
    <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col p-sm sm:p-md lg:p-lg gap-md lg:gap-lg bg-[#020617] h-full">
      {/* Run Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-md shrink-0 text-on-surface">
        <div className="flex items-center gap-md min-w-0 w-full lg:w-auto">
          <div
            onClick={() => setActiveView('suites')}
            className="bg-surface-container p-sm rounded border border-outline-variant flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0"
            title="Back to Test Suites"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">chevron_left</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-sm min-w-0">
              <h2 className="font-headline-lg text-headline-lg tracking-tight truncate min-w-0 max-w-full">{normalized.title}</h2>
              <span className={`${normalized.statusMeta.bg} ${normalized.statusMeta.text} ${normalized.statusMeta.border} border px-xs py-[2px] rounded-sm font-label-caps text-label-caps flex items-center gap-[2px] text-xs font-bold uppercase shrink-0`}>
                <span className="material-symbols-outlined text-[12px]">{normalized.statusMeta.icon}</span>
                <span>{normalized.statusMeta.label}</span>
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-unit text-xs truncate">
              Command <span className="text-on-surface font-code-sm">{normalized.command}</span> - Started {normalized.startedAt} - Duration: {normalized.duration}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-md text-left sm:text-right w-full lg:w-auto">
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Status</span>
            <span className={`font-headline-md text-headline-md ${normalized.statusMeta.text}`}>{normalized.statusMeta.label}</span>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-8 bg-outline-variant"></div>
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Exit Code</span>
            <span className={`font-headline-md text-headline-md ${normalized.statusKey === 'failed' ? 'text-error' : 'text-on-surface'}`}>{normalized.exitCodeLabel}</span>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-8 bg-outline-variant"></div>
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Duration</span>
            <span className="font-headline-md text-headline-md text-on-surface">{normalized.duration}</span>
          </div>
        </div>
      </div>

      {/* Main Grid content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-gutter bg-outline-variant rounded-lg overflow-hidden border border-outline-variant min-h-[420px] lg:min-h-0">
        {/* Left Side: Logs */}
        <div className="lg:col-span-8 bg-surface-container flex flex-col overflow-hidden min-h-[240px] lg:min-h-0 lg:h-full">
          <div className="min-h-10 border-b border-outline-variant flex items-center px-sm sm:px-md py-xs justify-between bg-surface-container-high shrink-0 text-xs gap-sm">
            <span className="font-body-sm text-body-sm font-medium text-on-surface">Execution Log</span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">{normalized.idLabel || 'Latest'}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-sm sm:p-md flex flex-col gap-sm">
            <div className="flex items-start gap-md group hover:bg-surface-variant/30 p-sm rounded border border-transparent hover:border-outline-variant transition-all">
              <span className="material-symbols-outlined text-primary text-[18px] mt-[2px]">terminal</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs gap-md min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface font-semibold">command</span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">{normalized.startedAt}</span>
                </div>
                <span className="font-code-sm text-code-sm text-on-surface-variant block mt-unit text-xs break-all">{normalized.command}</span>
              </div>
            </div>

            {outputBlocks.length === 0 ? (
              <div className="flex items-start gap-md p-sm rounded border border-outline-variant/50">
                <span className="material-symbols-outlined text-outline text-[18px] mt-[2px]">notes</span>
                <div className="font-body-sm text-body-sm text-on-surface-variant text-xs">No stdout or stderr was captured for this run.</div>
              </div>
            ) : (
              outputBlocks.map((block) => (
                <div key={block.label} className="bg-surface p-sm rounded border border-outline-variant/50 font-code-sm text-code-sm overflow-x-auto text-xs">
                  <div className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">{block.label}</div>
                  {splitOutput(block.text).map((line, index) => (
                    <div key={`${block.label}-${index}`} className={`${block.color} whitespace-pre-wrap break-words`}>{line || ' '}</div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Run Details */}
        <div className="lg:col-span-4 bg-surface-container flex flex-col overflow-hidden min-h-[180px] lg:min-h-0 lg:h-full">
          <div className="min-h-10 border-b border-outline-variant flex items-center px-sm sm:px-md py-xs justify-between bg-surface-container-high shrink-0 text-xs gap-sm">
            <span className="font-body-sm text-body-sm font-medium text-on-surface">Run Details</span>
            <span className={`${normalized.statusMeta.bg} ${normalized.statusMeta.text} font-code-sm text-code-sm px-xs rounded`}>Exit: {normalized.exitCodeLabel}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-sm sm:p-md">
            <div className="flex flex-col gap-sm text-xs">
              {details.map(([label, value]) => (
                <div key={label} className="border-b border-outline-variant/50 pb-sm last:border-b-0">
                  <div className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-unit">{label}</div>
                  <div className="font-code-sm text-code-sm text-on-surface break-words">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Raw output snippet */}
      <div className="bg-surface-container-lowest h-64 flex flex-col border border-outline-variant rounded-lg shrink-0 relative overflow-hidden">
        <div className="flex items-center bg-surface-container-high shrink-0 border-b border-outline-variant h-[36px]">
          <div className="px-md h-full flex items-center bg-surface-container-lowest border-t-2 border-primary text-on-surface font-body-sm text-body-sm gap-sm cursor-pointer text-xs">
            <span className="material-symbols-outlined text-[14px] text-primary">terminal</span>
            <span>raw output</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto font-code-sm text-code-sm leading-relaxed p-sm bg-[#020617] text-xs">
          {outputBlocks.length === 0 ? (
            <div className="text-on-surface-variant">No output captured.</div>
          ) : (
            outputBlocks.map((block) => (
              <div key={`raw-${block.label}`} className="mb-md">
                <div className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">{block.label}</div>
                <pre className={`whitespace-pre-wrap ${block.color}`}>{block.text}</pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPane({ fixApplied, setActiveView, latestRun, run }) {
  const runData = latestRun || run;

  if (runData) {
    return <LiveRunResults run={runData} setActiveView={setActiveView} />;
  }

  return (
    <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col p-sm sm:p-md lg:p-lg gap-md lg:gap-lg bg-[#020617] h-full">
      {/* Run Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-md shrink-0 text-on-surface">
        <div className="flex items-center gap-md min-w-0 w-full lg:w-auto">
          <div 
            onClick={() => setActiveView('suites')}
            className="bg-surface-container p-sm rounded border border-outline-variant flex items-center justify-center cursor-pointer hover:border-primary transition-colors shrink-0"
            title="Back to Test Suites"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">chevron_left</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-sm min-w-0">
              <h2 className="font-headline-lg text-headline-lg tracking-tight truncate min-w-0 max-w-full">Run #482 - Core API - Unit</h2>
              <span className="bg-tertiary/10 text-tertiary border border-tertiary/40 px-xs py-[2px] rounded-sm font-label-caps text-label-caps text-xs font-bold uppercase shrink-0">
                Sample run
              </span>
              <span className={`bg-secondary-container/20 text-secondary border border-secondary/30 px-xs py-[2px] rounded-sm font-label-caps text-label-caps flex items-center gap-[2px] text-xs font-bold shrink-0`}>
                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                <span>COMPLETED</span>
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-unit text-xs truncate">Executed by <span className="text-on-surface">CI Runner</span> • Started 14 mins ago • Duration: 2m 14s</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-md text-left sm:text-right w-full lg:w-auto">
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Pass Rate</span>
            <span className="font-headline-md text-headline-md text-secondary">{fixApplied ? '100%' : '98.2%'}</span>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-8 bg-outline-variant"></div>
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Tests</span>
            <span className="font-headline-md text-headline-md text-on-surface">1,042</span>
          </div>
          <div className="hidden sm:block w-px self-stretch min-h-8 bg-outline-variant"></div>
          <div className="flex min-w-[72px] flex-col items-start sm:items-end">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-[10px]">Failed</span>
            <span className={`font-headline-md text-headline-md ${fixApplied ? 'text-on-surface' : 'text-error'}`}>{fixApplied ? '0' : '3'}</span>
          </div>
        </div>
      </div>

      {/* Main Grid content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-gutter bg-outline-variant rounded-lg overflow-hidden border border-outline-variant min-h-[420px] lg:min-h-0">
        
        {/* Left Side: Logs */}
        <div className="lg:col-span-8 bg-surface-container flex flex-col overflow-hidden min-h-[240px] lg:min-h-0 lg:h-full">
          <div className="min-h-10 border-b border-outline-variant flex flex-wrap items-center px-sm sm:px-md py-xs justify-between bg-surface-container-high shrink-0 text-xs gap-sm">
            <span className="font-body-sm text-body-sm font-medium text-on-surface">Execution Log</span>
            <div className="flex flex-wrap items-center gap-sm">
              <button className="text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm flex items-center gap-xs"><span className="material-symbols-outlined text-[14px]">filter_list</span> Filter</button>
              <button className="text-error hover:text-error-container font-body-sm text-body-sm flex items-center gap-xs"><span className="material-symbols-outlined text-[14px]">error</span> Failures Only</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-sm sm:p-md flex flex-col gap-sm">
            <div className="flex items-start gap-md group hover:bg-surface-variant/30 p-sm rounded border border-transparent hover:border-outline-variant transition-all cursor-pointer">
              <span className="material-symbols-outlined text-secondary text-[18px] mt-[2px]">check_circle</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs gap-md min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface font-semibold truncate">auth.service.spec.ts</span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">42ms</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant block mt-unit text-xs">should successfully authenticate valid user credentials</span>
              </div>
            </div>

            <div className="flex items-start gap-md group hover:bg-surface-variant/30 p-sm rounded border border-transparent hover:border-outline-variant transition-all cursor-pointer">
              <span className="material-symbols-outlined text-secondary text-[18px] mt-[2px]">check_circle</span>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-xs gap-md min-w-0">
                  <span className="font-code-sm text-code-sm text-on-surface font-semibold truncate">auth.service.spec.ts</span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">18ms</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant block mt-unit text-xs">should throw error on invalid password</span>
              </div>
            </div>

            {!fixApplied ? (
              <div 
                onClick={() => setActiveView('debug')}
                className="flex items-start gap-md bg-error-container/10 p-sm rounded border border-error/30 relative cursor-pointer"
              >
                <div className="absolute left-0 top-0 w-[2px] h-full bg-error rounded-l"></div>
                <span className="material-symbols-outlined text-error text-[18px] mt-[2px]">cancel</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-xs gap-md min-w-0">
                    <span className="font-code-sm text-code-sm text-error font-semibold truncate">user.controller.spec.ts</span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">124ms</span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface block mt-unit text-xs">should return 404 when requesting non-existent user profile</span>
                  <div className="mt-sm bg-surface p-sm rounded border border-outline-variant/50 font-code-sm text-code-sm overflow-x-auto text-on-surface-variant text-xs">
                    <span className="text-error">Expected 404, received 200</span><br/>
                    <span className="opacity-70">at UserController.getProfile (src/controllers/user.controller.ts:45:12)</span><br/>
                    <span className="opacity-70">at Object.&lt;anonymous&gt; (test/user.controller.spec.ts:112:34)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-md group hover:bg-surface-variant/30 p-sm rounded border border-transparent hover:border-outline-variant transition-all cursor-pointer">
                <span className="material-symbols-outlined text-secondary text-[18px] mt-[2px]">check_circle</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center text-xs gap-md min-w-0">
                    <span className="font-code-sm text-code-sm text-on-surface font-semibold truncate">user.controller.spec.ts</span>
                    <span className="font-code-sm text-code-sm text-on-surface-variant shrink-0">108ms</span>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant block mt-unit text-xs">should return 404 when requesting non-existent user profile</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Coverage */}
        <div className="lg:col-span-4 bg-surface-container flex flex-col overflow-hidden min-h-[180px] lg:min-h-0 lg:h-full">
          <div className="min-h-10 border-b border-outline-variant flex items-center px-sm sm:px-md py-xs justify-between bg-surface-container-high shrink-0 text-xs gap-sm">
            <span className="font-body-sm text-body-sm font-medium text-on-surface">Coverage Analytics</span>
            <span className="font-code-sm text-code-sm text-secondary bg-secondary-container/20 px-xs rounded">Total: 84%</span>
          </div>
          <div className="flex-1 overflow-y-auto p-sm">
            <div className="flex flex-col font-code-sm text-code-sm text-xs">
              <div className="flex flex-col group cursor-pointer">
                <div className="flex items-center gap-xs px-sm py-unit hover:bg-surface-variant rounded">
                  <span className="material-symbols-outlined text-[16px] text-outline">folder</span>
                  <span className="text-on-surface flex-1">src/controllers/</span>
                  <span className="text-on-surface-variant text-[10px]">88%</span>
                </div>
                <div className="flex flex-col ml-md sm:ml-xl pl-unit border-l border-outline-variant/30 mt-unit gap-unit min-w-0">
                  <div className="flex items-center gap-xs px-sm py-unit hover:bg-surface-variant rounded">
                    <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                    <span className="text-on-surface-variant flex-1 min-w-0 truncate">auth.ts</span>
                    <div className="flex items-center gap-sm w-20 sm:w-24 shrink-0">
                      <div className="h-1 flex-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-secondary" style={{ width: '92%' }}></div>
                      </div>
                      <span className="text-[10px] text-secondary w-6 text-right">92%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-xs px-sm py-unit hover:bg-surface-variant rounded bg-surface-variant/50 border border-outline-variant/50">
                    <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                    <span className="text-on-surface flex-1 min-w-0 truncate">user.ts</span>
                    <div className="flex items-center gap-sm w-20 sm:w-24 shrink-0">
                      <div className="h-1 flex-1 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-tertiary" style={{ width: '74%' }}></div>
                      </div>
                      <span className="text-[10px] text-tertiary w-6 text-right">74%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Uncovered lines snippet */}
      <div className="bg-surface-container-lowest h-64 flex flex-col border border-outline-variant rounded-lg shrink-0 relative overflow-hidden">
        <div className="flex items-center bg-surface-container-high shrink-0 border-b border-outline-variant h-[36px]">
          <div className="px-md h-full flex items-center bg-surface-container-lowest border-t-2 border-primary text-on-surface font-body-sm text-body-sm gap-sm cursor-pointer text-xs">
            <span className="material-symbols-outlined text-[14px] text-primary">description</span>
            <span>user.controller.ts</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto font-code-sm text-code-sm leading-relaxed p-sm relative bg-[#020617] text-xs">
          <div className="absolute right-md top-md z-10">
            <span className="bg-error-container/20 text-error border border-error/30 px-xs py-unit rounded-sm font-label-caps text-label-caps flex items-center gap-xs text-[10px]">
              <span className="material-symbols-outlined text-[12px]">warning</span>
              <span>UNCOVERED LINES</span>
            </span>
          </div>
          <table className="min-w-[520px] w-full text-left border-collapse">
            <tbody>
              <tr className="hover:bg-surface-variant/30">
                <td className="w-12 text-right pr-md text-outline select-none border-r border-outline-variant/50">42</td>
                <td className="pl-md text-on-surface-variant"><span className="text-primary">async</span> <span className="text-secondary">getProfile</span>(req: Request, res: Response) {"{"}</td>
              </tr>
              <tr className="hover:bg-surface-variant/30">
                <td className="w-12 text-right pr-md text-outline select-none border-r border-outline-variant/50">43</td>
                <td className="pl-md text-on-surface-variant">&nbsp;&nbsp;<span className="text-primary">const</span> userId = req.params.id;</td>
              </tr>
              <tr className="hover:bg-surface-variant/30">
                <td className="w-12 text-right pr-md text-outline select-none border-r border-outline-variant/50">44</td>
                <td className="pl-md text-on-surface-variant">&nbsp;&nbsp;<span className="text-primary">const</span> user = <span className="text-primary">await</span> <span className="text-secondary">UserService.findById</span>(userId);</td>
              </tr>
              <tr className={`${fixApplied ? 'hover:bg-surface-variant/30' : 'bg-[rgba(239,68,68,0.15)]'} relative`}>
                <td className={`w-12 text-right pr-md font-medium select-none border-r ${fixApplied ? 'text-outline border-outline-variant/50' : 'text-error border-error/50'}`}>45</td>
                <td className={`pl-md ${fixApplied ? 'text-on-surface-variant' : 'text-on-surface'}`}>&nbsp;&nbsp;<span className="text-primary">if</span> (!user) {"{"}</td>
              </tr>
              <tr className={fixApplied ? 'hover:bg-surface-variant/30' : 'bg-[rgba(239,68,68,0.15)]'}>
                <td className={`w-12 text-right pr-md font-medium select-none border-r ${fixApplied ? 'text-outline border-outline-variant/50' : 'text-error border-error/50'}`}>46</td>
                <td className={`pl-md ${fixApplied ? 'text-on-surface-variant' : 'text-on-surface'}`}>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">return</span> res.<span className="text-secondary">status</span>(404).<span className="text-secondary">json</span>({"{"} error: <span className="text-tertiary">'User not found'</span> {"}"});</td>
              </tr>
              <tr className={fixApplied ? 'hover:bg-surface-variant/30' : 'bg-[rgba(239,68,68,0.15)]'}>
                <td className={`w-12 text-right pr-md font-medium select-none border-r ${fixApplied ? 'text-outline border-outline-variant/50' : 'text-error border-error/50'}`}>47</td>
                <td className={`pl-md ${fixApplied ? 'text-on-surface-variant' : 'text-on-surface'}`}>&nbsp;&nbsp;{"}"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
