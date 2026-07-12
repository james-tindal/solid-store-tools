import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

type GarbageCollectionConfig = {
  maxWaitMs?: number
}

export function assertGarbageCollected(
  value: WeakKey,
  config: GarbageCollectionConfig = {},
) {
  const maxWaitMs = config.maxWaitMs ?? 1_000
  let settled = false
  const unregisterToken = {}

  return new Promise<void>((resolve, reject) => {
    const registry = new FinalizationRegistry(() => {
      settled = true
      clearTimeout(timeout)
      resolve()
    })

    registry.register(value, undefined, unregisterToken)
    value = null as never

    const timeout = setTimeout(() => {
      settled = true
      registry.unregister(unregisterToken)
      reject(Error('Expected object to be garbage collected'))
    }, maxWaitMs)

    collect()
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
