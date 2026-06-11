import { useEffect, useMemo, useState } from 'react';

const WORKSPACE_TAB_PREFIX = 'workspace:';

const toWorkspaceTabId = (path) => `${WORKSPACE_TAB_PREFIX}${path}`;

const fromWorkspaceTabId = (tabId) => {
  if (typeof tabId !== 'string' || !tabId.startsWith(WORKSPACE_TAB_PREFIX)) {
    return null;
  }

  return tabId.slice(WORKSPACE_TAB_PREFIX.length);
};

const getBaseName = (path = '') => {
  const cleanPath = String(path).replace(/\\/g, '/');
  const parts = cleanPath.split('/').filter(Boolean);
  return parts.at(-1) || cleanPath || 'Untitled';
};

const extractFileText = (payload) => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidates = [
    payload.content,
    payload.text,
    payload.data?.content,
    payload.data?.text,
    payload.file?.content,
    payload.file?.text
  ];

  return candidates.find(value => typeof value === 'string') ?? null;
};

const readFileTextResponse = async (response) => {
  const rawBody = await response.text();

  if (!rawBody) {
    return '';
  }

  try {
    const payload = JSON.parse(rawBody);
    const fileText = extractFileText(payload);

    if (typeof fileText === 'string') {
      return fileText;
    }
  } catch {
    return rawBody;
  }

  return rawBody;
};

