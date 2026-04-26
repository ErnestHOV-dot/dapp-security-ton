/**
 * Выводит адрес WalletV4 для заданной мнемоники.
 * Используйте для заполнения TESTNET_OWNER_ADDRESS и ATTACKER_ADDRESS в .env
 *
 * Запуск:
 *   MNEMONIC="word1 word2 ... word24" npx ts-node scripts/get-wallet-address.ts
 */
import "dotenv/config";
import { mnemonicToWalletKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

async function main() {
    const mnemonic = process.env.MNEMONIC ?? process.env.TESTNET_MNEMONIC;
    if (!mnemonic) throw new Error("Укажите MNEMONIC=... или TESTNET_MNEMONIC=...");

    const key    = await mnemonicToWalletKey(mnemonic.trim().split(/\s+/));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });

    console.log(`Address : ${wallet.address.toString({ urlSafe: true, bounceable: false })}`);
    console.log(`Raw     : 0:${wallet.address.toRawString().split(":")[1]}`);
}

main().catch(e => { console.error(e); process.exit(1); });
