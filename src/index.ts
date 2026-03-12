import { getAstFactory, getParser } from "@tact-lang/compiler";
import * as fs from "fs";

// НАСТРОЙКИ
const FILENAME = "./contracts/test.tact";

// Цвета для консоли
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RESET = "\x1b[0m";

async function runLinter() {
    console.log(`${CYAN} Читаем файл: ${FILENAME}...${RESET}`);

    try {
        const sourceCode = fs.readFileSync(FILENAME, "utf-8");
        const astFactory = getAstFactory();
        const parser = getParser(astFactory);
        
        const moduleAst = parser.parse({
            path: FILENAME,
            code: sourceCode,
            origin: "user",
        });

        const entries = moduleAst.items;

        if (!entries) throw new Error("Пустой AST.");

        console.log(`${CYAN} Анализ запущен...${RESET}\n`);

        // 1. Проверка TODO в комментариях
        checkTodos(sourceCode);

        // 2. Обход AST
        entries.forEach((entry: any) => {
            if (entry.kind === 'contract' || entry.kind === 'trait') {
                checkContract(entry);
            }
        });

        console.log(`\n${CYAN} Анализ завершен.${RESET}`);

    } catch (e: any) {
        if (e.code === 'ENOENT') {
            console.error(`${RED} Файл '${FILENAME}' не найден!${RESET}`);
        } else {
            console.error(`${RED} Ошибка парсинга:${RESET}`, e.message);
        }
    }
}

function checkContract(node: any) {
    console.log(`Checking container: [${node.name.text}]`);

    node.declarations.forEach((decl: any) => {
        const contextName = getDeclarationLabel(decl);

        if (['receiver', 'function_def', 'contract_init'].includes(decl.kind)) {
            
            // ПРОВЕРКА 1: Пустые функции
            if (decl.statements && decl.statements.length === 0) {
                warn(decl.loc, `Пустая функция '${contextName}'. Лишний код увеличивает стоимость деплоя.`);
            }

            // ПРОВЕРКА 2: External сообщения (Replay Attack)
            if (decl.kind === 'receiver' && decl.selector.kind === 'external') {
                checkExternalSecurity(decl, contextName);
            }

            // ПРОВЕРКА 3: Access Control
            if (decl.kind === 'receiver' && decl.selector.kind === 'internal') {
                checkAccessControl(decl, contextName);
            }

            // Рекурсивный спуск
            if (decl.statements) {
                traverseStatements(decl.statements, contextName);
            }
        }
    });
}

function traverseStatements(statements: any[], contextName: string) {
    statements.forEach(stmt => {
        
        // ПРОВЕРКА 4: Опасные циклы
        if (stmt.kind === 'statement_while' || stmt.kind === 'statement_until') {
            crit(stmt.loc, `Найден цикл 'while/until' в '${contextName}'. Риск Out-of-Gas. Используйте ограниченные циклы.`);
        }
        if (stmt.kind === 'statement_repeat') {
            warn(stmt.loc, `Найден цикл 'repeat' в '${contextName}'. Убедитесь, что число повторений не слишком велико.`);
        }

        // ПРОВЕРКА 5: Вызовы функций (dump)
        if (stmt.kind === 'statement_expression') {
            checkExpression(stmt.expression, stmt.loc, contextName);
        }

        // ПРОВЕРКА 6: Блокировка монет (Send Mode)
        if (stmt.kind === 'statement_expression' && stmt.expression.kind === 'static_call') {
            if (stmt.expression.function.text === 'send') {
                checkSendMode(stmt.expression, stmt.loc);
            }
        }

        // Рекурсия
        if (stmt.kind === 'statement_condition') {
            traverseStatements(stmt.trueStatements, contextName);
            if (stmt.falseStatements) traverseStatements(stmt.falseStatements, contextName);
        }
        if (stmt.kind === 'statement_while' || stmt.kind === 'statement_repeat' || stmt.kind === 'statement_until') {
            traverseStatements(stmt.statements, contextName);
        }
    });
}

