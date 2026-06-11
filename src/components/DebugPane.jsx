export default function DebugPane({ fixApplied, onApplyFix, setActiveView }) {
  return (
    <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg bg-[#020617] h-full text-on-surface">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-center gap-sm">
          <div 
            onClick={() => setActiveView('results')}
            className="bg-surface-container p-sm rounded border border-outline-variant flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            title="Back to Results"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">chevron_left</span>
          </div>
          <div>
            <div className="flex items-center gap-sm mb-unit">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${fixApplied ? 'bg-secondary-container text-on-secondary-container border-secondary/30' : 'bg-error-container text-on-error-container border-error/30'}`}>
                {fixApplied ? 'Run Passed' : 'Failed Run'}
              </span>
              <span className="text-on-surface-variant font-code-sm text-code-sm">ID: RUN-9824-A</span>
              <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">Sample diff</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold">AuthSessionManager.ts</h1>
          </div>
        </div>
        <div className="text-right">
          <span className="text-on-surface-variant font-body-sm text-body-sm block">Environment: Staging</span>
          <span className="text-on-surface-variant font-body-sm text-body-sm block">Failed: 2 mins ago</span>
        </div>
      </div>

      {/* Agent Analysis */}
      <div className="bg-surface-container-high border border-outline-variant rounded-lg overflow-hidden flex flex-col shrink-0">
        <div className={`w-full relative top-0 ${fixApplied ? 'h-[2px] bg-secondary-fixed shadow-[0_0_10px_rgba(78,222,163,0.8)]' : 'agent-pulse'}`}></div>
        <div className="p-md border-b border-outline-variant flex items-center gap-sm bg-surface-container-highest">
          <span className="material-symbols-outlined text-secondary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          <h2 className="font-headline-md text-headline-md font-bold">Agent Analysis: Root Cause Identified</h2>
        </div>
        <div className="p-md flex flex-col gap-md text-sm">
          <p className="text-on-surface-variant leading-relaxed">
            The test <code className="bg-surface-variant px-1 py-0.5 rounded text-primary font-code-sm">testUserLogoutClearsSession</code> failed due to a Null Pointer Exception. The root cause is located in <code className="bg-surface-variant px-1 py-0.5 rounded text-primary font-code-sm">clearSessionData()</code>.
          </p>
          <div className="bg-[#0b1326] border border-outline-variant rounded p-sm font-code-sm text-code-sm text-on-surface-variant overflow-x-auto">
            <div className="flex"><span className="text-error w-4 shrink-0">&gt;</span><span className="text-error">TypeError: Cannot read properties of null (reading 'invalidate')</span></div>
            <div className="flex"><span className="w-4 shrink-0"></span><span className="text-outline">&nbsp;&nbsp;&nbsp;&nbsp;at AuthSessionManager.clearSessionData (src/auth/AuthSessionManager.ts:142:24)</span></div>
            <div className="flex"><span className="w-4 shrink-0"></span><span className="text-outline">&nbsp;&nbsp;&nbsp;&nbsp;at AuthSessionManager.logout (src/auth/AuthSessionManager.ts:88:14)</span></div>
          </div>
          <p className="text-on-surface-variant border-l-2 border-primary pl-md py-xs bg-primary/5 rounded-r">
            <strong>Proposed Fix:</strong> Add an explicit null check for <code className="font-code-sm text-primary">this.activeToken</code> before attempting to call <code className="font-code-sm text-primary">invalidate()</code>. The session may already be cleared by an external event before the logout routine finishes.
          </p>
        </div>
      </div>

      {/* Diff Viewer */}
      <div className="flex-1 flex flex-col bg-surface-container-high border border-outline-variant rounded-lg overflow-hidden min-h-[300px]">
        <div className="flex bg-surface-container-highest border-b border-outline-variant h-[36px] text-xs">
          <div className="flex items-center px-md border-r border-outline-variant bg-surface-container-high border-t-2 border-t-primary w-1/2">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-sm">code</span>
            <span className="font-body-sm text-body-sm text-on-surface">Current Code (Failing)</span>
          </div>
          <div className="flex items-center px-md border-r border-outline-variant bg-surface-container-high border-t-2 border-t-secondary w-1/2">
            <span className="material-symbols-outlined text-[16px] text-secondary mr-sm">auto_fix_high</span>
            <span className="font-body-sm text-body-sm text-on-surface">AI Suggested Fix</span>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden font-code-base text-code-base text-xs">
          {/* Left Diff */}
          <div className="w-1/2 bg-[#020617] border-r border-outline-variant overflow-y-auto py-sm">
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">140</span><span className="text-on-surface pl-sm whitespace-pre">  private async clearSessionData(): Promise&lt;void&gt; {"{"}</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">141</span><span className="text-on-surface pl-sm whitespace-pre">    this.logger.info('Clearing session data...');</span></div>
            {fixApplied ? (
              <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">142</span><span className="text-on-surface pl-sm whitespace-pre">    if (this.activeToken) {"{"}</span></div>
            ) : (
              <div className="flex diff-removed"><span className="diff-line-number text-error">142</span><span className="text-on-surface pl-sm whitespace-pre">    await this.activeToken.invalidate();</span></div>
            )}
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">143</span><span className="text-on-surface pl-sm whitespace-pre">    this.activeToken = null;</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">144</span><span className="text-on-surface pl-sm whitespace-pre">    this.currentUser = undefined;</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">145</span><span className="text-on-surface pl-sm whitespace-pre">    this.cache.clear('session:*');</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">146</span><span className="text-on-surface pl-sm whitespace-pre">  {"}"}</span></div>
          </div>
          
          {/* Right Diff */}
          <div className="w-1/2 bg-[#020617] overflow-y-auto py-sm">
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">140</span><span className="text-on-surface pl-sm whitespace-pre">  private async clearSessionData(): Promise&lt;void&gt; {"{"}</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">141</span><span className="text-on-surface pl-sm whitespace-pre">    this.logger.info('Clearing session data...');</span></div>
            <div className="flex diff-added"><span className="diff-line-number text-secondary">142</span><span className="text-on-surface pl-sm whitespace-pre">    if (this.activeToken) {"{"}</span></div>
            <div className="flex diff-added"><span className="diff-line-number text-secondary">143</span><span className="text-on-surface pl-sm whitespace-pre">      await this.activeToken.invalidate();</span></div>
            <div className="flex diff-added"><span className="diff-line-number text-secondary">144</span><span className="text-on-surface pl-sm whitespace-pre">    {"}"}</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">145</span><span className="text-on-surface pl-sm whitespace-pre">    this.activeToken = null;</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">146</span><span className="text-on-surface pl-sm whitespace-pre">    this.currentUser = undefined;</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">147</span><span className="text-on-surface pl-sm whitespace-pre">    this.cache.clear('session:*');</span></div>
            <div className="flex hover:bg-surface-variant/30"><span className="diff-line-number">148</span><span className="text-on-surface pl-sm whitespace-pre">  {"}"}</span></div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-surface-container-highest border border-outline-variant p-md rounded-lg flex items-center justify-between shrink-0 text-sm">
        <div className="flex items-center gap-sm">
          <span className={`material-symbols-outlined text-[20px] ${fixApplied ? 'text-secondary' : 'text-tertiary animate-pulse'}`}>check_circle</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {fixApplied ? 'Fix successfully applied and verified.' : 'Suggested patch validates against existing test suite.'}
          </span>
        </div>
        <div className="flex gap-md">
          <button 
            onClick={() => setActiveView('results')}
            className="bg-transparent border border-outline-variant text-on-surface hover:bg-surface-variant font-body-base px-xl py-sm rounded transition-colors flex items-center gap-sm"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>{fixApplied ? 'Back' : 'Dismiss'}</span>
          </button>
          {!fixApplied && (
            <>
              <button 
                onClick={() => alert('Regression suite added to workspace.')}
                className="bg-surface-variant text-on-surface hover:bg-outline-variant font-body-base px-xl py-sm rounded transition-colors flex items-center gap-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add_task</span>
                <span>Generate Regression</span>
              </button>
              <button 
                onClick={onApplyFix}
                className="bg-primary text-on-primary hover:bg-primary-fixed font-body-base font-semibold px-xl py-sm rounded transition-colors flex items-center gap-sm hover:scale-95 duration-100 transition-transform"
              >
                <span className="material-symbols-outlined text-[18px]">done_all</span>
                <span>Apply Fix</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
