import { useState, useRef, useEffect } from 'react';

const EMPTY_LOGS = [];

export default function TerminalPane({
  fullScreen,
  terminalLogs,
  onExecuteCmd,
  setTerminalLogs,
  problemsCount,
  setTerminalCollapsed,
  setActiveView,
  demoMode = false
}) {
  const [activePanelTab, setActivePanelTab] = useState('terminal'); // terminal, problems, output
  const [inputText, setInputText] = useState('');
  const [minimized, setMinimized] = useState(false);
  const logEndRef = useRef(null);
  const safeTerminalLogs = Array.isArray(terminalLogs) ? terminalLogs : EMPTY_LOGS;
  const showDemoIntro = demoMode;
  const problemTotal = Number(problemsCount) || 0;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeTerminalLogs, activePanelTab]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    if (typeof onExecuteCmd === 'function') {
      onExecuteCmd(inputText);
    }
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  if (fullScreen) {
    return (
      <div className="flex-1 flex flex-col p-sm bg-[#020617] h-full text-on-surface">
        <div className="flex-1 border border-[#1E293B] rounded-lg bg-[#060e20] flex flex-col overflow-hidden shadow-sm">
          {/* macOS window title */}
          <div className="h-8 bg-[#0F172A] border-b border-[#1E293B] flex items-center px-sm shrink-0">
            <div className="flex space-x-2">
              <div onClick={() => setActiveView?.('explorer')} className="w-3 h-3 rounded-full bg-error-container cursor-pointer hover:bg-error"></div>
              <div className="w-3 h-3 rounded-full bg-outline-variant"></div>
              <div className="w-3 h-3 rounded-full bg-outline-variant"></div>
            </div>
            <div className="flex-1 text-center font-code-sm text-code-sm text-on-surface-variant select-none text-xs">
              user@qa-engine:~/project - terminal session
            </div>
          </div>
          
          {/* Terminal Console Stream */}
          <div className="flex-grow overflow-y-auto p-md font-code-base text-code-base space-y-md text-xs">
            <div className="text-primary font-bold whitespace-pre mb-lg">
  ____    _    _____            _            
 / ___|  / \  |  ___|___  _ __ | |_ _   _ ___ 
| |     / _ \ | |_ / _ \| '_ \| __| | | / __|
| |___ / ___ \|  _| (_) | | | | |_| |_| \__ \
 \\____/_/   \\_|_|  \\___/|_| |_|\\__|\\__, |___/
                                   |___/     
v2.4.1-stable | CLI Session Initialized
            </div>
            
            {/* Command History */}
            {showDemoIntro && (
              <div className="space-y-lg">
                <div className="font-label-caps text-label-caps uppercase text-tertiary text-[10px] tracking-wider">Demo walkthrough</div>
                <div className="flex text-xs">
                  <span className="text-secondary mr-2">➜</span>
                  <span className="text-on-surface-variant mr-2">~/project</span>
                  <span className="text-on-surface">qa explain src/agent.ts</span>
                </div>
                <div className="pl-lg border-l border-[#1E293B] space-y-md">
                  <div className="flex items-center text-primary-fixed mb-sm">
                    <span className="material-symbols-outlined text-[16px] mr-2">smart_toy</span>
                    <span className="font-bold">QA Engine Analysis</span>
                  </div>
                  <p className="text-on-surface-variant">
                    I've reviewed <code className="bg-[#0F172A] px-1 py-0.5 rounded text-primary">src/agent.ts</code>. This demo output describes a sample execution loop, task queue, and plugin flow.
                  </p>
                  <p className="text-on-surface-variant">Demo components identified:</p>
                  <ul className="list-none space-y-1 text-on-surface-variant">
                    <li><span className="text-secondary mr-2">├─</span> <code className="text-primary">AgentController</code> class: Manages lifecycle.</li>
                    <li><span className="text-secondary mr-2">├─</span> <code className="text-primary">TaskQueue</code> implementation: Handles prioritized jobs.</li>
                    <li><span className="text-secondary mr-2">└─</span> <code className="text-primary">executeStep()</code> method: The primary evaluation function.</li>
                  </ul>
                </div>
              </div>
            )}
            
            {/* Dynamic Logs */}
            <div className="space-y-1 mt-4">
              {safeTerminalLogs.map((log, index) => {
                if (log.type === 'input') {
                  return (
                    <div key={index} className="flex">
                      <span className="text-secondary mr-2">➜</span>
                      <span className="text-on-surface-variant mr-2">~/project</span>
                      <span className="text-on-surface">{log.text}</span>
                    </div>
                  );
                }
                let color = 'text-on-surface-variant';
                if (log.type === 'pass') color = 'text-secondary';
                if (log.type === 'fail' || log.type === 'error') color = 'text-error';
                if (log.type === 'bold') color = 'text-on-surface font-bold';
                if (log.type === 'success') color = 'text-secondary font-bold';
                return (
                  <div key={index} className={`${color} pl-4`}>
                    {log.text}
                  </div>
                );
              })}
            </div>
            
            {/* Input prompt */}
            <div className="flex items-center pt-2">
              <span className="text-secondary mr-2">➜</span>
              <span className="text-on-surface-variant mr-2">~/project</span>
              <input 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent border-none text-on-surface font-code-base focus:ring-0 p-0 m-0 w-full pl-2 focus:outline-none text-xs" 
                type="text" 
                placeholder="Type command (e.g. qa run tests, clear, help)..."
              />
            </div>
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    );
  }

  // Else Bottom Drawer Panel layout
  return (
    <div className={`border-t border-outline-variant bg-surface-container-lowest flex flex-col shrink-0 transition-all duration-150 ${minimized ? 'h-8' : 'h-48'} text-on-surface`}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-md h-8 border-b border-outline-variant bg-surface-container">
        <div className="flex gap-md font-label-caps text-label-caps uppercase text-on-surface-variant text-[10px] tracking-wider font-bold">
          <span 
            onClick={() => setActivePanelTab('terminal')}
            className={`pb-1 mt-1 cursor-pointer ${activePanelTab === 'terminal' ? 'text-primary border-b-2 border-primary' : 'hover:text-on-surface'}`}
          >
            Terminal
          </span>
          <span 
            onClick={() => setActivePanelTab('problems')}
            className={`pb-1 mt-1 cursor-pointer ${activePanelTab === 'problems' ? 'text-primary border-b-2 border-primary' : 'hover:text-on-surface'}`}
          >
            Problems 
            {problemTotal > 0 && (
              <span className="bg-error/25 text-error rounded-full px-1.5 ml-1 text-[8px] font-bold">{problemTotal}</span>
            )}
          </span>
          <span 
            onClick={() => setActivePanelTab('output')}
            className={`pb-1 mt-1 cursor-pointer ${activePanelTab === 'output' ? 'text-primary border-b-2 border-primary' : 'hover:text-on-surface'}`}
          >
            Output
          </span>
        </div>
        <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">{showDemoIntro ? 'Demo logs' : 'Terminal logs'}</span>
        <div className="flex items-center gap-sm text-on-surface-variant">
          <button onClick={() => setTerminalLogs?.([])} className="hover:text-on-surface transition-colors p-0.5 rounded" title="Clear console"><span className="material-symbols-outlined text-[14px]">delete</span></button>
          <button onClick={() => setMinimized(!minimized)} className="hover:text-on-surface transition-colors p-0.5 rounded" title="Minimize"><span className="material-symbols-outlined text-[14px]">{minimized ? 'expand_more' : 'expand_less'}</span></button>
          <button onClick={() => setTerminalCollapsed?.(true)} className="hover:text-on-surface transition-colors p-0.5 rounded" title="Close"><span className="material-symbols-outlined text-[14px]">close</span></button>
        </div>
      </div>

      {/* Body panel drawer content */}
      {!minimized && (
        <div className="flex-grow p-sm font-code-sm text-code-sm text-on-surface-variant overflow-y-auto bg-[#020617] text-[11px] leading-relaxed">
          {activePanelTab === 'terminal' && (
            <div className="h-full flex flex-col justify-between">
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {safeTerminalLogs.length === 0 && (
                  <div className="text-on-surface-variant">No terminal logs yet. Run a command to start a session.</div>
                )}
                {safeTerminalLogs.map((log, index) => {
                  if (log.type === 'input') {
                    return (
                      <div key={index} className="flex">
                        <span className="text-primary w-24 shrink-0 font-bold">qa-engine ~/</span> 
                        <span className="text-secondary mr-1">$</span> 
                        <span className="text-on-surface">{log.text}</span>
                      </div>
                    );
                  }
                  let color = 'text-on-surface-variant';
                  if (log.type === 'pass') color = 'text-secondary';
                  if (log.type === 'fail' || log.type === 'error') color = 'text-error';
                  if (log.type === 'bold') color = 'text-on-surface font-bold';
                  if (log.type === 'success') color = 'text-secondary font-bold';
                  return (
                    <div key={index} className={`${color}`}>
                      {log.text}
                    </div>
                  );
                })}
                <div ref={logEndRef} />
              </div>
              
              <div className="flex items-center shrink-0 border-t border-outline-variant/35 pt-1 mt-1 font-bold">
                <span className="text-primary w-24 shrink-0">qa-engine ~/</span>
                <span className="text-secondary mr-1">$</span>
                <input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-none text-on-surface font-code-sm focus:ring-0 p-0 m-0 w-full pl-1 focus:outline-none text-[11px]" 
                  type="text" 
                  autoComplete="off" 
                  placeholder="Run command..."
                />
              </div>
            </div>
          )}

          {activePanelTab === 'problems' && (
            <div className="space-y-1">
              {problemTotal > 0 ? (
                <div 
                  onClick={() => setActiveView?.('debug')}
                  className="flex items-start space-x-2 text-error p-1 rounded hover:bg-surface-variant/20 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] mt-0.5">error</span>
                  <div>
                    <span className="font-bold">[TS2322]</span> Type 'null' is not assignable to type 'Token'. 
                    <span className="text-on-surface-variant font-normal"> - src/auth/AuthSessionManager.ts:142:24</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-2 text-secondary p-1 rounded">
                  <span className="material-symbols-outlined text-[16px] mt-0.5">check_circle</span>
                  <div>No problems reported.</div>
                </div>
              )}
            </div>
          )}

          {activePanelTab === 'output' && (
            <div className="space-y-0.5 text-outline">
              <div>[Demo output] [2026-06-11 17:28:47] [System] Initializing QA Engine Core RAG Model...</div>
              <div>[Demo output] [2026-06-11 17:28:48] [RAG] Indexed 1,402 AST nodes.</div>
              <div>[Demo output] [2026-06-11 17:28:50] [System] Model context loaded for sample analysis.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
