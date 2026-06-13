import fs from 'fs';
import path from 'path';

const srcPath = path.join(process.cwd(), 'deploy/dashboard-spa/app/components/MastyffAiSOCDashboard.tsx');
const outDir = path.join(process.cwd(), 'deploy/dashboard-spa/app/components/soc');
const src = fs.readFileSync(srcPath, 'utf8');

const panels = [
  ['ThreatIntelligence', 'SocThreatIntelPanel', `import { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { ATTACKS } from '@/lib/repo-data';
import { THREAT_SIGNATURES } from './soc-data';
import { SocSectionHeader } from './primitives';

const ALL_ATTACKS = ATTACKS;
`],
  ['ComplianceControls', 'SocCompliancePanel', `import { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { COMPLIANCE_FRAMEWORKS } from './soc-data';
import { SocSectionHeader } from './primitives';
`],
  ['SOARPlaybooks', 'SocSoarPanel', `import { Activity, ChevronRight, GitBranch } from 'lucide-react';
import { SOAR_PLAYBOOKS } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';
`],
  ['AttackSimulations', 'SocAttackSimulationsPanel', `import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ShieldAlert, TrendingUp } from 'lucide-react';
import { ATTACK_SCENARIOS, SOC_TOOLTIP_STYLE } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';
`],
  ['PerformanceBenchmarks', 'SocBenchmarksPanel', `import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { BarChart2, Clock, Database, Lock, Zap } from 'lucide-react';
import { BENCHMARK_TIERS as REAL_BENCHMARK_TIERS } from '@/lib/repo-data';
import { SOC_TOOLTIP_STYLE } from './soc-data';
import { SocCard, SocSectionHeader } from './primitives';

const BENCHMARK_TIERS = REAL_BENCHMARK_TIERS;
`],
  ['EnterpriseReadiness', 'SocEnterpriseReadinessPanel', `import { useState, useEffect, useCallback } from 'react';
import { Activity, Lock, Server, Shield } from 'lucide-react';
import { SocCard, SocSectionHeader } from './primitives';
`],
  ['MCPServers', 'SocMcpServersPanel', `import { useState } from 'react';
import { Activity, Server, Terminal } from 'lucide-react';
import { MASTYFF_AI_CONFIGS } from '@/lib/repo-data';
import { SocCard, SocSectionHeader } from './primitives';

const MCP_CONFIGS = MASTYFF_AI_CONFIGS;
`],
];

for (const [fnName, outName, imports] of panels) {
  const start = src.indexOf(`function ${fnName}()`);
  if (start < 0) {
    console.error('not found', fnName);
    continue;
  }
  let depth = 0;
  let i = src.indexOf('{', start);
  const bodyStart = i + 1;
  depth = 1;
  i++;
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  let body = src.slice(bodyStart, i - 1);
  const out = `'use client';

${imports}
export function ${outName}() {${body}}
`;
  fs.writeFileSync(path.join(outDir, `${outName}.tsx`), out);
  console.log('wrote', outName, out.length);
}
