message(0x1001) TodoTouch {
    value: Int as uint32;
}

message(0x1002) EmptyTouch {
    value: Int as uint32;
}

message(0x1003) ExternalReplayCmd {
    amount: Int as coins;
}

message(0x1004) AccessWithdraw {
    amount: Int as coins;
}

message(0x1005) LoopBurn {
    times: Int as uint32;
}

message(0x1006) DumpTouch {
    value: Int as uint32;
}

message(0x1007) SendModePay {
    amount: Int as coins;
}

message(0x1008) DeadlockStart {
    peer: Address;
}

message(0x1009) BouncePay {
    recipient: Address;
    amount: Int as coins;
}

message(0x1010) AsyncFanOut {
    first: Address;
    second: Address;
}

message(0x1011) CellOverflowBuild {
    value: Int as uint32;
}

struct MutablePayload {
    total: Int as uint32;
    enabled: Bool;
}

message(0x1012) ArgCopyApply {
    payload: MutablePayload;
}

message(0x1013) DivideFee {
    amount: Int as coins;
}

message(0x1014) DuplicatedCheck {
    amount: Int as coins;
}

message(0x1015) ReservedExit {
    blocked: Bool;
}

message(0x1016) LoopSend {
    recipient: Address;
    times: Int as uint32;
}

message(0x1017) ZeroSend {
    amount: Int as coins;
}

message(0x1018) GetterTick {
    value: Int as uint32;
}

message(0x1019) UnsafeRandomRoll {
    modulo: Int as uint32;
}

contract Rule01TodoComment {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: TodoTouch) {
        require(sender() == self.owner, "owner only");
        // TODO: remove emergency testnet shortcut before production deploy.
        self.counter = msg.value;
    }
}

contract Rule02EmptyFunction {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    fun forgottenHook() {
    }

    receive(msg: EmptyTouch) {
        require(sender() == self.owner, "owner only");
        self.counter = msg.value;
    }
}

contract Rule03ExternalReplay {
    owner: Address;
    pool: Int as coins;
    withdrawals: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
        self.withdrawals = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool += context().value;
    }

    external(msg: ExternalReplayCmd) {
        acceptMessage();
        self.pool -= msg.amount;
        self.withdrawals += 1;
    }
}

contract Rule04AccessControl {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool += context().value;
    }

    receive(msg: AccessWithdraw) {
        self.pool -= msg.amount;
        send(SendParameters{
            to: sender(),
            value: msg.amount,
            bounce: false,
            mode: SendIgnoreErrors
        });
    }
}

contract Rule05LoopUsage {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: LoopBurn) {
        require(sender() == self.owner, "owner only");
        let i: Int = 0;
        while (i < msg.times) {
            self.counter += 1;
            i += 1;
        }
    }
}

contract Rule06DumpCall {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: DumpTouch) {
        require(sender() == self.owner, "owner only");
        dump(msg.value);
        self.counter = msg.value;
    }
}

contract Rule07SendMode {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool += context().value;
    }

    receive(msg: SendModePay) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: self.owner,
            value: msg.amount,
            bounce: false
        });
    }
}

contract Rule08PotentialDeadlock {
    owner: Address;
    pendingStatus: Bool;

    init(owner: Address) {
        self.owner = owner;
        self.pendingStatus = false;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pendingStatus = false;
    }

    receive(msg: DeadlockStart) {
        require(sender() == self.owner, "owner only");
        if (self.pendingStatus) {
            send(SendParameters{
                to: msg.peer,
                value: 0,
                bounce: true,
                mode: SendIgnoreErrors
            });
        } else {
            self.pendingStatus = true;
            send(SendParameters{
                to: msg.peer,
                value: 0,
                bounce: true,
                mode: SendIgnoreErrors
            });
        }
    }
}

contract Rule09BounceHandling {
    owner: Address;
    reserved: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.reserved = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.reserved += context().value;
    }

    receive(msg: BouncePay) {
        require(sender() == self.owner, "owner only");
        self.reserved += msg.amount;
        send(SendParameters{
            to: msg.recipient,
            value: msg.amount,
            bounce: true,
            mode: SendIgnoreErrors
        });
    }
}

contract Rule10AsyncRace {
    owner: Address;
    score: Int;

    init(owner: Address) {
        self.owner = owner;
        self.score = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.score += 1;
    }

    receive(msg: AsyncFanOut) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: msg.first,
            value: 0,
            bounce: false,
            mode: SendIgnoreErrors
        });
        send(SendParameters{
            to: msg.second,
            value: 0,
            bounce: false,
            mode: SendIgnoreErrors
        });
        self.score += 10;
        self.score -= 1;
    }
}

contract Rule11CellBounds {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: CellOverflowBuild) {
        require(sender() == self.owner, "owner only");
        let oversized = beginCell().storeUint(msg.value, 2048).endCell();
        self.counter += msg.value;
    }
}

contract Rule12ArgCopyMutation {
    owner: Address;
    total: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.total = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.total += 1;
    }

    fun apply(payload: MutablePayload) {
        payload.total = payload.total + 1;
    }

    receive(msg: ArgCopyApply) {
        require(sender() == self.owner, "owner only");
        self.apply(msg.payload);
        self.total = msg.payload.total;
    }
}

contract Rule13DivideBeforeMultiply {
    owner: Address;
    lastFee: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.lastFee = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.lastFee += 1;
    }

    receive(msg: DivideFee) {
        require(sender() == self.owner, "owner only");
        self.lastFee = (msg.amount / 1000) * 3;
    }
}

contract Rule14DuplicatedCondition {
    owner: Address;
    score: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.score = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.score += 1;
    }

    receive(msg: DuplicatedCheck) {
        require(sender() == self.owner, "owner only");
        if (msg.amount > 0) {
            self.score += 1;
        }
        if (msg.amount > 0) {
            self.score += 10;
        }
    }
}

contract Rule15ExitCodeUsage {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: ReservedExit) {
        require(sender() == self.owner, "owner only");
        if (msg.blocked) {
            throw(13);
        }
        self.counter += 1;
    }
}

contract Rule16SendInLoop {
    owner: Address;
    sent: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.sent = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.sent += 1;
    }

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
}

contract Rule17ZeroAddress {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool += context().value;
    }

    receive(msg: ZeroSend) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: address("0:0000000000000000000000000000000000000000000000000000000000000000"),
            value: msg.amount,
            bounce: false,
            mode: SendIgnoreErrors
        });
    }
}

contract Rule18StateMutationGetter {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter += 1;
    }

    receive(msg: GetterTick) {
        require(sender() == self.owner, "owner only");
        self.counter = msg.value;
    }

    get fun unsafeCounter(): Int {
        self.counter += 1;
        return self.counter;
    }
}

contract Rule19EnsurePrgSeed {
    owner: Address;
    lastRoll: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.lastRoll = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.lastRoll += 1;
    }

    receive(msg: UnsafeRandomRoll) {
        require(sender() == self.owner, "owner only");
        self.lastRoll = randomInt() % msg.modulo;
    }
}
