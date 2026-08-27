import { createComputed } from 'solid-js'
import { $RAW, createStore } from 'solid-js/store'
import { afterEach, assert, test } from 'vitest'
import { merge } from './merge'
import { filterKeys } from './filterKeys'
import { objectFromAccessor } from './object-from-accessor'
import { switchStore } from './switch-store'
import { assertExists } from '../utilities'
import { testRoot } from '../solid-root'

afterEach(() => testRoot.dispose())


const { $NODE, $HAS } = getSymbols()
const metadataKeys = { $RAW, $NODE, $HAS }
const objectWithMetadata = { [$RAW]: null, [$NODE]: null, [$HAS]: null }

const isMetadataKey = (x: unknown): x is symbol =>
  Object.values(metadataKeys).includes(x as any)

const metadataKeyToString = (symbol: symbol) =>
  Object.keys(metadataKeys).find(string => (metadataKeys as any)[string] === symbol)!

const utilityBlock = <Source extends object>(source: Source) => ({
  objectFromAccessor: () => objectFromAccessor(() => source),
  filterKeys: () => filterKeys(source, () => true),
  merge: () => merge(source),
  switchStore: () => testRoot(() =>
    switchStore(() => 'selected', { selected: source })),
})

const RejectMetadataKeys = new Proxy({} as { [Key: symbol]: never }, {
  get(target, key,) {
    if (isMetadataKey(key))
      throw Error(`get trap received ${metadataKeyToString(key)}`)
  },
  set(target, key) {
    if (isMetadataKey(key))
      throw Error(`set trap received ${metadataKeyToString(key)}`)
    return true
  },
  has(target, key) {
    if (isMetadataKey(key))
      throw Error(`has trap received ${metadataKeyToString(key)}`)
    return true
  },
  defineProperty(target, key) {
    if (isMetadataKey(key))
      throw Error(`defineProperty trap received ${metadataKeyToString(key)}`)
    return true
  },
  deleteProperty(target, key) {
    if (isMetadataKey(key))
      throw Error(`deleteProperty trap received ${metadataKeyToString(key)}`)
    return true
  },
  getOwnPropertyDescriptor(target, key) {
    if (isMetadataKey(key))
      throw Error(`getOwnPropertyDescriptor trap received ${metadataKeyToString(key)}`)
  },
})

// All do not delegate metadata keys to source
{
  const testAllSymbols = (create: () => object) =>
    Object.values(metadataKeys)
      .forEach(symbol => testAllTraps(create, symbol))

  function testAllTraps(create: () => object, symbol: symbol) {
    Reflect.get(create(), symbol)
    Reflect.set(create(), symbol, null)
    Reflect.has(create(), symbol)
    Reflect.defineProperty(create(), symbol, {})
    Reflect.deleteProperty(create(), symbol)
    Reflect.getOwnPropertyDescriptor(create(), symbol)
  }

  for (const [name, it] of Object.entries(utilityBlock(RejectMetadataKeys)))
    test(`${name} does not delegate Solid metadata keys to source`, () => testAllSymbols(it))
}

// All do not report Solid metadata ownKeys from sources
{
  for (const [name, create] of Object.entries(utilityBlock(objectWithMetadata))) {
    const it = create()

    test(`${name} does not report Solid metadata ownKeys from sources`, () =>
      assert.deepStrictEqual(Reflect.ownKeys(it), [])
    )
  }
}

// All support Solid metadata keys
{
  const hostedMetadataKeys = { $NODE, $HAS }

  const testHostedSymbols = (it: object) =>
    Object.values(hostedMetadataKeys)
      .forEach(symbol => testHostedSymbol(it, symbol))

  function testHostedSymbol(it: object, symbol: symbol) {
    const value = {}
    const descriptor = {
      configurable: false,
      enumerable: false,
      writable: false,
      value,
    }

    assert.strictEqual(Reflect.defineProperty(it, symbol, descriptor), true)
    assert.strictEqual(Reflect.get(it, symbol), value)
    assert.strictEqual(Reflect.has(it, symbol), true)
    assert.deepStrictEqual(Reflect.getOwnPropertyDescriptor(it, symbol), descriptor)
    // Non-configurable proxy-local metadata must be reported by ownKeys to satisfy Proxy invariants.
    assert(Reflect.ownKeys(it).includes(symbol))
    assert.strictEqual(Reflect.deleteProperty(it, symbol), false)
  }

  for (const [name, create] of Object.entries(utilityBlock({}))) {
    const it = create()

    test(`${name} supports Solid metadata keys`, () => testHostedSymbols(it))
  }
}

