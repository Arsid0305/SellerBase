'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  HYPOTHESIS_STATUS_LABEL,
  PROBLEM_SEVERITY_LABEL,
  PROBLEM_STATUS_LABEL,
  type ProblemDetail,
  type ProblemSeverity,
  type ProblemStatus,
  type HypothesisStatus,
} from '@/entities/investigations';

type Props = {
  detail: ProblemDetail;
};

const SEVERITY_STYLES: Record<ProblemSeverity, string> = {
  low: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  med: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  critical: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_STYLES: Record<ProblemStatus, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200',
  investigating: 'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const HYPOTHESIS_STATUS_STYLES: Record<HypothesisStatus, string> = {
  proposed: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  testing: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
};

function confidenceBg(c: number): string {
  // linear gradient from sky to emerald based on confidence
  const pct = Math.max(0, Math.min(100, c));
  return `linear-gradient(90deg, rgb(186 230 253) 0%, rgb(110 231 183) ${pct}%, rgb(245 245 245) ${pct}%, rgb(245 245 245) 100%)`;
}

export function InvestigationBoard({ detail }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { problem, investigations } = detail;

  const [busy, setBusy] = useState(false);
  const [addingInv, setAddingInv] = useState(false);
  const [invNotes, setInvNotes] = useState('');

  const [causeOpenFor, setCauseOpenFor] = useState<number | null>(null);
  const [causeTitle, setCauseTitle] = useState('');
  const [causeDesc, setCauseDesc] = useState('');
  const [causeConfidence, setCauseConfidence] = useState(50);

  const [hypOpenFor, setHypOpenFor] = useState<number | null>(null);
  const [hypStatement, setHypStatement] = useState('');
  const [hypPlan, setHypPlan] = useState('');

  async function refresh() {
    startTransition(() => router.refresh());
  }

  async function createInvestigation() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/investigations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ problemId: problem.id, notes: invNotes.trim() || null }),
      });
      setInvNotes('');
      setAddingInv(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createCause(investigationId: number) {
    if (busy || !causeTitle.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/causes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          investigationId,
          title: causeTitle.trim(),
          description: causeDesc.trim() || null,
          confidence: causeConfidence,
        }),
      });
      setCauseTitle('');
      setCauseDesc('');
      setCauseConfidence(50);
      setCauseOpenFor(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createHypothesis(causeId: number) {
    if (busy || !hypStatement.trim()) return;
    setBusy(true);
    try {
      await fetch('/api/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          causeId,
          statement: hypStatement.trim(),
          testPlan: hypPlan.trim() || null,
        }),
      });
      setHypStatement('');
      setHypPlan('');
      setHypOpenFor(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resolveHypothesis(id: number, status: HypothesisStatus) {
    const result = prompt(
      status === 'confirmed' ? 'Итог проверки (что подтвердилось)' : 'Почему отклонена',
    );
    if (result === null) return;
    setBusy(true);
    try {
      await fetch('/api/hypotheses', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, status, result }),
      });
      if (status === 'confirmed') {
        const knowledgeTitle = prompt('Заголовок знания (или Отмена чтобы пропустить)');
        if (knowledgeTitle && knowledgeTitle.trim()) {
          await fetch('/api/knowledge', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              hypothesisId: id,
              title: knowledgeTitle.trim(),
              insight: result,
            }),
          });
        }
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-base font-semibold text-neutral-900">{problem.title}</div>
            {problem.description ? (
              <p className="text-sm leading-relaxed text-neutral-600">{problem.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="outline" className={SEVERITY_STYLES[problem.severity]}>
              {PROBLEM_SEVERITY_LABEL[problem.severity]}
            </Badge>
            <Badge variant="outline" className={STATUS_STYLES[problem.status]}>
              {PROBLEM_STATUS_LABEL[problem.status]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-neutral-900">
            Расследования ({investigations.length})
          </div>
          {!addingInv ? (
            <Button size="sm" variant="outline" onClick={() => setAddingInv(true)} className="gap-1">
              <Plus className="h-3 w-3" /> Добавить расследование
            </Button>
          ) : null}
        </div>

        {addingInv ? (
          <div className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
            <textarea
              value={invNotes}
              onChange={(e) => setInvNotes(e.target.value)}
              rows={2}
              placeholder="Заметки расследования (опц.)"
              className="rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={createInvestigation} disabled={busy}>
                Создать
              </Button>
              <button
                onClick={() => {
                  setAddingInv(false);
                  setInvNotes('');
                }}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}

        {investigations.length === 0 && !addingInv ? (
          <div className="rounded-lg border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-500">
            Нет расследований
          </div>
        ) : null}

        {investigations.map((inv) => (
          <div key={inv.id} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Расследование #{inv.id} · {inv.status}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCauseOpenFor(causeOpenFor === inv.id ? null : inv.id)}
                className="gap-1"
              >
                <Plus className="h-3 w-3" /> Причина
              </Button>
            </div>
            {inv.notes ? <p className="text-xs text-neutral-600">{inv.notes}</p> : null}

            {causeOpenFor === inv.id ? (
              <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                <input
                  value={causeTitle}
                  onChange={(e) => setCauseTitle(e.target.value)}
                  placeholder="Название причины"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
                <textarea
                  value={causeDesc}
                  onChange={(e) => setCauseDesc(e.target.value)}
                  rows={2}
                  placeholder="Описание (опц.)"
                  className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                />
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-neutral-600">
                    Уверенность: <span className="font-medium">{causeConfidence}%</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={causeConfidence}
                    onChange={(e) => setCauseConfidence(Number(e.target.value))}
                    className="h-2 w-full appearance-none rounded-full"
                    style={{ background: confidenceBg(causeConfidence) }}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => createCause(inv.id)} disabled={busy}>
                    Добавить
                  </Button>
                  <button
                    onClick={() => setCauseOpenFor(null)}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-l-2 border-neutral-200 pl-4">
              {inv.causes.length === 0 ? (
                <div className="text-xs text-neutral-400">Нет причин</div>
              ) : (
                inv.causes.map((cause) => (
                  <div key={cause.id} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1">
                        <div className="text-sm font-medium text-neutral-900">
                          {cause.title}
                          {cause.isConfirmed ? (
                            <span className="ml-2 text-xs text-emerald-600">подтверждена</span>
                          ) : null}
                        </div>
                        {cause.description ? (
                          <p className="text-xs text-neutral-600">{cause.description}</p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHypOpenFor(hypOpenFor === cause.id ? null : cause.id)}
                        className="gap-1"
                      >
                        <Plus className="h-3 w-3" /> Гипотеза
                      </Button>
                    </div>
                    <div
                      className="h-1.5 w-full rounded-full"
                      style={{ background: confidenceBg(cause.confidence) }}
                      title={`Уверенность ${cause.confidence}%`}
                    />

                    {hypOpenFor === cause.id ? (
                      <div className="flex flex-col gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                        <textarea
                          value={hypStatement}
                          onChange={(e) => setHypStatement(e.target.value)}
                          rows={2}
                          placeholder="Если сделать X, то Y случится"
                          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                        />
                        <textarea
                          value={hypPlan}
                          onChange={(e) => setHypPlan(e.target.value)}
                          rows={2}
                          placeholder="Как проверить (опц.)"
                          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => createHypothesis(cause.id)} disabled={busy}>
                            Добавить
                          </Button>
                          <button
                            onClick={() => setHypOpenFor(null)}
                            className="text-xs text-neutral-500 hover:text-neutral-700"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-2 border-l-2 border-neutral-200 pl-4">
                      {cause.hypotheses.length === 0 ? (
                        <div className="text-xs text-neutral-400">Нет гипотез</div>
                      ) : (
                        cause.hypotheses.map((h) => (
                          <div
                            key={h.id}
                            className="flex flex-col gap-1 rounded-md border border-neutral-200 bg-neutral-50/40 p-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-sm text-neutral-800">{h.statement}</div>
                              <Badge
                                variant="outline"
                                className={cn('shrink-0', HYPOTHESIS_STATUS_STYLES[h.status])}
                              >
                                {HYPOTHESIS_STATUS_LABEL[h.status]}
                              </Badge>
                            </div>
                            {h.testPlan ? (
                              <p className="text-xs text-neutral-600">План: {h.testPlan}</p>
                            ) : null}
                            {h.result ? (
                              <p className="text-xs text-neutral-600">Итог: {h.result}</p>
                            ) : null}
                            {h.status === 'proposed' || h.status === 'testing' ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => resolveHypothesis(h.id, 'confirmed')}
                                  className="gap-1 text-emerald-700 hover:text-emerald-800"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Подтвердить
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => resolveHypothesis(h.id, 'rejected')}
                                  className="gap-1 text-rose-700 hover:text-rose-800"
                                >
                                  <XCircle className="h-3 w-3" /> Отклонить
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
