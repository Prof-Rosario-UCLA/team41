import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/Auth';
//import './signup.css'; 

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup, isAuthenticated, loading, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/games');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const success = await signup(email, password);
    if (success) {
      navigate('/games');
    }
  };

  return (
    <div className="signup-page-container">
      <div className="signup-card">
        <h2 className="signup-title">Sign Up</h2>
        {error && <p className="error-error-message">{error}</p>}
        <form onSubmit={handleSubmit} className="signup-form-elements">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="signup-submit-button"
          >
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
        <p className="login-link-text">
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="login-link-button"
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;
