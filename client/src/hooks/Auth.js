import { useContext } from 'react';
import { AuthContext, AuthProvider } from '../context/Auth'; 

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export { AuthProvider }; 
