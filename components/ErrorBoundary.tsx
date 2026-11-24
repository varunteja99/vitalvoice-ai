import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#131314] text-[#E3E3E3] flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-[#1E1F20] rounded-[28px] border border-red-900/50 p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <span className="material-symbol text-3xl text-red-400">error</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              VitalVoice AI encountered an unexpected issue while rendering this screen.
            </p>
            {this.state.error?.message && (
              <div className="bg-[#131314] border border-[#444746] rounded-xl p-3 mb-6 text-left overflow-x-auto">
                <p className="text-xs font-mono text-red-300 break-words">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full py-3.5 rounded-full bg-[#D3E3FD] hover:bg-[#C4D7FC] text-[#041E49] font-bold transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
