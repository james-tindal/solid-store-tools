import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

type GarbageCollectionConfig = {
  maxWaitMs?: number
}

export function assertGarbageCollected(
  value: WeakKey,
  config: GarbageCollectionConfig = {},
) {
  return assertAllGarbageCollected([{ label: 'object', value }], config)
}

export function assertAllGarbageCollected(
  values: { label: string, value: WeakKey }[],
  config: GarbageCollectionConfig = {},
) {
  const maxWaitMs = config.maxWaitMs ?? 1_000
  const pendingLabels = new Set(values.map(({ label }) => label))
  let settled = false
  const unregisterTokens = values.map(() => ({}))

  return new Promise<void>((resolve, reject) => {
    const registry = new FinalizationRegistry<string>(label => {
      pendingLabels.delete(label)
      if (pendingLabels.size !== 0) return

      finish()
    })

    for (const [index, { label, value }] of values.entries())
      registry.register(value, label, unregisterTokens[index])

    values.length = 0

    const timeout = setTimeout(() => {
      settled = true
      for (const token of unregisterTokens)
        registry.unregister(token)
      reject(Error(`Expected object(s) to be garbage collected: ${[...pendingLabels].join(', ')}`))
    }, maxWaitMs)

    collect()

    function finish() {
      settled = true
      clearTimeout(timeout)
      resolve()
    }
  })

  async function collect() {
    while (!settled) {
      runGarbageCollector()
      await new Promise(setImmediate)
    }
  }
}

function runGarbageCollector() {
  const wasHidden = globalThis.gc == null

  setFlagsFromString('--expose-gc')
  runInNewContext('gc')()

  if (wasHidden)
    setFlagsFromString('--no-expose-gc')
}
