import "dotenv/config";

import { mnemonicToWalletKey } from "@ton/crypto";
import { Address, fromNano, Sender, toNano } from "@ton/core";
import { TonClient, WalletContractV4 } from "@ton/ton";

type ContractFactory = {
    fromInit(owner: Address): Promise<{
        address: Address;
        send(provider: unknown, via: Sender, args: { value: bigint; bounce?: boolean }, message: null): Promise<void>;
    }>;
};

const ENDPOINT = process.env.TON_TESTNET_RPC ?? "https://testnet.toncenter.com/api/v2/jsonRPC";
const DEPLOY_VALUE = toNano(process.env.MINI_DEPLOY_VALUE ?? "0.05");
const RPC_TIMEOUT_MS = Number(process.env.TON_RPC_TIMEOUT_MS ?? 120_000);

type ContractEntry = {
    rule: string;
    name: string;
    modulePath: string;
};

const CONTRACTS: ContractEntry[] = [
    { rule: "todo-comment", name: "Rule01TodoComment", modulePath: "../build/rule-vulnerable-minis_Rule01TodoComment" },
    { rule: "empty-function", name: "Rule02EmptyFunction", modulePath: "../build/rule-vulnerable-minis_Rule02EmptyFunction" },
    { rule: "external-replay-protection", name: "Rule03ExternalReplay", modulePath: "../build/rule-vulnerable-minis_Rule03ExternalReplay" },
    { rule: "access-control", name: "Rule04AccessControl", modulePath: "../build/rule-vulnerable-minis_Rule04AccessControl" },
    { rule: "loop-usage", name: "Rule05LoopUsage", modulePath: "../build/rule-vulnerable-minis_Rule05LoopUsage" },
    { rule: "dump-call", name: "Rule06DumpCall", modulePath: "../build/rule-vulnerable-minis_Rule06DumpCall" },
    { rule: "send-mode", name: "Rule07SendMode", modulePath: "../build/rule-vulnerable-minis_Rule07SendMode" },
    { rule: "potential-deadlock", name: "Rule08PotentialDeadlock", modulePath: "../build/rule-vulnerable-minis_Rule08PotentialDeadlock" },
    { rule: "bounce-handling", name: "Rule09BounceHandling", modulePath: "../build/rule-vulnerable-minis_Rule09BounceHandling" },
    { rule: "async-race", name: "Rule10AsyncRace", modulePath: "../build/rule-vulnerable-minis_Rule10AsyncRace" },
    { rule: "cell-bounds", name: "Rule11CellBounds", modulePath: "../build/rule-vulnerable-minis_Rule11CellBounds" },
    { rule: "arg-copy-mutation", name: "Rule12ArgCopyMutation", modulePath: "../build/rule-vulnerable-minis_Rule12ArgCopyMutation" },
    { rule: "divide-before-multiply", name: "Rule13DivideBeforeMultiply", modulePath: "../build/rule-vulnerable-minis_Rule13DivideBeforeMultiply" },
    { rule: "duplicated-condition", name: "Rule14DuplicatedCondition", modulePath: "../build/rule-vulnerable-minis_Rule14DuplicatedCondition" },
    { rule: "exit-code-usage", name: "Rule15ExitCodeUsage", modulePath: "../build/rule-vulnerable-minis_Rule15ExitCodeUsage" },
    { rule: "send-in-loop", name: "Rule16SendInLoop", modulePath: "../build/rule-vulnerable-minis_Rule16SendInLoop" },
    { rule: "zero-address", name: "Rule17ZeroAddress", modulePath: "../build/rule-vulnerable-minis_Rule17ZeroAddress" },
    { rule: "state-mutation-in-getter", name: "Rule18StateMutationGetter", modulePath: "../build/rule-vulnerable-minis_Rule18StateMutationGetter" },
    { rule: "ensure-prg-seed", name: "Rule19EnsurePrgSeed", modulePath: "../build/rule-vulnerable-minis_Rule19EnsurePrgSeed" },
];

function loadFactory(entry: ContractEntry): ContractFactory {
    const mod = require(entry.modulePath) as Record<string, unknown>;
    const factory = mod[entry.name];
    if (!factory) {
        throw new Error(`Generated wrapper '${entry.name}' not found. Run npm run tact:build first.`);
    }

    return factory as ContractFactory;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitSeqno(wallet: ReturnType<typeof WalletContractV4.create>, client: TonClient, previous: number) {
    const opened = client.open(wallet);
    for (let attempt = 0; attempt < 30; attempt += 1) {
        await sleep(2000);
        const current = await opened.getSeqno();
        if (current > previous) {
            return current;
        }
    }

    throw new Error(`Timeout waiting for wallet seqno > ${previous}`);
}

async function main() {
    const mnemonic = process.env.MNEMONIC ?? process.env.TESTNET_MNEMONIC;
    if (!mnemonic) {
        throw new Error("Set MNEMONIC or TESTNET_MNEMONIC with the deployer wallet seed phrase.");
    }

    const key = await mnemonicToWalletKey(mnemonic.trim().split(/\s+/));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    const client = new TonClient({ endpoint: ENDPOINT, apiKey: process.env.TON_API_KEY, timeout: RPC_TIMEOUT_MS });
    const openedWallet = client.open(wallet);
    const sender = openedWallet.sender(key.secretKey);
    const owner = wallet.address;

    console.log("Deploying vulnerable mini contracts to TON testnet");
    console.log(`Endpoint : ${ENDPOINT}`);
    console.log(`Owner    : ${owner.toString({ urlSafe: true, bounceable: false })}`);
    console.log(`Value    : ${fromNano(DEPLOY_VALUE)} TON each\n`);

    for (const entry of CONTRACTS) {
        const contract = await loadFactory(entry).fromInit(owner);
        const opened = client.open(contract);
        const alreadyDeployed = await client.isContractDeployed(contract.address);

        if (alreadyDeployed) {
            console.log(`${entry.name.padEnd(28)} ${contract.address.toString()} already deployed`);
            continue;
        }

        const seqno = await openedWallet.getSeqno();
        await opened.send(sender, { value: DEPLOY_VALUE, bounce: false }, null);
        await waitSeqno(wallet, client, seqno);

        console.log(`${entry.name.padEnd(28)} ${contract.address.toString()} ${entry.rule}`);
    }

    console.log("\nDone. Explorer links:");
    for (const entry of CONTRACTS) {
        const contract = await loadFactory(entry).fromInit(owner);
        console.log(`${entry.name}: https://testnet.tonviewer.com/${contract.address.toString()}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
