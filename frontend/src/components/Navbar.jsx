import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LogOut, User, Video } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Video className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">AI Monitor</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-700">
              <User className="h-5 w-5 mr-1" />
              <span className="text-sm font-medium">{user.name} ({user.role})</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center text-gray-500 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
