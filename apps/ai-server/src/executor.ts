import { readdir, readFile, writeFile } from "node:fs/promises";
import { addFact, listFacts } from "./memory";

const MAX_TEXT_BYTES = 100_000;
const MAX_DIR_ENTRIES = 200;
const COMMAND_TIMEOUT_SECONDS = 30;
const PROTECTED_WRITE_PREFIXES = ["/etc", "/usr", "/boot", "/sys", "/proc", "/dev"];

export interface ToolResult {
    text: string;
    imageBase64?: string;
}

export const SERVER_TOOLS = [
    "read_file",
    "list_directory",
    "write_file",
    "run_command",
    "http_get",
    "remember_fact",
    "recall_facts",
] as const;

export async function runTool(
    name: string,
    input: Record<string, unknown>,
): Promise<ToolResult> {
    switch (name) {
        case "read_file":
            return readFileTool(requireString(input, "path"));
        case "list_directory":
            return listDirectoryTool(requireString(input, "path"));
        case "write_file":
            return writeFileTool(requireString(input, "path"), requireString(input, "content"));
        case "run_command":
            return runCommandTool(requireString(input, "command"));
        case "http_get":
            return httpGetTool(requireString(input, "url"));
        case "remember_fact":
            return rememberFactTool(requireString(input, "content"));
        case "recall_facts":
            return recallFactsTool();
        default:
            throw new Error(`unknown tool: ${name}`);
    }
}

function requireString(input: Record<string, unknown>, key: string): string {
    const value = input[key];
    if (typeof value !== "string") throw new Error(`missing required argument: ${key}`);
    return value;
}

function truncate(value: string, max = 10_000) {
    return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}

async function readFileTool(path: string): Promise<ToolResult> {
    const buffer = await readFile(path).catch((error) => {
        throw new Error(`could not read ${path}: ${error.message}`);
    });

    const slice = buffer.subarray(0, MAX_TEXT_BYTES).toString("utf8");
    const text = buffer.byteLength > MAX_TEXT_BYTES ? `${slice}\n\n[truncated]` : slice;

    return { text };
}

async function listDirectoryTool(path: string): Promise<ToolResult> {
    const entries = await readdir(path, { withFileTypes: true }).catch((error) => {
        throw new Error(`could not list ${path}: ${error.message}`);
    });

    if (entries.length === 0) return { text: "(empty directory)" };

    const lines = entries.slice(0, MAX_DIR_ENTRIES).map((entry) => {
        const kind = entry.isDirectory() ? "dir " : entry.isSymbolicLink() ? "link" : "file";
        return `${kind}  ${entry.name}`;
    });

    if (entries.length > MAX_DIR_ENTRIES) {
        lines.push(`[${entries.length - MAX_DIR_ENTRIES} more entries not shown]`);
    }

    return { text: lines.join("\n") };
}

async function writeFileTool(path: string, content: string): Promise<ToolResult> {
    if (PROTECTED_WRITE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        throw new Error(`refusing to write to a system path: ${path}`);
    }

    await writeFile(path, content, "utf8").catch((error) => {
        throw new Error(`could not write ${path}: ${error.message}`);
    });

    return { text: `Wrote ${content.length} bytes to ${path}.` };
}

async function runCommandTool(command: string): Promise<ToolResult> {
    const proc = Bun.spawn(["timeout", String(COMMAND_TIMEOUT_SECONDS), "sh", "-c", command], {
        stdout: "pipe",
        stderr: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
    ]);

    const header =
        exitCode === 124
            ? `[timed out after ${COMMAND_TIMEOUT_SECONDS}s]`
            : `[exit ${exitCode}]`;

    const parts = [header];
    if (stdout.trim()) parts.push(`stdout:\n${truncate(stdout)}`);
    if (stderr.trim()) parts.push(`stderr:\n${truncate(stderr)}`);
    if (!stdout.trim() && !stderr.trim()) parts.push("(no output)");

    return { text: parts.join("\n") };
}

async function httpGetTool(url: string): Promise<ToolResult> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        throw new Error("url must start with http:// or https://");
    }

    const res = await fetch(url);
    const body = await res.text();

    return { text: `[HTTP ${res.status}]\n${truncate(body)}` };
}

async function rememberFactTool(content: string): Promise<ToolResult> {
    if (!content.trim()) return { text: "Nothing to remember: content was empty." };
    const fact = await addFact(content);
    return { text: `Remembered: ${fact.content}` };
}

async function recallFactsTool(): Promise<ToolResult> {
    const facts = await listFacts();
    if (facts.length === 0) return { text: "Nothing has been remembered yet." };
    return { text: facts.map((fact) => `- ${fact.content}`).join("\n") };
}
