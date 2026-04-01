import "@stdlib/deploy";

contract UnboundedLoop with Deployable {
    owner: Address;
    launches: Int as uint32;

    init() {
        self.owner = sender();
        self.launches = 0;
    }

    receive("start") {
        require(sender() == self.owner, "Access denied");

        self.launches = self.launches + 1;

        send(SendParameters{
            to: sender(),
            value: 0,
            bounce: false,
            mode: SendRemainingValue,
            body: "ping".asComment()
        });
    }

    bounced(_msg: Slice) {
        if (self.launches > 0) {
            self.launches = self.launches - 1;
        }
    }
}
