import { invoke } from "@tauri-apps/api/core";

const AI_SERVER_URL = "http://127.0.0.1:4000";

let tokenPromise: Promise<string> | null = null;

function appToken(): Promise<string> {
  tokenPromise ??= invoke<string>("app_token").catch(() => "");
  return tokenPromise;
}

export type ToolRisk = "low" | "medium" | "high" | "critical";

export type ToolScope =
  | "filesystem"
  | "terminal"
  | "screen_capture"
  | "application"
  | "system_settings"
  | "memory"
  | "network";

export interface ToolSpec {
  name: string;
  title: string;
  description: string;
  scope: ToolScope;
  risk: ToolRisk;
  destructive: boolean;
}

export interface ApiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ApiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ApiToolCall[];
  tool_call_id?: string;
}

export interface RequestedTool {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  assistantMessage: ApiMessage;
  toolCalls: RequestedTool[];
}

export interface Fact {
  id: string;
  content: string;
  createdAt: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${AI_SERVER_URL}${path}`, init);

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error ?? `${path} failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function executeServerTool(
  name: string,
  input: Record<string, unknown>,
): Promise<{ text: string; imageBase64?: string }> {
  return request("/tools/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-companion-token": await appToken(),
    },
    body: JSON.stringify({ name, input }),
  });
}

export interface Preferences {
  autoApproveLowRisk: boolean;
  speakReplies: boolean;
  proactiveSuggestions: boolean;
  suggestionIntervalMinutes: number;
  launchAtLogin: boolean;
  alwaysListening: boolean;
  wakePhrases: string[];
}

export async function loadPreferences(): Promise<Preferences> {
  const { preferences } = await request<{ preferences: Preferences }>("/preferences");
  return preferences;
}

export async function savePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const { preferences } = await request<{ preferences: Preferences }>("/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return preferences;
}

export async function fetchTools(): Promise<ToolSpec[]> {
  const { tools } = await request<{ tools: ToolSpec[] }>("/tools");
  return tools;
}

export function sendChat(
  history: ApiMessage[],
  conversationId: string,
): Promise<ChatResponse> {
  return post<ChatResponse>("/chat", { history, conversationId });
}

export async function transcribe(audio: Blob): Promise<string> {
  const audioBase64 = await blobToBase64(audio);
  const { transcript } = await post<{ transcript: string }>("/transcribe", { audioBase64 });
  return transcript;
}

export async function speak(text: string): Promise<Blob> {
  const res = await fetch(`${AI_SERVER_URL}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error ?? `/speak failed (${res.status})`);
  }

  return res.blob();
}

export async function listFacts(): Promise<Fact[]> {
  const { facts } = await request<{ facts: Fact[] }>("/memory/facts");
  return facts;
}

export async function addFact(content: string): Promise<Fact> {
  const { fact } = await post<{ fact: Fact }>("/memory/facts", { content });
  return fact;
}

export function deleteFact(id: string): Promise<{ deleted: boolean }> {
  return request(`/memory/facts/${id}`, { method: "DELETE" });
}

export interface AuditEntry {
  id: string;
  toolName: string;
  input: string;
  decision: string;
  createdAt: string;
}

export async function listToolAudit(): Promise<AuditEntry[]> {
  const { entries } = await request<{ entries: AuditEntry[] }>("/audit/tool");
  return entries;
}

export function recordToolDecision(
  toolName: string,
  input: unknown,
  decision: string,
): Promise<{ ok: boolean }> {
  return post("/audit/tool", { toolName, input, decision });
}

export async function fetchSuggestion(context: {
  activeWindow?: { app?: string; title?: string };
  localTime?: string;
}): Promise<string | null> {
  const { suggestion } = await post<{ suggestion: string | null }>("/suggest", context);
  return suggestion;
}

export async function serverIsUp(): Promise<boolean> {
  try {
    await request("/health");
    return true;
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
