import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";
import {
	compactedMutationResumeReason,
	hasMutationCapableResumeTools,
	sessionContainsCompactionEntry,
} from "../../src/runs/shared/session-compaction-guard.ts";

function withSession(contents: string, run: (sessionFile: string) => void): void {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "pi-session-compaction-guard-"));
	try {
		const sessionFile = path.join(root, "child.jsonl");
		fs.writeFileSync(sessionFile, contents, "utf-8");
		run(sessionFile);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
}

describe("session compaction resume guard", () => {
	it("detects a canonical compaction entry without matching quoted message text", () => {
		const message = `${JSON.stringify({ type: "message", message: { content: '{"type":"compaction"' } })}\n`;
		const compaction = `${JSON.stringify({ type: "compaction", id: "compact-1", summary: "durable state" })}\n`;
		withSession(`${message}${"x".repeat(70_000)}\n${compaction}`, (sessionFile) => {
			assert.equal(sessionContainsCompactionEntry(sessionFile), true);
		});
		withSession(message, (sessionFile) => {
			assert.equal(sessionContainsCompactionEntry(sessionFile), false);
		});
	});

	it("treats only explicit known read-only tool surfaces as non-mutating", () => {
		assert.equal(hasMutationCapableResumeTools({ tools: ["read", "grep", "find", "ls"] }), false);
		assert.equal(hasMutationCapableResumeTools({ tools: ["read", "structured_output", "contact_supervisor"] }), false);
		assert.equal(hasMutationCapableResumeTools({ tools: ["read", "write"] }), true);
		assert.equal(hasMutationCapableResumeTools({ tools: ["read", "bash"] }), true);
		assert.equal(hasMutationCapableResumeTools({ tools: ["read"], mcpDirectTools: ["issue_update"] }), true);
		assert.equal(hasMutationCapableResumeTools({}), true);
	});

	it("blocks only mutation-capable resumes after compaction", () => {
		withSession(`${JSON.stringify({ type: "compaction", id: "compact-1" })}\n`, (sessionFile) => {
			assert.equal(
				compactedMutationResumeReason(sessionFile, { tools: ["read", "write"] }),
				"the persisted child session crossed a compaction boundary",
			);
			assert.equal(compactedMutationResumeReason(sessionFile, { tools: ["read", "grep"] }), undefined);
		});
	});
});
