import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { Video, Copy, Play } from 'lucide-react';

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const createInterview = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewerId: user.id, candidateId: user.id }), // Ideally, candidateId would be selected, but we use a dummy or let the candidate bind it later.
      });
      const data = await res.json();
      navigate(`/interview/${data._id}`);
    } catch (err) {
      console.error('Error creating interview', err);
      // Fallback
      const newRoomId = Math.random().toString(36).substring(2, 9);
      navigate(`/interview/${newRoomId}`);
    }
  };

  const joinInterview = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/interview/${roomId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Welcome, {user.name}
          </h1>
          
          {user.role === 'Interviewer' ? (
            <div className="space-y-6">
              <p className="text-gray-600">Start a new AI-monitored interview session.</p>
              <button
                onClick={createInterview}
                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
              >
                <Video className="mr-2 h-5 w-5" />
                Create New Interview Room
              </button>
              
              <div className="mt-8 border-t pt-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Or Join Existing Room</h2>
                <form onSubmit={joinInterview} className="flex gap-4 max-w-md">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition font-medium flex items-center"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Join
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-gray-600">Join an interview session created by your interviewer.</p>
              <form onSubmit={joinInterview} className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room ID</label>
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter the ID provided by your interviewer"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex justify-center items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Join Interview Room
                </button>
              </form>
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <strong>Important:</strong> During the interview, you will be monitored by AI. Ensure your face is clearly visible, do not switch tabs, and do not look away from the screen or use your phone.
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
