# Описание правил безопасности

Каждый раздел документирует одно правило детектора: что оно обнаруживает, почему шаблон опасен, и в чём разница между уязвимой и безопасной реализацией контракта.

---

## TodoComment

**Серьёзность:** Info | **Категория:** Качество кода

Детектор, который выявляет `TODO`-комментарии, оставленные в продакшн-коде.

**Почему это плохо?**
TODO-комментарии часто указывают на незавершённую, временную или отладочную логику, которую забыли убрать перед деплоем. Злоумышленник, читающий исходный код контракта, может воспользоваться подсказками из таких комментариев (например, обходным путём, который минует валидацию). Кроме того, они сигнализируют о том, что код не был должным образом проверен перед выходом в прод.

**Пример**

```tact
// Rule01TodoComment (уязвимый)
receive(msg: TodoTouch) {
    require(sender() == self.owner, "owner only");
    // TODO: remove emergency testnet shortcut before production deploy.
    self.counter = msg.value;
}
```

**Используйте вместо этого:**

```tact
// Safe01TodoComment (исправлен)
receive(msg: SafeTodoTouch) {
    require(sender() == self.owner, "owner only");
    self.counter = msg.value;
}
```

---

## EmptyFunction

**Серьёзность:** Info | **Категория:** Качество кода

Детектор, который выявляет функции с пустым телом.

**Почему это плохо?**
Пустые функции — это либо забытые заглушки, либо случайно стёртые реализации. Они создают ложное ощущение завершённости: вызывающий код предполагает, что функция что-то делает, но она молча ничего не выполняет. В контракте это может означать, что важный хук (валидация, учёт средств, генерация события) никогда не срабатывает.

**Пример**

```tact
// Rule02EmptyFunction (уязвимый)
fun forgottenHook() {
}

receive(msg: EmptyTouch) {
    require(sender() == self.owner, "owner only");
    self.counter = msg.value;
}
```

**Используйте вместо этого:**

```tact
// Safe02EmptyFunction (исправлен)
fun implementedHook(value: Int): Int {
    return value + 1;
}

receive(msg: SafeEmptyTouch) {
    require(sender() == self.owner, "owner only");
    self.counter = self.implementedHook(msg.value);
}
```

---

## ExternalReplayProtection

**Серьёзность:** Critical | **Категория:** Безопасность

Детектор, который выявляет обработчики внешних сообщений, не защищённые от атак повторного воспроизведения (replay).

**Почему это плохо?**
Внешние сообщения в TON не аутентифицируются отправителем — любой может повторно отправить ранее действительное внешнее сообщение. Без проверки порядкового номера (seqno) злоумышленник может многократно воспроизвести одну и ту же команду вывода средств, опустошая пул контракта с помощью единственного изначально легитимного сообщения.

**Пример**

```tact
// Rule03ExternalReplay (уязвимый)
external(msg: ExternalReplayCmd) {
    acceptMessage();
    self.pool -= msg.amount;
    self.withdrawals += 1;
}
```

**Используйте вместо этого:**

```tact
// Safe03ExternalReplay (исправлен)
external(msg: SafeExternalCmd) {
    require(msg.seqno == self.seqno, "bad seqno");
    acceptMessage();
    self.seqno = self.seqno + 1;
    require(self.pool >= msg.amount, "insufficient pool");
    self.pool = self.pool - msg.amount;
    self.withdrawals = self.withdrawals + 1;
}
```

---

## AccessControl

**Серьёзность:** Critical | **Категория:** Безопасность

Детектор, который выявляет ресиверы, выполняющие привилегированные операции без проверки личности вызывающего.

**Почему это плохо?**
Без проверки владельца любой адрес может вызвать обработчик. В сценарии с выводом средств это означает, что любой внешний участник может опустошить средства контракта, просто отправив сообщение с произвольной суммой. Это одна из наиболее распространённых и серьёзных уязвимостей в смарт-контрактах.

**Пример**

