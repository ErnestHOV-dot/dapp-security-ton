message(0x2001) SafeTodoTouch {
    value: Int as uint32;
}

message(0x2002) SafeEmptyTouch {
    value: Int as uint32;
}

message(0x2003) SafeExternalCmd {
    seqno: Int as uint32;
    amount: Int as coins;
}

message(0x2004) SafeWithdraw {
    amount: Int as coins;
}

message(0x2005) SafeLoopBurn {
    times: Int as uint32;
}

message(0x2006) SafeDebugTouch {
    value: Int as uint32;
}

message(0x2007) SafeSendModePay {
    amount: Int as coins;
}

message(0x2008) SafeCoordinationStart {
    peer: Address;
}

message(0x2009) SafeBouncePay {
    recipient: Address;
    amount: Int as coins;
}

message(0x2010) SafeSingleSend {
    recipient: Address;
}

message(0x2011) SafeCellBuild {
    value: Int as uint32;
}

struct SafePayload {
    total: Int as uint32;
    enabled: Bool;
}

message(0x2012) SafeArgApply {
    payload: SafePayload;
}

message(0x2013) SafeDivideFee {
    amount: Int as coins;
}

message(0x2014) SafeConditionCheck {
    amount: Int as coins;
}

message(0x2015) SafeExit {
    blocked: Bool;
}

message(0x2016) SafeBatch {
    recipient: Address;
    amount: Int as coins;
}

message(0x2017) SafeAddressSend {
    recipient: Address;
    amount: Int as coins;
}

message(0x2018) SafeGetterTick {
    value: Int as uint32;
}

message(0x2019) SafeRandomRoll {
    modulo: Int as uint32;
}

contract Safe01TodoComment {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeTodoTouch) {
        require(sender() == self.owner, "owner only");
        self.counter = msg.value;
    }
}

contract Safe02EmptyFunction {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    fun implementedHook(value: Int): Int {
        return value + 1;
    }

    receive(msg: SafeEmptyTouch) {
        require(sender() == self.owner, "owner only");
        self.counter = self.implementedHook(msg.value);
    }
}

contract Safe03ExternalReplay {
    owner: Address;
    pool: Int as coins;
    seqno: Int as uint32;
    withdrawals: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
        self.seqno = 0;
        self.withdrawals = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool = self.pool + context().value;
    }

    external(msg: SafeExternalCmd) {
        require(msg.seqno == self.seqno, "bad seqno");
        acceptMessage();
        self.seqno = self.seqno + 1;
        require(self.pool >= msg.amount, "insufficient pool");
        self.pool = self.pool - msg.amount;
        self.withdrawals = self.withdrawals + 1;
    }
}

contract Safe04AccessControl {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool = self.pool + context().value;
    }

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
}

contract Safe05LoopUsage {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeLoopBurn) {
        require(sender() == self.owner, "owner only");
        require(msg.times <= 16, "too many iterations");
        self.counter = self.counter + msg.times;
    }
}

contract Safe06DumpCall {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeDebugTouch) {
        require(sender() == self.owner, "owner only");
        self.counter = msg.value;
    }
}

contract Safe07SendMode {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool = self.pool + context().value;
    }

    receive(msg: SafeSendModePay) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: self.owner,
            value: msg.amount,
            mode: 2
        });
    }
}

contract Safe08PotentialDeadlock {
    owner: Address;
    isOpen: Bool;

    init(owner: Address) {
        self.owner = owner;
        self.isOpen = true;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.isOpen = true;
    }

    receive(msg: SafeCoordinationStart) {
        require(sender() == self.owner, "owner only");
        require(self.isOpen, "closed");
        send(SendParameters{
            to: msg.peer,
            value: 0,
            mode: 2
        });
    }
}

contract Safe09BounceHandling {
    owner: Address;
    reserved: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.reserved = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.reserved = self.reserved + context().value;
    }

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
}

contract Safe10AsyncRace {
    owner: Address;
    score: Int;

    init(owner: Address) {
        self.owner = owner;
        self.score = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.score = self.score + 1;
    }

    receive(msg: SafeSingleSend) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: msg.recipient,
            value: 0,
            mode: 2
        });
        self.score = self.score + 9;
    }
}

contract Safe11CellBounds {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeCellBuild) {
        require(sender() == self.owner, "owner only");
        let packed = beginCell().storeUint(msg.value, 32).endCell();
        self.counter = msg.value;
    }
}

contract Safe12ArgCopyMutation {
    owner: Address;
    total: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.total = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.total = self.total + 1;
    }

    fun apply(payload: SafePayload): Int {
        return payload.total + 1;
    }

    receive(msg: SafeArgApply) {
        require(sender() == self.owner, "owner only");
        self.total = self.apply(msg.payload);
    }
}

contract Safe13DivideBeforeMultiply {
    owner: Address;
    lastFee: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.lastFee = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.lastFee = self.lastFee + 1;
    }

    receive(msg: SafeDivideFee) {
        require(sender() == self.owner, "owner only");
        self.lastFee = (msg.amount * 3) / 1000;
    }
}

contract Safe14DuplicatedCondition {
    owner: Address;
    score: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.score = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.score = self.score + 1;
    }

    receive(msg: SafeConditionCheck) {
        require(sender() == self.owner, "owner only");
        if (msg.amount > 1000) {
            self.score = self.score + 10;
        } else {
            self.score = self.score + 1;
        }
    }
}

contract Safe15ExitCodeUsage {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeExit) {
        require(sender() == self.owner, "owner only");
        if (msg.blocked) {
            throw(256);
        }
        self.counter = self.counter + 1;
    }
}

contract Safe16SendInLoop {
    owner: Address;
    sent: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.sent = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.sent = self.sent + 1;
    }

    receive(msg: SafeBatch) {
        require(sender() == self.owner, "owner only");
        send(SendParameters{
            to: msg.recipient,
            value: msg.amount,
            mode: 2
        });
        self.sent = self.sent + 1;
    }
}

contract Safe17ZeroAddress {
    owner: Address;
    pool: Int as coins;

    init(owner: Address) {
        self.owner = owner;
        self.pool = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.pool = self.pool + context().value;
    }

    receive(msg: SafeAddressSend) {
        require(sender() == self.owner, "owner only");
        require(msg.recipient != address("0:0000000000000000000000000000000000000000000000000000000000000000"), "bad recipient");
        send(SendParameters{
            to: msg.recipient,
            value: msg.amount,
            mode: 2
        });
    }
}

contract Safe18StateMutationGetter {
    owner: Address;
    counter: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.counter = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.counter = self.counter + 1;
    }

    receive(msg: SafeGetterTick) {
        require(sender() == self.owner, "owner only");
        self.counter = msg.value;
    }

    get fun safeCounter(): Int {
        return self.counter;
    }
}

contract Safe19EnsurePrgSeed {
    owner: Address;
    lastRoll: Int as uint32;

    init(owner: Address) {
        self.owner = owner;
        self.lastRoll = 0;
    }

    receive() {
        require(sender() == self.owner, "owner only");
        self.lastRoll = self.lastRoll + 1;
    }

    receive(msg: SafeRandomRoll) {
        require(sender() == self.owner, "owner only");
        nativePrepareRandom();
        self.lastRoll = randomInt() % msg.modulo;
    }
}
