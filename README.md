# solid-store-tools

[![npm version](https://img.shields.io/npm/v/solid-store-tools.svg)](https://www.npmjs.com/package/solid-store-tools)
[![npm downloads](https://img.shields.io/npm/dm/solid-store-tools.svg)](https://www.npmjs.com/package/solid-store-tools)
[![bundle size](https://img.shields.io/bundlejs/size/solid-store-tools)](https://bundlejs.com/?q=solid-store-tools)

Derive stores from stores and signals. For [SolidJS](https://www.solidjs.com/).

## Install

```sh
npm install solid-store-tools solid-js
```

Import all public APIs from the package root:

```ts
import { merge, omit, pick, switchStore } from 'solid-store-tools'
```

## Reactive ownership

The following functions create Solid computations:

- `dedupeStore`
- `logStore`
- `storeFromAccessor`
- `switchAccessor`
- `switchStore`

Call these functions inside a component or another Solid reactive root. Solid then disposes their computations with that owner.

## Live object views

`merge`, `pick`, `omit`, and `filterKeys` return proxies. They do not copy their source objects.

The proxies read current values, keys, and property descriptors from their sources. Mutations through a proxy operate on its source object.

### `merge`

`merge(...objects)` creates one live view of multiple objects. A property from a later object takes precedence over the same property from an earlier object.

```ts
import { merge } from 'solid-store-tools'
import { createMutable } from 'solid-js/store'

const user = createMutable({ name: 'Ada', online: false })
const status = createMutable({ online: true })
const view = merge(user, status)

view.name   // 'Ada'
view.online // true

status.online = false
view.online // false
```

A present property with an `undefined` value still takes precedence. If a property is absent, `merge` searches the earlier objects.

A write updates the object that currently supplies the property. A write to a new property updates the last object.

### `pick` and `omit`

`pick(object, keys)` exposes only the specified keys. `omit(object, keys)` exposes all keys except the specified keys.

```ts
import { omit, pick } from 'solid-store-tools'
import { createMutable } from 'solid-js/store'

const user = createMutable({
  id: 1,
  name: 'Ada',
  password: 'secret',
})

const identity = pick(user, ['id', 'name'])
const publicUser = omit(user, ['password'])

user.name = 'Grace'
identity.name   // 'Grace'
publicUser.name // 'Grace'
```

Both functions preserve readonly properties, symbol keys, and discriminated union types.

### `filterKeys`

`filterKeys(source, allows)` creates a live view that uses a predicate to select keys.

```ts
import { filterKeys } from 'solid-store-tools'

const source = { name: 'Ada', _token: 'secret' }
const publicEntries = filterKeys(
  source,
  key => typeof key !== 'string' || !key.startsWith('_'),
)

Object.keys(publicEntries) // ['name']
```

The predicate applies to reads, writes, key checks, deletion, and enumeration. A rejected key is not accessible through the proxy.

## Accessors and stores

### `objectFromAccessor` and `storeFromAccessor`

Both functions expose the object returned by an accessor. They provide different update and mutation behavior.

`objectFromAccessor(accessor)` creates a forwarding proxy. Each proxy operation uses the latest object from the accessor.

```ts
import { createSignal } from 'solid-js'
import { objectFromAccessor } from 'solid-store-tools'

const [current, setCurrent] = createSignal({ name: 'Ada' })
const user = objectFromAccessor(current)

user.name // 'Ada'
setCurrent({ name: 'Grace' })
user.name // 'Grace'
```

The proxy forwards writes and deletions to the current source object. A property read tracks the reactive dependencies of the accessor.

`storeFromAccessor(accessor)` creates a real Solid store. It reconciles each new object with the current store value.

```ts
import { createSignal } from 'solid-js'
import { storeFromAccessor } from 'solid-store-tools'

const [current, setCurrent] = createSignal({ name: 'Ada', score: 10 })
const user = storeFromAccessor(current)

setCurrent({ name: 'Ada', score: 11 })
user.score // 11
```

The store gives consumers fine-grained updates. Unchanged properties do not notify their dependents when the accessor returns a new object.

Use `objectFromAccessor` when operations must reach the current source object. Use `storeFromAccessor` when consumers need a reconciled, read-only Solid store.

### `getters`

`getters(spec)` converts zero-argument function entries into getter properties. It processes nested non-array objects recursively.

```ts
import { createSignal } from 'solid-js'
import { getters } from 'solid-store-tools'

const [first, setFirst] = createSignal('Ada')
const user = getters({
  name: first,
  profile: {
    label: () => `User: ${first()}`,
  },
})

user.name          // 'Ada'
user.profile.label // 'User: Ada'
```

The getters are lazy. Functions that declare one or more parameters remain functions. Arrays also remain unchanged.

## Store update control

### `dedupeStore`

`dedupeStore(object, options?)` snapshots an object and reconciles changes into a real Solid store.

```ts
import { createMutable } from 'solid-js/store'
import { dedupeStore, pick } from 'solid-store-tools'

const source = createMutable({ name: 'Ada', internal: 1 })
const publicStore = dedupeStore(pick(source, ['name']))

source.internal++
// Dependents of publicStore do not receive an update.
```

Use this function when a proxy view tracks more source changes than its consumers need. The optional second argument accepts Solid `reconcile` options.

## Branch selection

### `switchAccessor`

`switchAccessor(select, branches)` returns an accessor for the selected object. The selector returns a branch key or a `[key, data]` tuple.

```ts
import { createSignal } from 'solid-js'
import { switchAccessor } from 'solid-store-tools'

const [selected, setSelected] = createSignal<number>()

const current = switchAccessor(
  () => selected() === undefined
    ? 'empty' as const
    : ['selected', selected()] as const,
  {
    empty: { view: 'empty' as const },
    selected: id => ({ view: 'selected' as const, id }),
  },
)

current().view // 'empty'
setSelected(42)
current().view // 'selected'
```

A branch entry can be an object or a function that returns an object. A branch function runs when its key becomes selected.

Changing tuple data without changing the key does not recreate the branch. Include the required reactivity in the branch object when data can change.

The function disposes the previous branch root after a key change.

### `switchStore`

`switchStore(select, branches)` uses the same branch model as `switchAccessor`. It returns one stable object proxy instead of an accessor.

```ts
import { createSignal } from 'solid-js'
import { switchStore } from 'solid-store-tools'

const [authenticated, setAuthenticated] = createSignal(false)
const session = switchStore(
  () => authenticated() ? 'user' as const : 'guest' as const,
  {
    guest: { role: 'guest' as const },
    user: { role: 'user' as const, canEdit: true },
  },
)

session.role // 'guest'
setAuthenticated(true)
session.role // 'user'
```

Keys, values, methods, and property descriptors come from the current branch.

## Store inspection

### `logStore`

`logStore(store, filter?)` logs deep store changes with `console.log`. It returns the same store.

```ts
import { createMutable } from 'solid-js/store'
import { logStore } from 'solid-store-tools'

const state = logStore(createMutable({
  user: { name: 'Ada' },
}))

state.user.name = 'Grace'
// { type: 'set', path: ['user', 'name'], previous: 'Ada', value: 'Grace' }
```

Events have an `add`, `set`, or `delete` type. Array indexes in an event path are numbers.

The optional filter receives each `LogStoreEvent`. Return `false` to suppress that event.

```ts
logStore(state, event => event.path[0] !== 'internal')
```

## Object-oriented stores

These helpers convert objects with methods into Solid stores. They bind methods to the mutable store so that method calls can update reactive properties.

### `FunctionStore` and `FactoryStore`

`FunctionStore(instance)` binds enumerable function properties on an object.

`FactoryStore(factory)` creates a factory that applies `FunctionStore` to each result.

```ts
import { FactoryStore } from 'solid-store-tools'

const Counter = FactoryStore((initial: number) => ({
  count: initial,
  increment() {
    this.count++
  },
}))

const counter = Counter(0)
counter.increment()
counter.count // 1
```

### `MethodStore` and `ClassStore`

`MethodStore(instance)` binds methods from the instance prototype.

`ClassStore(Class)` creates a factory that constructs the class and applies `MethodStore`.

```ts
import { ClassStore } from 'solid-store-tools'

class CounterModel {
  count = 0

  increment() {
    this.count++
  }
}

const Counter = ClassStore(CounterModel)
const counter = Counter()

counter.increment()
counter.count // 1
```

Use `ClassStore(Class).private(...keys)` to omit public fields from the returned store view.

```ts
class SessionModel {
  token = 'secret'
  user = 'Ada'
}

const Session = ClassStore(SessionModel).private('token')
const session = Session()

session.user
// session.token is not part of the returned type or object view.
```

## Custom unmapped types

`switchAccessor` and `switchStore` make returned object properties mutable in their TypeScript result types. They preserve functions and `Date` values.

Add a type to `UnmappedTypes` when the type must remain unchanged:

```ts
import type { UnmappedTypes } from 'solid-store-tools'

declare module 'solid-store-tools' {
  interface UnmappedTypes {
    url: URL
  }
}
```

The interface key is only a label. Its value adds a type to the preserved union.
