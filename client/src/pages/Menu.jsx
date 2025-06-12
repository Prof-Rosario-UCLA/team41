import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/Auth';
import './Menu.css';

const Menu = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    const success = await logout();
    if (success) {
      navigate('/login');
    }
  };

  return (
    <div className="menu-container">
      <h1 className="menu-title">Customizable NYT Games</h1>
      <p className="menu-description">Main Menu</p>
      <div className="game-buttons-container">
        <button
          onClick={() => navigate('/wordle')}
          className="game-button wordle"
        >
          Play Wordle
        </button>
        <button className="game-button boggle">
          Play Boggle
        </button>
      </div>
      <button
        onClick={handleLogout}
        className="logout-button"
      >
        Logout
      </button>
    </div>
  );
};

export default Menu;
