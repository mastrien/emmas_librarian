import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ReactErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary captured an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopyLog = () => {
    const logText = `Error: ${this.state.error?.message || 'Unknown'}\nStack: ${this.state.error?.stack || ''}\nComponent Stack: ${this.state.errorInfo?.componentStack || ''}`;
    navigator.clipboard.writeText(logText);
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-6">
          <div className="max-w-lg w-full bg-slate-800 border border-red-500/30 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <svg className="w-8 h-8 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h2 className="text-xl font-bold text-slate-50">Algo deu errado na interface</h2>
            </div>
            <p className="text-sm text-slate-300">
              Ocorreu um erro inesperado durante o carregamento deste componente. Os dados não salvos permanecem protegidos.
            </p>
            {this.state.error && (
              <div className="bg-slate-950 p-3 rounded text-xs font-mono text-red-300 overflow-x-auto max-h-32 border border-slate-700">
                {this.state.error.toString()}
              </div>
            )}
            <div className="flex space-x-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition"
              >
                Recarregar Aplicação
              </button>
              <button
                onClick={this.handleCopyLog}
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 px-4 rounded-lg transition"
              >
                Copiar Logs
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
