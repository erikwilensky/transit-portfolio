import { Component } from 'react';

// One broken screen shows a message instead of blanking the whole app.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="soon">
        <div className="tri" aria-hidden="true" />
        <h1>This screen hit a problem</h1>
        <p>The rest of the demo still works. Pick another screen or person, or reload the page.</p>
        <p className="fineprint"><code>{String(this.state.error.message || this.state.error)}</code></p>
      </div>
    );
  }
}
