import { useState, useRef, useEffect } from 'react';

export default function ChatPane({
  chatMessages,
  onSendMessage,
  isSending = false,
  activeModel,
  setFixApplied
}) {
  const [inputText, setInputText] = useState('');
  const [chatMode, setChatMode] = useState('Plan'); // Plan, Develop, Test
  const [patchStates, setPatchStates] = useState({});
  const messagesEndRef = useRef(null);

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isSending]);

  const getPatchState = (messageIndex) => patchStates[messageIndex] || 'idle';

  const getPatchProposal = (message) => {
    const proposals = message.patchProposals || message.patch_proposals;
    return Array.isArray(proposals) && proposals.length > 0 ? proposals[0] : null;
  };

  const readPatchResponse = async (response) => {
    const text = await response.text();
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  };

  const handleApplyPatchInChat = async (messageIndex, proposal) => {
    setPatchStates(prev => ({ ...prev, [messageIndex]: 'applying' }));

    try {
      const res = proposal
        ? await fetch('/api/patch/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target_file: proposal.target_file || proposal.file,
              original_checksum: proposal.original_checksum,
              replacement: proposal.replacement,
              confirm: true
            })
          })
        : await fetch('/api/apply-fix', { method: 'POST' });
      const data = await readPatchResponse(res);

      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || data.message || 'Patch apply failed.');
      }

      setFixApplied(true);
      setPatchStates(prev => ({ ...prev, [messageIndex]: 'applied' }));
    } catch (error) {
      console.error('Patch apply failed:', error);
      setPatchStates(prev => ({ ...prev, [messageIndex]: 'failed' }));
    }
  };

  const getPatchButtonConfig = (state) => {
    if (state === 'applying') {
      return {
        disabled: true,
        className: 'bg-primary/70 text-on-primary px-sm py-1 rounded text-label-caps font-label-caps font-bold uppercase flex items-center gap-xs cursor-wait',
        icon: 'sync',
        iconClass: 'material-symbols-outlined text-[14px] animate-spin',
        label: 'Applying...'
      };
    }

    if (state === 'applied') {
      return {
        disabled: true,
        className: 'bg-secondary text-on-secondary px-sm py-1 rounded text-label-caps font-label-caps font-bold uppercase flex items-center gap-xs cursor-not-allowed',
        icon: 'done',
        iconClass: 'material-symbols-outlined text-[14px]',
        label: 'Applied'
      };
    }

    if (state === 'failed') {
      return {
        disabled: false,
        className: 'bg-error-container text-on-error-container hover:bg-error/80 transition-colors px-sm py-1 rounded text-label-caps font-label-caps font-bold uppercase flex items-center gap-xs',
        icon: 'error',
        iconClass: 'material-symbols-outlined text-[14px]',
        label: 'Retry'
      };
    }

    return {
      disabled: false,
      className: 'bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors px-sm py-1 rounded text-label-caps font-label-caps font-bold uppercase flex items-center gap-xs',
      icon: 'done_all',
      iconClass: 'material-symbols-outlined text-[14px]',
      label: 'Apply Patch'
    };
  };

  const getLogClassName = (log) => {
    const text = String(log);
    if (text.includes('[ERROR]')) return 'text-error';
    if (text.includes('[WARN]')) return 'text-tertiary';
    return '';
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      <div className="flex-1 flex flex-col h-full bg-background relative">
        {/* Chat Mode Header */}
        <div className="h-12 border-b border-outline-variant flex items-center px-md justify-between bg-surface-container-lowest shrink-0">
          <div className="flex items-center gap-sm bg-surface-container rounded p-[2px] border border-outline-variant">
            {['Plan', 'Develop', 'Test'].map(mode => (
              <button 
                key={mode}
                onClick={() => setChatMode(mode)}
                className={`px-sm py-1 rounded text-body-sm font-semibold transition-all ${chatMode === mode ? 'bg-surface-container-highest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-sm">
            <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">
              Demo chat
            </span>
            <div className="flex items-center gap-xs text-body-sm text-on-surface-variant bg-surface-container px-sm py-1 rounded border border-outline-variant cursor-pointer hover:border-primary transition-colors">
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span>{activeModel}</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </div>
          </div>
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg" id="chat-messages-scroll">
          {chatMessages.map((msg, index) => (
            <div key={index} className="flex gap-md max-w-4xl mx-auto w-full relative">
              {msg.sender === 'user' ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant text-primary font-headline-md text-headline-md font-bold">U</div>
                  <div className="flex flex-col gap-sm pt-1">
                    <div className="font-semibold text-on-surface text-body-base">{msg.name}</div>
                    <div className="text-on-surface-variant text-body-base">{msg.content}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`w-8 h-8 rounded-sm flex items-center justify-center shrink-0 ${msg.error ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`}>
                    <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                  </div>
                  <div className="flex flex-col gap-md pt-1 w-full min-w-0">
                    <div className="flex items-center justify-between">
                      <div className={`font-semibold text-body-base flex items-center gap-sm ${msg.error ? 'text-error' : 'text-primary'}`}>
                        {msg.name}
                        <span className={`flex items-center gap-1 text-body-sm font-normal px-2 py-0.5 rounded-full ${msg.error ? 'text-error bg-error-container/60' : 'text-secondary bg-secondary/10'}`}>
                          <span className={`w-2 h-2 rounded-full ${msg.error ? 'bg-error' : 'bg-secondary animate-pulse'}`}></span>
                          {msg.error ? 'Error' : 'Executed'}
                        </span>
                      </div>
                      <div className="flex gap-sm text-on-surface-variant">
                        <button className="hover:text-primary transition-colors" title="Copy"><span className="material-symbols-outlined text-[18px]">content_copy</span></button>
                        <button className="hover:text-primary transition-colors" title="Like"><span className="material-symbols-outlined text-[18px]">thumb_up</span></button>
                      </div>
                    </div>
                    
                    {/* Live logs output */}
                    {msg.logs?.length > 0 && (
                      <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden relative shadow-sm">
                        <div className="h-[2px] bg-primary w-full absolute top-0 left-0"></div>
                        <div className="px-sm py-xs border-b border-outline-variant bg-surface-container flex items-center gap-xs text-on-surface-variant font-label-caps text-label-caps uppercase text-[10px]">
                          <span className="material-symbols-outlined text-[12px]">terminal</span> Logs Output
                        </div>
                        <div className="p-sm font-code-sm text-code-sm text-on-surface-variant opacity-80 max-h-24 overflow-y-auto">
                          {msg.logs.map((log, lIdx) => (
                            <div key={lIdx} className={getLogClassName(log)}>{String(log)}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="text-on-surface text-body-base leading-relaxed">{msg.content}</div>
                    
                    {/* Patch block */}
                    {(msg.hasPatch || getPatchProposal(msg)) && (
                      <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface-container-lowest flex flex-col mt-2">
                        <div className="flex justify-between items-center px-md py-sm bg-surface-container border-b border-outline-variant">
                          <div className="flex items-center gap-sm text-on-surface-variant font-code-sm text-code-sm">
                            <span className="material-symbols-outlined text-[16px]">description</span>
                            <span>{getPatchProposal(msg)?.target_file || msg.file || 'src/agent.ts'}</span>
                          </div>
                          {(() => {
                            const proposal = getPatchProposal(msg);
                            const patchState = getPatchState(index);
                            const config = getPatchButtonConfig(patchState);
                            return (
                              <button
                                onClick={() => handleApplyPatchInChat(index, proposal)}
                                disabled={config.disabled}
                                className={config.className}
                              >
                                <span className={config.iconClass}>{config.icon}</span>
                                <span>{config.label}</span>
                              </button>
                            );
                          })()}
                        </div>
                        <div className="font-code-base text-code-base overflow-x-auto p-sm">
                          <pre className="m-0 text-on-surface-variant">
                            {getPatchProposal(msg) ? (
                              getPatchProposal(msg).unified_diff || getPatchProposal(msg).explanation || 'Patch proposal has no preview.'
                            ) : (
                              <>
                                <div className="flex diff-removed px-sm"><span className="w-8 text-right mr-sm text-error select-none opacity-50">42</span><span className="text-error">-</span> <span className="pl-2">const response = await api.post('/execute', payload);</span></div>
                                <div className="flex diff-removed px-sm"><span className="w-8 text-right mr-sm text-error select-none opacity-50">43</span><span className="text-error">-</span> <span className="pl-2">return response.data;</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">42</span><span className="text-secondary">+</span> <span className="pl-2">const maxRetries = 3;</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">43</span><span className="text-secondary">+</span> <span className="pl-2">for (let i = 0; i &lt; maxRetries; i++) {"{"}</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">44</span><span className="text-secondary">+</span> <span className="pl-2">  try {"{"}</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">45</span><span className="text-secondary">+</span> <span className="pl-2">    const response = await api.post('/execute', payload);</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">46</span><span className="text-secondary">+</span> <span className="pl-2">    return response.data;</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">47</span><span className="text-secondary">+</span> <span className="pl-2">  {"}"} catch (error) {"{"}</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">48</span><span className="text-secondary">+</span> <span className="pl-2">    if (i === maxRetries - 1) throw error;</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">49</span><span className="text-secondary">+</span> <span className="pl-2">    await new Promise(r =&gt; setTimeout(r, 1000 * Math.pow(2, i)));</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">50</span><span className="text-secondary">+</span> <span className="pl-2">  {"}"}</span></div>
                                <div className="flex diff-added px-sm"><span className="w-8 text-right mr-sm text-secondary select-none opacity-50">51</span><span className="text-secondary">+</span> <span className="pl-2">{"}"}</span></div>
                              </>
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {isSending && (
            <div className="flex gap-md max-w-4xl mx-auto w-full relative" role="status" aria-live="polite">
              <div className="w-8 h-8 rounded-sm bg-primary-container flex items-center justify-center shrink-0 text-on-primary-container">
                <span className="material-symbols-outlined text-[20px] animate-pulse">smart_toy</span>
              </div>
              <div className="flex flex-col gap-md pt-1 w-full min-w-0">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-primary text-body-base flex items-center gap-sm">
                    QA Engine
                    <span className="flex items-center gap-1 text-secondary text-body-sm font-normal bg-secondary/10 px-2 py-0.5 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                      Sending
                    </span>
                  </div>
                </div>
                <div className="bg-surface-container-low border border-outline-variant rounded-lg overflow-hidden relative shadow-sm">
                  <div className="h-[2px] bg-primary w-full absolute top-0 left-0"></div>
                  <div className="px-sm py-xs border-b border-outline-variant bg-surface-container flex items-center gap-xs text-on-surface-variant font-label-caps text-label-caps uppercase text-[10px]">
                    <span className="material-symbols-outlined text-[12px]">terminal</span> Request In Progress
                  </div>
                  <div className="p-sm font-code-sm text-code-sm text-on-surface-variant opacity-80">
                    <div>[INFO] Waiting for /api/chat response...</div>
                  </div>
                </div>
                <div className="text-on-surface-variant text-body-base leading-relaxed">QA Engine is working on it.</div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Chat Input */}
        <div className="p-md border-t border-outline-variant bg-surface-container-lowest shrink-0">
          <div className="max-w-4xl mx-auto relative bg-surface-container border border-outline-variant rounded-xl focus-within:border-primary transition-colors flex flex-col overflow-hidden shadow-sm">
            <textarea 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-none text-body-base text-on-surface resize-none p-md focus:ring-0 placeholder-on-surface-variant/50 min-h-[80px] focus:outline-none"
              placeholder={isSending ? 'Waiting for QA Engine...' : "Message QA Engine or type '/' for commands..."}
            />
            <div className="flex items-center justify-between px-md py-sm bg-surface-container-high border-t border-outline-variant">
              <div className="flex items-center gap-sm">
                <button className="text-on-surface-variant hover:text-primary transition-colors flex items-center gap-xs px-2 py-1 rounded hover:bg-surface-container-highest font-label-caps text-label-caps uppercase text-xs" title="Attach context">
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  <span>Context</span>
                </button>
                <span className="w-px h-4 bg-outline-variant"></span>
                <div 
                  onClick={() => setInputText(prev => prev + ' @src/agent.ts')}
                  className="flex items-center gap-xs text-on-surface-variant font-code-sm text-code-sm cursor-pointer hover:text-on-surface"
                >
                  <span className="bg-surface-container-lowest px-1 rounded border border-outline-variant">@</span>
                  <span>Mention files</span>
                </div>
              </div>
              <button 
                onClick={handleSend}
                disabled={isSending || !inputText.trim()}
                aria-label={isSending ? 'Sending message' : 'Send message'}
                className={`bg-primary text-on-primary transition-colors w-8 h-8 rounded flex items-center justify-center ${isSending || !inputText.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary-fixed'}`}
              >
                <span className={`material-symbols-outlined text-[18px] ${isSending ? 'animate-spin' : ''}`}>{isSending ? 'sync' : 'send'}</span>
              </button>
            </div>
          </div>
          <div className="text-center mt-2 text-on-surface-variant font-body-sm text-body-sm opacity-60">
            AI can make mistakes. Verify critical code changes.
          </div>
        </div>
      </div>
      
      {/* Right Sidebar */}
      <aside className="w-64 bg-surface-container border-l border-outline-variant flex flex-col shrink-0 hidden lg:flex">
        <div className="h-12 border-b border-outline-variant flex items-center px-md font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider justify-between bg-surface-container-high text-xs">
          <span>Active Context</span>
          <button className="hover:text-primary transition-colors" title="Refresh context"><span className="material-symbols-outlined text-[16px]">refresh</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-md space-y-md">
          <div className="bg-surface-container-low border border-outline-variant rounded p-sm relative group hover:border-outline transition-colors">
            <button className="absolute top-1 right-1 text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error transition-all">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
            <div className="flex items-center gap-xs font-code-sm text-code-sm text-primary mb-1">
              <span className="material-symbols-outlined text-[14px]">description</span>
              <span className="truncate pr-4">src/agent.ts</span>
            </div>
            <div className="text-body-sm text-on-surface-variant line-clamp-2 opacity-80 text-xs">
              export class AgentController {'{'} async executeStep() ... {'}'}
            </div>
          </div>
          <div className="bg-surface-container-low border border-outline-variant rounded p-sm relative group hover:border-outline transition-colors">
            <button className="absolute top-1 right-1 text-on-surface-variant opacity-0 group-hover:opacity-100 hover:text-error transition-all">
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
            <div className="flex items-center gap-xs font-code-sm text-code-sm text-tertiary mb-1">
              <span className="material-symbols-outlined text-[14px]">data_object</span>
              <span className="truncate pr-4">types/api.d.ts</span>
            </div>
            <div className="text-body-sm text-on-surface-variant line-clamp-2 opacity-80 text-xs">
              interface APIError {'{'} code: number; message: string; {'}'}
            </div>
          </div>
        </div>
        <div className="p-sm border-t border-outline-variant bg-surface-container-lowest flex justify-between items-center text-label-caps font-label-caps uppercase text-on-surface-variant text-[10px]">
          <span>Tokens Used</span>
          <span className="text-primary font-bold">12.4k / 128k</span>
        </div>
      </aside>
    </div>
  );
}
