import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/Auth';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Wordle from './pages/Wordle';
import Menu from './pages/Menu';
import NotFound from './pages/NotFound';
import Banner from './components/Banner'; 
import './style.css'; 

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Banner />
    </AuthProvider>
  );
}

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-2xl font-bold text-gray-700">Loading authentication...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/games" element={isAuthenticated ? <Menu /> : <Navigate to="/login" />} />
        <Route path="/wordle" element={isAuthenticated ? <Wordle /> : <Navigate to="/login" />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/games" /> : <Login />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/games" /> : <Signup />} />

        <Route path="/" element={isAuthenticated ? <Navigate to="/games" /> : <Navigate to="/login" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
