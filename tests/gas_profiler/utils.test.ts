import test from "node:test";
import assert from "node:assert/strict";
import { formatNanotonsAsTon } from "../../src/gas_profiler/utils";

test("formatNanotonsAsTon formats nanotons as TON string", () => {
    assert.equal(formatNanotonsAsTon(1025200n), "0.0010252");
    assert.equal(formatNanotonsAsTon(1_000_000_000n), "1");
    assert.equal(formatNanotonsAsTon(1_500_000_000n), "1.5");
    assert.equal(formatNanotonsAsTon(null), "n/a");
});
