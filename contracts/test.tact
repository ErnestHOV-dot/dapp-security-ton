message AddPoints {
    amount: Int as uint32;
}

contract TestGasContract {
    owner: Address;
    points: Int as uint32 = 0;
    depositsCount: Int as uint32 = 0;
    lastText: String = "";

    init(owner: Address) {
        self.owner = owner;
    }

    receive() {
        self.depositsCount = self.depositsCount + 1;
    }

    receive("deposit") {
        self.depositsCount = self.depositsCount + 1;
        self.lastText = "deposit";
    }

    receive(msg: AddPoints) {
        require(sender() == self.owner, "Only owner can add points");
        self.points = self.points + msg.amount;
    }

    get fun getPoints(): Int {
        return self.points;
    }

    get fun getDepositsCount(): Int {
        return self.depositsCount;
    }

    get fun getLastText(): String {
        return self.lastText;
    }
}