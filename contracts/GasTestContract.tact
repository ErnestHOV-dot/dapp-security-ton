message AddValue {
    amount: Int as uint32;
}

message SetFlag {
    value: Bool;
}

contract GasTestContract {
    owner: Address;
    counter: Int as uint32 = 0;
    totalReceived: Int as uint64 = 0;
    flag: Bool = false;

    init(owner: Address) {
        self.owner = owner;
    }

    receive() {
        self.counter = self.counter + 1;
    }

    receive("increment") {
        self.counter = self.counter + 1;
    }

    receive("deposit") {
        self.totalReceived = self.totalReceived + context().value;
    }

    receive(msg: AddValue) {
        self.counter = self.counter + msg.amount;
    }

    receive(msg: SetFlag) {
        require(sender() == self.owner, "Not owner");
        self.flag = msg.value;
    }

    get fun counterValue(): Int {
        return self.counter;
    }

    get fun totalReceivedValue(): Int {
        return self.totalReceived;
    }

    get fun flagValue(): Bool {
        return self.flag;
    }
}