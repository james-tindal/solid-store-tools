import { test as vitestTest } from 'vitest'
import { assertAllGarbageCollected } from './assert-garbage-collected'

type GarbageCollectedTestResult = {
  target: WeakKey
  retain?: unknown
}

type GarbageCollectedTest = {
  name: string
  run: () => GarbageCollectedTestResult
}

const tests: GarbageCollectedTest[] = []

export function test(name: string, run: () => GarbageCollectedTestResult) {
  tests.push({ name, run })
}

export function runTests(name = 'garbage collection') {
  const testsToRun = tests.splice(0)

  vitestTest(name, async () => {
    const retained: unknown[] = []
    const targets: { label: string, value: WeakKey }[] = []

    for (const { name, run } of testsToRun) {
      let result: GarbageCollectedTestResult | undefined = run()
      retained.push(result.retain)
      targets.push({ label: name, value: result.target })
      result = undefined
    }

    await assertAllGarbageCollected(targets)

    retained.length = 0
  })
}
