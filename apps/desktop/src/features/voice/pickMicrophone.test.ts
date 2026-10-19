import { afterEach, expect, test } from "bun:test";
import { pickMicrophone } from "./useWakeListener";

function mockDevices(labels: string[]) {
    (globalThis as any).navigator = {
        mediaDevices: {
            enumerateDevices: async () =>
                labels.map((label, index) => ({
                    kind: "audioinput",
                    label,
                    deviceId: `device-${index}`,
                })),
        },
    };
}

afterEach(() => {
    delete (globalThis as any).navigator;
});

test("prefers a plugged-in headset over the built-in mic", async () => {
    mockDevices(["Built-in Microphone", "EarPods (USB)"]);
    expect(await pickMicrophone()).toBe("device-1");
});

test("falls back to the system default when only the built-in mic exists", async () => {
    mockDevices(["Internal Mic 1"]);
    expect(await pickMicrophone()).toBeUndefined();
});

test("falls back to the default when no device has a label yet", async () => {
    mockDevices([]);
    expect(await pickMicrophone()).toBeUndefined();
});

test("recognises common built-in mic naming variants", async () => {
    mockDevices(["Laptop Microphone", "USB Headset Mic"]);
    expect(await pickMicrophone()).toBe("device-1");
});
