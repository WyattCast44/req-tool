import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary caught', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="panel notice notice-danger">
          <div className="notice-title">{this.props.title || 'Something went wrong in this view'}</div>
          <p className="mt-1">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-secondary mt-2"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
