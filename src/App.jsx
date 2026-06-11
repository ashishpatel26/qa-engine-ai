import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ChatPane from './components/ChatPane';
import WorkspacePane from './components/WorkspacePane';
import MonitorPane from './components/MonitorPane';
import SuitesPane from './components/SuitesPane';
import ResultsPane from './components/ResultsPane';
import DebugPane from './components/DebugPane';
import TerminalPane from './components/TerminalPane';
import SettingsPane from './components/SettingsPane';

const parseResponseBody = async (response) => {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const formatChatErrorDetail = (detail) => {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(item => item?.message || item?.msg || formatChatErrorDetail(item))
      .filter(Boolean)
      .join('; ');
  }
  if (typeof detail === 'object') {
    return detail.message || detail.error || JSON.stringify(detail);
  }
  return String(detail);
};

const getChatErrorMessage = (data, fallback) => {
  return formatChatErrorDetail(data?.detail || data?.error || data?.message) || fallback;
};

const normalizeChatLogs = (logs) => {
  if (Array.isArray(logs)) return logs;
  if (typeof logs === 'string') return [logs];
  return undefined;
};

const formatCommand = (command) => {
  if (Array.isArray(command)) return command.join(' ');
  return String(command || '');
};

const commandLabel = (command) => command?.label || command?.id || 'Test command';

const inferCommandFramework = (command) => {
  const value = `${command?.id || ''} ${command?.label || ''} ${formatCommand(command?.command)}`.toLowerCase();
  if (value.includes('lint')) return 'ESLint';
  if (value.includes('build')) return 'Vite';
  if (value.includes('audit')) return 'npm audit';
  if (value.includes('pytest')) return 'pytest';
  if (value.includes('py_compile')) return 'Python';
  return 'Shell';
};

const splitOutputLines = (text) => String(text || '').split(/\r?\n/).filter(Boolean);

const classifyOutputLine = (line, fallbackType) => {
  const lower = line.toLowerCase();
  if (lower.includes('error') || lower.includes('failed') || lower.includes('traceback')) return 'error';
  if (lower.includes('passed') || lower.includes('success') || lower.includes('built in')) return 'pass';
  return fallbackType;
};

const buildRunLogs = (run) => {
  const logs = [
    { type: run.status === 'passed' ? 'success' : run.status === 'failed' || run.status === 'timeout' ? 'error' : 'system', text: `[${String(run.status || 'unknown').toUpperCase()}] ${run.command_id || 'test run'}` },
    { type: 'system', text: `$ ${formatCommand(run.command)}` }
  ];

  splitOutputLines(run.stdout).slice(0, 120).forEach((line) => {
    logs.push({ type: classifyOutputLine(line, 'system'), text: line });
  });

  splitOutputLines(run.stderr).slice(0, 120).forEach((line) => {
    logs.push({ type: classifyOutputLine(line, 'error'), text: line });
  });

  if (run.exit_code !== undefined && run.exit_code !== null) {
    logs.push({ type: 'bold', text: `Exit code: ${run.exit_code} | Duration: ${run.duration_ms ?? '--'}ms` });
  }

  return logs;
};

const normalizeCommandId = (text) => text.trim().replace(/^qa\s+run\s+/i, '').trim();

const adaptRunForUi = (run, commandConfig) => {
  if (!run) return null;
  const commandId = run.command_id || run.commandId || commandConfig?.id || '';
  const label = commandConfig?.label || run.suite_name || run.suiteName || commandId || 'Test Run';

  return {
    ...run,
    command_id: commandId,
    suite_id: commandId,
    suite_name: label,
    name: label,
    command: formatCommand(run.command || commandConfig?.command)
  };
};

const buildSuitesFromCommands = (commands, runsByCommandId, runningCommandId) => {
  return commands.map((command) => {
    const latestRun = runsByCommandId[command.id] || null;
    const isRunning = runningCommandId === command.id;

    return {
      id: command.id,
      suite_id: command.id,
      key: command.id,
      name: commandLabel(command),
      label: commandLabel(command),
      framework: inferCommandFramework(command),
      command: formatCommand(command.command),
      runTarget: command.id,
      latestRun: isRunning && latestRun ? { ...latestRun, status: 'running' } : latestRun,
      status: isRunning ? 'running' : latestRun?.status,
      view: 'results'
    };
  });
};

