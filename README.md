# dapp-security-ton

CLI toolkit для статического анализа Tact-смарт-контрактов в TON, демонстрационных vulnerable/safe контрактов, testnet deployment и gas profiling.

## Быстрый старт

```bash
npm install
npm run tact:build
npm run build
npm run test
```

Проверить vulnerable и safe мини-контракты:

```bash
npm run analyze -- contracts/rule-vulnerable-minis.tact
npm run analyze -- contracts/rule-safe-minis.tact
```

Ожидаемый результат:

- `rule-vulnerable-minis.tact` должен находить проблемы по правилам.
- `rule-safe-minis.tact` должен проходить без findings.

## .env

Для testnet deploy нужен `.env` в корне проекта:

```env
MNEMONIC="word1 word2 ... word24"
TON_API_KEY="optional-toncenter-key"
TON_TESTNET_RPC="https://testnet.toncenter.com/api/v2/jsonRPC"
TON_RPC_TIMEOUT_MS=120000
MINI_DEPLOY_VALUE=0.05
```

`MNEMONIC` уже может лежать в твоем `.env`. Скрипты также понимают `TESTNET_MNEMONIC`.

## Структура

```text
contracts/
  rule-vulnerable-minis.tact  # 19 intentionally vulnerable mini contracts
  rule-safe-minis.tact        # fixed contracts for the same rules
scripts/
  deploy-testnet.ts           # deploy vulnerable minis to TON testnet
  get-wallet-address.ts       # print wallet address from mnemonic
src/
  rules/                      # analyzer rules
  gas_profiler/               # sandbox gas profiler
tests/                        # node:test test suite
build/                        # generated Tact wrappers, ignored by git
reports/                      # generated gas reports, ignored by git
dist/                         # compiled TypeScript, ignored by git
```

`build/`, `reports/` и `dist/` являются generated output. Удалить их можно командой:

```bash
npm run clean
```

После `clean` снова выполни `npm run tact:build`, потому что `scripts/deploy-testnet.ts` использует generated wrappers из `build/`.

## Статический анализатор

Запуск:

```bash
npm run analyze -- <path-to-contract.tact>
```

Примеры:

```bash
npm run analyze -- contracts/rule-vulnerable-minis.tact
npm run analyze -- contracts/rule-safe-minis.tact
```

Анализатор парсит Tact через `@tact-lang/compiler` и передает в правила AST. Большинство правил работает по AST. Исключение: `todo-comment`, потому что комментарии не сохраняются в AST и должны проверяться по исходному тексту. `duplicated-condition` сравнивает AST-поддеревья условий, а не ищет строковый шаблон в исходнике.

## Правила

| ID | Rule | Что ловит |
|---:|---|---|
| 01 | `todo-comment` | TODO/FIXME/HACK/BUG/XXX в исходнике |
| 02 | `empty-function` | пустые handlers/functions |
| 03 | `external-replay-protection` | external receive без replay protection |
| 04 | `access-control` | sensitive action без проверки `sender()`/owner |
| 05 | `loop-usage` | потенциально опасные циклы |
| 06 | `dump-call` | debug `dump()`/`dumpStack()` в production path |
| 07 | `send-mode` | `send()` без явного безопасного mode |
| 08 | `potential-deadlock` | pending/waiting state без завершения |
| 09 | `bounce-handling` | state accounting без bounce handler |
| 10 | `async-race` | state mutation рядом с fan-out sends |
| 11 | `cell-bounds` | serialization без контроля лимитов cell |
| 12 | `arg-copy-mutation` | mutation копии struct-аргумента |
| 13 | `divide-before-multiply` | деление до умножения в financial math |
| 14 | `duplicated-condition` | дублирующиеся условия |
| 15 | `exit-code-usage` | reserved/нежелательные exit codes |
| 16 | `send-in-loop` | отправки внутри цикла |
| 17 | `zero-address` | отправка на zero address |
| 18 | `state-mutation-in-getter` | mutation state внутри getter |
| 19 | `ensure-prg-seed` | небезопасный randomness без seed hardening |

## Mini Contracts

`contracts/rule-vulnerable-minis.tact` содержит по одному контракту на правило:

- `Rule01TodoComment` ... `Rule19EnsurePrgSeed`
- контракты специально уязвимые, чтобы анализатор находил findings
- deploy на testnet нужен только для демонстрации работы vulnerable samples в testnet

`contracts/rule-safe-minis.tact` содержит безопасные версии:

- `Safe01TodoComment` ... `Safe19EnsurePrgSeed`
- используются как regression target: анализатор не должен находить issues

## Testnet Deploy

Сгенерировать wrappers и задеплоить vulnerable minis:

```bash
npm run tact:build
npm run deploy:testnet
```

Скрипт использует `MNEMONIC` из `.env`, деплоит все `RuleXX...` контракты и печатает адреса/tonviewer links.

## Gas Profiler

Запуск:

```bash
npm run gas:profile -- \
  --contract contracts/<YourContract>.tact \
  --scenarios scenarios/<your-scenarios>.json
```

То же через общий entrypoint:

```bash
npm run analyze -- \
  --gas-profile \
  --contract contracts/<YourContract>.tact \
  --scenarios scenarios/<your-scenarios>.json
```

Основные параметры:

| Параметр | Назначение |
|---|---|
| `--contract <path>` | путь к `.tact` контракту |
| `--scenarios <path>` | путь к JSON scenario file |
| `--build <path>` | путь к generated build artifacts |
| `--wrapper <path>` | явный путь к generated wrapper |
| `--output <path>` | путь для JSON-отчета |
| `--format <json\|pretty>` | формат консольного вывода |

Если `--output` не указан, отчет сохраняется в `reports/gas-profile-report.json`, а Markdown-версия рядом как `.md`.

Минимальный scenario file:

```json
{
  "contractName": "MyContract",
  "defaults": {
    "value": "10000000",
    "senderName": "deployer"
  },
  "scenarios": [
    {
      "name": "deploy",
      "kind": "deploy"
    },
    {
      "name": "getter call",
      "kind": "getter",
      "methodName": "getValue",
      "args": []
    }
  ]
}
```

Поддерживаемые scenario kinds:

- `deploy`
- `getter`
- `receive-empty`
- `receive-text`
- `receive-typed` через generated wrapper и `store<MessageType>()`

## NPM Scripts

| Command | Назначение |
|---|---|
| `npm run analyze -- <contract>` | static analysis |
| `npm run tact:build` | generate Tact wrappers into `build/` |
| `npm run build` | TypeScript build |
| `npm run test` | test suite |
| `npm run deploy:testnet` | deploy vulnerable minis to testnet |
| `npm run wallet:address` | print wallet address from `.env` mnemonic |
| `npm run gas:profile -- ...` | sandbox gas profiler |
| `npm run clean` | remove `dist`, `build`, `reports` |

## Validation

Перед коммитом полезный минимальный набор:

```bash
npm run tact:build
npm run build
npm run test
npm run analyze -- contracts/rule-vulnerable-minis.tact
npm run analyze -- contracts/rule-safe-minis.tact
```
