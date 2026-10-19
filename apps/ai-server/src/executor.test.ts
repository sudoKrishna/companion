import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runTool } from "./executor";

const dir = mkdtempSync(join(tmpdir(), "companion-executor-"));

test("writes and reads a file back", async () => {
    const path = join(dir, "note.txt");

    const written = await runTool("write_file", { path, content: "hello orb" });
    expect(written.text).toContain("Wrote 9 bytes");

    const read = await runTool("read_file", { path });
    expect(read.text).toBe("hello orb");
});

test("refuses to write to system paths", async () => {
    expect(runTool("write_file", { path: "/etc/passwd", content: "nope" })).rejects.toThrow(
        /refusing to write/,
    );
});

test("reports unreadable files", async () => {
    expect(runTool("read_file", { path: "/definitely/not/here.txt" })).rejects.toThrow(
        /could not read/,
    );
});

test("lists a directory", async () => {
    const result = await runTool("list_directory", { path: dir });
    expect(result.text).toContain("note.txt");
});

test("runs a command and reports its exit code", async () => {
    const result = await runTool("run_command", { command: "echo orb-ok; exit 3" });

    expect(result.text).toContain("[exit 3]");
    expect(result.text).toContain("orb-ok");
});

test("requires declared arguments", async () => {
    expect(runTool("read_file", {})).rejects.toThrow(/missing required argument: path/);
});

test("rejects unknown tools", async () => {
    expect(runTool("delete_everything", {})).rejects.toThrow(/unknown tool/);
});

test("rejects non-http urls", async () => {
    expect(runTool("http_get", { url: "file:///etc/passwd" })).rejects.toThrow(
        /must start with http/,
    );
});
