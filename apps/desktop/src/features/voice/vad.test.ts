import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { frameRms, speechThreshold, updatedNoiseFloor } from "./useWakeListener";

const FRAME = 2048;

test("silence stays below the speech threshold", () => {
    const silence = new Uint8Array(FRAME).fill(128);
    expect(frameRms(silence)).toBe(0);
    expect(frameRms(silence) > speechThreshold(0.002)).toBe(false);
});

test("the noise floor settles towards the measured room level", () => {
    let floor = 0.002;
    for (let i = 0; i < 200; i++) floor = updatedNoiseFloor(floor, 0.01);
    expect(floor).toBeGreaterThan(0.008);
    expect(floor).toBeLessThanOrEqual(0.01);
});

test("speech recorded from this machine's microphone is detected", () => {
    const samples = readWav(`${import.meta.dir}/__fixtures__/speech.wav`);
    if (!samples) return; // fixture is optional: it is a recording of this machine

    let floor = 0.002;
    let speechFrames = 0;

    for (let offset = 0; offset + FRAME <= samples.length; offset += FRAME) {
        const frame = new Uint8Array(FRAME);
        for (let i = 0; i < FRAME; i++) {
            frame[i] = Math.max(0, Math.min(255, 128 + Math.round(samples[offset + i]! / 256)));
        }

        const rms = frameRms(frame);
        if (rms > speechThreshold(floor)) speechFrames++;
        else floor = updatedNoiseFloor(floor, rms);
    }

    expect(speechFrames).toBeGreaterThan(5);
});

function readWav(path: string): Int16Array | null {
    let raw: Buffer;
    try {
        raw = readFileSync(path);
    } catch {
        return null;
    }

    const dataAt = raw.indexOf("data", 12, "ascii");
    if (dataAt === -1) return null;

    const start = dataAt + 8;
    const length = raw.readUInt32LE(dataAt + 4);
    const slice = raw.subarray(start, start + length);

    return new Int16Array(slice.buffer, slice.byteOffset, Math.floor(slice.byteLength / 2));
}
