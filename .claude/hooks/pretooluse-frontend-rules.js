#!/usr/bin/env node
/**
 * PreToolUse hook: enforce frontend file-organization rules.
 * Triggers on Write | Edit | MultiEdit.
 * Blocks if:
 *   - .component.tsx contains styled() or logic hooks (useState/useEffect/etc.)
 *   - .container.tsx contains styled()
 *   - any apps/web/src/** or packages/ui/src/{atoms,molecules}/** file outside
 *     .style.ts(x) contains styled()
 *   - any apps/web/src/** or packages/ui/src/{atoms,molecules}/** file outside
 *     .types.ts(x) contains top-level interface/type/enum declaration
 *
 * Exempt: landing/, apps/api/, any path containing /api/, store.ts, *.config.*, atom/molecule
 *         (atom/molecule still subject to styled-only-in-style-files via ESLint;
 *          this hook skips them because their components legitimately use styled
 *          historically — ESLint will catch the rest during refactor).
 *
 * Exit codes: 0 = allow, 2 = block (stderr fed back to agent).
 */
const path = require('path');

const LOGIC_HOOK_RE = /\b(useState|useEffect|useMemo|useCallback|useReducer|useRef|useQuery|useMutation|useLazyQuery|useSelector|useDispatch|useNavigate)\s*\(/g;
const STYLED_RE = /\bstyled\s*[\.(]/;
const TYPE_DECL_RE = /^\s*(export\s+)?(interface|type|enum)\s+[A-Z_]/gm;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function normalize(p) {
  return p.replace(/\\/g, '/');
}

function isExempt(filePath) {
  const f = normalize(filePath);
  if (f.includes('apps/web/src/features/landing/')) return true;
  if (f.includes('apps/api/')) return true;
  if (/\/api\//.test(f)) return true;
  if (/\/store\.ts$/.test(f)) return true;
  if (/\.config\.[tj]s(x|mjs|cjs)?$/.test(f)) return true;
  return false;
}

function isInScope(filePath) {
  const f = normalize(filePath);
  return (
    f.includes('apps/web/src/') ||
    f.includes('packages/ui/src/')
  );
}

function check(filename, content) {
  const violations = [];
  if (!isInScope(filename) || isExempt(filename)) return violations;

  const f = normalize(filename);
  const isComponent = f.endsWith('.component.tsx');
  const isContainer = f.endsWith('.container.tsx');
  const isStyle = f.endsWith('.style.ts') || f.endsWith('.style.tsx');
  const isTypes = f.endsWith('.types.ts') || f.endsWith('.types.tsx');

  // .component.tsx: no styled, no logic hooks
  if (isComponent) {
    if (STYLED_RE.test(content)) {
      violations.push('styled() found in *.component.tsx — move to *.style.ts');
    }
    const matches = content.match(LOGIC_HOOK_RE);
    if (matches) {
      const unique = [...new Set(matches.map((m) => m.replace(/\s*\($/, '')))];
      violations.push(
        `logic hooks in *.component.tsx: ${unique.join(', ')} — move to *.container.tsx`,
      );
    }
  }

  // .container.tsx: no styled
  if (isContainer && STYLED_RE.test(content)) {
    violations.push('styled() found in *.container.tsx — move to *.style.ts');
  }

  // styled only in .style.ts
  if (!isStyle && !isComponent && !isContainer && STYLED_RE.test(content)) {
    violations.push('styled() must live in *.style.ts');
  }

  // type decls only in .types.ts
  if (!isTypes && TYPE_DECL_RE.test(content)) {
    // Reset lastIndex because regex has /g flag and .test() advances state
    TYPE_DECL_RE.lastIndex = 0;
    violations.push('top-level interface/type/enum declaration must live in *.types.ts');
  }
  TYPE_DECL_RE.lastIndex = 0;

  return violations;
}

async function main() {
  const raw = await readStdin();
  if (!raw) {
    process.exit(0);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // not a tool event we understand
  }

  const { tool_name, tool_input } = payload;
  if (!tool_input || !tool_input.file_path) process.exit(0);

  const filePath = tool_input.file_path;

  // Collect text to scan
  let texts = [];
  if (tool_name === 'Write' && typeof tool_input.content === 'string') {
    texts = [tool_input.content];
  } else if (tool_name === 'Edit') {
    if (typeof tool_input.new_string === 'string') texts.push(tool_input.new_string);
  } else if (tool_name === 'MultiEdit' && Array.isArray(tool_input.edits)) {
    texts = tool_input.edits.map((e) => e.new_string || '');
  } else {
    process.exit(0);
  }

  // Scan each text snippet. For Edit/MultiEdit we only see the NEW content;
  // a partial snippet may not match TYPE_DECL_RE (which is line-anchored) — that's OK,
  // ESLint will catch it on full file scan.
  const all = [];
  for (const t of texts) {
    const v = check(filePath, t);
    if (v.length) all.push(...v);
  }

  if (all.length === 0) process.exit(0);

  // Block. stderr is fed back to the agent.
  const msg = [
    `[frontend-rules] Blocked ${tool_name} on ${path.basename(filePath)}:`,
    ...all.map((v) => `  - ${v}`),
    'Fix the violation, then retry. See CLAUDE.md "Frontend Rules" section.',
  ].join('\n');
  process.stderr.write(msg);
  process.exit(2);
}

main().catch(() => process.exit(0));
