export default function MonitorPane({ fixApplied }) {
  return (
    <div className="flex-grow overflow-y-auto p-md grid grid-cols-1 xl:grid-cols-12 gap-md items-start h-full">
      {/* Metrics Sidebar */}
      <aside className="xl:col-span-3 flex flex-col space-y-md w-full">
        {/* System Overview */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-md">
          <div className="mb-md flex items-center justify-between gap-sm">
            <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-xs font-bold">System Overview</h2>
            <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">Sample</span>
          </div>
          <div className="space-y-sm">
            <div className="flex justify-between items-center py-xs border-b border-outline-variant">
              <span className="text-body-sm text-on-surface-variant">Active Agents</span>
              <span className="font-code-sm text-code-sm text-secondary">3 Running</span>
            </div>
            <div className="flex justify-between items-center py-xs border-b border-outline-variant">
              <span className="text-body-sm text-on-surface-variant">Total Tokens</span>
              <span className="font-code-sm text-code-sm text-on-surface">142,094</span>
            </div>
            <div className="flex justify-between items-center py-xs border-b border-outline-variant">
              <span className="text-body-sm text-on-surface-variant">Session Cost</span>
              <span className="font-code-sm text-code-sm text-tertiary">$1.42</span>
            </div>
            <div className="flex justify-between items-center py-xs">
              <span className="text-body-sm text-on-surface-variant">Avg Latency</span>
              <span className="font-code-sm text-code-sm text-on-surface">1.2s</span>
            </div>
          </div>
        </div>

        {/* Global Event Log */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg p-0 overflow-hidden flex flex-col">
          <div className="p-sm px-md border-b border-outline-variant bg-surface-container flex justify-between items-center bg-[#0F172A]">
            <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-xs font-bold">Global Event Log</h2>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant cursor-pointer hover:text-on-surface">filter_list</span>
          </div>
          <div className="p-sm flex flex-col space-y-xs max-h-64 overflow-y-auto font-code-sm text-code-sm text-on-surface-variant text-xs">
            <div className="flex items-start space-x-sm hover:bg-surface-container-lowest p-1 rounded cursor-pointer">
              <span className="text-outline">10:42</span>
              <span className="text-secondary">[QA] Test suite passed</span>
            </div>
            <div className="flex items-start space-x-sm hover:bg-surface-container-lowest p-1 rounded cursor-pointer">
              <span className="text-outline">10:41</span>
              <span className="text-primary">[Code] Committed changes to Auth.ts</span>
            </div>
            <div className="flex items-start space-x-sm hover:bg-surface-container-lowest p-1 rounded cursor-pointer bg-error-container/10">
              <span className="text-outline">10:39</span>
              <span className="text-error">[Sec] Vulnerability detected in deps</span>
            </div>
            <div className="flex items-start space-x-sm hover:bg-surface-container-lowest p-1 rounded cursor-pointer">
              <span className="text-outline">10:35</span>
              <span className="text-primary">[Sys] Dev Env configured</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Agent Cards Grid */}
      <div className="xl:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-md w-full">
        {/* Coding Agent Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden flex flex-col h-80 hover:border-primary transition-colors cursor-pointer group relative interactive-hover">
          <div className="h-[2px] w-full bg-outline-variant absolute top-0 left-0">
            <div className="h-full w-full pulse-bar"></div>
          </div>
          <div className="p-md pb-sm border-b border-[#1E293B] flex justify-between items-start mt-[2px]">
            <div className="flex items-center space-x-sm">
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container shrink-0">
                <span className="material-symbols-outlined text-[18px]">code</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Coding Agent</h3>
                <div className="flex items-center space-x-sm mt-1">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  <p className="font-label-caps text-label-caps text-secondary uppercase tracking-widest text-[9px]">Refactoring Auth.ts</p>
                </div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-code-sm text-code-sm text-on-surface">Token: 45k</div>
              <div className="font-code-sm text-code-sm text-tertiary mt-1">$0.45</div>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-md overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-container-lowest z-10 pointer-events-none mt-20"></div>
            <div className="font-code-sm text-code-sm text-on-surface-variant flex flex-col space-y-1 text-xs">
              <div><span className="text-primary">&gt;</span> Analyzing dependencies... [OK]</div>
              <div><span className="text-primary">&gt;</span> Parsing AST for Auth.ts... [OK]</div>
              <div><span className="text-primary">&gt;</span> Identifying deprecated JWT patterns...</div>
              <div className="text-tertiary">&gt; Warning: Found legacy crypto module usage at line 42</div>
              <div><span className="text-primary">&gt;</span> Generating replacement logic using jose...</div>
              <div className="text-outline flex items-center"><span className="w-1 h-4 bg-outline animate-pulse mr-2"></span> Thinking</div>
            </div>
          </div>
          <div className="p-sm bg-surface-container border-t border-[#1E293B] flex justify-between items-center group-hover:bg-surface-container-high transition-colors text-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant">View Session Replay</span>
            <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
          </div>
        </div>

        {/* QA Agent Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden flex flex-col h-80 hover:border-primary transition-colors cursor-pointer group interactive-hover">
          <div className="p-md pb-sm border-b border-[#1E293B] flex justify-between items-start">
            <div className="flex items-center space-x-sm">
              <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
                <span className="material-symbols-outlined text-[18px]">bug_report</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">QA Agent</h3>
                <div className="flex items-center space-x-sm mt-1">
                  <span className={`w-2 h-2 rounded-full ${fixApplied ? 'bg-secondary' : 'bg-outline animate-pulse'}`}></span>
                  <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest text-[9px]">{fixApplied ? 'Idle - Tests Passed' : 'Idle - Awaiting Fix'}</p>
                </div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-code-sm text-code-sm text-on-surface">Token: 12k</div>
              <div className="font-code-sm text-code-sm text-tertiary mt-1">$0.12</div>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-md overflow-hidden relative">
            <div className="font-code-sm text-code-sm text-on-surface-variant flex flex-col space-y-1 text-xs">
              <div><span className="text-secondary">✓</span> Executing unit tests matching '*auth*'</div>
              <div><span className="text-secondary">✓</span> src/tests/auth.spec.ts: 24/24 passed</div>
              <div><span className="text-secondary">✓</span> src/tests/jwt.spec.ts: 12/12 passed</div>
              <br/>
              <div className="text-on-surface font-semibold">Test Suites: 2 passed, 2 total</div>
              <div className="text-on-surface font-semibold">Tests:       36 passed, 36 total</div>
            </div>
          </div>
          <div className="p-sm bg-surface-container border-t border-[#1E293B] flex justify-between items-center group-hover:bg-surface-container-high transition-colors text-xs">
            <span className="font-label-caps text-label-caps text-on-surface-variant">View Audit Logs</span>
            <span className="material-symbols-outlined text-[16px] text-primary">arrow_forward</span>
          </div>
        </div>

        {/* Security Agent Card */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-lg overflow-hidden flex flex-col h-80 hover:border-error transition-colors cursor-pointer group relative interactive-hover">
          <div className="h-[2px] w-full bg-error absolute top-0 left-0"></div>
          <div className="p-md pb-sm border-b border-[#1E293B] flex justify-between items-start mt-[2px]">
            <div className="flex items-center space-x-sm">
              <div className="w-8 h-8 rounded-full bg-error-container flex items-center justify-center text-on-error-container shrink-0">
                <span className="material-symbols-outlined text-[18px]">security</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">Security Agent</h3>
                <div className="flex items-center space-x-sm mt-1">
                  <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                  <p className="font-label-caps text-label-caps text-error uppercase tracking-widest text-[9px]">Reviewing NPM Audit</p>
                </div>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-code-sm text-code-sm text-on-surface">Token: 8k</div>
              <div className="font-code-sm text-code-sm text-tertiary mt-1">$0.08</div>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-lowest p-md overflow-hidden relative">
            <div className="font-code-sm text-code-sm text-on-surface-variant flex flex-col space-y-1 text-xs">
              <div><span className="text-primary">&gt;</span> npm audit --json</div>
              <div><span className="text-primary">&gt;</span> Analyzing dependency graph...</div>
              <br/>
              <div className="text-error bg-error-container/20 p-2 rounded-sm border border-error/30 mt-2 text-xs">
                [CRITICAL] High severity vulnerability found in 'axios' &lt; v1.6.0. <br/>
                Path: root -&gt; my-package -&gt; axios<br/>
                Action Required: Force update dependency.
              </div>
            </div>
          </div>
          <div className="p-sm bg-surface-container border-t border-[#1E293B] flex justify-between items-center group-hover:bg-surface-container-high transition-colors text-xs">
            <span className="font-label-caps text-label-caps text-error font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">warning</span>
              <span>Resolve Issue</span>
            </span>
            <span className="material-symbols-outlined text-[16px] text-error">arrow_forward</span>
          </div>
        </div>
      </div>
    </div>
  );
}
