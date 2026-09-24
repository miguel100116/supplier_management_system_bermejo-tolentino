# Dependency and supply-chain review

Status: locally verified on 2026-09-24; no package publication or deployment performed.

## Result

The clean-install audit originally reported 11 advisories: 1 critical, 5 high, and 5 moderate. The remediation upgraded or replaced the affected dependency paths without `npm audit fix --force`:

- `jspdf` was upgraded to `4.2.1` and `jspdf-autotable` to `5.0.8`.
- Express resolves to `4.22.3`; the affected `body-parser` and `qs` transitives were updated by the normal non-breaking audit fix.
- PostCSS resolves to `8.5.28`.
- The stale npm-registry `xlsx` package was replaced with the official SheetJS Community Edition `0.20.3` tarball from `cdn.sheetjs.com`.
- PptxGenJS's browser-unused `image-size` dependency is overridden to patched version `2.0.4`. A real PPTX buffer-generation regression test protects the export path.

`npm audit --json` reports zero vulnerabilities after the remediation. The lockfile is authoritative and CI installs it with `npm ci`.

## Install-script review

`npm install-scripts ls` reports only these package-owned hooks:

| Package | Hook | Static review and trust decision |
| --- | --- | --- |
| `core-js@3.49.0` | `postinstall` | Reads environment flags and a temporary banner cache, then optionally prints a funding message. It does not modify the repository, elevate privileges, or transmit data. Trusted but nonessential. |
| `esbuild@0.28.1` | `postinstall` | Selects the official platform-specific optional package, checks the binary version/hash contract, and falls back to downloading the matching official npm artifact only when the binary is unavailable. Required for the direct server build/test tooling. |
| `esbuild@0.25.12` | `postinstall` | The same bounded installer used transitively by Vite. Required for the frontend production build. |

The static review found no privilege changes, persistence, hidden shell execution, credential reads, or unrelated system modification in these hooks. Clean install, TypeScript checks, tests, and production build are the executable verification; package hooks must be re-reviewed when their versions or ownership change.

## Ongoing rule

Do not use forced audit remediation. Review direct versus transitive ownership, changelogs, install hooks, runtime reachability, export behavior, and the final lockfile. A zero advisory count is not a substitute for reviewing new package code or deployment configuration.
