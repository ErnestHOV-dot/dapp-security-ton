import "@stdlib/deploy";

contract VulnerableContract with Deployable {
    owner: Address;
    counter: Int as uint32;

    init() {
        self.owner = sender();
        self.counter = 0;
    }

    // 0. ФУНКЦИЯ ДЛЯ ПОПОЛНЕНИЯ (Копилка)
    // контракт примет деньги, если написать "topup"
    receive("topup") {
        // Ничего не делаем, просто оставляем деньги у себя
    }

    // 1. УЯЗВИМОСТЬ: Пустая функция
    // Анализатор должен выдать WARNING: Пустая функция, трата газа.
    receive("empty_func") {
        
    }

    // 2. УЯЗВИМОСТЬ: Опасный цикл while
    // Анализатор должен выдать CRITICAL: Риск Out-of-Gas.
    receive("dangerous_loop") {
        let i: Int = 0;
        while (i < 500) { 
            i = i + 1;
        }
    }

    // 3. УЯЗВИМОСТЬ: Забытый dump
    // Анализатор должен выдать CRITICAL: Забытый dump().
    receive("debug_me") {
        dump("System check...");
    }

    // 4. КРИТИЧЕСКАЯ УЯЗВИМОСТЬ: Вывод денег БЕЗ проверки владельца
    // Анализатор должен выдать WARNING: Нет явных проверок require(sender() == ...).
    // Именно эту функцию мы будем взламывать скриптом hack.ts!
    receive("withdraw") {
        // ОШИБКА: Тут не хватает строки: require(sender() == self.owner, "No access");
        
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: 128, // 128 = SendRemainingBalance (отправить все деньги обратно вызывающему)
            body: "You got hacked".asComment()
        });
    }

    // 5. УЯЗВИМОСТЬ: External сообщение без защиты
    // Анализатор должен выдать CRITICAL: Нет защиты от Replay Attack.
    external("unsafe_external") {
        self.counter = self.counter + 1;
    }
}
