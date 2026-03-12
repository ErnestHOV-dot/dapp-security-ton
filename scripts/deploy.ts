import { mnemonicToWalletKey } from "@ton/crypto";
import { TonClient, WalletContractV4, toNano } from "@ton/ton";
import { VulnerableContract } from "../build/vulnerable_VulnerableContract";
import 'dotenv/config';

// --- НАСТРОЙКИ ---
// 1. API Key (от @tontestnetapibot)
const API_KEY = process.env.TON_API_KEY || "";


// 2. сид-фраза 
const MNEMONIC = process.env.DEPLOY_MNEMONIC || "";
// -----------------

async function runDeploy() {
    // Проверка на заполненность данных
    if (MNEMONIC.includes("word1")) {
        throw new Error("Вставьте сид-фразу в переменную MNEMONIC!");
    }

    const key = await mnemonicToWalletKey(MNEMONIC.split(" "));
    const wallet = WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 });
    
    // Подключение к сети
    const endpoint = "https://testnet.toncenter.com/api/v2/jsonRPC";
    const client = new TonClient({ 
        endpoint, 
        apiKey: API_KEY
    });

    console.log("Кошелек подключен:", wallet.address.toString({ testOnly: true }));

    // Подготовка контракта
    // fromInit() создает состояние инициализации для деплоя
    const contract = await VulnerableContract.fromInit(); 
    
    // Открываем контракт через провайдер (это позволяет автоматически прикрепить init-пакет при первой отправке)
    const contractProvider = client.open(contract);

    console.log("Адрес будущего контракта:", contract.address.toString({ testOnly: true }));

    // Проверяем, задеплоен ли он уже
    if (await client.isContractDeployed(contract.address)) {
        return console.log("!Контракт уже задеплоен!");
    }

    // Отправка транзакции деплоя
    console.log("Деплоим контракт...");
    
    const walletContract = client.open(wallet);
    const seqno = await walletContract.getSeqno();

    await contractProvider.send(
        walletContract.sender(key.secretKey), 
        {
            value: toNano("0.05"), // Отправляем 0.05 TON на газ и хранение
            bounce: false,
        }, 
        // отправляем сообщение "empty_func".
        // Так как это ПЕРВОЕ сообщение на этот адрес, библиотека @ton/ton
        // автоматически прикрепит код контракта (Init State) к транзакции.
        // Это вызовет деплой + выполнение функции "empty_func".
        "empty_func"
    );

    // Ждем подтверждения
    let currentSeqno = seqno;
    while (currentSeqno == seqno) {
        console.log("Ждем подтверждения блока...");
        await new Promise(r => setTimeout(r, 2000));
        currentSeqno = await walletContract.getSeqno();
    }
    
    console.log("Контракт успешно задеплоен!");
    console.log(`Посмотреть в эксплорере: https://testnet.tonviewer.com/${contract.address.toString()}`);
}

runDeploy();