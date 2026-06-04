import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', {
        full_name: fullName,
        email: email,
        password: password
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative blurred circles */}
      <div style={{
        position: 'absolute', top: '-100px', left: '-100px',
        width: '400px', height: '400px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-120px', right: '-120px',
        width: '350px', height: '350px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: '440px', margin: '0 16px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '24px',
        border: '1px solid rgba(148,163,184,0.15)',
        padding: '48px 40px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Logo / Icon */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            marginBottom: '16px',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        </div>

        <h2 style={{
          fontSize: '28px', fontWeight: 700, color: '#f1f5f9',
          textAlign: 'center', margin: '0 0 6px 0',
        }}>Create an Account</h2>
        <p style={{
          fontSize: '14px', color: '#94a3b8',
          textAlign: 'center', margin: '0 0 32px 0',
        }}>Join us and get started in seconds</p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
            color: '#fca5a5', fontSize: '13px', textAlign: 'center',
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 500,
              color: '#cbd5e1', marginBottom: '8px',
            }}>Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="John Doe"
              style={{
                width: '100%', padding: '12px 16px', fontSize: '15px',
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '12px', color: '#f1f5f9', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6';
                e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 500,
              color: '#cbd5e1', marginBottom: '8px',
            }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@company.com"
              style={{
                width: '100%', padding: '12px 16px', fontSize: '15px',
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '12px', color: '#f1f5f9', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6';
                e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block', fontSize: '13px', fontWeight: 500,
              color: '#cbd5e1', marginBottom: '8px',
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              style={{
                width: '100%', padding: '12px 16px', fontSize: '15px',
                background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)',
                borderRadius: '12px', color: '#f1f5f9', outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6';
                e.target.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(148,163,184,0.2)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '16px', fontWeight: 600,
              color: '#ffffff', border: 'none', borderRadius: '12px', cursor: 'pointer',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
              boxShadow: '0 4px 20px rgba(139,92,246,0.4)',
              transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 28px rgba(139,92,246,0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.4)';
            }}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{
          marginTop: '28px', textAlign: 'center',
          fontSize: '14px', color: '#94a3b8',
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{
            color: '#a78bfa', textDecoration: 'none', fontWeight: 600,
            transition: 'color 0.2s',
          }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#c4b5fd'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#a78bfa'}
          >Sign in</Link>
        </p>
      </div>
    </div>
  );
}
