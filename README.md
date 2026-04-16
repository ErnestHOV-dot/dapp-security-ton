# dapp-security-ton

CLI-инструмент для статического анализа и gas profiling Tact-смарт-контрактов в сети TON.

## Что умеет

Проект поддерживает два режима работы:

- `Статический анализ`
  Проверяет Tact-контракт по набору эвристических правил и показывает найденные риски.

- `Gas profiling`
  Исполняет контракт в `@ton/sandbox` по JSON-сценариям, считает `gas` и `fees`, сохраняет отчеты в `JSON` и `Markdown`.

## Установка

```bash
npm install
```

Если используешь gas profiler и тебе нужны generated wrappers:

```bash
npm run tact:build
```

Сборка TypeScript:

```bash
npm run build
```

## Статический анализ

Запуск:

```bash
npm run analyze -- ./contracts/<YourContract>.tact
```

Что делает команда:

- читает `.tact` файл
- строит AST
- применяет правила анализа
- печатает найденные проблемы в консоль

## Gas Profiling

Базовый запуск:

```bash
npm run gas:profile -- \
  --contract ./contracts/<YourContract>.tact \
  --scenarios ./scenarios/<your-scenarios>.json
```

Запуск через общий entrypoint:

```bash
npm run analyze -- \
  --gas-profile \
  --contract ./contracts/<YourContract>.tact \
  --scenarios ./scenarios/<your-scenarios>.json
```

Что делает profiler:

- валидирует входные параметры
- находит или использует generated wrapper
- поднимает `@ton/sandbox`
- прогоняет сценарии из JSON
- считает `gas` и `fees`
- сохраняет JSON и Markdown отчеты

## Основные CLI-параметры

- `--contract <path>` — путь к `.tact` контракту
- `--scenarios <path>` — путь к JSON-файлу сценариев
- `--build <path>` — путь к build-артефактам
- `--wrapper <path>` — путь к generated wrapper
- `--output <path>` — путь для сохранения JSON-отчета
- `--format <json|pretty>` — формат консольного вывода

Если `--output` не указан, JSON-отчет сохраняется в:

```text
reports/gas-profile-report.json
```

Markdown-отчет сохраняется рядом с тем же именем, но с расширением `.md`.

## Структура входных данных

В проекте больше нет демо-примеров. Пользователь должен:

- положить контракт в `contracts/`
- положить сценарии в `scenarios/`
- при необходимости добавить проект в `tact.config.json`

Минимальный пример scenario JSON:

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

Подробная документация по profiler:

- [docs/gas-profiler.md](/Users/e.salakhov/Desktop/static/dapp-security-ton/docs/gas-profiler.md)

## Формат результатов

`Gas profiler` сохраняет два отчета:

- `JSON` — машиночитаемый отчет
- `Markdown` — читаемый отчет с findings и таблицей сценариев

## NPM-команды

| Команда | Назначение |
|---|---|
| `npm run analyze -- <contract>` | статический анализ контракта |
| `npm run gas:profile -- ...` | запуск gas profiler |
| `npm run tact:build` | сборка Tact-артефактов |
| `npm run build` | сборка TypeScript |
| `npm run test` | запуск тестов |
| `npm run clean` | удаление `dist`, `build`, `reports` |

## Ограничения текущей версии

Сейчас profiler поддерживает:

- `deploy`
- `getter`
- `receive-empty`
- `receive-text`
- `receive-typed` через generated wrapper и `store<MessageType>()`

Profiler не генерирует сценарии автоматически. Пользователь явно задает их в JSON.

## Структура проекта

```text
contracts/   # пользовательские Tact-контракты
scenarios/   # пользовательские JSON-сценарии для gas profiling
docs/        # документация
scripts/     # CLI entrypoints
src/         # исходный код анализатора и profiler
tests/       # тесты
build/       # generated Tact artifacts
reports/     # generated profiler reports
```