const normalizeWorkspaceFiles = (payload) => {
  let rawItems = [];

  if (Array.isArray(payload)) {
    rawItems = payload;
  } else if (Array.isArray(payload?.entries)) {
    rawItems = payload.entries;
  } else if (Array.isArray(payload?.items)) {
    rawItems = payload.items;
  } else if (Array.isArray(payload?.files)) {
    rawItems = payload.files;
  }

  return rawItems
    .map((item) => {
      if (typeof item === 'string') {
        const path = item.trim();

        if (!path) {
          return null;
        }

        return {
          path,
          name: getBaseName(path),
          type: 'file',
          size: null
        };
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const path = String(item.path ?? item.fullPath ?? item.name ?? item.file ?? '').trim();

      if (!path) {
        return null;
      }

      const typeValue = String(item.type ?? '').toLowerCase();
      const isDirectory = Boolean(
        item.isDirectory ||
        item.directory ||
        typeValue === 'dir' ||
        typeValue === 'directory' ||
        typeValue === 'folder'
      );
      const size = Number(item.size);

      return {
        path,
        name: String(item.name ?? getBaseName(path)),
        type: isDirectory ? 'directory' : 'file',
        size: Number.isFinite(size) ? size : null,
        content: typeof item.content === 'string' ? item.content : undefined,
        text: typeof item.text === 'string' ? item.text : undefined
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }

      return a.path.localeCompare(b.path);
    });
};

const formatFileSize = (size) => {
  if (!Number.isFinite(size)) {
    return '';
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (name, type = 'file') => {
  if (type === 'directory') {
    return 'folder';
  }

  if (name.endsWith('.json')) {
    return 'data_object';
  }

  if (name.endsWith('.ts') || name.endsWith('.tsx')) {
    return 'description';
  }

  if (name.endsWith('.md')) {
    return 'article';
  }

  return 'javascript';
};

export default function WorkspacePane({
  activeFile,
  setActiveFile,
  openFiles,
  setOpenFiles,
  fixApplied
}) {
  const [consoleLogs, setConsoleLogs] = useState([
    { type: 'info', text: '➜ Fetching PR #142... OK' },
    { type: 'info', text: '➜ Parsing AST for ReviewAgent.js... OK' },
    { type: 'warn', text: '⚙ Querying RAG Index for similar dependency injections...' },
    { type: 'pulse', text: 'Loading context chunks (3/5) ...' }
  ]);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState([]);
  const [workspaceStatus, setWorkspaceStatus] = useState('loading');
  const [workspaceMessage, setWorkspaceMessage] = useState('Checking /api/workspace/files for real workspace data...');
  const [fileContentByPath, setFileContentByPath] = useState({});

  const activeWorkspacePath = fromWorkspaceTabId(activeFile);
  const activeWorkspaceFile = useMemo(
    () => workspaceFiles.find(file => file.path === activeWorkspacePath) ?? null,
    [activeWorkspacePath, workspaceFiles]
  );
  const activeWorkspaceRecord = activeWorkspacePath ? fileContentByPath[activeWorkspacePath] : null;
  const hasActiveRealFileContent = activeWorkspaceRecord?.status === 'loaded';
  const editorMode = (() => {
    if (!activeWorkspaceFile) {
      return {
        label: 'Demo code',
        className: 'border-tertiary/40 bg-tertiary/10 text-tertiary'
      };
    }

    if (activeWorkspaceRecord?.status === 'loaded') {
      return {
        label: 'Real file',
        className: 'border-secondary/40 bg-secondary/10 text-secondary'
      };
    }

    if (activeWorkspaceRecord?.status === 'error') {
      return {
        label: 'File error',
        className: 'border-error/40 bg-error/10 text-error'
      };
    }

    return {
      label: 'Loading file',
      className: 'border-primary/40 bg-primary/10 text-primary'
    };
  })();
  const activeBreadcrumbParts = activeWorkspaceFile
    ? activeWorkspaceFile.path.split('/').filter(Boolean)
    : ['qa-engine-core', 'src', 'agents', activeFile].filter(Boolean);

  useEffect(() => {
    const controller = new AbortController();

    const fetchWorkspaceFiles = async () => {
      try {
        const response = await fetch('/api/workspace/files', {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const files = normalizeWorkspaceFiles(payload);

        if (!files.length) {
          throw new Error('No files returned');
        }

        if (controller.signal.aborted) {
          return;
        }

        setWorkspaceFiles(files);
        setWorkspaceStatus('ready');
        setWorkspaceMessage(`${files.length} workspace item${files.length === 1 ? '' : 's'} loaded from /api/workspace/files.`);
        setConsoleLogs(prev => [
          ...prev,
          { type: 'info', text: `➜ Loaded ${files.length} workspace item${files.length === 1 ? '' : 's'} from backend` }
        ]);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setWorkspaceFiles([]);
        setWorkspaceStatus('demo');
        setWorkspaceMessage('Offline/demo mode: /api/workspace/files is unavailable, so the sample workspace is being shown.');
        setConsoleLogs(prev => [
          ...prev,
          { type: 'warn', text: '⚙ Workspace files unavailable; using offline demo sample.' }
        ]);
      }
    };

    fetchWorkspaceFiles();

    return () => {
      controller.abort();
    };
  }, []);

  const loadWorkspaceFile = async (file) => {
    if (!file || file.type === 'directory') {
      return;
    }

    const cached = fileContentByPath[file.path];

    if (cached?.status === 'loaded' || cached?.status === 'loading') {
      return;
    }

    setFileContentByPath(prev => ({
      ...prev,
      [file.path]: { status: 'loading', text: '', error: '' }
    }));

    try {
      let fileText = extractFileText(file);

      if (typeof fileText !== 'string') {
        const response = await fetch(`/api/workspace/file?path=${encodeURIComponent(file.path)}`, {
          headers: { Accept: 'application/json, text/plain;q=0.9' }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        fileText = await readFileTextResponse(response);
      }

      setFileContentByPath(prev => ({
        ...prev,
        [file.path]: { status: 'loaded', text: fileText, error: '' }
      }));
      setConsoleLogs(prev => [
        ...prev,
        { type: 'info', text: `➜ Opened ${file.path}` }
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load file';

      setFileContentByPath(prev => ({
        ...prev,
        [file.path]: { status: 'error', text: '', error: message }
      }));
      setConsoleLogs(prev => [
        ...prev,
        { type: 'warn', text: `⚙ Could not open ${file.path}: ${message}` }
      ]);
    }
  };

  const handleActivateTab = (tabId) => {
    setActiveFile(tabId);

    const workspacePath = fromWorkspaceTabId(tabId);
    const workspaceFile = workspacePath
      ? workspaceFiles.find(file => file.path === workspacePath)
      : null;

    if (workspaceFile) {
      loadWorkspaceFile(workspaceFile);
    }
  };

  const handleOpenWorkspaceFile = (file) => {
    if (!file || file.type === 'directory') {
      return;
    }

    const tabId = toWorkspaceTabId(file.path);

    setOpenFiles(prev => (prev.includes(tabId) ? prev : [...prev, tabId]));
    handleActivateTab(tabId);
  };

  const renderPlainCodeContent = (text) => {
    const lines = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    return (
      <div className="relative z-10 flex min-w-max">
        <div className="flex flex-col text-outline-variant text-right pr-4 select-none border-r border-outline-variant/30 mr-4 font-code-sm text-code-sm">
          {lines.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <div className="flex flex-col w-full text-on-surface-variant font-code-base text-code-base">
          {lines.map((line, index) => (
            <div key={index} className="whitespace-pre">{line || ' '}</div>
          ))}
        </div>
      </div>
    );
  };

  const getCodeContent = () => {
    if (activeWorkspaceFile) {
      if (!activeWorkspaceRecord || activeWorkspaceRecord.status === 'loading') {
        return (
          <div className="relative z-10 p-md text-on-surface-variant font-body-sm text-body-sm">
            Loading {activeWorkspaceFile.path} from the workspace...
          </div>
        );
      }

      if (activeWorkspaceRecord.status === 'error') {
        return (
          <div className="relative z-10 p-md text-on-surface-variant font-body-sm text-body-sm">
            <div className="font-bold text-error">Could not load {activeWorkspaceFile.path}</div>
            <div className="mt-1 text-xs">{activeWorkspaceRecord.error}</div>
            <button
              onClick={() => {
                setFileContentByPath(prev => {
                  const next = { ...prev };
                  delete next[activeWorkspaceFile.path];
                  return next;
                });
                loadWorkspaceFile(activeWorkspaceFile);
              }}
              className="mt-3 border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest text-[10px] px-2 py-1 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        );
      }

      return renderPlainCodeContent(activeWorkspaceRecord.text);
    }

    if (activeFile === 'ReviewAgent.js') {
      if (fixApplied) {
        return (
          <div className="relative z-10 flex">
            <div className="flex flex-col text-outline-variant text-right pr-4 select-none border-r border-outline-variant/30 mr-4 font-code-sm text-code-sm">
              <span>42</span><span>43</span><span>44</span><span>45</span><span>46</span><span>47</span>
            </div>
            <div className="flex flex-col w-full text-on-surface-variant font-code-base text-code-base">
              <div className="whitespace-pre">class ReviewAgent extends BaseAgent {"{"}</div>
              <div className="whitespace-pre">  constructor(config) {"{"}</div>
              <div className="whitespace-pre">    super(config);</div>
              <div className="whitespace-pre text-secondary">    // Inject indexer dependency for better testing</div>
              <div className="whitespace-pre text-secondary">    this.indexer = config.indexer || new RAGIndexer(config.dbUrl);</div>
              <div className="whitespace-pre">  {"}"}</div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="relative z-10 flex">
            <div className="flex flex-col text-outline-variant text-right pr-4 select-none border-r border-outline-variant/30 mr-4 font-code-sm text-code-sm">
              <span>42</span><span>43</span><span>44</span><span>45</span><span>46</span><span>47</span><span>48</span><span>49</span>
            </div>
            <div className="flex flex-col w-full font-code-base text-code-base">
              <div className="whitespace-pre">class ReviewAgent extends BaseAgent {"{"}</div>
              <div className="whitespace-pre">  constructor(config) {"{"}</div>
              <div className="whitespace-pre">    super(config);</div>
              <div className="bg-[#ef4444]/12 whitespace-pre flex border-l-2 border-error">
                <span className="w-4 text-error select-none px-1">-</span>
                <span className="text-error line-through decoration-error/50">    this.indexer = new RAGIndexer(config.dbUrl);</span>
              </div>
              <div className="bg-[#10b981]/12 whitespace-pre flex border-l-2 border-secondary">
                <span className="w-4 text-secondary select-none px-1">+</span>
                <span className="text-secondary">    // Inject indexer dependency for better testing</span>
              </div>
              <div className="bg-[#10b981]/12 whitespace-pre flex border-l-2 border-secondary">
                <span className="w-4 text-secondary select-none px-1">+</span>
                <span className="text-secondary">    this.indexer = config.indexer || new RAGIndexer(config.dbUrl);</span>
              </div>
              <div className="whitespace-pre">  {"}"}</div>
              <div className="whitespace-pre"></div>
              <div className="whitespace-pre text-primary-fixed-dim">  async analyzePR(prData) {"{"}</div>
            </div>
          </div>
        );
      }
    }

    if (activeFile === 'agent.ts') {
      return (
        <div className="relative z-10 flex">
          <div className="flex flex-col text-outline-variant text-right pr-4 select-none border-r border-outline-variant/30 mr-4 font-code-sm text-code-sm">
            {[...Array(24).keys()].map(n => <span key={n}>{n + 1}</span>)}
          </div>
          <div className="flex flex-col w-full text-on-surface-variant font-code-base text-code-base">
            <div className="whitespace-pre"><span className="code-syntax-keyword">import</span> {'{'} LLMProvider, AgentContext, StepResult {'}'} <span className="code-syntax-keyword">from</span> <span className="code-syntax-string">'./types'</span>;</div>
            <div className="whitespace-pre"></div>
            <div className="whitespace-pre"><span className="code-syntax-keyword">export</span> <span className="code-syntax-keyword">class</span> <span className="code-syntax-function">AgentController</span> {"{"}</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">private</span> llm: LLMProvider;</div>
            <div className="whitespace-pre"></div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">constructor</span>(llm: LLMProvider) {"{"}</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">this</span>.llm = llm;</div>
            <div className="whitespace-pre">  {"}"}</div>
            <div className="whitespace-pre"></div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">async</span> <span className="code-syntax-function">executeStep</span>(context: AgentContext): <span className="code-syntax-keyword">Promise</span>&lt;StepResult&gt; {"{"}</div>
            <div className="whitespace-pre">    logger.<span className="code-syntax-function">info</span>(<span className="code-syntax-string">'Starting execution step'</span>, {'{'} stepId: context.currentStep {'}'});</div>
            <div className="whitespace-pre"></div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">try</span> {"{"}</div>
            <div className="whitespace-pre">      <span className="code-syntax-keyword">const</span> analysis = <span className="code-syntax-keyword">await</span> <span className="code-syntax-keyword">this</span>.llm.<span className="code-syntax-function">analyze</span>(context.state);</div>
            <div className="whitespace-pre">      <span className="code-syntax-keyword">if</span> (analysis.requiresAction) {"{"}</div>
            <div className="whitespace-pre">          <span className="code-syntax-keyword">return</span> <span className="code-syntax-keyword">await</span> <span className="code-syntax-keyword">this</span>.toolChain.<span className="code-syntax-function">execute</span>(analysis.action);</div>
            <div className="whitespace-pre">      {"}"}</div>
            <div className="whitespace-pre">      <span className="code-syntax-keyword">return</span> {'{'} status: <span className="code-syntax-string">'complete'</span>, result: analysis.summary {'}'};</div>
            <div className="whitespace-pre">    {"}"} <span className="code-syntax-keyword">catch</span> (error) {"{"}</div>
            <div className="whitespace-pre">      <span className="code-syntax-keyword">return</span> <span className="code-syntax-function">handleError</span>(error, context);</div>
            <div className="whitespace-pre">    {"}"}</div>
            <div className="whitespace-pre">  {"}"}</div>
            <div className="whitespace-pre">{"}"}</div>
          </div>
        </div>
      );
    }

    if (activeFile === 'package.json') {
      return (
        <div className="relative z-10 flex">
          <div className="flex flex-col text-outline-variant text-right pr-4 select-none border-r border-outline-variant/30 mr-4 font-code-sm text-code-sm">
            {[...Array(14).keys()].map(n => <span key={n}>{n + 1}</span>)}
          </div>
          <div className="flex flex-col w-full text-on-surface-variant font-code-base text-code-base">
            <div className="whitespace-pre">{"{"}</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"name"</span>: <span className="code-syntax-string">"qa-engine-core"</span>,</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"version"</span>: <span className="code-syntax-string">"2.4.1"</span>,</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"description"</span>: <span className="code-syntax-string">"Autonomous Agentic QA Testing Workspace"</span>,</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"main"</span>: <span className="code-syntax-string">"dist/index.js"</span>,</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"scripts"</span>: {"{"}</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">"dev"</span>: <span className="code-syntax-string">"node dist/index.js"</span>,</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">"test"</span>: <span className="code-syntax-string">"jest"</span>,</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">"test:agent"</span>: <span className="code-syntax-string">"jest src/agent.ts"</span></div>
            <div className="whitespace-pre">  {"}"},</div>
            <div className="whitespace-pre">  <span className="code-syntax-keyword">"dependencies"</span>: {"{"}</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">"axios"</span>: <span className="code-syntax-string">"^1.6.2"</span>,</div>
            <div className="whitespace-pre">    <span className="code-syntax-keyword">"jose"</span>: <span className="code-syntax-string">"^5.1.3"</span></div>
            <div className="whitespace-pre">  {"}"}</div>
            <div className="whitespace-pre">{"}"}</div>
          </div>
        </div>
      );
    }

    return <div className="p-md">No file opened in editor.</div>;
  };

  const handleGenerateTests = () => {
    alert('Mock: AST parsing completed. Test skeleton added to ReviewAgent.test.js.');
    setConsoleLogs(prev => [
      ...prev,
      { type: 'info', text: '➜ Generated tests skeleton for ReviewAgent.js' }
    ]);
    setSuggestionDismissed(true);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Editor Main Section */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
        <div className="flex h-[36px] bg-surface-container-low border-b border-outline-variant shrink-0">
          {openFiles.map(name => {
            const workspacePath = fromWorkspaceTabId(name);
            const workspaceFile = workspacePath
              ? workspaceFiles.find(file => file.path === workspacePath)
              : null;
            const displayName = workspaceFile?.name ?? getBaseName(workspacePath ?? name);
            const isActive = name === activeFile;
            return (
              <div 
                key={name}
                onClick={() => handleActivateTab(name)}
                className={`flex items-center px-3 gap-2 border-r border-outline-variant cursor-pointer group transition-colors ${isActive ? 'bg-surface-container border-t-2 border-primary text-primary' : 'bg-surface-container-lowest border-t-2 border-transparent text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined text-[14px]">{getFileIcon(displayName, workspaceFile?.type)}</span>
                <span className="font-body-sm text-body-sm truncate max-w-[120px]">{displayName}</span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    const filtered = openFiles.filter(f => f !== name);
                    setOpenFiles(filtered);
                    if (activeFile === name) {
                      handleActivateTab(filtered[0] || '');
                    }
                  }}
                  className="material-symbols-outlined text-[14px] text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error transition-opacity"
                >
                  close
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Editor Breadcrumbs */}
        <div className="flex items-center h-7 px-sm bg-surface-container-low border-b border-outline-variant shrink-0 gap-1 text-xs text-on-surface-variant">
          {activeBreadcrumbParts.map((part, index) => (
            <span key={`${part}-${index}`} className="contents">
              {index > 0 && (
                <span className="material-symbols-outlined text-[12px] text-outline-variant">chevron_right</span>
              )}
              <span className={index === activeBreadcrumbParts.length - 1 ? 'text-primary truncate' : 'truncate'}>{part}</span>
            </span>
          ))}
          <span className={`ml-auto rounded-sm border px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide ${editorMode.className}`}>
            {editorMode.label}
          </span>
        </div>

        {workspaceStatus === 'demo' && (
          <div className="shrink-0 border-b border-tertiary/30 bg-tertiary/10 px-sm py-1.5 text-xs text-tertiary">
            {workspaceMessage}
          </div>
        )}
        
        {/* Code Canvas */}
        <div className="flex-1 overflow-auto bg-[#020617] p-4 relative">
          {getCodeContent()}
        </div>
      </div>
      
      {/* Right Sidebar: Agent Console */}
      <aside className="w-80 bg-surface-container-low border-l border-outline-variant flex flex-col shrink-0">
        <div className="h-8 flex items-center px-sm border-b border-outline-variant bg-surface-container shrink-0 text-xs text-on-surface-variant font-label-caps uppercase">
          <span>Review Agent Console</span>
          <span className="ml-auto rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">Sample</span>
        </div>
        
        {/* Agent Activity Card */}
        <div className="m-sm border border-primary/50 bg-surface-container rounded overflow-hidden flex flex-col shadow-[0_0_15px_rgba(171,199,255,0.05)] text-on-surface">
          <div className="w-full h-[2px] bg-primary/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-full bg-primary w-1/3 pulse-slide-bar rounded-r-full"></div>
          </div>
          <div className="p-sm flex items-center gap-2 border-b border-outline-variant/50 bg-surface-container-high">
            <span className="material-symbols-outlined text-primary text-[18px] animate-pulse">psychiatry</span>
            <span className="font-body-sm text-body-sm text-primary font-bold">Analyzing Diff Context</span>
          </div>
          <div className="p-sm bg-[#060e20] font-code-sm text-code-sm text-on-surface-variant flex flex-col gap-1 max-h-40 overflow-y-auto">
            {consoleLogs.map((log, index) => (
              <div 
                key={index} 
                className={`${log.type === 'pulse' ? 'animate-pulse' : ''} ${log.type === 'warn' ? 'text-tertiary' : ''} ${log.type === 'info' ? 'text-on-surface-variant' : ''}`}
              >
                {log.text}
              </div>
            ))}
          </div>
        </div>
        
        {/* Suggestions Panel */}
        <div className="flex-grow overflow-y-auto p-sm space-y-sm">
          <section className="border border-outline-variant rounded bg-surface-container overflow-hidden">
            <div className="flex items-center gap-2 border-b border-outline-variant/60 bg-surface-container-high px-2 py-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">folder_open</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant uppercase text-xs">Workspace Files</span>
              <span className={`ml-auto rounded-sm border px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide ${workspaceStatus === 'ready' ? 'border-secondary/40 bg-secondary/10 text-secondary' : workspaceStatus === 'loading' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-tertiary/40 bg-tertiary/10 text-tertiary'}`}>
                {workspaceStatus === 'ready' ? 'Live' : workspaceStatus === 'loading' ? 'Loading' : 'Demo'}
              </span>
            </div>

            <div className="p-2">
              {workspaceStatus === 'loading' && (
                <div className="text-xs text-on-surface-variant animate-pulse">
                  Checking /api/workspace/files...
                </div>
              )}

              {workspaceStatus === 'demo' && (
                <div className="text-xs text-tertiary">
                  {workspaceMessage}
                </div>
              )}

              {workspaceStatus === 'ready' && (
                <>
                  <div className="text-[11px] text-on-surface-variant mb-2">{workspaceMessage}</div>
                  <div className="max-h-56 overflow-y-auto">
                    {workspaceFiles.map(file => {
                      const tabId = toWorkspaceTabId(file.path);
                      const isDirectory = file.type === 'directory';
                      const isActive = activeFile === tabId;

                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => handleOpenWorkspaceFile(file)}
                          disabled={isDirectory}
                          title={file.path}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-sm transition-colors ${isActive ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface'} ${isDirectory ? 'cursor-default opacity-70 hover:bg-transparent hover:text-on-surface-variant' : ''}`}
                        >
                          <span className="material-symbols-outlined text-[15px] shrink-0">{getFileIcon(file.name, file.type)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-body-sm text-xs">{file.name}</span>
                            <span className="block truncate text-[10px] text-on-surface-variant/70">{file.path}</span>
                          </span>
                          {file.size !== null && (
                            <span className="text-[10px] text-on-surface-variant/70 shrink-0">{formatFileSize(file.size)}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </section>

          {!hasActiveRealFileContent && !suggestionDismissed && (
            <>
              <h4 className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2 text-xs">Initial Findings</h4>
              <div className="p-2 border border-outline-variant rounded bg-surface-variant text-body-sm font-body-sm text-on-surface">
                <div className="flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">warning</span>
                  <span className="font-bold text-xs">Test Coverage Warning</span>
                </div>
                <p className="text-on-surface-variant text-xs mt-1">The newly injected `indexer` dependency requires updated unit tests in `ReviewAgent.test.js`. Shall I generate a test suite template?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={handleGenerateTests} className="bg-primary hover:bg-primary-container text-on-primary text-[10px] px-2 py-1 rounded font-bold transition-colors">Generate Tests</button>
                  <button onClick={() => setSuggestionDismissed(true)} className="border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest text-[10px] px-2 py-1 rounded transition-colors">Dismiss</button>
                </div>
              </div>
            </>
          )}
        </div>
        
        {/* Command console input */}
        <div className="p-sm border-t border-outline-variant bg-surface-container shrink-0">
          <div className="relative group">
            <input 
              className="w-full bg-surface-dim border border-outline-variant rounded-md pl-3 pr-8 py-2 font-body-sm text-body-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-on-surface-variant/50 focus:ring-0" 
              placeholder="Command Agent..." 
              type="text"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    setConsoleLogs(prev => [...prev, { type: 'info', text: `➜ ${val}` }]);
                    e.currentTarget.value = '';
                    setTimeout(() => {
                      setConsoleLogs(prev => [...prev, { type: 'info', text: `[Agent] Command "${val}" resolved.` }]);
                    }, 800);
                  }
                }
              }}
            />
            <button className="absolute right-2 top-2.5 text-primary hover:text-primary-fixed-dim transition-colors">
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
