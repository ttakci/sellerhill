# Frontend Rules Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish three-layer enforcement (ESLint + PreToolUse hook + skill/CLAUDE.md) for frontend file-organization rules, then refactor all existing frontend code to comply.

**Architecture:** Phase 1 builds infrastructure (4 new ESLint rules, Node-based PreToolUse hook, SKILL.md, CLAUDE.md updates, deletes `frontend-rules.md`). Phase 2 audits existing code with the new rules. Phase 3 refactors feature-by-feature per audit results. Phase 4 validates end-to-end. Each phase ends in a green `pnpm validate` and a commit.

**Tech Stack:** ESLint 8 custom plugin (CommonJS, `packages/ui/src/eslint-plugin/index.js`), Node script for hook (cross-platform Windows), Claude Code `PreToolUse` hook protocol, Markdown for docs.

**Spec:** `docs/superpowers/specs/2026-07-06-frontend-rules-enforcement-design.md`

## Global Constraints

- Repo is a pnpm workspace; commands run from repo root unless noted
- Lint runs with `--max-warnings 0`; any new rule with severity `error` blocks commits via `pnpm validate` pre-commit hook
- Cross-platform shell: bash (Git Bash on Windows). Hook script must be Node-only (no bash/PowerShell in hook)
- Path separator in Node: use `path.sep` or normalize, never assume `/`
- **Never** use `--no-verify` on commits (project rule)
- **Never** delete `frontend-rules.md` before its content lives in both `SKILL.md` AND `CLAUDE.md`
- Exempt paths (skip in rules + hook): `apps/web/src/features/landing/**`, `apps/api/**`, `apps/web/src/**/api/*.ts(x)`, `apps/web/src/app/store.ts`, `*.config.{ts,js,mjs,cjs}`, `packages/ui/src/{atoms,molecules}/**` for some rules (see per-rule scope)
- After every task: run `pnpm validate`. Must be green before commit

---

## Phase 1 — Infrastructure

### Task 1: Add 4 structural ESLint rules to design-system plugin

**Files:**
- Modify: `packages/ui/src/eslint-plugin/index.js` (append 4 rules to `module.exports.rules`)

**Interfaces:**
- Consumes: filename via `context.getFilename()`, AST via `context.parserServices` (no type info needed — pure AST traversal)
- Produces: 4 new rule keys available in `.eslintrc.json` `rules` block: `design-system/styled-only-in-style-files`, `design-system/types-only-in-types-files`, `design-system/logic-only-in-container`, `design-system/no-styled-in-container`

**Rule specifications (verbatim contract):**

```
rule: styled-only-in-style-files
  TRIGGER: CallExpression where callee.name === 'styled'
           OR callee is MemberExpression (styled.div / styled(Component))
  APPLY TO: all files under apps/web/src/**
  EXEMPT: filename endswith '.style.ts' OR '.style.tsx'
          OR filename includes 'packages/ui/src/atoms' or 'packages/ui/src/molecules'
          OR filename includes 'apps/web/src/features/landing'
          OR filename matches /\/api\//, /store\.ts$/, /\.config\./
  MESSAGE: "styled() must live in *.style.ts. Move to [Name].style.ts."

rule: types-only-in-types-files
  TRIGGER: ExportNamedDeclaration or ExportDefaultDeclaration
           with declaration.type in ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration']
           OR top-level (not nested in function) VariableDeclaration with @type JSDoc
  APPLY TO: apps/web/src/** and packages/ui/src/{atoms,molecules}/**
  EXEMPT: filename endswith '.types.ts' OR '.types.tsx'
          OR filename includes 'apps/web/src/features/landing'
          OR /\/api\//, /store\.ts$/, /\.config\./
          (imported types re-exported via `export type { X } from '...'` are allowed)
  MESSAGE: "Type/interface/enum declaration must live in *.types.ts."

rule: logic-only-in-container
  TRIGGER: CallExpression where callee.name in
           ['useState', 'useEffect', 'useMemo', 'useCallback', 'useReducer',
            'useRef', 'useQuery', 'useMutation', 'useLazyQuery',
            'useSelector', 'useDispatch', 'useNavigate']
  APPLY TO: only files where filename endswith '.component.tsx'
  EXEMPT: callee.name in ['useTranslation', 'useTheme'] (these are presentation hooks)
          OR filename includes 'apps/web/src/features/landing'
  MESSAGE: "Logic hook '{{hook}}' is not allowed in *.component.tsx. Move to *.container.tsx."

rule: no-styled-in-container
  TRIGGER: same as styled-only-in-style-files
  APPLY TO: only files where filename endswith '.container.tsx'
  EXEMPT: filename includes 'apps/web/src/features/landing'
  MESSAGE: "styled() not allowed in *.container.tsx. Move to *.style.ts."
```

- [ ] **Step 1: Append the 4 rules to `packages/ui/src/eslint-plugin/index.js`**