```tact
// Rule04AccessControl (уязвимый)
receive(msg: AccessWithdraw) {
    // Отсутствует: require(sender() == self.owner, "owner only")
    self.pool -= msg.amount;
    send(SendParameters{
        to: sender(),
        value: msg.amount,
        bounce: false,
        mode: SendIgnoreErrors
    });
}
```

**Используйте вместо этого:**

```tact
// Safe04AccessControl (исправлен)
receive(msg: SafeWithdraw) {
    require(sender() == self.owner, "owner only");
    require(self.pool >= msg.amount, "insufficient pool");
    self.pool = self.pool - msg.amount;
    send(SendParameters{
        to: self.owner,
        value: msg.amount,
        mode: 2
    });
}
```

---

## LoopUsage

**Серьёзность:** Medium | **Категория:** Газ

Детектор, который выявляет циклы с неограниченным или управляемым пользователем числом итераций.

**Почему это плохо?**
Транзакции TON имеют фиксированный лимит газа. Цикл, количество итераций которого задаётся вызывающим, может быть установлен на произвольно большое значение, что приведёт к исчерпанию газа и откату транзакции. Это может использоваться как вектор атаки типа «отказ в обслуживании» или — при списании газа за каждую итерацию — привести к тому, что контракт будет постоянно блокироваться на определённых входных данных.

**Пример**

```tact
// Rule05LoopUsage (уязвимый)
receive(msg: LoopBurn) {
    require(sender() == self.owner, "owner only");
    let i: Int = 0;
    while (i < msg.times) {
        self.counter += 1;
        i += 1;
    }
}
```

**Используйте вместо этого:**

```tact
// Safe05LoopUsage (исправлен)
receive(msg: SafeLoopBurn) {
    require(sender() == self.owner, "owner only");
    require(msg.times <= 16, "too many iterations");
    self.counter = self.counter + msg.times;
}
```

---

## DumpCall

**Серьёзность:** Info | **Категория:** Качество кода

Детектор, который выявляет вызовы `dump()`, оставленные в продакшн-коде.

**Почему это плохо?**
`dump()` — отладочная функция, выводящая значения в лог ноды. Она не влияет на логику контракта, но потребляет дополнительный газ при каждом вызове. Её наличие в продакшне сигнализирует о том, что код не прошёл должную проверку. В высоконагруженных контрактах потраченный газ суммируется, а отладочный вывод может раскрывать внутреннее состояние операторам нод.

**Пример**

```tact
// Rule06DumpCall (уязвимый)
receive(msg: DumpTouch) {
    require(sender() == self.owner, "owner only");
    dump(msg.value);  // отладочный вызов оставлен в продакшне
    self.counter = msg.value;
}
```

**Используйте вместо этого:**

```tact
// Safe06DumpCall (исправлен)
receive(msg: SafeDebugTouch) {
    require(sender() == self.owner, "owner only");
    self.counter = msg.value;
}
```

---

## SendMode

**Серьёзность:** Medium | **Категория:** Безопасность

Детектор, который выявляет вызовы `send()` без явного поля `mode`, полагающиеся на значение по умолчанию `0`.

**Почему это плохо?**
Режим `0` вычитает комиссию за перевод из отправляемой суммы, поэтому получатель получает меньше, чем ожидается. Он также не обрабатывает ошибки предсказуемым образом. Отсутствие явного указания режима делает намерение неоднозначным и является распространённым источником ошибок в учёте. Рекомендуемый режим для большинства исходящих платежей — `2` (комиссии оплачиваются отдельно, ошибки не игнорируются).

**Пример**

```tact
// Rule07SendMode (уязвимый)
receive(msg: SendModePay) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{
        to: self.owner,
        value: msg.amount,
        bounce: false
        // mode не задан — по умолчанию 0
    });
}
```

**Используйте вместо этого:**

```tact
// Safe07SendMode (исправлен)
receive(msg: SafeSendModePay) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{
        to: self.owner,
        value: msg.amount,
        mode: 2
    });
}
```

