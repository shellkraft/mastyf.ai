'use client';

import { useState } from 'react';
import { Activity, Server, Terminal } from 'lucide-react';
import { MASTYFF_AI_CONFIGS } from '@/lib/repo-data';
import { SocCard, SocSectionHeader } from './primitives';

const MCP_CONFIGS = MASTYFF_AI_CONFIGS;

export function SocMcpServersPanel() {
  const [selected, setSelected] = useState(MCP_CONFIGS[0]);

  return (
    <div>
      <div className="section-header mb-20">
        <Server size={20} color="var(--cyan)"/>
        <div>
          <div className="section-title">MCP Servers</div>
          <div className="section-sub">Mastyff AI proxy configurations · 4 server profiles · JSON configuration viewer</div>
        </div>
      </div>

      <div className="grid-1-2">
        <div>
          {MCP_CONFIGS.map(c => (
            <div
              key={c.name}
              onClick={() => setSelected(c)}
              className="config-card"
              style={{
                cursor:'pointer',
                border:`1px solid ${selected.name===c.name?'var(--cyan-glow)':'var(--border)'}`,
                background: selected.name===c.name?'var(--cyan-dim)':'var(--navy-panel)',
              }}
            >
              <div className="config-name">
                <Server size={12}/>
                {c.name}
                {selected.name===c.name && <span className="badge badge-cyan">ACTIVE</span>}
              </div>
              <div style={{fontSize:11,color:'var(--text-muted)'}}>{c.description}</div>
            </div>
          ))}

          {/* Server stats */}
          <SocCard title="Proxy Statistics" icon={<Activity size={14}/>} style={{marginTop:12}}>
            {[
              { label:'Test Files', value:'94 passed / 1 failed', color:'var(--green)' },
              { label:'Test Cases', value:'537 passed / 1 failed', color:'var(--green)' },
              { label:'Build Time', value:'4.5s initial', color:'var(--cyan)' },
              { label:'Cached Build', value:'<0.5s', color:'var(--cyan)' },
              { label:'CVE Scan', value:'0 vulnerabilities', color:'var(--green)' },
              { label:'Dependencies', value:'60+ packages', color:'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border-dim)'}}>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>{s.label}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:s.color}}>{s.value}</span>
              </div>
            ))}
          </SocCard>
        </div>

        <SocCard title={selected.name} sub={selected.description} icon={<Terminal size={14}/>}>
          <div className="config-json">
            {selected.content}
          </div>

          <div style={{marginTop:16}}>
            <div className="mb-8 text-muted text-xs uppercase tracking-wide">Proxy Capabilities</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {[
                'Semantic Detection','Policy Engine','Rate Limiting','Audit Trail',
                'Cost Governance','AI Learning','SSRF Protection','Path Guard',
              ].map(c => (
                <span key={c} className="badge badge-cyan">{c}</span>
              ))}
            </div>
          </div>

          <div style={{marginTop:16}}>
            <div className="mb-8 text-muted text-xs uppercase tracking-wide">Transport</div>
            <div style={{display:'flex',gap:8}}>
              <span className="badge badge-allow">stdio</span>
              <span className="badge badge-muted">HTTP/SSE (requires upstream)</span>
            </div>
          </div>
        </SocCard>
      </div>
    </div>
  );
}