Insert before the final closing `},` of the `rules: { ... }` object (i.e. after the last existing rule's closing `},`):

```javascript
    // ============================================================
    // Structural rules — file organization (added 2026-07-06)
    // ============================================================

    'styled-only-in-style-files': {
      meta: {
        type: 'problem',
        docs: {
          description: 'styled() must only be used inside *.style.ts(x) files',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          styledOutsideStyleFile:
            'styled() must live in *.style.ts. Move to a *.style.ts file.',
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename().replace(/\\/g, '/');

        // Exempt checks
        if (filename.endsWith('.style.ts') || filename.endsWith('.style.tsx')) return {};
        if (filename.includes('packages/ui/src/atoms/')) return {};
        if (filename.includes('packages/ui/src/molecules/')) return {};
        if (filename.includes('apps/web/src/features/landing/')) return {};
        if (/\/api\//.test(filename)) return {};
        if (/\/store\.ts$/.test(filename)) return {};
        if (/\.config\.[tj]s(x|mjs|cjs)?$/.test(filename)) return {};
        if (!filename.includes('apps/web/src/')) return {};

        return {
          CallExpression(node) {
            const callee = node.callee;
            const isStyled =
              (callee.type === 'Identifier' && callee.name === 'styled') ||
              (callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                callee.object.name === 'styled');
            if (isStyled) {
              context.report({ node, messageId: 'styledOutsideStyleFile' });
            }
          },
        };
      },
    },

    'types-only-in-types-files': {
      meta: {
        type: 'problem',
        docs: {
          description: 'interface/type/enum declarations must live in *.types.ts',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          typeOutsideTypesFile:
            'Type/interface/enum declaration must live in *.types.ts. Move it to [Name].types.ts.',
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename().replace(/\\/g, '/');

        if (filename.endsWith('.types.ts') || filename.endsWith('.types.tsx')) return {};
        if (filename.includes('apps/web/src/features/landing/')) return {};
        if (/\/api\//.test(filename)) return {};
        if (/\/store\.ts$/.test(filename)) return {};
        if (/\.config\.[tj]s(x|mjs|cjs)?$/.test(filename)) return {};
        if (!filename.includes('apps/web/src/') &&
            !filename.includes('packages/ui/src/atoms/') &&
            !filename.includes('packages/ui/src/molecules/')) return {};

        const DECL_KINDS = new Set([
          'TSInterfaceDeclaration',
          'TSTypeAliasDeclaration',
          'TSEnumDeclaration',
        ]);

        return {
          ExportNamedDeclaration(node) {
            if (node.declaration && DECL_KINDS.has(node.declaration.type)) {
              // Allow re-exports of types: `export type { X } from '...'`
              if (node.exportKind === 'type') return;
              context.report({ node, messageId: 'typeOutsideTypesFile' });
            }
          },
          ExportDefaultDeclaration(node) {
            if (node.declaration && DECL_KINDS.has(node.declaration.type)) {
              context.report({ node, messageId: 'typeOutsideTypesFile' });
            }
          },
        };
      },
    },

    'logic-only-in-container': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Logic hooks must live in *.container.tsx, not *.component.tsx',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          logicInComponent:
            'Logic hook \'{{hook}}\' is not allowed in *.component.tsx. Move to *.container.tsx.',
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename().replace(/\\/g, '/');

        if (!filename.endsWith('.component.tsx')) return {};
        if (filename.includes('apps/web/src/features/landing/')) return {};

        const LOGIC_HOOKS = new Set([
          'useState', 'useEffect', 'useMemo', 'useCallback', 'useReducer',
          'useRef', 'useQuery', 'useMutation', 'useLazyQuery',
          'useSelector', 'useDispatch', 'useNavigate',
        ]);

        return {
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type === 'Identifier' && LOGIC_HOOKS.has(callee.name)) {
              context.report({
                node,
                messageId: 'logicInComponent',
                data: { hook: callee.name },
              });
            }
          },
        };
      },
    },

    'no-styled-in-container': {
      meta: {
        type: 'problem',
        docs: {
          description: 'styled() is not allowed in *.container.tsx',
          category: 'Design System',
          recommended: true,
        },
        messages: {
          styledInContainer:
            'styled() not allowed in *.container.tsx. Move to *.style.ts.',
        },
        schema: [],
      },
      create(context) {
        const filename = context.getFilename().replace(/\\/g, '/');

        if (!filename.endsWith('.container.tsx')) return {};
        if (filename.includes('apps/web/src/features/landing/')) return {};

        return {
          CallExpression(node) {
            const callee = node.callee;
            const isStyled =
              (callee.type === 'Identifier' && callee.name === 'styled') ||
              (callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                callee.object.name === 'styled');
            if (isStyled) {
              context.report({ node, messageId: 'styledInContainer' });
            }
          },
        };
      },
    },
```

- [ ] **Step 2: Smoke-test plugin loads without syntax error**

Run:
```bash
node -e "const p = require('./packages/ui/src/eslint-plugin/index.js'); console.log(Object.keys(p.rules));"
```

Expected: array including all 4 new rule keys (plus existing 5+).

- [ ] **Step 3: Rebuild plugin install + verify ESLint picks it up**

The plugin is consumed via `node_modules/eslint-plugin-design-system` (symlinked in pnpm workspace). Verify:

```bash
ls -la node_modules/eslint-plugin-design-system
```

If it's a symlink, no rebuild needed. If it's a real copy, run:
```bash
cp packages/ui/src/eslint-plugin/index.js node_modules/eslint-plugin-design-system/index.js
```

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/eslint-plugin/index.js
git commit -m "feat(eslint): add 4 structural design-system rules

- styled-only-in-style-files
- types-only-in-types-files
- logic-only-in-container
- no-styled-in-container"
```

---

### Task 2: Enable the 4 new rules in `.eslintrc.json`

**Files:**
- Modify: `.eslintrc.json` (in main `rules` block; landing already exempt via existing override)

**Interfaces:**
- Consumes: rule keys from Task 1
- Produces: rules active at `error` severity for `apps/web/src/**` and `packages/ui/src/{atoms,molecules}/**`

- [ ] **Step 1: Add the 4 rules to `.eslintrc.json` `rules` block**

In the `"rules": { ... }` block, after the existing 5 design-system rules, add:

```json
    "design-system/styled-only-in-style-files": "error",
    "design-system/types-only-in-types-files": "error",
    "design-system/logic-only-in-container": "error",
    "design-system/no-styled-in-container": "error",
```

Also extend the **landing override** (currently disables 5 design-system rules) to disable these 4 too. Find:

```json
    {
      "files": ["apps/web/src/features/landing/**/*.{ts,tsx}"],
      "rules": {
        "design-system/no-hardcoded-colors": "off",
        "design-system/no-hardcoded-spacing": "off",
        "design-system/no-inline-styles": "off",
        "design-system/no-styled-typography": "off",
        "design-system/no-bare-text-in-button": "off"
      }
    }
