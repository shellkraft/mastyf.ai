'use client';

import Image from 'next/image';
import { useState } from 'react';
import { SITE_NAME } from '@/lib/product-links';
import {
  AUTO_RESEARCH_STAGES,
  THREAT_LAB_STAGES,
  type PipelineStage,
} from '@/lib/threat-discovery-copy';

type FlowId = 'threat-lab' | 'auto-research';

const FLOWS: {
  id: FlowId;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  stages: PipelineStage[];
  badge: string;
}[] = [
  {
    id: 'threat-lab',
    title: `${SITE_NAME} — LLM Threat Discovery Architecture`,
    subtitle: 'Human-in-the-loop discovery — LLM proposes, you approve before policy changes.',
    image: '/assets/llm-threat-discovery-architecture.png',
    imageAlt:
      'mastyf.ai LLM Threat Discovery pipeline: detection sources, Ollama LLM, validation gates, signed manifest, human accept',
    stages: THREAT_LAB_STAGES,
    badge: 'Threat Lab',
  },
  {
    id: 'auto-research',
    title: `${SITE_NAME}: Self-Sustaining Threat Research Architecture`,
    subtitle: 'Continuous red-team loop — live proxy traffic feeds new adversarial fixtures 24/7.',
    image: '/assets/auto-threat-research-architecture.png',
    imageAlt:
      'mastyf.ai Auto Threat Research pipeline: live detections, debounced queue, LLM research, taxonomy, adv fixture write',
    stages: AUTO_RESEARCH_STAGES,
    badge: 'Auto Research',
  },
];

export function ThreatArchitectureTabs() {
  const [flow, setFlow] = useState<FlowId>('threat-lab');
  const active = FLOWS.find((f) => f.id === flow) ?? FLOWS[0];
  const [selected, setSelected] = useState(active.stages[0].id);

  const stage = active.stages.find((s) => s.id === selected) ?? active.stages[0];

  function pickFlow(id: FlowId) {
    setFlow(id);
    const next = FLOWS.find((f) => f.id === id);
    if (next) setSelected(next.stages[0].id);
  }

  return (
    <div className="landing-threat-arch">
      <div className="landing-threat-tabs" role="tablist">
        {FLOWS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={flow === f.id}
            className={flow === f.id ? 'landing-threat-tab active' : 'landing-threat-tab'}
            onClick={() => pickFlow(f.id)}
          >
            <span className="landing-threat-tab-badge">{f.badge}</span>
            {f.id === 'threat-lab' ? 'LLM Threat Discovery' : 'Self-Sustaining Threat Research'}
          </button>
        ))}
      </div>

      <div className="landing-threat-body">
        <figure className="landing-arch landing-arch-threat">
          <Image
            src={active.image}
            alt={active.imageAlt}
            width={1400}
            height={900}
            style={{ width: '100%', height: 'auto' }}
          />
          <figcaption className="landing-arch-caption">{active.subtitle}</figcaption>
        </figure>

        <div className="landing-threat-stages" role="list">
          {active.stages.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="listitem"
              className={selected === s.id ? 'landing-threat-stage active' : 'landing-threat-stage'}
              onClick={() => setSelected(s.id)}
            >
              <span className="landing-threat-stage-num">{i + 1}</span>
              <span>{s.short}</span>
            </button>
          ))}
        </div>

        <article className="landing-threat-detail card">
          <h3>{stage.label}</h3>
          <p>{stage.explanation}</p>
        </article>
      </div>
    </div>
  );
}
