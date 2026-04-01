import { runLinter } from "./linter";
import { createRules } from "./rules";

const DEFAULT_FILENAME = "./contracts/receiver_example.tact";
const filename = process.argv[2] ?? DEFAULT_FILENAME;

void runLinter(filename, createRules());
