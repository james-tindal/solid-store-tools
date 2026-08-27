import { testRoot } from '../solid-root'
import { createMutable } from 'solid-js/store'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { assertGarbageCollected } from '../assert-garbage-collected'
import { logStore, type LogStoreEvent } from './log-store'
import { assertLength } from '../utilities'

const { expect: expectLogged, ...loggedEvents } = {
  checkedCalls: 0,
  reset() {
    if (vi.isMockFunction(console.log))
      vi.mocked(console.log).mockClear()
    else
      vi.spyOn(console, 'log').mockImplementation(() => {})

    loggedEvents.checkedCalls = 0
  },
  expect(...events: LogStoreEvent[]) {
    const calls = vi.mocked(console.log).mock.calls.slice(loggedEvents.checkedCalls)
    loggedEvents.checkedCalls += calls.length

    expect(calls.map(([event]) => event)).toEqual(events)
  },
}

describe('logStore', () => {
  beforeEach(loggedEvents.reset)

  test('returns the passed store', () => testRoot(() => {
    const store = createMutable({
      name: 'Ada',
    })

    expect(logStore(store)).toBe(store)
  }))

  test('logs changes to top-level store keys', () => testRoot(() => {
    const store = createMutable({
      name: 'Ada',
      count: 1,
    })

    logStore(store)

    store.name = 'Grace'
    store.count = 2

    expectLogged(
      {
        type: 'set',
        path: ['name'],
        previous: 'Ada',
        value: 'Grace',
      },
      {
        type: 'set',
        path: ['count'],
        previous: 1,
        value: 2,
      },
    )
  }))

  test('filters logged events', () => testRoot(() => {
    const store = createMutable({
      visible: 'Ada',
      hidden: 'secret',
    })

    logStore(store, event => event.path[0] !== 'hidden')

    store.visible = 'Grace'
    store.hidden = 'classified'

    expectLogged(
      {
        type: 'set',
        path: ['visible'],
        previous: 'Ada',
        value: 'Grace',
      },
    )
  }))

  test('logs object replacement at the object path', () => testRoot(() => {
    const previousUser = {
      name: 'Ada',
      profile: {
        active: true,
      },
    }
    const nextUser = {
      name: 'Grace',
      profile: {
        active: false,
      },
    }
    const store = createMutable({
      user: previousUser,
    })

    logStore(store)

    store.user = nextUser

    expectLogged(
      {
        type: 'set',
        path: ['user'],
        previous: previousUser,
        value: nextUser,
      },
    )
  }))

  test('logs changes to nested store keys', () => testRoot(() => {
    const store = createMutable({
      user: {
        name: 'Ada',
        profile: {
          active: true,
        },
      },
    })

    logStore(store)

    store.user.profile.active = false

    expectLogged(
      {
        type: 'set',
        path: ['user', 'profile', 'active'],
        previous: true,
        value: false,
      },
    )
  }))

  test('logs array index changes', () => testRoot(() => {
    const store = createMutable({
      players: [
        { name: 'Ada', money: 100 },
        { name: 'Grace', money: 200 },
      ],
    })

    logStore(store)

    assertLength(store.players, 2)
    store.players[1].money = 250

    expectLogged(
      {
        type: 'set',
        path: ['players', 1, 'money'],
        previous: 200,
        value: 250,
      },
    )
  }))

  test('logs added keys', () => testRoot(() => {
    const store = createMutable({
      user: {} as { name?: string },
    })

    logStore(store)

    store.user.name = 'Ada'

    expectLogged(
      {
        type: 'add',
        path: ['user', 'name'],
        value: 'Ada',
      },
    )
  }))

  test('logs deleted keys', () => testRoot(() => {
    const store = createMutable({
      user: {
        name: 'Ada' as string | undefined,
      },
    })

    logStore(store)

    delete store.user.name

    expectLogged(
      {
        type: 'delete',
        path: ['user', 'name'],
        previous: 'Ada',
      },
    )
  }))

  test('logs symbol keys', () => testRoot(() => {
    const symbolKey = Symbol('status')
    const store = createMutable({
      [symbolKey]: 'ready',
    })

    logStore(store)

    store[symbolKey] = 'done'

    expectLogged(
      {
        type: 'set',
        path: [symbolKey],
        previous: 'ready',
        value: 'done',
      },
    )
  }))

  test('does not log the initial snapshot by default', () => testRoot(() => {
    const store = createMutable({
      name: 'Ada',
    })

    logStore(store)

    expect(console.log).not.toHaveBeenCalled()
  }))

  test('releases replaced object branches', () => testRoot(() => {
    let oldBranch: { nested: { value: string }} | undefined = {
      nested: {
        value: 'old',
      },
    }
    const store = createMutable({
      branch: oldBranch,
    })
    const collected = assertGarbageCollected(oldBranch)

    logStore(store, () => false)

    store.branch = {
      nested: {
        value: 'new',
      },
    }
    oldBranch = undefined

    return collected
  }))

  test('releases deleted object branches', () => testRoot(() => {
    let oldBranch: { nested: { value: string }} | undefined = {
      nested: {
        value: 'old',
      },
    }
    const store = createMutable({
      branch: oldBranch as { nested: { value: string }} | undefined,
    })
    const collected = assertGarbageCollected(oldBranch)

    logStore(store, () => false)

    delete store.branch
    oldBranch = undefined

    return collected
  }))
})
