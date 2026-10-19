import { expect, test } from "bun:test";
import { wakePrompt } from "./useWakeListener";

const phrases = ["hey companion", "tell me what you think"];

test("takes what follows the wake phrase as the request", () => {
    expect(wakePrompt("Hey companion, what is on my calendar?", phrases, false)).toBe(
        "what is on my calendar",
    );
});

test("matches a wake phrase anywhere in the segment", () => {
    expect(wakePrompt("So, tell me what you think about this draft", phrases, false)).toBe(
        "about this draft",
    );
});

test("falls back to the phrase itself when nothing follows it", () => {
    expect(wakePrompt("Hey companion!", phrases, false)).toBe("hey companion");
});

test("ignores speech without a wake phrase", () => {
    expect(wakePrompt("I should really get lunch soon", phrases, false)).toBeNull();
});

test("ignores empty transcripts", () => {
    expect(wakePrompt("", phrases, false)).toBeNull();
});

test("a click bypasses the wake phrase entirely", () => {
    expect(wakePrompt("what time is it", phrases, true)).toBe("what time is it");
});
