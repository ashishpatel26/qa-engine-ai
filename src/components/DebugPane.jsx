import { useState } from 'react';

const EMPTY_FORM = {
  targetFile: '',
  find: '',
  replace: '',
  explanation: ''
};

function normalizeProposal(value) {
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  if (value && typeof value === 'object') return value;
  return null;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function getErrorMessage(data, fallback) {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail)) {
    return data.detail
      .map(item => item?.msg || item?.message || JSON.stringify(item))
      .join('; ');
  }
  return data?.error || data?.message || fallback;
}

function getProposalTarget(proposal) {
  return proposal?.target_file || proposal?.file || '';
}

function getDiffLineClass(line) {
  if (line.startsWith('@@')) return 'text-primary bg-primary/10';
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-secondary bg-secondary/10';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-error bg-error/10';
  if (line.startsWith('+++') || line.startsWith('---')) return 'text-on-surface bg-surface-container-high';
  return 'text-on-surface-variant';
}

export default function DebugPane({
  fixApplied,
  setActiveView,
  onPatchApplied,
  patchProposal = null,
  patchProposals = null
}) {
  const incomingProposal = normalizeProposal(patchProposal) || normalizeProposal(patchProposals);
  const [form, setForm] = useState(EMPTY_FORM);
  const [proposal, setProposal] = useState(null);
  const [status, setStatus] = useState(incomingProposal ? 'ready' : 'idle');
  const [statusMessage, setStatusMessage] = useState(incomingProposal ? 'Loaded a patch proposal for review.' : '');

  const activeProposal = proposal || incomingProposal;
  const displayStatus = activeProposal && status === 'idle' ? 'ready' : status;
  const targetFile = getProposalTarget(activeProposal);
  const canApply = Boolean(
    activeProposal &&
    targetFile &&
    activeProposal.original_checksum &&
    activeProposal.replacement &&
    status !== 'applying' &&
    status !== 'applied'
  );
  const canCreateProposal = Boolean(form.targetFile.trim() && form.find && status !== 'proposing');
  const hasIncomingProposal = Boolean(incomingProposal);

  const updateForm = (field) => (event) => {
    setForm(prev => ({ ...prev, [field]: event.target.value }));
  };

  const handleCreateProposal = async (event) => {
    event.preventDefault();
    if (!form.targetFile.trim() || !form.find) {
      setStatus('error');
      setStatusMessage('Target file and find text are required.');
      return;
    }

    setStatus('proposing');
    setStatusMessage('');

    try {
      const response = await fetch('/api/patch/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_file: form.targetFile.trim(),
          find: form.find,
          replace: form.replace,
          explanation: form.explanation.trim()
        })
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(data, 'Patch proposal failed.'));
      }

      setProposal(data);
      setStatus('ready');
      setStatusMessage(`Proposal created for ${data.target_file || form.targetFile.trim()}.`);
    } catch (error) {
      setStatus('error');
      setStatusMessage(error.message || 'Patch proposal failed.');
    }
  };

  const handleApplyProposal = async () => {
    if (!canApply) {
      setStatus('error');
      setStatusMessage('Create or load a valid patch proposal before applying.');
      return;
    }

    setStatus('applying');
    setStatusMessage('');

    try {
      const response = await fetch('/api/patch/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_file: targetFile,
          original_checksum: activeProposal.original_checksum,
          replacement: activeProposal.replacement,
          confirm: true
        })
      });
      const data = await readJsonResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, 'Patch apply failed.'));
      }

      setStatus('applied');
      setStatusMessage(`Applied patch to ${data.path || targetFile}.`);
      onPatchApplied?.(data);
    } catch (error) {
      setStatus('error');
      setStatusMessage(error.message || 'Patch apply failed.');
    }
  };

  const renderDiffPreview = () => {
    if (!activeProposal) {
      return (
        <div className="h-full min-h-[260px] flex items-center justify-center p-lg text-center text-on-surface-variant">
          <div className="max-w-md">
            <div className="material-symbols-outlined text-[40px] text-primary mb-sm">difference</div>
            <p className="font-body-base text-body-base">
              No real proposal is loaded yet. Create one from workspace text to preview the unified diff here.
            </p>
          </div>
        </div>
      );
    }

    const diff = activeProposal.unified_diff || activeProposal.explanation || 'Patch proposal has no preview.';
    return (
      <div className="font-code-base text-code-base text-xs overflow-auto">
        {diff.split('\n').map((line, index) => (
          <div key={`${index}-${line}`} className={`flex min-w-max px-sm ${getDiffLineClass(line)}`}>
            <span className="w-10 shrink-0 select-none text-right pr-sm opacity-50">{index + 1}</span>
            <span className="whitespace-pre">{line || ' '}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-lg bg-[#020617] h-full text-on-surface">
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={() => setActiveView('results')}
            className="bg-surface-container p-sm rounded border border-outline-variant flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            title="Back to Results"
            aria-label="Back to results"
          >
            <span className="material-symbols-outlined text-primary text-[24px]">chevron_left</span>
          </button>
          <div>
            <div className="flex items-center gap-sm mb-unit flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase border ${fixApplied || status === 'applied' ? 'bg-secondary-container text-on-secondary-container border-secondary/30' : 'bg-error-container text-on-error-container border-error/30'}`}>
                {fixApplied || status === 'applied' ? 'Patch Applied' : 'Patch Pending'}
              </span>
              <span className="rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-primary">Real patch API</span>
              {!hasIncomingProposal && (
                <span className="rounded-sm border border-tertiary/40 bg-tertiary/10 px-1.5 py-[1px] font-label-caps text-[9px] font-bold uppercase tracking-wide text-tertiary">
                  Manual proposal
                </span>
              )}
            </div>
            <h1 className="font-headline-lg text-headline-lg font-bold">Patch Debugger</h1>
            <p className="text-on-surface-variant font-body-sm text-body-sm mt-xs">
              {targetFile || 'Create a workspace patch proposal, preview it, then apply it with checksum validation.'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-on-surface-variant font-body-sm text-body-sm block">Endpoint: /api/patch/proposals</span>
          <span className="text-on-surface-variant font-body-sm text-body-sm block">Apply: /api/patch/apply</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-lg flex-1 min-h-0">
        <form
          onSubmit={handleCreateProposal}
          className="bg-surface-container-high border border-outline-variant rounded-lg overflow-hidden flex flex-col min-h-[520px]"
        >
          <div className={`w-full relative top-0 ${status === 'error' ? 'h-[2px] bg-error shadow-[0_0_10px_rgba(239,68,68,0.7)]' : status === 'applied' ? 'h-[2px] bg-secondary shadow-[0_0_10px_rgba(78,222,163,0.8)]' : status === 'proposing' || status === 'applying' ? 'agent-pulse' : 'h-[2px] bg-primary'}`}></div>
          <div className="p-md border-b border-outline-variant flex items-center justify-between gap-sm bg-surface-container-highest">
            <div className="flex items-center gap-sm min-w-0">
              <span className="material-symbols-outlined text-primary text-[20px]">rule_settings</span>
              <h2 className="font-headline-md text-headline-md font-bold truncate">Proposal Input</h2>
            </div>
            <span className="font-label-caps text-label-caps uppercase text-[10px] text-on-surface-variant">
              {displayStatus}
            </span>
          </div>

          <div className="p-md flex flex-col gap-md">
            {hasIncomingProposal && (
              <div className="border border-secondary/30 bg-secondary/10 text-secondary rounded p-sm text-body-sm">
                A patch proposal was passed into this pane. The form can still create a new proposal if needed.
              </div>
            )}

            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Target file</span>
              <input
                value={form.targetFile}
                onChange={updateForm('targetFile')}
                className="bg-[#0b1326] border border-outline-variant rounded px-sm py-sm text-on-surface font-code-sm text-code-sm focus:outline-none focus:border-primary"
                placeholder="src/example.js"
                autoComplete="off"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Find text</span>
              <textarea
                value={form.find}
                onChange={updateForm('find')}
                className="bg-[#0b1326] border border-outline-variant rounded px-sm py-sm text-on-surface font-code-sm text-code-sm resize-y min-h-[110px] focus:outline-none focus:border-primary"
                placeholder="Exact text currently in the file"
                spellCheck="false"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Replace with</span>
              <textarea
                value={form.replace}
                onChange={updateForm('replace')}
                className="bg-[#0b1326] border border-outline-variant rounded px-sm py-sm text-on-surface font-code-sm text-code-sm resize-y min-h-[110px] focus:outline-none focus:border-primary"
                placeholder="Replacement text"
                spellCheck="false"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">Explanation</span>
              <input
                value={form.explanation}
                onChange={updateForm('explanation')}
                className="bg-[#0b1326] border border-outline-variant rounded px-sm py-sm text-on-surface font-body-sm text-body-sm focus:outline-none focus:border-primary"
                placeholder="Why this patch is needed"
                autoComplete="off"
              />
            </label>

            {statusMessage && (
              <div className={`border rounded p-sm text-body-sm ${status === 'error' ? 'border-error/40 bg-error-container/40 text-on-error-container' : 'border-outline-variant bg-surface-container text-on-surface-variant'}`}>
                {statusMessage}
              </div>
            )}
          </div>

          <div className="mt-auto p-md border-t border-outline-variant bg-surface-container-highest flex items-center justify-between gap-md">
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="bg-transparent border border-outline-variant text-on-surface hover:bg-surface-variant font-body-base px-md py-sm rounded transition-colors flex items-center gap-sm"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              <span>Reset</span>
            </button>
            <button
              type="submit"
              disabled={!canCreateProposal}
              className="bg-primary text-on-primary hover:bg-primary-fixed font-body-base font-semibold px-md py-sm rounded transition-colors flex items-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className={`material-symbols-outlined text-[18px] ${status === 'proposing' ? 'animate-spin' : ''}`}>
                {status === 'proposing' ? 'sync' : 'difference'}
              </span>
              <span>{status === 'proposing' ? 'Creating...' : 'Create Proposal'}</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col bg-surface-container-high border border-outline-variant rounded-lg overflow-hidden min-h-[520px]">
          <div className="flex bg-surface-container-highest border-b border-outline-variant min-h-[44px] text-xs items-center justify-between gap-md px-md">
            <div className="flex items-center gap-sm min-w-0">
              <span className="material-symbols-outlined text-[16px] text-secondary">auto_fix_high</span>
              <span className="font-body-sm text-body-sm text-on-surface truncate">
                {targetFile || 'Unified diff preview'}
              </span>
            </div>
            {activeProposal?.id && (
              <span className="font-code-sm text-code-sm text-on-surface-variant truncate">ID: {activeProposal.id}</span>
            )}
          </div>

          <div className="flex-1 bg-[#020617] overflow-hidden">
            {renderDiffPreview()}
          </div>

          {activeProposal?.explanation && (
            <div className="border-t border-outline-variant bg-surface-container p-md text-on-surface-variant text-body-sm">
              <strong className="text-on-surface">Explanation:</strong> {activeProposal.explanation}
            </div>
          )}

          <div className="bg-surface-container-highest border-t border-outline-variant p-md flex items-center justify-between shrink-0 text-sm gap-md">
            <div className="flex items-center gap-sm min-w-0">
              <span className={`material-symbols-outlined text-[20px] ${status === 'applied' ? 'text-secondary' : status === 'error' ? 'text-error' : 'text-tertiary'}`}>
                {status === 'applied' ? 'check_circle' : status === 'error' ? 'error' : 'pending'}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {status === 'applied'
                  ? 'Patch applied through the real backend.'
                  : activeProposal
                    ? 'Proposal is ready for checksum-validated apply.'
                    : 'Waiting for a real proposal.'}
              </span>
            </div>
            <div className="flex gap-md">
              <button
                type="button"
                onClick={() => setActiveView('results')}
                className="bg-transparent border border-outline-variant text-on-surface hover:bg-surface-variant font-body-base px-xl py-sm rounded transition-colors flex items-center gap-sm"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleApplyProposal}
                disabled={!canApply}
                className="bg-primary text-on-primary hover:bg-primary-fixed font-body-base font-semibold px-xl py-sm rounded transition-colors flex items-center gap-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className={`material-symbols-outlined text-[18px] ${status === 'applying' ? 'animate-spin' : ''}`}>
                  {status === 'applying' ? 'sync' : status === 'applied' ? 'done' : 'done_all'}
                </span>
                <span>{status === 'applying' ? 'Applying...' : status === 'applied' ? 'Applied' : 'Apply Patch'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
