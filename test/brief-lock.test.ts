import { describe, expect, it } from "vitest";

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("withBriefLock", () => {
  it("does not begin a second brief operation until the first finishes", async () => {
    const module = await import("../src/brief-lock.js").catch(() => ({}));
    const withBriefLock = (
      module as {
        withBriefLock?: <T>(work: () => Promise<T>) => Promise<T>;
      }
    ).withBriefLock;
    expect(withBriefLock).toBeTypeOf("function");

    const firstGate = deferred();
    const events: string[] = [];

    const first = withBriefLock!(async () => {
      events.push("start-1");
      await firstGate.promise;
      events.push("end-1");
      return 1;
    });
    const second = withBriefLock!(async () => {
      events.push("start-2");
      events.push("end-2");
      return 2;
    });

    await Promise.resolve();
    expect(events).toEqual(["start-1"]);
    firstGate.resolve();

    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(events).toEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("releases the queue when an operation rejects", async () => {
    const module = await import("../src/brief-lock.js").catch(() => ({}));
    const withBriefLock = (
      module as {
        withBriefLock?: <T>(work: () => Promise<T>) => Promise<T>;
      }
    ).withBriefLock;
    expect(withBriefLock).toBeTypeOf("function");
    const failed = withBriefLock!(async () => {
      throw new Error("RPC unavailable");
    });
    const next = withBriefLock!(async () => "recovered");

    await expect(failed).rejects.toThrow("RPC unavailable");
    await expect(next).resolves.toBe("recovered");
  });
});
