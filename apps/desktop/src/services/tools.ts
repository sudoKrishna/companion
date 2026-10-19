import { invoke } from "@tauri-apps/api/core";
import { executeServerTool } from "./ai";

export interface ToolResult {
  text: string;
  imageBase64?: string;
}

const NATIVE_TOOLS = new Set(["capture_screen", "active_window"]);

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  if (name === "capture_screen") {
    const result = await invoke<{ text: string; imageBase64: string }>("capture_screen");
    return { text: result.text, imageBase64: result.imageBase64 };
  }

  if (name === "active_window") {
    return { text: await invoke<string>("active_window") };
  }

  return executeServerTool(name, input);
}

export function isNativeTool(name: string) {
  return NATIVE_TOOLS.has(name);
}

export function describeToolTarget(
  name: string,
  input: Record<string, unknown>,
): string | undefined {
  if (name === "write_file") {
    return `${String(input.path)}\n\n${truncate(String(input.content ?? ""))}`;
  }

  const target = input.path ?? input.command ?? input.url ?? input.content;
  return typeof target === "string" ? truncate(target) : undefined;
}

function truncate(value: string, max = 400) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
