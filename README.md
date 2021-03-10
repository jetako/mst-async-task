# mst-async-task
Manage the lifecycles of asynchronous flows in Mobx-State-Tree

## Introduction
Mobx-State-Tree's `flow` provides a solid foundation for dealing with asynchronous actions, but we're left to do all of the bookkeeping ourselves.

`mst-async-task` encapsulates the various states of asychronous actions and gives you powerful abilities like chaining and aborting tasks with minimal boilerplate.

## Example
```ts
import { types } from 'mobx-state-tree'
import { AsyncTask, runTask } from 'mst-async-task'
import { User, Item } from './models'

export const Store = types
  .model({
    user: types.maybe(User),
    loadUserTask: types.optional(AsyncTask, {})
  })
  .actions(self => {
    const loadUser = () => runTask(self.loadUserTask, function*({ exec }) {
      // No need to wrap in a try/catch block. Errors are handled by the task runner.
      const data = yield fetch(`https://example-api.com/user`)
      // Wrap state updates in an exec() callback, which will prevent
      // execution if the task is aborted.
      exec(() => {
        self.user = User.create(data)
      })
    })

    return { loadUser }
  })
```

#### Component
```tsx
export const Main = observer(() => {
  const { user, loadUserTask, loadUser } = useStore()

  useEffect(() => {
    loadUser()
  }, [])

  if (loadUserTask.pending) {
    return (
      <div>
        <p>Loading...</p>
        <button onClick={() => loadUserTask.abort()}>
          Abort
        </button>
      </div>
    )
  }

  if (loadUserTask.error) {
    return <p>Error: {loadUserTask.error.message}</p>
  }

  if (user) {
    return <p>Hello, {user.name}</p>
  }

  return null
})
```

## AbortSignal
If you're making a long-running request that you want to be cancelable, you can pass the `signal` parameter to
`fetch()`, and the request will be stopped when you call `task.abort()`. 
```ts
const uploadFile = (data: FormData) => runTask(self.uploadFileTask, function*({ signal }) {
  yield fetch(`https://example-api.com/uploads`, {
    body: data,
    method: 'POST',
    // Pass the AbortSignal to fetch() to stop uploading when
    // when the task is aborted.
    signal
  })
})
```

## Chaining tasks
Tasks can execute other tasks in a controlled fashion. If an error occurs in the child task, it will bubble up to the parent. If the parent task is aborted, the child task will be aborted as well.
```ts
const loadUser = () => runTask(self.loadUserTask, function*({ exec }) {
  const data = yield fetch(`https://example-api.com/user`)
  yield exec(() => {
    self.user = User.create(data)
    return loadItem(self.user.itemId)
  })
})

const loadItem = (id: string) => runTask(self.loadItemTask, function*({ exec }) {
  const data = yield fetch(`https://example-api.com/items/${id}`)
  exec(() => {
    // This will not be executed if `loadUserTask.abort()` is called or if loadUser() is
    // called again while still pending.
    self.item = Item.create(data)
  })
})
```

## Running tasks in parallel
```ts
const loadAllThings = () => runTask(self.loadAllTask, function*({ exec }) {
  yield Promise.all([
    exec(loadThing1),
    exec(loadThing2)
  ])
})
```

# Documentation

## AsyncTask
Model that encapsulates the state of an async action.

### Properties
| Name             | Type               | Description                                                |
| ---------------- | ------------------ | ---------------------------------------------------------- | 
| **status**       | AsyncTaskStatus    | 'init' \| 'pending' \| 'complete' \| 'failed' \| 'aborted' |
| **error**        | Error \| undefined | Any error that is thrown during task execution.            |

### Views
| Name             | Type               | Description                                                |
| ---------------- | ------------------ | ---------------------------------------------------------- | 
| **clean**        | boolean            | Indicates the task has not been run yet.                   |
| **pending**      | boolean            | Indicates the task is currently running.                   |
| **complete**     | boolean            | Indicates the task completed successfully.                 |
| **failed**       | boolean            | Indicates an error was thrown during task execution.       |
| **aborted**      | boolean            | Indicates the task was aborted.                            |
| **unresolved**   | boolean            | Indicates the task has not been run or is pending.         |
| **resolved**     | boolean            | Indicates the task is complete, failed, or aborted.        |

### Actions
| Name             | Description                                                                     |
| ---------------- | ------------------------------------------------------------------------------- | 
| **abort()**      | Aborts the task if it is currently running.                                     |
| **reset()**      | Aborts the task if it is currently running, and resets to the initial state.    |

## runTask(task, generator)
Executes a `flow` generator while maintaining lifecycle updates in an AsyncTask. In the generator function, you perform async operations like loading data and
updating the store state, similarly to how you would with `flow`. The generator function receives an object with two parameters: `signal` and `exec`:

`signal` is an AbortSignal that is useful for canceling requests. For example, you can pass it into `fetch()`, and if the task is aborted, the http request will be
aborted as well.

`exec` serves two purposes:
1. If you want your task to be cancelable via `task.abort()` but don't want to deal with signals, you can prevent your task from updating state after it is aborted by wrapping your updates in an `exec()` callback.
2. Calling a task action from another task.