---

## PotentialDeadlock

**Серьёзность:** High | **Категория:** Безопасность

Детектор, который выявляет контракты, способные войти в состояние, из которого они не могут продолжить работу.

**Почему это плохо?**
Когда контракт устанавливает флаг `pendingStatus` и затем отправляет bouncing-сообщение, неуспешная доставка приводит к тому, что bounce сбрасывает флаг обратно — но контракт может продолжить отправку bouncing-сообщений в зависимости от текущего значения флага. Некорректное управление флагом при параллельных или неуспешных сообщениях может навсегда заблокировать контракт в состоянии, где каждое входящее сообщение либо отклоняется, либо запускает неразрешимую цепочку bounce-сообщений.

**Пример**

```tact
// Rule08PotentialDeadlock (уязвимый)
receive(msg: DeadlockStart) {
    require(sender() == self.owner, "owner only");
    if (self.pendingStatus) {
        send(SendParameters{ to: msg.peer, value: 0, bounce: true, mode: SendIgnoreErrors });
    } else {
        self.pendingStatus = true;
        send(SendParameters{ to: msg.peer, value: 0, bounce: true, mode: SendIgnoreErrors });
    }
}
```

**Используйте вместо этого:**

```tact
// Safe08PotentialDeadlock (исправлен)
receive(msg: SafeCoordinationStart) {
    require(sender() == self.owner, "owner only");
    require(self.isOpen, "closed");
    send(SendParameters{
        to: msg.peer,
        value: 0,
        mode: 2
    });
}
```

---

## BounceHandling

**Серьёзность:** Medium | **Категория:** Безопасность

Детектор, который выявляет контракты, изменяющие состояние перед исходящей отправкой без обработки соответствующего bounce.

**Почему это плохо?**
Если сообщение отправлено с `bounce: true` и контракт-получатель отклоняет его, возвращается bounce-сообщение. Когда контракт уже обновил внутренний учёт (например, увеличил `reserved`) до отправки, отсутствие обработчика `bounced` означает, что состояние никогда не будет скорректировано. Со временем это приводит к несогласованному учёту, при котором контракт считает, что у него больше зарезервированных средств, чем он фактически контролирует.

**Пример**

```tact
// Rule09BounceHandling (уязвимый)
receive(msg: BouncePay) {
    require(sender() == self.owner, "owner only");
    self.reserved += msg.amount;  // состояние обновлено до отправки
    send(SendParameters{
        to: msg.recipient,
        value: msg.amount,
        bounce: true,             // но обработчика bounced{} нет
        mode: SendIgnoreErrors
    });
}
```

**Используйте вместо этого:**

```tact
// Safe09BounceHandling (исправлен)
receive(msg: SafeBouncePay) {
    require(sender() == self.owner, "owner only");
    require(msg.recipient != address("0:0000000000000000000000000000000000000000000000000000000000000000"), "bad recipient");
    self.reserved = self.reserved + msg.amount;
    send(SendParameters{
        to: msg.recipient,
        value: msg.amount,
        mode: 2
    });
}
```

---

## AsyncRace

**Серьёзность:** High | **Категория:** Безопасность

Детектор, который выявляет контракты, отправляющие несколько сообщений в одной транзакции, а затем изменяющие состояние так, что это зависит от успешной доставки обоих сообщений.

**Почему это плохо?**
Доставка сообщений в TON асинхронна. Когда контракт рассылает сообщения двум адресам и затем обновляет общее состояние, две дочерние транзакции могут выполняться в любом порядке, и каждая из них может завершиться неудачей. Мутации состояния, предполагающие определённый порядок выполнения или рассчитывающие на успех обоих сообщений, дадут некорректный результат, если доставлено только одно сообщение, оставив контракт в несогласованном состоянии.

**Пример**

```tact
// Rule10AsyncRace (уязвимый)
receive(msg: AsyncFanOut) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{ to: msg.first,  value: 0, bounce: false, mode: SendIgnoreErrors });
    send(SendParameters{ to: msg.second, value: 0, bounce: false, mode: SendIgnoreErrors });
    self.score += 10;  // предполагает успех обоих сообщений
    self.score -= 1;
}
```

