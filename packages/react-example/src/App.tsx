import React from 'react'
import { observer } from 'mobx-react-lite'
import { Store, IStore } from './Store'
import { AsyncTaskStatus, IAsyncTask } from 'mst-async-task'

const store = Store.create()

export default function App() {
  return (
    <div className="App">
      <Main store={store} />
    </div>
  )
}

const Main = observer((({ store }: { store: IStore }) => {
  const {
    message1,
    message2,
    task1,
    task2,
    runAllSeqTask,
    runAllParallelTask,
    shouldFailMap,
    runTask1,
    runTask2,
    runAllSeq,
    runAllParallel,
    toggleShouldFail,
    reset,
  } = store

  return (
    <div className="modal-dialog">
      <div className="modal-content">
        <div className="modal-header">
          <h5 className="modal-title">mst-async-task: React Example</h5>
        </div>

        <div className="modal-body py-0">
          <TaskRow
            name="Task 1"
            task={task1}
            message={message1}
            fail={shouldFailMap.get('task1')}
            onToggleFail={() => toggleShouldFail('task1')}
            onRun={runTask1}
          />

          <TaskRow
            name="Task 2"
            task={task2}
            message={message2}
            fail={shouldFailMap.get('task2')}
            onToggleFail={() => toggleShouldFail('task2')}
            onRun={runTask2}
          />
          
          <div className="figure-caption">Run All Tasks</div>
          <hr className="mt-0" />

          <TaskRow
            name="Sequential"
            task={runAllSeqTask}
            onRun={runAllSeq}
          />

          <TaskRow
            name="Parallel"
            task={runAllParallelTask}
            onRun={runAllParallel}
          />
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={reset}>
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}))

const STATUS_COLORS = {
  [AsyncTaskStatus.INIT]: 'secondary',
  [AsyncTaskStatus.PENDING]: 'primary',
  [AsyncTaskStatus.COMPLETE]: 'success',
  [AsyncTaskStatus.ABORTED]: 'warning',
  [AsyncTaskStatus.FAILED]: 'danger'
}

interface TaskRowProps {
  name: string
  task: IAsyncTask
  message?: string
  fail?: boolean
  onToggleFail?: () => void
  onRun: () => void
}

const TaskRow = observer((({ name, task, message, fail, onToggleFail, onRun }: TaskRowProps) => {
  const { status } = task

  return (
    <div className="d-flex align-items-center my-4">
      <div className="d-flex align-items-center">
        <div>
          <h6 className="mb-0">
            {name}
            <span className="text-secondary ms-1">{message && `(${message})`}</span>
          </h6>

          <div className="d-flex align-items-center">
            <div
              className={`bg-${STATUS_COLORS[status]} rounded-pill me-1`}
              style={{ width: '10px', height: '10px' }}>
            </div>
            <small>{status}</small>
          </div>
        </div>
      </div>

      <div className="d-flex justify-content-end align-items-center ms-auto">
        {onToggleFail && (
          <div className="form-check me-3">
            <input
              className="form-check-input"
              type="checkbox"
              value=""
              checked={!!fail}
              onChange={() => onToggleFail()}
              id={`fail_${name}`}
            />
            <label className="form-check-label" htmlFor={`fail_${name}`}>
              Fail
            </label>
          </div>
        )}

        {!task.pending ? (
          <button
            className="btn btn-sm btn-primary"
            style={{ width: '55px' }}
            onClick={onRun}>
            Run
          </button>
        ) : (
          <button
            className="btn btn-sm btn-secondary"
            style={{ width: '55px' }}
            onClick={task.abort}>
            Abort
          </button>
        )}
      </div>
    </div>
  )
}))