// All follow local descriptor rules for Solid metadata keys
{
  const testMutableMetadataSymbol = (create: () => object, symbol: symbol) => {
    const it = create()
    const initial = {}
    const updated = {}

    assert.strictEqual(Reflect.defineProperty(it, symbol, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: initial,
    }), true)

    assert.strictEqual(Reflect.set(it, symbol, updated), true)
    assert.strictEqual(Reflect.get(it, symbol), updated)
  }

  const testReadonlyMetadataSymbol = (create: () => object, symbol: symbol) => {
    const it = create()
    const initial = {}
    const updated = {}

    assert.strictEqual(Reflect.defineProperty(it, symbol, {
      configurable: true,
      enumerable: false,
      writable: false,
      value: initial,
    }), true)

    assert.strictEqual(Reflect.set(it, symbol, updated), false)
    assert.strictEqual(Reflect.get(it, symbol), initial)
  }

  function testMetadataSymbol(create: () => object, symbol: symbol) {
    testMutableMetadataSymbol(create, symbol)
    testReadonlyMetadataSymbol(create, symbol)
  }

  const testMetadataSymbols = (create: () => object) =>
    Object.values(metadataKeys)
      .forEach(symbol => testMetadataSymbol(create, symbol))

  for (const [name, create] of Object.entries(utilityBlock({})))
    test(`${name} follows local descriptor rules for Solid metadata keys`, () =>
      testMetadataSymbols(create))
}

// All can be used as Solid store roots
{
  for (const [name, create] of Object.entries(utilityBlock({ value: 'value' })))
    test(`${name} can be used as Solid store root`, () => {
      const [store] = testRoot(() => createStore(create()))

      assert.strictEqual((store as any).value, 'value')
    })
}

// All cannot be added to a Solid store
{
  for (const name of Object.keys(utilityBlock({ value: 'value' })))
    test(`${name} cannot be added to a Solid store`, () => {
      const [source, setSource] = createStore({ value: 'value' })
      const create = utilityBlock(source)[name as keyof ReturnType<typeof utilityBlock>]
      const value = create()
      const [store, setStore] = createStore({ data: undefined as typeof value | undefined })

      setStore({ data: value })
      assertExists(store.data)
      'value' in store.data
      Reflect.ownKeys(store.data)
      const observed = store.data.value

      assert.strictEqual(observed, 'value')
      setSource('value', 'updated')
      assert.notStrictEqual(observed, 'updated')
    })
}

// All report source data properties as data descriptors
{
  for (const [name, create] of Object.entries(utilityBlock({ value: 'value' })))
    test(`${name} reports source data properties as data descriptors`, () => {
      const descriptor = Reflect.getOwnPropertyDescriptor(create(), 'value')

      assert.isDefined(descriptor)
      assert.isFalse('get' in descriptor!)
      assert.isFalse('set' in descriptor!)
      assert.strictEqual(descriptor!.value, 'value')
      assert.strictEqual(descriptor!.writable, true)
    })
}

// All report source accessor properties as data descriptors
{
  const source = {
    get value() {
      return 'value'
    },
  }

  for (const [name, create] of Object.entries(utilityBlock(source)))
    test(`${name} reports source accessor properties as data descriptors`, () => {
      const descriptor = Reflect.getOwnPropertyDescriptor(create(), 'value')

      assert.isDefined(descriptor)
      assert.isFalse('get' in descriptor!)
      assert.isFalse('set' in descriptor!)
      assert.strictEqual(descriptor!.value, 'value')
      assert.strictEqual(descriptor!.writable, false)
    })
}


// This does not work on the server, only in browser and tests.
// There, you have to identify $NODE and $HAS by string description.
function getSymbols() {
  const symbols = new Set<symbol>()
  const MetadataKeys = new Proxy({} as { [Key: symbol]: never }, {
    defineProperty(target, key) {
      symbols.add(key as symbol)
      return true
    },
  })

  const [store, setStore] = createStore({ data: MetadataKeys })

  setStore({ data: MetadataKeys })

  testRoot(dispose => createComputed(() => {
    (store.data as any).value
    'value' in store.data
    dispose()
  }))

  const $NODE = [...symbols].find(s => s.description === 'store-node')
  const $HAS = [...symbols].find(s => s.description === 'store-has')
  assertExists($NODE); assertExists($HAS)
  return { $NODE, $HAS }
}