**Используйте вместо этого:**

```tact
// Safe10AsyncRace (исправлен)
receive(msg: SafeSingleSend) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{
        to: msg.recipient,
        value: 0,
        mode: 2
    });
    self.score = self.score + 9;  // единственное детерминированное обновление
}
```

---

## CellBounds

**Серьёзность:** High | **Категория:** Безопасность

Детектор, который выявляет вызовы `storeUint` / `storeInt`, чья битовая ширина превышает ёмкость ячейки TVM.

**Почему это плохо?**
Ячейка TVM может хранить не более 1023 бит данных. Вызов `storeUint(value, 2048)` запрашивает 2048 бит, что переполняет лимит ячейки и вызывает исключение времени выполнения (код выхода 8). Это всегда приведёт к откату транзакции, делая любой обработчик, использующий этот код, навсегда неработоспособным — фактически это отказ в обслуживании для данного пути выполнения.

**Пример**

```tact
// Rule11CellBounds (уязвимый)
receive(msg: CellOverflowBuild) {
    require(sender() == self.owner, "owner only");
    let oversized = beginCell().storeUint(msg.value, 2048).endCell();  // 2048 > 1023 бит
    self.counter += msg.value;
}
```

**Используйте вместо этого:**

```tact
// Safe11CellBounds (исправлен)
receive(msg: SafeCellBuild) {
    require(sender() == self.owner, "owner only");
    let packed = beginCell().storeUint(msg.value, 32).endCell();  // 32 бита, в пределах лимита
    self.counter = msg.value;
}
```

---

## ArgCopyMutation

**Серьёзность:** Medium | **Категория:** Баг

Детектор, который выявляет функции, мутирующие аргумент-структуру в расчёте на то, что мутация будет видна на месте вызова.

**Почему это плохо?**
В Tact структуры передаются по значению. Изменение параметра функции меняет только локальную копию; исходная переменная на месте вызова остаётся нетронутой. Код, который читает «изменённый» аргумент после вызова, молча прочитает исходное, неизменённое значение, вызывая логические ошибки, которые сложно отладить, потому что код выглядит корректно на первый взгляд.

**Пример**

```tact
// Rule12ArgCopyMutation (уязвимый)
fun apply(payload: MutablePayload) {
    payload.total = payload.total + 1;  // мутирует только локальную копию
}

receive(msg: ArgCopyApply) {
    require(sender() == self.owner, "owner only");
    self.apply(msg.payload);
    self.total = msg.payload.total;  // читает исходное, неизменённое значение
}
```

**Используйте вместо этого:**

```tact
// Safe12ArgCopyMutation (исправлен)
fun apply(payload: SafePayload): Int {
    return payload.total + 1;  // возвращает вычисленное значение
}

receive(msg: SafeArgApply) {
    require(sender() == self.owner, "owner only");
    self.total = self.apply(msg.payload);
}
```

---

## DivideBeforeMultiply

**Серьёзность:** Medium | **Категория:** Баг

Детектор, который выявляет выражения, в которых целочисленное деление выполняется до умножения, вызывая потерю точности.

**Почему это плохо?**
Целочисленное деление в TVM усекает результат. Когда деление идёт первым, дробная часть отбрасывается ещё до того, как умножение усиливает ошибку. Например, `(5 / 1000) * 3` вычисляется в `0`, тогда как `(5 * 3) / 1000` даёт корректный результат для реалистичных значений. В расчётах комиссий разница существенна и всегда смещена в меньшую сторону, что означает систематическое занижение платы контрактом.

**Пример**

```tact
// Rule13DivideBeforeMultiply (уязвимый)
receive(msg: DivideFee) {
    require(sender() == self.owner, "owner only");
    self.lastFee = (msg.amount / 1000) * 3;  // усечение до умножения
}
```