export default function App() {
  // Global Application State
  const [activeTab, setActiveTab] = useState('workspace'); // workspace, chat, monitor, testing, settings
  const [activeView, setActiveView] = useState('explorer'); // explorer, chat, monitor, suites, results, debug, settings, terminal
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [terminalCollapsed, setTerminalCollapsed] = useState(false);
  
  const [activeFile, setActiveFile] = useState('ReviewAgent.js');
  const [openFiles, setOpenFiles] = useState(['ReviewAgent.js', 'agent.ts']);
  const [fixApplied, setFixApplied] = useState(false);
  
  const [runMode, setRunMode] = useState('Planning');
  const [activeModel, setActiveModel] = useState('GPT-4o');
  const [problemsCount, setProblemsCount] = useState(1);
  
  const [servicesConnected, setServicesConnected] = useState({
    Codex: false,
    ClaudeCode: false,
    OpenAI: true,
    Anthropic: false,
    Ollama: false
  });

  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [ollamaConnected, setOllamaConnected] = useState(false);
  const [ollamaModels, setOllamaModels] = useState([]);

  const [chatMessages, setChatMessages] = useState([
    {
      sender: 'user',
      name: 'User',
      content: 'I need you to refactor the agent.ts file to improve error handling during API timeouts. Can you suggest a retry mechanism?'
    },
    {
      sender: 'assistant',
      name: 'QA Engine',
      content: "I've analyzed `agent.ts`. Currently, it fails immediately on API timeouts. I recommend implementing an exponential backoff retry mechanism. Here is the proposed change for the `executeAction` method.",
      logs: [
        '[INFO] Reading src/agent.ts...',
        '[INFO] Analyzing current error handling logic...',
        '[WARN] Found direct axios.post calls without try/catch blocks in executeAction().',
        '[INFO] Searching for existing retry utility... none found.',
        '[INFO] Generating exponential backoff implementation.'
      ],
      hasPatch: true,
      file: 'agent.ts'
    }
  ]);
  const [isChatSending, setIsChatSending] = useState(false);

  const [terminalLogs, setTerminalLogs] = useState([]);
  const [testCommands, setTestCommands] = useState([]);
  const [testRuns, setTestRuns] = useState([]);
  const [latestRun, setLatestRun] = useState(null);
  const [runningCommandId, setRunningCommandId] = useState('');
  const [testApiStatus, setTestApiStatus] = useState('loading');

  // Sync state with FastAPI backend
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then(data => {
        if (data.fix_applied) setFixApplied(true);
        if (data.services_connected) {
          setServicesConnected(prev => ({
            ...prev,
            Codex: data.services_connected.Codex,
            ClaudeCode: data.services_connected.ClaudeCode,
            Ollama: data.services_connected.Ollama || false
          }));
        }
        if (data.ollama_host) setOllamaHost(data.ollama_host);
        if (data.ollama_connected !== undefined) setOllamaConnected(data.ollama_connected);
        if (data.ollama_models) setOllamaModels(data.ollama_models);
      })
      .catch(err => console.log('Backend connection offline, using mock states: ', err));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadTestApiState = async () => {
      try {
        const [commandsResponse, runsResponse] = await Promise.all([
          fetch('/api/test-commands'),
          fetch('/api/test-runs')
        ]);
        const commandsData = await parseResponseBody(commandsResponse);
        const runsData = await parseResponseBody(runsResponse);

        if (!commandsResponse.ok) {
          throw new Error(getChatErrorMessage(commandsData, 'Unable to load test commands.'));
        }
        if (!runsResponse.ok) {
          throw new Error(getChatErrorMessage(runsData, 'Unable to load test run history.'));
        }

        if (!cancelled) {
          const commands = Array.isArray(commandsData.commands) ? commandsData.commands : [];
          const runs = Array.isArray(runsData.runs) ? runsData.runs : [];
          setTestCommands(commands);
          setTestRuns(runs);
          setLatestRun(runs[0] || null);
          setTestApiStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setTestApiStatus('offline');
          setTerminalLogs(prev => [
            ...prev,
            { type: 'error', text: `[TEST API] ${error.message}` }
          ]);
        }
      }
    };

    loadTestApiState();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectService = (service) => {
    fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setServicesConnected(prev => ({ ...prev, [service]: true }));
        }
      })
      .catch(() => {
        setServicesConnected(prev => ({ ...prev, [service]: true }));
      });
  };

  const handleDisconnectService = (service) => {
    setServicesConnected(prev => ({ ...prev, [service]: false }));
  };

  const findTestCommand = (text, suite) => {
    const normalizedText = normalizeCommandId(text).toLowerCase();
    const suiteId = suite?.id || suite?.command_id || suite?.commandId;
    const suiteCommand = suite?.command ? formatCommand(suite.command).toLowerCase() : '';

    return testCommands.find((item) => {
      const itemCommand = formatCommand(item.command).toLowerCase();
      return String(item.id).toLowerCase() === normalizedText
        || String(item.label || '').toLowerCase() === normalizedText
        || itemCommand === normalizedText
        || itemCommand.endsWith(normalizedText)
        || String(item.id).toLowerCase() === String(suiteId || '').toLowerCase()
        || (suiteCommand && itemCommand === suiteCommand);
    });
  };

  const mergeRunHistory = (run) => {
    setLatestRun(run);
    setTestRuns(prev => [run, ...prev.filter(item => item.id !== run.id)]);
  };

  const runConfiguredTest = async (commandConfig, inputText) => {
    if (!commandConfig || runningCommandId) return;

    const optimisticRun = {
      id: `running-${commandConfig.id}-${Date.now()}`,
      command_id: commandConfig.id,
      command: commandConfig.command,
      status: 'running',
      exit_code: null,
      stdout: '',
      stderr: '',
      duration_ms: null,
      started_at: new Date().toISOString()
    };

    setRunningCommandId(commandConfig.id);
    mergeRunHistory(optimisticRun);
    setActiveView('results');
    setTerminalLogs(prev => [
      ...prev,
      { type: 'input', text: inputText || `qa run ${commandConfig.id}` },
      { type: 'system', text: `[RUNNING] ${commandLabel(commandConfig)}` },
      { type: 'system', text: `$ ${formatCommand(commandConfig.command)}` }
    ]);

    try {
      const response = await fetch('/api/test-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command_id: commandConfig.id })
      });
      const data = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(getChatErrorMessage(data, `Test run failed with status ${response.status}.`));
      }

      mergeRunHistory(data);
      setTerminalLogs(prev => [
        ...prev,
        ...buildRunLogs(data)
      ]);
    } catch (error) {
      const failedRun = {
        ...optimisticRun,
        status: 'failed',
        stderr: error.message,
        duration_ms: 0
      };
      mergeRunHistory(failedRun);
      setTerminalLogs(prev => [
        ...prev,
        { type: 'error', text: `[TEST API] ${error.message}` }
      ]);
    } finally {
      setRunningCommandId('');
    }
  };

  const executeTerminalCmd = (command) => {
    const text = command.trim();
    if (!text) return;

    if (text === 'clear') {
      setTerminalLogs([]);
      return;
    }

    const matchedCommand = findTestCommand(text);
    if (matchedCommand) {
      runConfiguredTest(matchedCommand, text);
    } else if (text.toLowerCase().includes('explain')) {
      setTerminalLogs(prev => [...prev, { type: 'input', text }]);
      setTimeout(() => {
        setTerminalLogs(prev => [
          ...prev,
          { type: 'bold', text: '🤖 Parsing src/agent.ts...' },
          { type: 'system', text: 'AgentController orchestrates autonomous execution loops.' },
          { type: 'pass', text: '├─ executeStep() -> LLM evaluation' },
          { type: 'pass', text: '└─ toolChain.execute() -> executes actions' }
        ]);
      }, 500);
    } else if (text.toLowerCase() === 'help') {
      setTerminalLogs(prev => [
        ...prev,
        { type: 'input', text },
        { type: 'bold', text: 'Available commands:' },
        { type: 'system', text: `  test API: ${testApiStatus}` },
        ...testCommands.map(item => ({ type: 'system', text: `  qa run ${item.id} - ${commandLabel(item)}` })),
        { type: 'system', text: '  qa explain <file> - Shows a local walkthrough' },
        { type: 'system', text: '  clear - Clears console' },
        { type: 'system', text: '  help - Prints help' }
      ]);
    } else {
      setTerminalLogs(prev => [
        ...prev,
        { type: 'input', text },
        { type: 'system', text: `bash: command not found: ${text}. Type 'help' for suggestions.` }
      ]);
    }
  };

  const handleRunSuite = (runTarget, suite) => {
    const commandConfig = findTestCommand(String(runTarget || ''), suite);
    if (!commandConfig) {
      setTerminalLogs(prev => [
        ...prev,
        { type: 'error', text: `[TEST API] No approved command matched ${runTarget || 'that suite'}.` }
      ]);
      return;
    }
    runConfiguredTest(commandConfig, `qa run ${commandConfig.id}`);
  };

  const handleSendChatMessage = async (text) => {
    const message = text.trim();
    if (!message || isChatSending) return;

    setChatMessages(prev => [...prev, { sender: 'user', name: 'User', content: message }]);
    setIsChatSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model: activeModel })
      });
      const data = await parseResponseBody(response);

      if (!response.ok) {
        throw new Error(getChatErrorMessage(data, `Chat request failed with status ${response.status}.`));
      }

      if (data.detail || data.error || (!data.content && data.message)) {
        throw new Error(getChatErrorMessage(data, 'Chat request failed.'));
      }

      if (!data.content) {
        throw new Error('Chat service returned an empty response.');
      }

      setChatMessages(prev => [
        ...prev,
        {
          sender: data.sender || 'assistant',
          name: data.name || 'QA Engine',
          content: data.content,
          logs: normalizeChatLogs(data.logs),
          hasPatch: Boolean(data.has_patch ?? data.hasPatch),
          file: data.file,
          source: data.source,
          provider: data.provider,
          model: data.model,
          patchProposals: Array.isArray(data.patch_proposals) ? data.patch_proposals : []
        }
      ]);
    } catch (error) {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'assistant',
          name: 'QA Engine',
          content: `Chat request failed: ${error.message}`,
          logs: [`[ERROR] ${error.message}`],
          error: true
        }
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  // Synchronize dynamic tab-to-view states
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'chat') setActiveView('chat');
    else if (tabId === 'workspace') setActiveView('explorer');
    else if (tabId === 'monitor') setActiveView('monitor');
    else if (tabId === 'testing') setActiveView('suites');
    else if (tabId === 'settings') setActiveView('settings');
  };

  const commandLookup = Object.fromEntries(testCommands.map(command => [command.id, command]));
  const adaptedTestRuns = testRuns.map(run => adaptRunForUi(run, commandLookup[run.command_id])).filter(Boolean);
  const latestRunForResults = adaptRunForUi(latestRun, commandLookup[latestRun?.command_id]);
  const latestRunsByCommandId = adaptedTestRuns.reduce((acc, run) => {
    if (run.command_id && !acc[run.command_id]) acc[run.command_id] = run;
    return acc;
  }, {});
  const configuredSuites = buildSuitesFromCommands(testCommands, latestRunsByCommandId, runningCommandId);

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      activeView={activeView}
      setActiveView={setActiveView}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      terminalCollapsed={terminalCollapsed}
      setTerminalCollapsed={setTerminalCollapsed}
      activeFile={activeFile}
      setActiveFile={setActiveFile}
      openFiles={openFiles}
      setOpenFiles={setOpenFiles}
      runMode={runMode}
      setRunMode={setRunMode}
      activeModel={activeModel}
      setActiveModel={setActiveModel}
      problemsCount={problemsCount}
      fixApplied={fixApplied}
      ollamaModels={ollamaModels}
    >
      {/* Dynamic Pane Switcher */}
      {activeView === 'chat' && (
        <ChatPane
          chatMessages={chatMessages}
          onSendMessage={handleSendChatMessage}
          isSending={isChatSending}
          activeModel={activeModel}
          setFixApplied={setFixApplied}
        />
      )}
      
      {activeView === 'explorer' && (
        <WorkspacePane
          activeFile={activeFile}
          setActiveFile={setActiveFile}
          openFiles={openFiles}
          setOpenFiles={setOpenFiles}
          fixApplied={fixApplied}
        />
      )}
      
      {activeView === 'monitor' && (
        <MonitorPane
          fixApplied={fixApplied}
        />
      )}
      
      {activeView === 'suites' && (
        <SuitesPane
          fixApplied={fixApplied}
          setActiveView={setActiveView}
          onRunSuite={handleRunSuite}
          suites={configuredSuites}
          runs={adaptedTestRuns}
        />
      )}
      
      {activeView === 'results' && (
        <ResultsPane
          fixApplied={fixApplied}
          setActiveView={setActiveView}
          latestRun={latestRunForResults}
        />
      )}
      
      {activeView === 'debug' && (
        <DebugPane
          fixApplied={fixApplied}
          onPatchApplied={() => {
            setFixApplied(true);
            setProblemsCount(0);
          }}
          setActiveView={setActiveView}
        />
      )}
      
      {activeView === 'terminal' && (
        <TerminalPane
          fullScreen={true}
          terminalLogs={terminalLogs}
          onExecuteCmd={executeTerminalCmd}
          setTerminalLogs={setTerminalLogs}
        />
      )}
      
      {activeView === 'settings' && (
        <SettingsPane
          servicesConnected={servicesConnected}
          onConnect={handleConnectService}
          onDisconnect={handleDisconnectService}
          ollamaHost={ollamaHost}
          setOllamaHost={setOllamaHost}
          ollamaConnected={ollamaConnected}
          setOllamaConnected={setOllamaConnected}
          ollamaModels={ollamaModels}
          setOllamaModels={setOllamaModels}
          setServicesConnected={setServicesConnected}
        />
      )}
      
      {/* Shared bottom drawer terminal */}
      {!terminalCollapsed && activeView !== 'terminal' && (
        <TerminalPane
          fullScreen={false}
          terminalLogs={terminalLogs}
          onExecuteCmd={executeTerminalCmd}
          setTerminalLogs={setTerminalLogs}
          problemsCount={problemsCount}
          setTerminalCollapsed={setTerminalCollapsed}
          setActiveView={setActiveView}
        />
      )}
    </Layout>
  );
}
