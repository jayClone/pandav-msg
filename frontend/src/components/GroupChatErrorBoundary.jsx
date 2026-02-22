import React from 'react';

class GroupChatErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ GroupChat Error:', error);
    console.error('📋 Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-red-950/20 p-4">
          <div className="bg-red-500/20 border-2 border-red-500 rounded-xl p-6 max-w-md text-center">
            <h2 className="text-xl font-bold text-red-400 mb-2">⚠️ Error Loading Group Chat</h2>
            <p className="text-sm text-red-300 mb-4">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
            >
              🔄 Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GroupChatErrorBoundary;