**Используйте вместо этого:**

```tact
// Safe13DivideBeforeMultiply (исправлен)
receive(msg: SafeDivideFee) {
    require(sender() == self.owner, "owner only");
    self.lastFee = (msg.amount * 3) / 1000;  // сначала умножение, затем деление
}
```

---

## DuplicatedCondition

**Серьёзность:** Info | **Категория:** Качество кода

Детектор, который выявляет одинаковые условные выражения, встречающиеся более одного раза в одной области видимости.

**Почему это плохо?**
Дублированные условия указывают на ошибки копирования-вставки или незавершённый рефакторинг. Оба ветвления вычисляют один и тот же предикат, поэтому их совокупный эффект всегда эквивалентен одному из них — разработчик почти наверняка имел в виду два разных условия. Это создаёт вводящую в заблуждение логику, повышенные расходы газа и затрудняет будущее сопровождение, поскольку изменение одной копии автоматически не обновляет другую.

**Пример**

```tact
// Rule14DuplicatedCondition (уязвимый)
receive(msg: DuplicatedCheck) {
    require(sender() == self.owner, "owner only");
    if (msg.amount > 0) {
        self.score += 1;
    }
    if (msg.amount > 0) {  // идентичное условие — вероятно, ошибка копирования
        self.score += 10;
    }
}
```

**Используйте вместо этого:**

```tact
// Safe14DuplicatedCondition (исправлен)
receive(msg: SafeConditionCheck) {
    require(sender() == self.owner, "owner only");
    if (msg.amount > 1000) {
        self.score = self.score + 10;
    } else {
        self.score = self.score + 1;
    }
}
```

---

## ExitCodeUsage

**Серьёзность:** Low | **Категория:** Безопасность

Детектор, который выявляет вызовы `throw()` с кодами выхода, зарезервированными стандартом TON (0–255).

**Почему это плохо?**
Коды выхода 0–255 зарезервированы для системных ошибок TVM и TON. Использование их в пользовательской логике контракта создаёт неоднозначность: инструменты, индексаторы и офф-чейн клиенты не могут отличить системную ошибку от намеренного отклонения контрактом. Это также рискует столкнуться с будущими кодами ошибок TVM, вызывая некорректное поведение в клиентах обработки ошибок или приводя к молчаливой неверной классификации исключений.

**Пример**

```tact
// Rule15ExitCodeUsage (уязвимый)
receive(msg: ReservedExit) {
    require(sender() == self.owner, "owner only");
    if (msg.blocked) {
        throw(13);  // 13 находится в зарезервированном диапазоне 0–255
    }
    self.counter += 1;
}
```

**Используйте вместо этого:**

```tact
// Safe15ExitCodeUsage (исправлен)
receive(msg: SafeExit) {
    require(sender() == self.owner, "owner only");
    if (msg.blocked) {
        throw(256);  // ≥256 — безопасный пользовательский диапазон
    }
    self.counter = self.counter + 1;
}
```

---

## SendInLoop

**Серьёзность:** Medium | **Категория:** Газ

Детектор, который выявляет вызовы `send()`, размещённые внутри циклов.

**Почему это плохо?**
Каждый `send()` ставит в очередь исходящее сообщение и потребляет газ. Размещение `send()` внутри цикла означает, что количество сообщений масштабируется вместе с пользовательскими данными, что может исчерпать лимит газа транзакции и откатить всё, или — при небольшом числе итераций, но частых вызовах контракта — значительно увеличить операционные расходы. Это также добавляет непредсказуемость профилю газа контракта, затрудняя оценку затрат в наихудшем случае.

**Пример**

```tact
// Rule16SendInLoop (уязвимый)
receive(msg: LoopSend) {
    require(sender() == self.owner, "owner only");
    repeat (msg.times) {
        send(SendParameters{
            to: msg.recipient,
            value: 0,
            bounce: false,
            mode: SendIgnoreErrors
        });
        self.sent += 1;
    }
}
```