function checkExpression(expr: any, loc: any, contextName: string) {
    if (expr.kind === 'static_call') {
        if (expr.function.text === 'dump') {
            crit(loc, `Забытый 'dump()' в '${contextName}'. Удалите отладку.`);
        }
    }
}

function checkSendMode(callNode: any, loc: any) {
    // Используем безопасную конвертацию в строку
    const argsJson = safeJsonStringify(callNode.args); 
    // Простая эвристика: ищем слово mode или SendRemainingValue
    if (!argsJson.includes("mode") && !argsJson.includes("SendRemainingValue") && !argsJson.includes("128")) {
         warn(loc, `Найден вызов 'send()'. Проверьте, что указан 'mode' (например, SendRemainingValue + SendIgnoreErrors).`);
    }
}

function checkExternalSecurity(decl: any, name: string) {
    let hasProtection = false;
    
    const checkProtection = (stmts: any[]) => {
        stmts.forEach(s => {
            // ИСПРАВЛЕНИЕ ЗДЕСЬ: Используем безопасный stringify
            const json = safeJsonStringify(s);
            if (json.includes("seqno") || json.includes("msg_seqno") || json.includes("timestamp") || json.includes("now")) {
                hasProtection = true;
            }
        });
    };
    
    if (decl.statements) checkProtection(decl.statements);

    if (!hasProtection) {
        crit(decl.loc, `External сообщение '${name}' без защиты от Replay Attack! Добавьте проверку seqno или timestamp.`);
    }
}

function checkAccessControl(decl: any, name: string) {
    let hasAuthCheck = false;
    const checkAuth = (stmts: any[]) => {
        stmts.forEach(s => {
            // ИСПРАВЛЕНИЕ ЗДЕСЬ: Используем безопасный stringify
            const json = safeJsonStringify(s);
            if ((json.includes("require") || json.includes("nativeThrow")) && 
                (json.includes("sender") || json.includes("owner"))) {
                hasAuthCheck = true;
            }
        });
    };

    if (decl.statements) checkAuth(decl.statements);

    if (!hasAuthCheck && decl.statements.length > 0) {
        warn(decl.loc, `В функции '${name}' не найдено явных проверок 'require(sender() == ...)'. Убедитесь, что она безопасна.`);
    }
}

function checkTodos(code: string) {
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('TODO') || line.includes('FIXME')) {
            warn({ interval: { start: { line: idx + 1, col: 0 } } }, `Оставлен комментарий TODO/FIXME: "${line.trim()}"`);
        }
    });
}

// --- НОВАЯ ФУНКЦИЯ ДЛЯ БЕЗОПАСНОГО ПРЕВРАЩЕНИЯ AST В СТРОКУ ---
function safeJsonStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
        // Если значение BigInt, превращаем его в строку
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    });
}

function getDeclarationLabel(decl: any): string {
    if (decl.kind === "function_def") return decl.name.text;
    if (decl.kind === "contract_init") return "init";
    if (decl.kind === "receiver") {
        if (decl.selector.kind === "bounce") return "receive(bounce)";
        const sub = decl.selector.subKind;
        if (sub.kind === "comment") return `receive("${sub.comment.value}")`;
        if (sub.kind === "fallback") return "receive(fallback)";
        return "receive(simple)";
    }
    return "unknown";
}

function crit(loc: any, msg: string) {
    const line = getLineFromLoc(loc);
    console.log(`   ${RED}[CRITICAL] Line ${line}:${RESET} ${msg}`);
}

function warn(loc: any, msg: string) {
    const line = getLineFromLoc(loc);
    console.log(`   ${YELLOW}[WARNING]  Line ${line}:${RESET} ${msg}`);
}

function getLineFromLoc(loc: any): string | number {
    if (!loc) return "?";
    if (loc.interval && loc.interval.start && typeof loc.interval.start.line === "number") {
        return loc.interval.start.line;
    }
    if (typeof loc.line === "number") return loc.line;
    return "?";
}

runLinter();
