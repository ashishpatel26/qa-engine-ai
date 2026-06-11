export default function Layout({
  children,
  activeTab,
  setActiveTab,
  activeView,
  setActiveView,
  sidebarCollapsed,
  setSidebarCollapsed,
  terminalCollapsed,
  setTerminalCollapsed,
  activeFile,
  setActiveFile,
  runMode,
  setRunMode,
  activeModel,
  setActiveModel,
  fixApplied,
  ollamaModels = []
}) {

  const handleBranchClick = () => {
    alert('Mock: Checked out main branch.');
  };

  const handleModelClick = () => {
    const baseModels = ['GPT-4o', 'Claude-3.5-Sonnet', 'Gemini-1.5-Pro'];
    const models = [...baseModels, ...ollamaModels];
    const currentIdx = models.indexOf(activeModel);
    setActiveModel(models[(currentIdx + 1) % models.length]);
  };

  const cycleMode = () => {
    const modes = ['Planning', 'Develop', 'Test'];
    const currentIdx = modes.indexOf(runMode);
    setRunMode(modes[(currentIdx + 1) % modes.length]);
  };

  const renderSidebarContent = () => {
    if (activeTab === 'chat' || activeTab === 'workspace') {
      return (
        <div className="flex-1 overflow-y-auto py-xs select-none">
          <div className="flex items-center px-sm py-1 cursor-pointer hover:bg-surface-variant/30 group">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-1">expand_more</span>
            <span className="material-symbols-outlined text-[16px] text-primary mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <span className="font-body-sm text-body-sm text-on-surface truncate">qa-engine-core</span>
          </div>
          <div className="flex items-center px-sm py-1 pl-[24px] cursor-pointer hover:bg-surface-variant/30 group">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-1">expand_more</span>
            <span className="material-symbols-outlined text-[16px] text-primary mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <span className="font-body-sm text-body-sm text-on-surface truncate">src</span>
          </div>
          <div className="flex items-center px-sm py-1 pl-[44px] cursor-pointer hover:bg-surface-variant/30 group">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-1 -rotate-90">expand_more</span>
            <span className="material-symbols-outlined text-[16px] text-outline mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <span className="font-body-sm text-body-sm text-on-surface-variant truncate">components</span>
          </div>
          <div className="flex items-center px-sm py-1 pl-[44px] cursor-pointer hover:bg-surface-variant/30 group">
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-1">expand_more</span>
            <span className="material-symbols-outlined text-[16px] text-primary mr-2" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <span className="font-body-sm text-body-sm text-on-surface truncate">agents</span>
          </div>
          
          <div 
            onClick={() => { setActiveFile('ReviewAgent.js'); setActiveView('explorer'); }}
            className={`flex items-center px-sm py-1 pl-[64px] cursor-pointer hover:bg-surface-variant/40 group border-l-2 ${activeFile === 'ReviewAgent.js' && activeView === 'explorer' ? 'bg-surface-container-highest border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#eab308] mr-2">javascript</span>
            <span className="font-body-sm text-body-sm truncate flex-1">ReviewAgent.js</span>
            <span className={`w-2 h-2 rounded-full ${fixApplied ? 'bg-secondary' : 'bg-error animate-pulse'}`}></span>
          </div>
          
          <div 
            onClick={() => { setActiveFile('agent.ts'); setActiveView('explorer'); }}
            className={`flex items-center px-sm py-1 pl-[64px] cursor-pointer hover:bg-surface-variant/40 group border-l-2 ${activeFile === 'agent.ts' && activeView === 'explorer' ? 'bg-surface-container-highest border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#3178c6] mr-2">description</span>
            <span className="font-body-sm text-body-sm truncate flex-1">agent.ts</span>
          </div>
          
          <div className="flex items-center px-sm py-1 pl-[64px] cursor-pointer hover:bg-surface-variant/40 group border-l-2 border-transparent text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-[#3178c6] mr-2">description</span>
            <span className="font-body-sm text-body-sm truncate flex-1">RAGIndexer.test.ts</span>
            <span className="font-code-sm text-code-sm text-error">1 error</span>
          </div>
          
          <div 
            onClick={() => { setActiveFile('package.json'); setActiveView('explorer'); }}
            className={`flex items-center px-sm py-1 pl-[24px] cursor-pointer hover:bg-surface-variant/30 group mt-2 border-l-2 ${activeFile === 'package.json' && activeView === 'explorer' ? 'bg-surface-container-highest border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
          >
            <span className="material-symbols-outlined text-[16px] text-outline mr-2 ml-5">settings</span>
            <span className="font-body-sm text-body-sm truncate flex-1">package.json</span>
          </div>
        </div>
      );
    }
    
    if (activeTab === 'testing') {
      return (
        <div className="flex flex-col h-full">
          <div className="p-md">
            <button className="w-full bg-primary-container text-on-primary-container hover:opacity-95 transition-all py-sm px-md rounded flex items-center justify-center gap-sm font-body-base text-body-base font-semibold shadow-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>New Test Suite</span>
            </button>
          </div>
          <div className="flex flex-col py-sm text-on-surface-variant font-body-base text-body-base">
            <a 
              onClick={() => setActiveView('suites')}
              className={`flex items-center gap-md px-md py-sm cursor-pointer hover:text-on-surface hover:bg-surface-variant/30 ${activeView === 'suites' ? 'bg-primary-container/10 text-primary border-l-2 border-primary font-medium' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">precision_manufacturing</span>
              <span className="font-label-caps text-label-caps uppercase text-xs">Test Suites</span>
            </a>
            <a 
              onClick={() => setActiveView('results')}
              className={`flex items-center gap-md px-md py-sm cursor-pointer hover:text-on-surface hover:bg-surface-variant/30 ${activeView === 'results' ? 'bg-primary-container/10 text-primary border-l-2 border-primary font-medium' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">play_circle</span>
              <span className="font-label-caps text-label-caps uppercase text-xs">Runs</span>
            </a>
            <a 
              onClick={() => setActiveView('debug')}
              className={`flex items-center gap-md px-md py-sm cursor-pointer hover:text-on-surface hover:bg-surface-variant/30 ${activeView === 'debug' ? 'bg-primary-container/10 text-primary border-l-2 border-primary font-medium' : ''}`}
            >
              <span className="material-symbols-outlined text-[20px]">analytics</span>
              <span className="font-label-caps text-label-caps uppercase text-xs">Reports</span>
            </a>
          </div>
          <div className="mt-auto border-t border-outline-variant py-sm flex flex-col font-body-base text-body-base">
            <a className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-variant/30 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span className="font-label-caps text-label-caps uppercase text-xs">Docs</span>
            </a>
            <a className="flex items-center gap-md px-md py-sm text-on-surface-variant hover:bg-surface-variant/30 cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">support_agent</span>
              <span className="font-label-caps text-label-caps uppercase text-xs">Support</span>
            </a>
          </div>
        </div>
      );
    }
    
    if (activeTab === 'settings') {
      return (
        <nav className="flex flex-col p-2 space-y-1">
          <a className="flex items-center px-3 py-2 rounded bg-surface-container-highest text-on-surface font-body-sm text-body-sm border-l-2 border-primary cursor-pointer">
            <span className="material-symbols-outlined text-[16px] mr-3 text-primary">api</span>
            <span>Model Providers</span>
          </a>
          <a className="flex items-center px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface font-body-sm text-body-sm border-l-2 border-transparent transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[16px] mr-3">alt_route</span>
            <span>Model Routing</span>
          </a>
          <a className="flex items-center px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface font-body-sm text-body-sm border-l-2 border-transparent transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[16px] mr-3">security</span>
            <span>Security & Privacy</span>
          </a>
          <a className="flex items-center px-3 py-2 rounded text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface font-body-sm text-body-sm border-l-2 border-transparent transition-colors cursor-pointer">
            <span className="material-symbols-outlined text-[16px] mr-3">dns</span>
            <span>Local Mode</span>
          </a>
        </nav>
      );
    }
    
    if (activeTab === 'monitor') {
      return (
        <div className="p-md flex flex-col space-y-md h-full text-on-surface">
          <div className="bg-surface-container-high rounded p-sm border border-outline-variant">
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-xs text-[10px] tracking-wider font-bold">SESSION TOKENS</h4>
            <div className="text-2xl font-bold font-code-sm text-primary">142,094</div>
            <div className="text-xs text-on-surface-variant mt-1">Cost: $1.42</div>
          </div>
          <div className="bg-surface-container-high rounded p-sm border border-outline-variant">
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-xs text-[10px] tracking-wider font-bold">LATENCY TRENDS</h4>
            <div className="h-20 flex items-end gap-1 pt-4 px-1 bg-[#0b1326] rounded">
              <div className="bg-primary-container w-full h-8 rounded-t"></div>
              <div className="bg-primary-container w-full h-10 rounded-t"></div>
              <div className="bg-primary w-full h-16 rounded-t"></div>
              <div className="bg-primary-container w-full h-12 rounded-t"></div>
              <div className="bg-secondary w-full h-14 rounded-t"></div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const getSidebarTitle = () => {
    if (activeTab === 'chat' || activeTab === 'workspace') return 'Explorer';
    if (activeTab === 'testing') return 'QA Engine';
    if (activeTab === 'settings') return 'Configuration';
    if (activeTab === 'monitor') return 'Agent Dashboard';
    return '';
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#020617] text-on-surface">
      {/* Top Navigation Header */}
      <header className="bg-surface-dim border-b border-outline-variant flex justify-between items-center h-12 px-md w-full shrink-0 z-50">
        <div className="flex items-center space-x-md">
          <span 
            onClick={() => setActiveView('suites')} 
            className="font-headline-md text-headline-md font-black text-on-surface tracking-tight cursor-pointer"
          >
            QA Engine
          </span>
          <div className="h-4 w-px bg-outline-variant mx-2"></div>
          <nav className="hidden md:flex space-x-md items-center">
            <span className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary cursor-pointer transition-opacity">Main</span>
            <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
            <span onClick={handleBranchClick} className="font-label-caps text-label-caps text-primary font-bold cursor-pointer transition-opacity">Branch: main</span>
            <span className="material-symbols-outlined text-[14px] text-outline-variant">chevron_right</span>
            <span onClick={handleModelClick} className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary cursor-pointer transition-opacity">Model: {activeModel}</span>
          </nav>
        </div>
        
        <div className="flex items-center space-x-sm">
          <div className="relative flex items-center bg-surface-container rounded border border-outline-variant px-sm h-8 w-64 focus-within:border-primary transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-[16px]">search</span>
            <input className="bg-transparent border-none text-body-sm focus:ring-0 w-full placeholder-on-surface-variant text-on-surface py-0 h-full pl-2 focus:outline-none" placeholder="Search workspace..." type="text"/>
            <span className="text-on-surface-variant font-code-sm text-code-sm border border-outline-variant rounded px-1 ml-1 bg-surface-container-high">⌘K</span>
          </div>
          
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1 rounded transition-colors ${sidebarCollapsed ? 'text-on-surface-variant hover:bg-surface-container-highest' : 'text-primary bg-surface-container-highest'}`}
            title="Toggle Sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">account_tree</span>
          </button>
          <button 
            onClick={() => setTerminalCollapsed(!terminalCollapsed)}
            className={`p-1 rounded transition-colors ${terminalCollapsed ? 'text-on-surface-variant hover:bg-surface-container-highest' : 'text-primary bg-surface-container-highest'}`}
            title="Toggle Console"
          >
            <span className="material-symbols-outlined text-[20px]">terminal</span>
          </button>
          <button className="p-1 text-on-surface-variant hover:text-primary rounded hover:bg-surface-container-highest transition-colors" title="More Actions">
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
          <div className="w-px h-6 bg-outline-variant mx-1"></div>
          <button 
            onClick={() => setActiveView('suites')}
            className="bg-primary text-on-primary hover:bg-primary-fixed-dim transition-all px-md py-xs rounded font-body-sm text-body-sm font-semibold flex items-center gap-xs shadow-sm hover:scale-95 duration-100"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            <span>Run All</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout Frame */}
      <div className="flex flex-1 overflow-hidden relative w-full">
        {/* Activity Bar */}
        <aside className="w-activity-bar-width bg-surface-container border-r border-outline-variant flex flex-col items-center py-md space-y-md shrink-0 z-40">
          <div className="flex flex-col space-y-md w-full items-center flex-1">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`w-full flex justify-center py-sm transition-all relative group ${activeTab === 'chat' ? 'text-primary bg-surface-container-high border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
              title="AI Chat"
            >
              <span className="material-symbols-outlined text-[24px]">chat</span>
            </button>
            <button 
              onClick={() => setActiveTab('workspace')}
              className={`w-full flex justify-center py-sm transition-all relative group ${activeTab === 'workspace' ? 'text-primary bg-surface-container-high border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
              title="Code Workspace"
            >
              <span className="material-symbols-outlined text-[24px]">account_tree</span>
            </button>
            <button 
              onClick={() => setActiveTab('monitor')}
              className={`w-full flex justify-center py-sm transition-all relative group ${activeTab === 'monitor' ? 'text-primary bg-surface-container-high border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
              title="Agent Activity"
            >
              <span className="material-symbols-outlined text-[24px]">monitoring</span>
            </button>
            <button 
              onClick={() => setActiveTab('testing')}
              className={`w-full flex justify-center py-sm transition-all relative group ${activeTab === 'testing' ? 'text-primary bg-surface-container-high border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
              title="Test Suites"
            >
              <span className="material-symbols-outlined text-[24px]">science</span>
            </button>
            
            <button 
              onClick={() => setActiveTab('settings')}
              className={`w-full flex justify-center py-sm transition-all relative group mt-auto ${activeTab === 'settings' ? 'text-primary bg-surface-container-high border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest'}`}
              title="Settings"
            >
              <span className="material-symbols-outlined text-[24px]">settings</span>
            </button>
          </div>
          
          <div className="mt-auto pt-md w-full flex justify-center border-t border-outline-variant cursor-pointer" title="User Profile">
            <div className="w-8 h-8 rounded-full border border-outline-variant overflow-hidden hover:border-primary transition-colors flex items-center justify-center bg-surface-container-high text-primary font-bold text-xs">
              QA
            </div>
          </div>
        </aside>

        {/* Collapsible Sidebar */}
        <aside className={`bg-surface-container-low border-r border-outline-variant flex flex-col shrink-0 transition-all duration-150 ${sidebarCollapsed ? 'w-0 invisible opacity-0' : 'w-sidebar-width opacity-100'}`}>
          <div className="h-8 flex items-center px-sm border-b border-outline-variant shrink-0 justify-between">
            <div className="flex items-center gap-xs min-w-0">
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider text-xs truncate">{getSidebarTitle()}</span>
              {(activeTab === 'chat' || activeTab === 'workspace' || activeTab === 'testing' || activeTab === 'monitor') && (
                <span className="shrink-0 rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">Demo data</span>
              )}
            </div>
            {(activeTab === 'chat' || activeTab === 'workspace') && (
              <div className="flex space-x-1">
                <button className="text-on-surface-variant hover:text-primary p-0.5 rounded cursor-pointer" title="New File"><span className="material-symbols-outlined text-[14px]">note_add</span></button>
                <button className="text-on-surface-variant hover:text-primary p-0.5 rounded cursor-pointer" title="New Folder"><span className="material-symbols-outlined text-[14px]">create_new_folder</span></button>
                <button className="text-on-surface-variant hover:text-primary p-0.5 rounded cursor-pointer" title="Refresh"><span className="material-symbols-outlined text-[14px]">refresh</span></button>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col min-h-0 relative">
            {renderSidebarContent()}
          </div>
        </aside>

        {/* Dynamic Inner Panel View Router */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#020617]">
          {children}
        </div>
      </div>

      {/* Status Bar / Footer */}
      <footer className="h-8 bg-primary text-on-primary font-code-sm text-code-sm flex items-center justify-between px-md shrink-0 z-50">
        <div className="flex space-x-md items-center">
          <div className="flex items-center">
            <span className="material-symbols-outlined text-[14px] mr-1">memory</span>
            <span>Model: Anthropic Claude 3.5 Sonnet</span>
          </div>
          <div className="hidden sm:flex items-center opacity-80">|</div>
          <div className="hidden sm:flex items-center">
            <span className="material-symbols-outlined text-[14px] mr-1">toll</span>
            <span>Tokens: 12.4k</span>
          </div>
        </div>
        <div onClick={cycleMode} className="flex items-center bg-inverse-primary text-on-primary px-sm py-xs rounded-sm font-bold cursor-pointer hover:bg-opacity-95" title="Cycle Mode">
          <span className="material-symbols-outlined text-[14px] mr-1">psychology</span>
          <span>Mode: {runMode}</span>
        </div>
      </footer>
    </div>
  );
}
