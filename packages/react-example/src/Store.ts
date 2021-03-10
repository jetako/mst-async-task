import { types, Instance, applySnapshot } from 'mobx-state-tree'
import { AsyncTask, runTask } from 'mst-async-task'

const sleep = (delay: number) => new Promise<void>(resolve => {
  setTimeout(resolve, delay)
})

const api = {
  async getMessage1() {
    await sleep(1000)
    return 'Hello'
  },

  async getMessage2(signal: AbortSignal) {
    return new Promise(async (resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(new Error('Aborted'))
      })
      await sleep(2000)
      resolve('Greetings') 
    })
  }
}

export const Store = types
  .model({
    message1: types.maybe(types.string),
    message2: types.maybe(types.string),
    task1: types.optional(AsyncTask, {}),
    task2: types.optional(AsyncTask, {}),
    runAllSeqTask: types.optional(AsyncTask, {}),
    runAllParallelTask: types.optional(AsyncTask, {}),
    shouldFailMap: types.optional(types.map(types.boolean), {})
  })
  .actions(self => {
    const runTask1 = () => runTask(self.task1, function*({ exec }) {
      const message = yield api.getMessage1()
      
      if (self.shouldFailMap.get('task1')) {
        throw new Error('Failed')
      }

      exec(() => {
        self.message1 = message
      })
    })
    
    const runTask2 = () => runTask(self.task2, function*({ signal, exec }) {
      const message = yield api.getMessage2(signal)

      if (self.shouldFailMap.get('task2')) {
        throw new Error('Failed')
      }

      exec(() => {
        self.message2 = message
      })
    })

    const runAllSeq = () => runTask(self.runAllSeqTask, function*({ exec }) {
      yield exec(runTask1)
      yield exec(runTask2)
    })

    const runAllParallel = () => runTask(self.runAllParallelTask, function*({ exec }) {
      yield Promise.all([exec(runTask1), exec(runTask2)])
    })

    const toggleShouldFail = (taskName: string) => {
      self.shouldFailMap.set(taskName, !self.shouldFailMap.get(taskName))
    }
    
    const reset = () => {
      applySnapshot(self, {})
    }

    return {
      runTask1,
      runTask2,
      runAllSeq,
      runAllParallel,
      toggleShouldFail,
      reset
    }
  })

export interface IStore extends Instance<typeof Store> {}
