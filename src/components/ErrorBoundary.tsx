import React, { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          fontFamily: 'sans-serif',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center',
            backgroundColor: '#2a2a2a',
            padding: '40px',
            borderRadius: '8px',
            border: '1px solid #d32f2f'
          }}>
            <h1 style={{ color: '#d32f2f', marginBottom: '20px' }}>Erro ao Carregar a Aplicação</h1>
            <p style={{ marginBottom: '20px', lineHeight: '1.6' }}>
              Desculpe, ocorreu um erro. Verifique:
            </p>
            <ul style={{
              textAlign: 'left',
              marginBottom: '20px',
              lineHeight: '2'
            }}>
              <li>✓ Se você configurou as variáveis de ambiente no Netlify</li>
              <li>✓ Se VITE_SUPABASE_URL está correto</li>
              <li>✓ Se VITE_SUPABASE_ANON_KEY está correto</li>
              <li>✓ Tente fazer um Trigger Deploy novamente no Netlify</li>
            </ul>
            <details style={{ 
              textAlign: 'left',
              marginTop: '20px',
              padding: '10px',
              backgroundColor: '#1a1a1a',
              borderRadius: '4px',
              cursor: 'pointer'
            }}>
              <summary style={{ marginBottom: '10px', color: '#90caf9' }}>Detalhes do erro</summary>
              <pre style={{
                overflowX: 'auto',
                color: '#ffcdd2',
                fontSize: '12px',
                margin: '10px 0 0 0'
              }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
