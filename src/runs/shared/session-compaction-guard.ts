import * as fs from "node:fs";

const COMPACTION_ENTRY_PREFIX = '{"type":"compaction"';
const READ_ONLY_TOOLS = new Set([
	"contact_supervisor",
	"fetch_content",
	"find",
	"get_search_content",
	"grep",
	"ls",
	"read",
	"structured_output",
	"subagent_supervisor",
	"subagent_wait",
	"web_search",
]);

export interface ResumeToolCapabilities {
	tools?: readonly string[];
	mcpDirectTools?: readonly string[];
}

export function sessionContainsCompactionEntry(sessionFile: string): boolean {
	const contents = fs.readFileSync(sessionFile, "utf-8");
	return contents.startsWith(COMPACTION_ENTRY_PREFIX) || contents.includes(`\n${COMPACTION_ENTRY_PREFIX}`);
}

export function hasMutationCapableResumeTools(capabilities: ResumeToolCapabilities): boolean {
	if (capabilities.mcpDirectTools?.length) return true;
	if (!capabilities.tools) return true;
	return capabilities.tools.some((tool) => !READ_ONLY_TOOLS.has(tool));
}

export function compactedMutationResumeReason(
	sessionFile: string,
	capabilities: ResumeToolCapabilities,
): string | undefined {
	if (!hasMutationCapableResumeTools(capabilities)) return undefined;
	return sessionContainsCompactionEntry(sessionFile)
		? "the persisted child session crossed a compaction boundary"
		: undefined;
}
