message AddPoints {
    amount: Int as uint32;
}

contract UserDemoContract {
    owner: Address;
    totalDeposited: Int as uint64 = 0;
    points: Int as uint32 = 0;
    flag: Bool = false;

    init() {
        self.owner = sender();
    }

    receive() {
        self.points = self.points + 1;
    }

    receive("deposit") {
        self.totalDeposited = self.totalDeposited + context().value;
    }

    receive("noop") {
    }

    receive("withdraw") {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: "withdraw".asComment()
        });
    }

    receive("batch") {
        let i: Int = 0;
        while (i < 20) {
            i = i + 1;
        }
    }

    receive(msg: AddPoints) {
        self.points = self.points + msg.amount;
    }

    external("sync") {
        self.flag = true;
    }

    get fun pointsValue(): Int {
        return self.points;
    }

    get fun depositedValue(): Int {
        return self.totalDeposited;
    }

    get fun flagValue(): Bool {
        return self.flag;
    }
}
