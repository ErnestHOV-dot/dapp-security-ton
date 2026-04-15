# Gas Profiler

## Назначение

`gas_profiler` — отдельный модуль для профилирования газа и комиссий Tact-контрактов в `@ton/sandbox`.
Он не пытается угадывать поведение контракта автоматически: пользователь явно задает сценарии через JSON-файл, а модуль исполняет их и формирует отчет.

Архитектурно модуль отделен от статического анализатора и может использоваться рядом с ним в дипломном проекте как независимый блок динамического анализа.

## Запуск

Отдельный entrypoint:

```bash
npm run gas:profile -- \
  --contract ./contracts/GasTestContract.tact \
  --scenarios ./examples/gas-profile/basic.scenarios.json
```

Через основной CLI:

```bash
npm run analyze -- \
  --gas-profile \
  --contract ./contracts/GasTestContract.tact \
  --scenarios ./examples/gas-profile/basic.scenarios.json
```

## Параметры CLI

- `--contract <path>` — путь к `.tact` файлу или директории проекта.
- `--scenarios <path>` — путь к JSON-файлу со сценариями.
- `--build <path>` — путь к build-артефактам Tact.
- `--wrapper <path>` — путь к generated wrapper.
- `--output <path>` — путь для сохранения JSON-отчета.
- `--format <json|pretty>` — формат CLI-вывода.
- `--gas-profile` — флаг для запуска через общий `analyze` entrypoint.

Если `--output` не указан, используется `./reports/gas-profile-report.json`.

## Формат scenario JSON

```json
{
  "contractName": "MyContract",
  "description": "Gas profiling scenarios for MyContract",
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
      "name": "empty receive",
      "kind": "receive-empty",
      "value": "10000000"
    },
    {
      "name": "deposit text",
      "kind": "receive-text",
      "text": "deposit",
      "value": "50000000"
    },
    {
      "name": "get counter",
      "kind": "getter",
      "methodName": "counter",
      "args": []
    }
  ]
}
```

## Поддерживаемые сценарии первой версии

- `deploy`
- `getter`
- `receive-empty`
- `receive-text`
- `receive-typed`

## Ограничения первой версии

- `receive-typed` работает только если generated wrapper экспортирует нужный `store<MessageType>()`.
- Для разворачивания контракта в Sandbox ожидается generated wrapper с `fromInit()`.
- `getter`-аргументы в JSON поддерживают базовые tuple item формы: `null`, `int`, `cell`, `slice`, `builder`, `tuple`.
- `external receivers`, `bounce scenarios`, `tick/tock` и автогенерация сценариев из ABI пока не реализованы.

## Авторазрешение build и wrapper

Модуль пытается найти `tact.config.json`, сопоставить контракт с проектом, определить build-директорию и wrapper.
Если wrapper не найден, profiler пробует запустить локальную сборку `tact --config ...`.

Если этого недостаточно, пользователь может явно указать:

```bash
--build ./build
--wrapper ./build/myproject_MyContract.ts
```

## Структура отчета

JSON-отчет содержит:

- информацию о контракте и входных файлах;
- timestamp генерации;
- результаты по каждому сценарию;
- суммарную статистику `overall`.

Ключевые поля сценария:

- `metrics[]` — набор метрик по транзакциям сценария;
- `summary.totalGasUsed`
- `summary.totalFees`
- `summary.success`
- `summary.transactionCount`

Все `bigint` сериализуются в строки для совместимости с JSON.
