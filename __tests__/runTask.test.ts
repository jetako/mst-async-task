import { types, Instance } from 'mobx-state-tree'
import {
  AsyncTask,
  AsyncTaskStatus,
  AsyncTaskResult,
  AsyncTaskAbortError,
  runTask,
} from '../src'

const sleep = (signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  setTimeout(() => {
    if (signal?.aborted) {
      reject(new Error('Aborted'))
    } else {
      resolve()
    }
  }, 1)
})

describe('runTask()', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  describe('single task', () => {
    const TestStore = types
      .model({
        value: types.maybe(types.string),
        task: types.optional(AsyncTask, {})
      })
      .actions(self => {
        return {
          run: (fail = false) => runTask(self.task, function*({ signal, exec }) {
            yield sleep(signal)
            if (fail) {
              throw new Error('failed')
            }
            exec(() => self.value = 'ok')
          })
        }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    it('sets status to pending immediately', () => {
      store.run()
      expect(store.task.status).toBe(AsyncTaskStatus.PENDING)
    })

    it('aborts the task when abort() is called while pending', async () => {
      const promise = store.run()
      store.task.abort()
      jest.runAllTimers()
      const result = await promise
      expect(result.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task.status).toBe(AsyncTaskStatus.ABORTED)
    })

    it('sets status to complete and returns result', async () => {
      const promise = store.run()
      jest.runAllTimers()
      const result = await promise
      expect(result).toBeInstanceOf(AsyncTaskResult)
      expect(result.error).toBeUndefined()
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value).toBe('ok')
    })

    it('sets status to failed when an error is thrown', async () => {
      const promise = store.run(true)
      jest.runAllTimers()
      const result = await promise
      expect(result.error?.message).toBe('failed')
      expect(store.task.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task.error?.message).toBe('failed')
    })

    it('resets state when reset() is called', async () => {
      const promise = store.run()
      jest.runAllTimers()
      await promise
      store.task.reset()
      expect(store.task.status).toBe(AsyncTaskStatus.INIT)
    })

    it('throws error when reset() is called while pending', async () => {
      store.run()
      expect(() => store.task.reset()).toThrow()
    })

    it('aborts previous task when run again while pending', async () => {
      const promise1 = store.run()
      const promise2 = store.run()
      jest.runAllTimers()
      const result1 = await promise1
      expect(result1.error).toBeInstanceOf(AsyncTaskAbortError)
      const result2 = await promise2
      expect(result2.error).toBeUndefined()
      expect(store.task.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value).toBe('ok')
    })
  })

  describe('chained tasks', () => {
    const TestStore = types
      .model({
        value1: types.maybe(types.string),
        value2: types.maybe(types.string),
        value3: types.maybe(types.string),
        task1: types.optional(AsyncTask, {}),
        task2: types.optional(AsyncTask, {}),
        task3: types.optional(AsyncTask, {})
      })
      .actions(self => {
        const run = (fail = false) => runTask(self.task1, function*({ signal, exec }) {
          yield sleep(signal)
          yield exec(() => {
            self.value1 = 'ok'
            return run2(fail)
          })
        })
        
        const run2 = (fail = false) => runTask(self.task2, function*({ signal, exec }) {
          yield sleep(signal)
          if (fail) {
            throw new Error('failed')
          }
          yield exec(() => {
            self.value2 = 'ok'
            return run3()
          })
        })

        const run3 = () => runTask(self.task3, function*({ signal, exec }) {
          yield sleep(signal)
          exec(() => self.value3 = 'ok')
        })
        
        return { run }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    it('runs all tasks', async () => {
      const promise = store.run()
      for (let i = 0; i < 3; i++) {
        jest.runAllTimers()
        await Promise.resolve()
      }
      const result = await promise
      expect(result.error).toBeUndefined()
      expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task3.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBe('ok')
      expect(store.value3).toBe('ok')
    })

    it('bubbles up nested failures to the initial task', async () => {
      const promise = store.run(true)
      for (let i = 0; i < 3; i++) {
        jest.runAllTimers()
        await Promise.resolve()
      }
      const result = await promise
      expect(result.error?.message).toBe('failed')
      expect(store.task1.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task1.error?.message).toBe('failed')
      expect(store.task2.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task2.error?.message).toBe('failed')
      expect(store.task3.status).toBe(AsyncTaskStatus.INIT)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBeUndefined()
      expect(store.value3).toBeUndefined()
    })

    it('bubbles up nested abort errors to the initial task', async () => {
      const promise = store.run()
      for (let i = 0; i < 2; i++) {
        jest.runAllTimers()
        await Promise.resolve()
      }
      store.task3.abort()
      jest.runAllTimers()
      await Promise.resolve()
      const result = await promise
      expect(result.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task1.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task1.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task2.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task2.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.task3.status).toBe(AsyncTaskStatus.ABORTED)
      expect(store.task3.error).toBeInstanceOf(AsyncTaskAbortError)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBe('ok')
      expect(store.value3).toBeUndefined()
    })
  })

  describe('parallel tasks', () => {
    const TestStore = types
      .model({
        value1: types.maybe(types.string),
        value2: types.maybe(types.string),
        task1: types.optional(AsyncTask, {}),
        task2: types.optional(AsyncTask, {}),
        task3: types.optional(AsyncTask, {}),
      })
      .actions(self => {
        const run = (fail = false) => runTask(self.task1, function*({ exec }) {
          yield Promise.all([
            exec(run1),
            exec(run2, fail)
          ])
        })
        
        const run1 = () => runTask(self.task2, function*({ signal, exec }) {
          yield sleep(signal)
          exec(() => self.value1 = 'ok')
        })

        const run2 = (fail = false) => runTask(self.task3, function*({ signal, exec }) {
          yield sleep(signal)
          if (fail) {
            throw new Error('failed')
          }
          exec(() => self.value2 = 'ok')
        })
        
        return { run }
      })

    let store: Instance<typeof TestStore>

    beforeEach(() => {
      store = TestStore.create()
    })

    it('runs all tasks', async () => {
      const promise = store.run()
      jest.runAllTimers()
      const result = await promise
      expect(result.error).toBeUndefined()
      expect(store.task1.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task3.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBe('ok')
    })
    
    it('bubbles up failures to the initial task', async () => {
      const promise = store.run(true)
      jest.runAllTimers()
      const result = await promise
      expect(result.error?.message).toBe('failed')
      expect(store.task1.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.task1.error?.message).toBe('failed')
      expect(store.task2.status).toBe(AsyncTaskStatus.COMPLETE)
      expect(store.task3.status).toBe(AsyncTaskStatus.FAILED)
      expect(store.value1).toBe('ok')
      expect(store.value2).toBeUndefined()
    })
  })
})