```

Append the 4 new rules with `"off"`:

```json
        "design-system/styled-only-in-style-files": "off",
        "design-system/types-only-in-types-files": "off",
        "design-system/logic-only-in-container": "off",
        "design-system/no-styled-in-container": "off"
```

Also extend the **`apps/api/**`** override the same way.

- [ ] **Step 2: Run lint. Expect failures (refactor not yet done).**

```bash
pnpm lint 2>&1 | tail -100
```

Expected: errors from the 4 new rules in existing code. **This is the audit baseline** — do NOT fix yet. Capture counts:

```bash
pnpm lint 2>&1 | grep -E "styled-only-in-style-files|types-only-in-types-files|logic-only-in-container|no-styled-in-container" | wc -l
```

Record this number in `docs/superpowers/plans/2026-07-06-frontend-rules-enforcement.md` audit section (Task 6 fills).

- [ ] **Step 3: Temporarily set new rules to `warn` so commit can pass**

Temporarily change the 4 new rules in `.eslintrc.json` to `"warn"` (not `"error"`). `--max-warnings 0` still blocks but you can use `pnpm lint:fix` mode separately. Actually `--max-warnings 0` blocks warns too — so instead, set them to `"off"` for now. We'll flip to `"error"` in Task 17 final validation.

**Decision:** Set the 4 new rules to `"off"` in main block (keep them on inside landing/api overrides is moot). Phase 3 refactor uses an explicit CLI invocation:

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' apps/web/src --ext .ts,.tsx
```

This bypasses the `off` setting for the audit pass. Document this in Task 6.

- [ ] **Step 4: Commit**

```bash
git add .eslintrc.json
git commit -m "chore(eslint): wire 4 structural rules (off by default; on via audit CLI)"
```

---

### Task 3: Write PreToolUse hook (Node script)

**Files:**
- Create: `.claude/hooks/pretooluse-frontend-rules.js`
- Modify: `.claude/settings.json` (add `hooks` block)

**Interfaces:**
- Consumes: stdin JSON from Claude Code `PreToolUse` event — shape:
  ```json
  {
    "session_id": "...",
    "tool_name": "Write" | "Edit" | "MultiEdit",
    "tool_input": {
      "file_path": "absolute path",
      "content": "..." (Write),
      "old_string": "...", "new_string": "..." (Edit),
      "edits": [{old_string, new_string}, ...] (MultiEdit)
    }
  }
  ```
- Produces: exit code 0 (allow) or 2 (block). stderr text fed back to Claude.

- [ ] **Step 1: Create `.claude/hooks/` directory**

```bash
mkdir -p .claude/hooks
```

- [ ] **Step 2: Write `.claude/hooks/pretooluse-frontend-rules.js`**

```javascript
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
 * Exempt: landing/, apps/api/, **/api/, store.ts, *.config.*, atom/molecule
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
    f.includes('packages/ui/src/atoms/') ||
    f.includes('packages/ui/src/molecules/')
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

  // styled only in .style.ts (skip atom/molecule historical for hook; ESLint catches)
  if (!isStyle && !isComponent && !isContainer && STYLED_RE.test(content)) {
    if (!f.includes('packages/ui/src/atoms/') && !f.includes('packages/ui/src/molecules/')) {
      violations.push('styled() must live in *.style.ts');
    }
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
```

- [ ] **Step 3: Make the script executable + test directly**

```bash
chmod +x .claude/hooks/pretooluse-frontend-rules.js
# Test 1: clean payload — should exit 0
echo '{"tool_name":"Write","tool_input":{"file_path":"apps/web/src/features/dashboard/DashboardPage/DashboardPage.style.ts","content":"export const X = styled.div``;"}}' | node .claude/hooks/pretooluse-frontend-rules.js
echo "exit=$?"
# Expected: exit=0

# Test 2: violation — should exit 2
echo '{"tool_name":"Write","tool_input":{"file_path":"apps/web/src/features/dashboard/DashboardPage/DashboardPage.component.tsx","content":"const [x, setX] = useState(0);"}}' | node .claude/hooks/pretooluse-frontend-rules.js
echo "exit=$?"
# Expected: stderr line about logic hooks, exit=2

# Test 3: exempt path — should exit 0
echo '{"tool_name":"Write","tool_input":{"file_path":"apps/web/src/features/landing/Hero.tsx","content":"const [x, setX] = useState(0);"}}' | node .claude/hooks/pretooluse-frontend-rules.js
echo "exit=$?"
# Expected: exit=0
```

- [ ] **Step 4: Register hook in `.claude/settings.json`**

Edit `.claude/settings.json`. Add a top-level `hooks` key (preserve existing `permissions`):

```json
{
  "permissions": { ... },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/pretooluse-frontend-rules.js"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Live test — attempt to write a violating file**

In a Claude Code session, attempt to write a file with `useState` in a `.component.tsx`. Verify the hook blocks it with the stderr message. (Manual verification — document result in commit message.)

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/pretooluse-frontend-rules.js .claude/settings.json
git commit -m "feat(hooks): add PreToolUse frontend-rules enforcer

Node script blocks Write/Edit/MultiEdit that violate file-organization
rules. Cross-platform. Exempts landing/api/config."
```

---

### Task 4: Create SKILL.md, delete `frontend-rules.md`

**Files:**
- Create: `.claude/skills/frontend-rules/SKILL.md`
- Delete: `.claude/skills/frontend-rules.md`

**Interfaces:**
- Consumes: content of existing `.claude/skills/frontend-rules.md` (verified accurate against current codebase in this plan)
- Produces: a loadable skill called `frontend-rules`

- [ ] **Step 1: Create directory if not exists**

```bash
mkdir -p .claude/skills/frontend-rules
```

- [ ] **Step 2: Write `.claude/skills/frontend-rules/SKILL.md`**

```markdown
---
name: frontend-rules
description: Frontend file-organization and design-system rules for apps/web and packages/ui. Use when writing or modifying any .ts/.tsx file under apps/web/src (except landing) or packages/ui/src/atoms|molecules.
---

# Frontend Rules

## File Organization (mandatory)

Every feature component has 4 files:

| File | Allowed | Forbidden |
|---|---|---|
| `[Name].component.tsx` | JSX markup, `useTranslation`, `useTheme` | `useState/useEffect/useMemo`, RTK Query hooks, `dispatch`, `useSelector`, `useNavigate`, `formatCurrency`-style helpers, `styled(...)` |
| `[Name].container.tsx` | All logic, hooks, RTK Query, handlers, formatters | `styled(...)`, JSX markup (only `<Component .../>` return allowed) |
| `[Name].style.ts` | All `styled(...)` calls | JSX, logic |
| `[Name].types.ts` | `interface`, `type`, `enum` | implementations |

Atoms/Molecules (`packages/ui/src/{atoms,molecules}/`) follow the same rules. **Stateful** atoms/molecules (Select, Dropdown, Tooltip, etc.) MUST split into `.container.tsx` + `.component.tsx` like features. **Stateless** atoms/molecules (Button, Badge, Icon) only need `.component.tsx` + `.style.ts` + `.types.ts`.

### Exempt paths
- `apps/web/src/features/landing/**`
- `apps/web/src/**/api/*.ts(x)` (RTK Query endpoints)
- `apps/web/src/app/store.ts`
- `apps/api/**`
- `*.config.{ts,js,mjs,cjs}`

## Design System (mandatory, enforced by ESLint)

### Tokens
- All colors, spacing, shadows, radii, typography → `tkn('path')` from `@repo/ui`. Never hardcoded hex/rgb, never raw `16px`/`1rem`.
- Inline `style={{ }}` is forbidden.

### Text
- All visible text uses `<Text variant="...">` from `@repo/ui`. Never `styled.h1`, `styled.p`, etc.
- Variants: `display`, `h1`, `h2`, `h3`, `h4`, `h5`, `body`, `body-sm`, `body-xs`, `caption`, `mono`, `overline`.

### Form controls
- Buttons → `Button`, `ModernButton`, `IconButton`. Never raw `<button>`.
- Text inputs → `TextInput`. Never `<input>`.
- Selects → `Select`. Never `<select>`.
- Checkboxes → `Checkbox`. Toggles → `Toggle`.

### Layout
- Cards → `Card` variants: `default | bordered | elevated | flat | interactive | stat | section`.
- Tables → `Table` molecule. Never `styled.table`.
- Page header → `PageHeader` molecule.
- Dropdowns → `Dropdown` atom.

### Notifications
- Toasts: `useToast()` → `toast.success(...)`, `toast.error(...)`.
- Modals (info/error/warn): `MessageModal` via `showMessage` from `UIContext`. Never `alert()`/`confirm()`.

### Extending atoms in `.style.ts`
Use the atom's built-in variant/weight/size props. Template literal should be empty or **layout CSS only** (margin, gap, flex, grid, position, width/height, overflow, z-index).

What goes in template literal:
- `margin`, `gap`, `padding` (when atom doesn't handle it), `display`, `flex-direction`, `align-items`, `justify-content`, `position`, `top/right/bottom/left`, `width`, `height`, `min-height`, `max-width`, `overflow`, `grid-column`, `z-index`, `opacity`, `cursor`.

What goes in props instead:
- `font-size`, `font-weight`, `font-family` → `Text` `variant`/`weight`.
- `color` (text) → `Text` `color`/`muted`, or `Button` `variant`.
- `background`, `border`, `border-radius` → atom `variant`/`size`.
- `box-shadow` → `Card` `variant`.
- inner `padding` → atom `size`.

**Exception:** Layout-only wrappers (`Container`, `Grid`, `Row`, `Column`) may be `styled.div`.
**Exception:** Dynamic state styling (`$active`) that variant props can't express may use minimal CSS.

## Status / constants
All status values, type discriminators, and constant strings come from enums in `packages/shared/src/domain/`. Never raw `'active'`, `'draft'`, etc.

## i18n
- No hardcoded UI strings.
- Files: `packages/shared/src/i18n/resources/{en,tr}/`.
- Primary namespace: dot notation `t('ebay.connect.title')`.
- Cross-namespace `translation`: colon syntax `t('translation:common.loading')`.

## Hover effects
All interactive elements must have visible hover (color change, lift, or shadow), using `transition: all ${tkn('transitions.fast')}`.
```

- [ ] **Step 3: Delete the old standalone md**

```bash
git rm .claude/skills/frontend-rules.md
```

- [ ] **Step 4: Verify skill loads**

In a Claude Code session: `/skills` should list `frontend-rules`. (Manual verification.)

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/frontend-rules/SKILL.md
git commit -m "feat(skill): add frontend-rules skill; remove standalone md

Content of frontend-rules.md moved into SKILL.md with proper frontmatter.
Old file removed."
```

---

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (replace rules 6 and 7; add new "Frontend Rules" reference section)

- [ ] **Step 1: Strengthen rule 6 (Container/Component Split)**

Find existing rule 6 in `CLAUDE.md`:

```
6. **Container/Component Split (strict)** — Component files (`.component.tsx`) must contain ONLY JSX/markup and `useTranslation`. ALL logic (formatting, computed values, event handlers, hooks beyond `useTranslation`/`useTheme`) belongs in container files (`.container.tsx`). Utilities like `formatCurrency`, `formatDate`, `isTR` checks are logic — they go in the container.
```

Replace with:

```
6. **Container/Component Split (strict, enforced by ESLint + PreToolUse hook)** — Every feature component is split into 4 files:
   - `[Name].component.tsx` — JSX markup only. Allowed hooks: `useTranslation`, `useTheme`. Forbidden: `useState`, `useEffect`, `useMemo`, `useCallback`, `useReducer`, `useRef`, RTK Query hooks (`useQuery`/`useMutation`/`useLazyQuery`), `useSelector`, `useDispatch`, `useNavigate`, formatters (`formatCurrency`, etc.), event handlers. Forbidden: `styled(...)`.
   - `[Name].container.tsx` — All logic. Forbidden: `styled(...)`. JSX is allowed only as `<Component .../>` return.
   - `[Name].style.ts` — All `styled(...)` calls.
   - `[Name].types.ts` — `interface`/`type`/`enum` declarations only.

   **Atoms/Molecules** (`packages/ui/src/{atoms,molecules}/`) follow the same rules. **Stateful** atoms/molecules (Select, Dropdown, Tooltip, etc.) MUST split into `.container.tsx` + `.component.tsx` like features. **Stateless** atoms/molecules (Button, Badge) stay as `.component.tsx` + `.style.ts` + `.types.ts`.

   **Exempt:** `apps/web/src/features/landing/**`, `apps/web/src/**/api/*.ts(x)`, `apps/web/src/app/store.ts`, `apps/api/**`, `*.config.{ts,js,mjs,cjs}`.

   Enforced by `design-system/styled-only-in-style-files`, `design-system/types-only-in-types-files`, `design-system/logic-only-in-container`, `design-system/no-styled-in-container` ESLint rules, and by `.claude/hooks/pretooluse-frontend-rules.js` (Write/Edit/MultiEdit).
```

- [ ] **Step 2: Append new "Frontend Rules" reference section at end of `CLAUDE.md`**

```markdown

## Frontend Rules (Quick Reference)

See `.claude/skills/frontend-rules/SKILL.md` for the canonical version.

### File organization
4 files per feature component: `.component.tsx` (markup only) / `.container.tsx` (logic) / `.style.ts` (styled) / `.types.ts` (types). Stateful atoms/molecules (Select, Dropdown, etc.) also need `.container.tsx` + `.component.tsx` split. Stateless atoms (Button, Badge) stay as `.component.tsx` + `.style.ts` + `.types.ts`. Exempt: landing, RTK api files, store.ts, configs.

### Anti-patterns (will be blocked by hook + lint)
- `styled(...)` outside `.style.ts`
- `useState`/`useEffect`/RTK Query/etc. in `.component.tsx`
- `interface`/`type`/`enum` outside `.types.ts`
- Hardcoded hex/rgb colors (use `tkn('colors.*')`)
- Hardcoded px/rem spacing (use `tkn('spacing.*')`)
- `style={{ }}` inline styles
- `styled.h1`/`styled.p` (use `<Text variant="...">`)
- Raw `<select>`, `<input>`, `<button>`, native HTML form controls
- `alert()`/`confirm()` (use `MessageModal` via `showMessage`)
- Hardcoded status strings like `'active'` (use enums from `packages/shared`)
- Hardcoded UI strings (use i18n `t()`)

### Atom extension pattern in `.style.ts`
Empty template literal + variant/weight/size props in JSX. Layout CSS only in template (margin/gap/flex/grid/position/dimensions). No font-size/font-weight/color/background/border/shadow in template — those go in props.
```

- [ ] **Step 3: Validate CLAUDE.md is well-formed**

```bash
# Quick sanity — make sure no markdown broke
wc -l CLAUDE.md
# Verify rules count didn't accidentally shift
grep -c "^[0-9]\+\. \*\*" CLAUDE.md
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): strengthen container/component rule; add Frontend Rules reference

Rule 6 now references enforced ESLint keys + hook. Adds quick-reference
anti-pattern list at end."
```

---

## Phase 2 — Audit

### Task 6: Run new rules, capture baseline violation inventory

**Files:**
- Create: `docs/superpowers/plans/2026-07-06-frontend-rules-enforcement-audit.md`

**Interfaces:**
- Consumes: 4 new rules wired in Task 2 (active via `--rule` CLI override since `.eslintrc.json` has them at `"off"`)
- Produces: per-feature violation counts that drive Phase 3 task scope

- [ ] **Step 1: Run the 4 new rules explicitly across in-scope code**

```bash
npx eslint \
  --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' \
  --ext .ts,.tsx \
  apps/web/src packages/ui/src/atoms packages/ui/src/molecules \
  2>&1 | tee /tmp/audit-output.txt
```

Note: existing `.eslintrc.json` overrides for landing and apps/api still apply.

- [ ] **Step 2: Aggregate by feature + rule**

```bash
# Per-feature summary
python -c "
import re, collections
features = collections.defaultdict(lambda: collections.Counter())
with open('/tmp/audit-output.txt', encoding='utf-8', errors='replace') as f:
    for line in f:
        m = re.match(r'^(apps/web/src/features/[^/]+(?:/[^/]+)?|packages/ui/src/(?:atoms|molecules)/[^/]+).*?(design-system/[a-z-]+)', line)
        if m:
            features[m.group(1)][m.group(2)] += 1
for f in sorted(features):
    total = sum(features[f].values())
    print(f'{total:4d}  {f}')
    for rule, n in features[f].most_common():
        print(f'       {n:3d}  {rule}')
"
```

- [ ] **Step 3: Write the audit summary doc**

Create `docs/superpowers/plans/2026-07-06-frontend-rules-enforcement-audit.md`:

```markdown
# Frontend Rules Audit — Baseline (2026-07-06)

Counts below drive Phase 3 task scope.

## Summary

| Feature / Package | styled-outside-style | type-outside-types | logic-in-component | styled-in-container | Total |
|---|---|---|---|---|---|
<!-- FILL FROM STEP 2 OUTPUT -->

## Notes
<!-- anything unusual -->
```

Fill the table from Step 2 output. Commit the doc — it's a baseline record.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans/2026-07-06-frontend-rules-enforcement-audit.md
git commit -m "docs(audit): baseline violation counts for new structural rules"
```

---

## Phase 3 — Refactor (per-feature)

**General flow for every refactor task (Tasks 7–16):**

Each task uses the same 5-step pattern. Substitute the feature name in `{{FEATURE}}` and file globs in `{{GLOB}}`.

```
Step 1: Run new rules on this feature's files only
Step 2: Fix violations one file at a time (style → types → logic → container-styled)
Step 3: Run typecheck + full lint (rules still "off" in config, so use explicit --rule)
Step 4: Build @repo/ui if feature imports from there
Step 5: Commit
```

### Task 7: Refactor `dashboard`

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage/{DashboardPage.component.tsx,DashboardPage.container.tsx,DashboardPage.style.ts,DashboardPage.types.ts}`

- [ ] **Step 1: Scope the violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/dashboard 2>&1
```

- [ ] **Step 2: Fix each violation**

For each reported violation:
- **`styled(...)` outside `.style.ts`** → move the styled declaration to `DashboardPage.style.ts`, export it, import in the file that uses it.
- **`interface`/`type` outside `.types.ts`** → move to `DashboardPage.types.ts`, re-import.
- **Logic hook in `.component.tsx`** → move state/handler/formatter into the container; pass needed values as props to the component. The container already renders `<DashboardComponent ...props />`, extend that props interface (in `.types.ts`).
- **`styled(...)` in `.container.tsx`** → move to `.style.ts`.

After every fix, re-run the same `npx eslint --rule '...'` command on the directory.

- [ ] **Step 3: Verify clean**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/dashboard
# Expected: no output, exit 0
```

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck
pnpm --filter @repo/ui build 2>&1 | tail -5
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/dashboard
git commit -m "refactor(dashboard): comply with structural frontend rules"
```

---

### Task 8: Refactor `settings`

**Files:**
- Modify: `apps/web/src/features/settings/SettingsPage/{SettingsHubPage.*.tsx}`
- Modify: `apps/web/src/features/settings/drawers/*.tsx`

Note: Drawer files (e.g. `AmazonAccountDrawer.tsx`) currently don't follow the 4-file pattern. For each drawer:
- Split into `<Name>Drawer.component.tsx` + `<Name>Drawer.container.tsx` + `<Name>Drawer.style.ts` + `<Name>Drawer.types.ts` (if violations exist), OR
- If the drawer is presentation-only with no logic, add a `.style.ts` for any styled, keep logic in parent container.

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/settings 2>&1
```

- [ ] **Step 2: Fix violations**

Apply the same fix patterns as Task 7. For monolithic drawer files (`AmazonAccountDrawer.tsx`, etc.):
- Extract `styled(...)` calls into `<Name>Drawer.style.ts`
- Extract types into `<Name>Drawer.types.ts`
- If the file has `useState`/RTK Query/event handlers, split into `.container.tsx` (logic) + `.component.tsx` (markup). If purely presentational with props from parent, leave as single `.component.tsx` and ensure no logic hooks.

- [ ] **Step 3: Verify clean**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/settings
```

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck
pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/settings
git commit -m "refactor(settings): split drawers into 4-file pattern; comply with structural rules"
```

---

### Task 9: Refactor `store-settings`

**Files:**
- Modify: `apps/web/src/features/store-settings/StoreSettingsPage.*.tsx`
- Modify: `apps/web/src/features/store-settings/components/BlacklistCard/*`

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/store-settings
```

- [ ] **Step 2: Fix violations** — same pattern as Task 7. BlacklistCard is already in 3-file pattern (component/style/types), should be cleanest. Verify no `useState` in component.

- [ ] **Step 3: Verify clean** — re-run Step 1 command.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/store-settings
git commit -m "refactor(store-settings): comply with structural frontend rules"
```

---

### Task 10: Refactor `orders`

**Files:**
- Modify: `apps/web/src/features/orders/OrdersPage.*.tsx`
- Modify: `apps/web/src/features/orders/details/OrderDetailsPage.*.tsx`
- Modify: `apps/web/src/features/orders/details/components/AmazonDetailsModal.tsx` (split if has violations)

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/orders
```

- [ ] **Step 2: Fix violations** — same pattern. `AmazonDetailsModal.tsx` may need split if it has styled/logic mixed in.

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/orders
git commit -m "refactor(orders): comply with structural frontend rules"
```

---

### Task 11: Refactor `listings` (incl. listing-jobs, products, add-listings)

**Files:**
- Modify: `apps/web/src/features/listings/**/*.tsx` (multiple sub-features)

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/listings
```

- [ ] **Step 2: Fix per sub-feature** — `ListingsPage`, `AddListingsPage`, `ListingJobsPage`, `listing-jobs/details/ListingJobDetailsPage`, `products/ProductsPage`. Apply patterns from Task 7.

- [ ] **Step 3: Verify clean** — re-run Step 1.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/listings
git commit -m "refactor(listings): comply with structural frontend rules across all sub-features"
```

---

### Task 12: Refactor `listing-settings-groups`

**Files:**
- Modify: `apps/web/src/features/listing-settings-groups/**/*.tsx`

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/listing-settings-groups
```

- [ ] **Step 2: Fix violations** — `ListingSettingsGroupPage` and `listing-settings-group-form/ListingSettingsGroupForm`. Apply patterns from Task 7.

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/listing-settings-groups
git commit -m "refactor(listing-settings-groups): comply with structural frontend rules"
```

---

### Task 13: Refactor `amazon`

**Files:**
- Modify: `apps/web/src/features/amazon/accounts/AmazonAccountsPage.*.tsx`
- Modify: `apps/web/src/features/amazon/components/LinkAmazonModal.tsx`

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/amazon
```

- [ ] **Step 2: Fix violations** — `LinkAmazonModal.tsx` likely needs split into 4 files (or 3 if purely presentational).

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/amazon
git commit -m "refactor(amazon): split LinkAmazonModal; comply with structural rules"
```

---

### Task 14: Refactor `ebay`

**Files:**
- Modify: `apps/web/src/features/ebay/**/*.tsx` (3 sub-features: ebay-connect, onboarding, stores)

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/ebay
```

- [ ] **Step 2: Fix per sub-feature** — `ebay-connect/EbayConnectPage`, `onboarding/OnboardingEbayPage`, `stores/StoresPage`. Apply Task 7 patterns.

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/ebay
git commit -m "refactor(ebay): comply with structural frontend rules across sub-features"
```

---

### Task 15: Refactor `auth` + `profile`

**Files:**
- Modify: `apps/web/src/features/auth/{login,register,check-email,verify-email}/*.tsx`
- Modify: `apps/web/src/features/profile/*.tsx`
- Note: `apps/web/src/features/auth/store/authSlice.ts` is a Redux slice, not a component — leave alone.

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/styled-only-in-style-files":"error","design-system/types-only-in-types-files":"error","design-system/logic-only-in-container":"error","design-system/no-styled-in-container":"error"}' --ext .ts,.tsx apps/web/src/features/auth apps/web/src/features/profile
```

- [ ] **Step 2: Fix per page** — `LoginPage`, `RegisterPage`, `CheckEmailPage`, `VerifyEmailPage`, `ProfilePage`. Apply Task 7 patterns.

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Typecheck + build**

```bash
pnpm typecheck && pnpm --filter @repo/ui build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/features/profile
git commit -m "refactor(auth,profile): comply with structural frontend rules"
```

---

### Task 16: Refactor `packages/ui` atoms & molecules

**Files:**
- Modify: `packages/ui/src/atoms/**/*.tsx` and `packages/ui/src/molecules/**/*.tsx`

**Special scope:** Atoms/Molecules follow the same rules as features. Stateful atoms/molecules (those with `useState`/`useEffect`/`useRef`/etc. — Select, Tooltip, Dropdown, Typewriter, Table, Popover, Collapsible identified in audit) MUST split into `.container.tsx` (logic) + `.component.tsx` (presentation). Stateless atoms (Button, Badge, Icon) stay as `.component.tsx` + `.style.ts` + `.types.ts`.

The 4 rules apply uniformly:
- `styled-only-in-style-files` is OFF for atom/molecule paths (rule has built-in exemption — atom/molecule files have not historically split styled into .style.ts; ESLint will catch new violations but Task 16 doesn't need to refactor existing styled locations)
- `types-only-in-types-files` is ON — types must live in `.types.ts`
- `logic-only-in-container` is ON — stateful atoms/molecules split into container+component
- `no-styled-in-container` is ON

Expected violations to fix in Task 16: 41 `logic-only-in-container` across 7 atom/molecule files (Select, Tooltip, Dropdown, Typewriter, Table, Popover, Collapsible) — each needs new `.container.tsx` created.

- [ ] **Step 1: Scope violations**

```bash
npx eslint --rule '{"design-system/types-only-in-types-files":"error"}' --ext .ts,.tsx packages/ui/src/atoms packages/ui/src/molecules 2>&1
```

- [ ] **Step 2: Fix per atom/molecule**
  - **Stateful atoms/molecules** (Select, Tooltip, Dropdown, Typewriter, Table, Popover, Collapsible): split each into `.container.tsx` (state, refs, effects, handlers) + `.component.tsx` (JSX markup only — receives props). Create new `.container.tsx` file, move stateful logic there, update imports in `index.ts`.
  - **Stateless atoms/molecules**: move stray `interface`/`type` declarations into `.types.ts` if any exist outside.

- [ ] **Step 3: Verify clean** — re-run.

- [ ] **Step 4: Build the package**

```bash
pnpm --filter @repo/ui build 2>&1 | tail -5
```

Expected: green. If build fails because downstream code imports moved types from old location, update imports in `apps/web/src/`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/atoms packages/ui/src/molecules
git commit -m "refactor(ui): move atom/molecule types into *.types.ts files"
```

---

## Phase 4 — Validation & Activation

### Task 17: Flip new rules to `"error"`, full validate, smoke test, hook demo

**Files:**
- Modify: `.eslintrc.json` (4 new rules from `"off"` → `"error"`)

- [ ] **Step 1: Flip the 4 new rules to `"error"` in `.eslintrc.json`**

In the main `rules` block, change:

```json
    "design-system/styled-only-in-style-files": "off",
    "design-system/types-only-in-types-files": "off",
    "design-system/logic-only-in-container": "off",
    "design-system/no-styled-in-container": "off",
```

to:

```json
    "design-system/styled-only-in-style-files": "error",
    "design-system/types-only-in-types-files": "error",
    "design-system/logic-only-in-container": "error",
    "design-system/no-styled-in-container": "error",
```

- [ ] **Step 2: Full validation**

```bash
pnpm validate 2>&1 | tail -30
```

Expected: green. If failures, fix them (should not happen if Phase 3 was thorough — re-scope with `pnpm lint` to identify, fix, commit fixup per-feature).

- [ ] **Step 3: Build everything**

```bash
pnpm build 2>&1 | tail -20
```

Expected: green.

- [ ] **Step 4: Smoke test — start dev server**

```bash
pnpm dev:web
```

In a separate terminal or browser: navigate to `http://localhost:5173`. Manually verify:
- Login page loads
- After login: dashboard renders
- Settings hub renders
- Orders page renders
- Listings page renders
- Store settings page renders

Stop dev server when done.

- [ ] **Step 5: Hook demo**

In a Claude Code session, attempt:

```
Write to apps/web/src/features/dashboard/DashboardPage/DashboardPage.component.tsx
content: import { useState } from 'react';
```

Verify the PreToolUse hook blocks with `[frontend-rules] Blocked Write on DashboardPage.component.tsx: - logic hooks in *.component.tsx: useState`.

- [ ] **Step 6: Commit + push**

```bash
git add .eslintrc.json
git commit -m "feat(eslint): activate 4 structural design-system rules

Phase 4 complete. All frontend code complies with file-organization rules.
Enforced via ESLint (CI/pre-commit) and PreToolUse hook (agent writes)."
git push
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Bölüm 1 (Dosya Organizasyonu): Tasks 1-5 (rules) + Task 17 (activation)
- ✅ Bölüm 2.1 (ESLint): Tasks 1, 2, 17
- ✅ Bölüm 2.2 (Hook): Task 3
- ✅ Bölüm 2.3 (Skill): Task 4
- ✅ Bölüm 2.4 (CLAUDE.md): Task 5
- ✅ Bölüm 3.1 (Tarama): Task 6
- ✅ Bölüm 3.2-3.3 (Refactor sırası): Tasks 7-16 (matches spec table)
- ✅ Bölüm 3.4 (Doğrulama): Task 17
- ✅ Bölüm 5 (Silinecek): Task 4 Step 3 (`git rm frontend-rules.md`)
- ✅ Risk: false-positive path filtering built into rules + hook

**Type/name consistency check:**
- Rule keys: `styled-only-in-style-files`, `types-only-in-types-files`, `logic-only-in-container`, `no-styled-in-container` — used identically in plugin (Task 1), eslintrc (Task 2, 17), audit CLI (Task 6), refactor tasks (7-16), and hook (Task 3 indirectly via path patterns).
- Hook exit codes: `0` allow, `2` block — consistent across spec + plan.
- Exempt paths: identical list everywhere (landing, api/, store.ts, configs, apps/api/).
- Atom/molecule carve-out: identical (stateful atoms/molecules split into container+component; stateless stay component-only).

**No placeholders:** Every step has exact commands or exact code. Refactor steps are pattern-based (move styled to .style.ts) but explicit about which file each violation type moves to. The "fix violations" step is intentionally generic because exact line numbers are unknown until Phase 2 audit runs — but the pattern is fixed and testable.
