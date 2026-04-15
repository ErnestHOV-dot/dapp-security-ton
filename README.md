# dapp-security-ton

CLI toolkit for static analysis and gas profiling of TON Tact smart contracts.

## What It Does

The project currently provides two user-facing capabilities:

- `static analysis` for heuristic security checks on Tact source files
- `gas profiling` in `@ton/sandbox` driven by explicit JSON scenarios

The gas profiler is scenario-based by design. It does not guess contract behavior automatically; the user defines the calls to execute and the tool produces a structured JSON report plus a short console summary.

## Quick Start

```bash
npm install
npm run tact:build
npm run build
```

Run static analysis:

```bash
npm run analyze -- ./contracts/GasTestContract.tact
```

Run gas profiling:

```bash
npm run gas:profile -- \
  --contract ./contracts/GasTestContract.tact \
  --scenarios ./examples/gas-profile/basic.scenarios.json
```

Run gas profiling through the main CLI:

```bash
npm run analyze -- \
  --gas-profile \
  --contract ./contracts/GasTestContract.tact \
  --scenarios ./examples/gas-profile/basic.scenarios.json
```

## CLI Commands

| Command | Purpose |
|---|---|
| `npm run analyze -- <contract>` | Run static analysis on a Tact file |
| `npm run gas:profile -- ...` | Run gas profiling scenarios |
| `npm run tact:build` | Build Tact artifacts and wrappers |
| `npm run build` | Compile the TypeScript project |
| `npm run test` | Run tests |
| `npm run clean` | Remove generated `dist`, `build`, and `reports` directories |

## Gas Profiling Inputs

Supported CLI flags:

- `--contract <path>`
- `--scenarios <path>`
- `--build <path>`
- `--wrapper <path>`
- `--output <path>`
- `--format <json|pretty>`

Example scenario files:

- [examples/gas-profile/basic.scenarios.json](/Users/e.salakhov/Desktop/static/dapp-security-ton/examples/gas-profile/basic.scenarios.json)
- [examples/gas-profile/typed.scenarios.json](/Users/e.salakhov/Desktop/static/dapp-security-ton/examples/gas-profile/typed.scenarios.json)

Detailed profiler documentation: [docs/gas-profiler.md](/Users/e.salakhov/Desktop/static/dapp-security-ton/docs/gas-profiler.md)

## Project Layout

```text
src/
  index.ts
  cli.ts
  linter.ts
  gas_profiler/
  rules/
scripts/
  run-gas-profiler.ts
contracts/
  GasTestContract.tact
examples/
  gas-profile/
docs/
tests/
```

## Notes

- The default demo contract is `contracts/GasTestContract.tact`.
- Generated artifacts are written to `build/`.
- Reports are written to `reports/` unless `--output` is provided.
- The current profiler version supports `deploy`, `getter`, `receive-empty`, `receive-text`, and wrapper-backed `receive-typed`.

---

## 📌 Примечание

Если необходимо анализировать другой контракт, достаточно изменить значение `FILENAME` в `src/index.ts` или доработать CLI-передачу пути к файлу в будущем.
