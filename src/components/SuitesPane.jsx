const SAMPLE_SUMMARY = {
  totalTests: '1,492',
  passingRate: '94%',
  passingRateFixed: '100%',
  coverage: '78.2%',
  coverageValue: 78.2,
  recentFailures: '12',
  recentFailuresFixed: '0'
};

const STATUS_META = {
  passing: {
    dot: 'bg-secondary',
    text: 'text-secondary',
    label: 'Passing'
  },
  failing: {
    dot: 'bg-error animate-pulse',
    text: 'text-error',
    label: 'Failing'
  },
  running: {
    dot: 'bg-tertiary animate-pulse',
    text: 'text-tertiary',
    label: 'Running'
  },
  queued: {
    dot: 'bg-tertiary',
    text: 'text-tertiary',
    label: 'Queued'
  },
  unknown: {
    dot: 'bg-outline',
    text: 'text-on-surface-variant',
    label: 'Not run'
  }
};

function getSampleSuites(fixApplied) {
  return [
    {
      id: 'core-api',
      name: 'Core API - Unit',
      runTarget: 'Core API',
      icon: 'folder_zip',
      status: 'passing',
      framework: 'Jest',
      coverage: 92.4,
      lastRun: '2m ago',
      totalTests: 1042,
      passedTests: 1042,
      failedTests: 0,
      view: 'results'
    },
    {
      id: 'frontend-e2e',
      name: 'Frontend E2E - Playwright',
      runTarget: 'Frontend E2E',
      icon: 'web',
      status: fixApplied ? 'passing' : 'failing',
      statusLabel: fixApplied ? 'Passing' : 'Failing (3)',
      framework: 'Playwright',
      coverage: 65.8,
      lastRun: '15m ago',
      totalTests: 37,
      passedTests: fixApplied ? 37 : 34,
      failedTests: fixApplied ? 0 : 3,
      view: fixApplied ? 'results' : 'debug'
    },
    {
      id: 'auth-flow',
      name: 'Auth Flow - Integration',
      runTarget: 'Auth Flow',
      icon: 'lock',
      status: 'passing',
      framework: 'Cypress',
      coverage: 88.1,
      lastRun: '1h ago',
      totalTests: 186,
      passedTests: 186,
      failedTests: 0,
      view: 'results'
    },
    {
      id: 'db-migrations',
      name: 'DB Migrations',
      runTarget: 'DB Migrations',
      icon: 'database',
      status: 'running',
      framework: 'Custom Bash',
      coverage: null,
      lastRun: 'Just now',
      totalTests: null,
      passedTests: null,
      failedTests: null,
      view: 'results'
    }
  ];
}

