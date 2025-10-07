import React, { Component, ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  isNetworkError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    isNetworkError: false
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const isNetworkError = error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('NETWORK_ERROR') ||
      error.message.toLowerCase().includes('failed to fetch') ||
      (error.name === 'TypeError' && error.message.includes('Failed to fetch'));

    return { hasError: true, error, isNetworkError };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const isNetworkError = this.state.isNetworkError;

    if (isNetworkError) {
      console.warn("Network error caught in component:", error.message);
    } else {
      console.error("Uncaught error in component:", error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { isNetworkError } = this.state;

      return (
        <div className={`p-8 text-center rounded-lg border ${
          isNetworkError
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <h2 className={`text-xl font-bold mb-2 ${
            isNetworkError ? 'text-yellow-800' : 'text-red-800'
          }`}>
            {isNetworkError ? 'Connection Issue' : 'Something went wrong'}
          </h2>
          <p className={`mb-4 ${
            isNetworkError ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {isNetworkError
              ? 'Unable to connect to the server. Please check your internet connection and try again.'
              : 'An error occurred in this section. Please try refreshing the page or contacting support.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined, isNetworkError: false })}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${
              isNetworkError
                ? 'bg-yellow-600 hover:bg-yellow-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {isNetworkError ? 'Retry Connection' : 'Try Again'}
          </button>
          {this.state.error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-red-700 font-medium">
                Error Details
              </summary>
              <pre className="mt-2 p-3 bg-red-100 rounded text-xs text-red-800 overflow-auto">
                {this.state.error.message}
                {this.state.error.stack && (
                  <>
                    {'\n\n'}
                    {this.state.error.stack}
                  </>
                )}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}