**Используйте вместо этого:**

```tact
// Safe16SendInLoop (исправлен)
receive(msg: SafeBatch) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{
        to: msg.recipient,
        value: msg.amount,
        mode: 2
    });
    self.sent = self.sent + 1;
}
```

---

## ZeroAddress

**Серьёзность:** Low | **Категория:** Безопасность

Детектор, который выявляет использование нулевого адреса.

**Почему это плохо?**
Использование нулевого адреса в смарт-контрактах, как правило, проблематично: он может эксплуатироваться как значение по умолчанию или неинициализированный адрес, что приводит к непреднамеренным переводам и уязвимостям безопасности. Кроме того, операции с нулевым адресом могут привести к потере средств или токенов, поскольку приватного ключа для доступа к этому адресу не существует.

**Пример**

```tact
// Rule17ZeroAddress (уязвимый)
receive(msg: ZeroSend) {
    require(sender() == self.owner, "owner only");
    send(SendParameters{
        to: address("0:0000000000000000000000000000000000000000000000000000000000000000"),
        value: msg.amount,
        bounce: false,
        mode: SendIgnoreErrors
    });
}
```

**Используйте вместо этого:**

```tact
// Safe17ZeroAddress (исправлен)
receive(msg: SafeAddressSend) {
    require(sender() == self.owner, "owner only");
    require(msg.recipient != address("0:0000000000000000000000000000000000000000000000000000000000000000"), "bad recipient");
    send(SendParameters{
        to: msg.recipient,
        value: msg.amount,
        mode: 2
    });
}
```

---

## StateMutationInGetter

**Серьёзность:** High | **Категория:** Безопасность

Детектор, который выявляет `get`-функции, изменяющие состояние контракта.

**Почему это плохо?**
Геттер-функции в TON выполняются офф-чейн через `runGetMethod`. Они не отправляют транзакцию, поэтому любые изменения состояния внутри них молча отбрасываются — хранилище на цепочке никогда не обновляется. Код, полагающийся на побочные эффекты в геттере (например, инкремент счётчика или списание комиссии), будет работать некорректно: мутация происходит локально при симуляции, но никогда не сохраняется, создавая расхождение между ожиданиями разработчиков и тем, что фиксирует блокчейн.

**Пример**

```tact
// Rule18StateMutationGetter (уязвимый)
get fun unsafeCounter(): Int {
    self.counter += 1;  // изменение состояния в геттере — молча отбрасывается
    return self.counter;
}
```

**Используйте вместо этого:**

```tact
// Safe18StateMutationGetter (исправлен)
get fun safeCounter(): Int {
    return self.counter;  // только чтение — без побочных эффектов
}
```

---

## EnsurePrgSeed

**Серьёзность:** High | **Категория:** Безопасность

Детектор, который выявляет вызовы `randomInt()`, которым не предшествует `nativePrepareRandom()`.

**Почему это плохо?**
В TON сид генератора псевдослучайных чисел (ГПСЧ) детерминирован и выводится из данных уровня блока. Без предварительного вызова `nativePrepareRandom()` сид не смешивается с энтропией, специфичной для транзакции, что делает результат предсказуемым. Злоумышленник, способный наблюдать за параметрами блока или влиять на них, может предсказать результат `randomInt()` и эксплуатировать любую логику, зависящую от него (лотереи, перемешивание, схемы commit-reveal и т.д.).

**Пример**

```tact
// Rule19EnsurePrgSeed (уязвимый)
receive(msg: UnsafeRandomRoll) {
    require(sender() == self.owner, "owner only");
    self.lastRoll = randomInt() % msg.modulo;  // сид не инициализирован
}
```

**Используйте вместо этого:**

```tact
// Safe19EnsurePrgSeed (исправлен)
receive(msg: SafeRandomRoll) {
    require(sender() == self.owner, "owner only");
    nativePrepareRandom();                      // сначала добавляем энтропию транзакции
    self.lastRoll = randomInt() % msg.modulo;
}
```