function pickValue(source, keys) {
  if (!source) return undefined;
  return keys.map((key) => source[key]).find((value) => value !== undefined && value !== null && value !== '');
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getExitCode(run) {
  return toNumber(pickValue(run, ['exit_code', 'exitCode', 'code']));
}

function normalizeStatus(status, exitCode) {
  const rawStatus = String(status || '').toLowerCase();

  if (['queued', 'pending', 'waiting'].some((term) => rawStatus.includes(term))) {
    return 'queued';
  }

  if (['running', 'in_progress', 'in-progress', 'started'].some((term) => rawStatus.includes(term))) {
    return 'running';
  }

  if (exitCode !== null && exitCode !== 0) {
    return 'failing';
  }

  if (['fail', 'error', 'cancel', 'timeout'].some((term) => rawStatus.includes(term))) {
    return 'failing';
  }

  if (exitCode === 0 || ['pass', 'success', 'complete'].some((term) => rawStatus.includes(term))) {
    return 'passing';
  }

  return 'unknown';
}

function formatPercent(value) {
  const number = toNumber(value);
  if (number === null) return '--';
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function formatCount(value) {
  const number = toNumber(value);
  if (number === null) return '--';
  return new Intl.NumberFormat().format(number);
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function getSuiteKey(suite) {
  return pickValue(suite, ['id', 'suite_id', 'suiteId', 'key', 'name', 'suite_name', 'suiteName']);
}

function getRunSuiteKey(run) {
  return pickValue(run, ['suite_id', 'suiteId', 'suite_key', 'suiteKey', 'suite_name', 'suiteName', 'suite', 'name']);
}

function matchesRunSuite(run, suite) {
  const runKey = getRunSuiteKey(run);
  const suiteKeys = [
    pickValue(suite, ['id', 'suite_id', 'suiteId', 'key']),
    pickValue(suite, ['name', 'suite_name', 'suiteName', 'label'])
  ].filter(Boolean);

  return Boolean(runKey && suiteKeys.some((key) => String(key) === String(runKey)));
}

function getStartedAt(run) {
  return pickValue(run, ['started_at', 'startedAt', 'created_at', 'createdAt', 'updated_at', 'updatedAt']);
}

function compareRunsByStartTime(a, b) {
  const aTime = new Date(getStartedAt(a) || 0).getTime();
  const bTime = new Date(getStartedAt(b) || 0).getTime();
  return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
}

function findLatestRun(suite, latestRuns, suiteRuns, runs) {
  const directRun = pickValue(suite, ['latestRun', 'latest_run', 'run']);
  if (directRun) return directRun;

  const suiteKey = getSuiteKey(suite);
  const sources = [latestRuns, suiteRuns, runs];

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      const matches = source.filter((run) => matchesRunSuite(run, suite));
      if (matches.length > 0) return [...matches].sort(compareRunsByStartTime)[0];
      continue;
    }

    if (typeof source === 'object' && suiteKey && source[suiteKey]) {
      return source[suiteKey];
    }
  }

  return null;
}

function inferIcon(suite, framework) {
  const explicitIcon = pickValue(suite, ['icon', 'materialIcon', 'material_icon']);
  if (explicitIcon) return explicitIcon;

  const frameworkName = String(framework || '').toLowerCase();
  if (frameworkName.includes('playwright')) return 'devices';
  if (frameworkName.includes('cypress')) return 'api';
  if (frameworkName.includes('jest') || frameworkName.includes('vitest')) return 'javascript';
  if (frameworkName.includes('bash') || frameworkName.includes('shell')) return 'terminal';
  return 'fact_check';
}

function normalizeSuite(suite, latestRun, index) {
  const exitCode = getExitCode(latestRun || suite);
  const rawStatus = pickValue(latestRun, ['status', 'state']) || pickValue(suite, ['status', 'state']);
  const statusKey = normalizeStatus(rawStatus, exitCode);
  const framework = pickValue(suite, ['framework', 'runner', 'tool']) || pickValue(latestRun, ['framework', 'runner']) || '--';
  const failedTests = toNumber(pickValue(suite, ['failedTests', 'failed_tests', 'failures', 'failed_count']))
    ?? toNumber(pickValue(latestRun, ['failedTests', 'failed_tests', 'failures', 'failed_count']));

  return {
    id: pickValue(suite, ['id', 'suite_id', 'suiteId', 'key']) || `suite-${index}`,
    name: pickValue(suite, ['name', 'suite_name', 'suiteName', 'label']) || `Suite ${index + 1}`,
    runTarget: pickValue(suite, ['runTarget', 'run_target', 'id', 'suite_id', 'suiteId', 'name', 'suite_name', 'suiteName']),
    icon: inferIcon(suite, framework),
    statusKey,
    statusLabel: pickValue(suite, ['statusLabel', 'status_label']) || getStatusLabel(statusKey, failedTests),
    framework,
    coverage: pickValue(suite, ['coverage', 'coverage_percent', 'coveragePercent']),
    lastRun: pickValue(suite, ['lastRun', 'last_run', 'last_run_label', 'lastRunLabel']) || formatDateTime(getStartedAt(latestRun)),
    totalTests: toNumber(pickValue(suite, ['totalTests', 'total_tests', 'tests', 'test_count']))
      ?? toNumber(pickValue(latestRun, ['totalTests', 'total_tests', 'tests', 'test_count'])),
    passedTests: toNumber(pickValue(suite, ['passedTests', 'passed_tests', 'passed_count']))
      ?? toNumber(pickValue(latestRun, ['passedTests', 'passed_tests', 'passed_count'])),
    failedTests,
    view: pickValue(suite, ['view', 'detailsView', 'details_view']) || 'results',
    raw: suite,
    latestRun
  };
}

function getStatusLabel(statusKey, failedTests) {
  if (statusKey === 'failing' && failedTests > 0) return `Failing (${failedTests})`;
  return STATUS_META[statusKey]?.label || STATUS_META.unknown.label;
}

function getRealSummary(suites) {
  const totalTests = suites.reduce((sum, suite) => sum + (suite.totalTests || 0), 0);
  const passedTests = suites.reduce((sum, suite) => sum + (suite.passedTests || 0), 0);
  const failedTests = suites.reduce((sum, suite) => sum + (suite.failedTests || 0), 0);
  const passingSuites = suites.filter((suite) => suite.statusKey === 'passing').length;
  const coverageValues = suites.map((suite) => toNumber(suite.coverage)).filter((value) => value !== null);
  const coverageAverage = coverageValues.length > 0
    ? coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length
    : null;
  const passRate = totalTests > 0
    ? (passedTests / totalTests) * 100
    : suites.length > 0 ? (passingSuites / suites.length) * 100 : null;

  return {
    totalTests: totalTests > 0 ? formatCount(totalTests) : '--',
    passingRate: passRate === null ? '--' : formatPercent(passRate),
    passingSubtitle: suites.length > 0 ? `${passingSuites}/${suites.length} suites` : 'No suites',
    coverage: coverageAverage === null ? '--' : formatPercent(coverageAverage),
    coverageValue: coverageAverage || 0,
    coverageSubtitle: 'Across suites',
    recentFailures: formatCount(failedTests),
    failuresSubtitle: 'Latest runs'
  };
}

function getSampleSummary(fixApplied) {
  return {
    totalTests: SAMPLE_SUMMARY.totalTests,
    passingRate: fixApplied ? SAMPLE_SUMMARY.passingRateFixed : SAMPLE_SUMMARY.passingRate,
    passingSubtitle: '↑ 2.1%',
    coverage: SAMPLE_SUMMARY.coverage,
    coverageValue: SAMPLE_SUMMARY.coverageValue,
    coverageSubtitle: 'Target: 80%',
    recentFailures: fixApplied ? SAMPLE_SUMMARY.recentFailuresFixed : SAMPLE_SUMMARY.recentFailures,
    failuresSubtitle: 'Last 24h'
  };
}

export default function SuitesPane({
  fixApplied,
  setActiveView,
  onRunSuite,
  suites,
  latestRuns,
  suiteRuns,
  runs
}) {
  const hasProvidedSuites = Array.isArray(suites);
  const isUsingSampleData = !hasProvidedSuites;
  const sourceSuites = hasProvidedSuites ? suites : getSampleSuites(fixApplied);
  const displaySuites = sourceSuites.map((suite, index) => normalizeSuite(
    suite,
    isUsingSampleData ? null : findLatestRun(suite, latestRuns, suiteRuns, runs),
    index
  ));
  const summary = isUsingSampleData ? getSampleSummary(fixApplied) : getRealSummary(displaySuites);
  const coverageWidth = `${Math.min(Math.max(summary.coverageValue, 0), 100)}%`;

  const handlePlayClick = (e, suite) => {
    e.stopPropagation();
    if (typeof onRunSuite === 'function' && suite.statusKey !== 'running') {
      onRunSuite(suite.runTarget || suite.name, suite.raw || suite);
    }
  };

  const handleRowClick = (suite) => {
    if (typeof setActiveView === 'function') {
      setActiveView(suite.view || 'results');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-lg bg-background h-full">
      <div className="max-w-[1400px] mx-auto flex flex-col gap-lg">
        {/* Page Header */}
        <div className="flex justify-between items-end shrink-0 text-on-surface">
          <div>
            <div className="flex items-center gap-sm mb-xs">
              <h2 className="font-headline-lg text-headline-lg">Test Suites Overview</h2>
              {isUsingSampleData && (
                <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">Sample data</span>
              )}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">Manage and monitor automated testing environments.</p>
          </div>
        </div>

        {/* Bento Grid Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
          {/* Total Tests */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-md flex flex-col justify-between h-32 relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-xs">Total Tests</span>
              <span className="material-symbols-outlined text-on-surface-variant text-sm">fact_check</span>
            </div>
            <div className="font-code-base text-[32px] leading-none text-on-surface">{summary.totalTests}</div>
          </div>
          
          {/* Passing Rate */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-md flex flex-col justify-between h-32 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${fixApplied || !isUsingSampleData ? 'bg-secondary' : 'bg-tertiary'} opacity-50`}></div>
            <div className="flex justify-between items-start">
              <span className={`font-label-caps text-label-caps uppercase text-xs ${fixApplied || !isUsingSampleData ? 'text-secondary' : 'text-tertiary'}`}>Passing Rate</span>
              <span className={`material-symbols-outlined text-sm ${fixApplied || !isUsingSampleData ? 'text-secondary' : 'text-tertiary'}`}>{fixApplied || !isUsingSampleData ? 'check_circle' : 'pending'}</span>
            </div>
            <div className="flex items-end gap-sm">
              <div className={`font-code-base text-[32px] leading-none ${fixApplied || !isUsingSampleData ? 'text-secondary' : 'text-tertiary'}`}>{summary.passingRate}</div>
              <div className={`font-body-sm text-body-sm mb-1 ${isUsingSampleData ? 'text-secondary-fixed-dim' : 'text-on-surface-variant'}`}>{summary.passingSubtitle}</div>
            </div>
          </div>
          
          {/* Total Coverage */}
          <div className="bg-surface-container border border-outline-variant rounded-lg p-md flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <span className="font-label-caps text-label-caps text-primary uppercase text-xs">Total Coverage</span>
              <span className="material-symbols-outlined text-primary text-sm">radar</span>
            </div>
            <div className="flex items-end gap-sm">
              <div className="font-code-base text-[32px] leading-none text-primary">{summary.coverage}</div>
              <div className="font-body-sm text-body-sm text-on-surface-variant mb-1">{summary.coverageSubtitle}</div>
            </div>
            <div className="w-full bg-surface-variant h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: coverageWidth }}></div>
            </div>
          </div>
          
          {/* Recent Failures */}
          <div className={`bg-surface-container border rounded-lg p-md flex flex-col justify-between h-32 relative ${fixApplied || (!isUsingSampleData && summary.recentFailures === '0') ? 'border-outline-variant' : 'border-error-container'}`}>
            <div className="absolute right-0 bottom-0 opacity-10">
              <span className="material-symbols-outlined text-9xl text-error">warning</span>
            </div>
            <div className="flex justify-between items-start z-10">
              <span className={`font-label-caps text-label-caps uppercase text-xs ${fixApplied || (!isUsingSampleData && summary.recentFailures === '0') ? 'text-on-surface-variant' : 'text-error'}`}>Recent Failures</span>
              <span className={`material-symbols-outlined text-sm ${fixApplied || (!isUsingSampleData && summary.recentFailures === '0') ? 'text-on-surface-variant' : 'text-error'}`}>bug_report</span>
            </div>
            <div className="flex items-end gap-sm z-10">
              <div className={`font-code-base text-[32px] leading-none ${fixApplied || (!isUsingSampleData && summary.recentFailures === '0') ? 'text-on-surface' : 'text-error'}`}>{summary.recentFailures}</div>
              <div className="font-body-sm text-body-sm text-on-surface-variant mb-1">{summary.failuresSubtitle}</div>
            </div>
          </div>
        </div>

        {/* Main Data Table */}
        <div className="bg-surface-container border border-outline-variant rounded-lg flex flex-col flex-1 min-h-[400px]">
          {/* Table Toolbar */}
          <div className="px-md py-sm border-b border-outline-variant flex justify-between items-center bg-surface-bright/30 text-on-surface">
            <div className="flex gap-sm">
              <button className="font-label-caps text-label-caps text-on-surface bg-surface-variant px-3 py-1.5 rounded flex items-center gap-xs text-xs">
                <span className="material-symbols-outlined text-[14px]">filter_list</span> Filter
              </button>
              <button className="font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface px-3 py-1.5 rounded flex items-center gap-xs transition-colors text-xs">
                <span className="material-symbols-outlined text-[14px]">sort</span> Sort
              </button>
            </div>
            <div className="font-body-sm text-body-sm text-on-surface-variant">Showing {displaySuites.length > 0 ? 1 : 0}-{displaySuites.length} of {displaySuites.length} suites</div>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-sm px-md py-sm border-b border-outline-variant font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider bg-surface-container-low text-xs">
            <div className="col-span-4">Suite Name</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Framework</div>
            <div className="col-span-2 text-right">Coverage</div>
            <div className="col-span-1 text-right">Last Run</div>
            <div className="col-span-1 text-center">Action</div>
          </div>

          {/* Table Rows */}
          <div className="flex flex-col font-body-sm text-body-sm text-on-surface-variant">
            {displaySuites.length === 0 ? (
              <div className="px-md py-xl text-center text-on-surface-variant">No test suites configured.</div>
            ) : (
              displaySuites.map((suite, index) => {
                const statusMeta = STATUS_META[suite.statusKey] || STATUS_META.unknown;
                const isRunning = suite.statusKey === 'running';
                const isLast = index === displaySuites.length - 1;
                const canRun = typeof onRunSuite === 'function' && !isRunning;

                return (
                  <div
                    key={suite.id}
                    onClick={() => handleRowClick(suite)}
                    className={`grid grid-cols-12 gap-sm px-md py-md ${isLast ? '' : 'border-b border-outline-variant'} hover:bg-surface-variant/30 transition-colors items-center group cursor-pointer ${suite.statusKey === 'failing' ? 'bg-error-container/5' : ''}`}
                  >
                    <div className="col-span-4 flex items-center gap-sm">
                      <span className="material-symbols-outlined text-outline text-sm">{suite.icon}</span>
                      <span className="font-code-sm text-code-sm text-on-surface font-semibold">{suite.name}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-xs">
                      <div className={`w-2 h-2 rounded-full ${statusMeta.dot}`}></div>
                      <span className={statusMeta.text}>{suite.statusLabel}</span>
                    </div>
                    <div className="col-span-2 flex items-center gap-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm">{inferIcon({}, suite.framework)}</span> {suite.framework}
                    </div>
                    <div className="col-span-2 text-right font-code-sm text-code-sm text-on-surface">{formatPercent(suite.coverage)}</div>
                    <div className="col-span-1 text-right text-on-surface-variant">{suite.lastRun}</div>
                    <div className="col-span-1 flex justify-center">
                      <button
                        onClick={(e) => handlePlayClick(e, suite)}
                        disabled={!canRun}
                        className={`opacity-0 group-hover:opacity-100 bg-surface-variant text-on-surface w-6 h-6 rounded flex items-center justify-center transition-all ${canRun ? 'hover:bg-primary-container hover:text-on-primary-container' : 'cursor-not-allowed opacity-40'}`}
                        title={isRunning ? 'Run in progress' : 'Run suite'}
                      >
                        <span className="material-symbols-outlined text-[14px]">{isRunning ? 'hourglass_top' : 'play_arrow'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
