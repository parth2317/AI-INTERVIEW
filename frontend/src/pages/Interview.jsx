import React, { useEffect, useRef, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { AuthContext } from '../context/AuthContext';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAiMonitor } from '../hooks/useAiMonitor';

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const Interview = () => {
  const { roomId } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [alerts, setAlerts] = useState([]);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  
  const chatEndRef = useRef(null);

  // Initialize AI Monitoring only for Candidates
  const { isAiLoaded } = useAiMonitor(localVideoRef, user?.role === 'Candidate', socket, roomId, user);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, alerts]);

  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Initialize WebRTC and Socket
    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        newSocket.emit('join-room', { roomId, userId: user.id, role: user.role });

        newSocket.on('user-joined', async ({ userId, role, socketId }) => {
          console.log(`User joined: ${userId} as ${role}`);
          createPeerConnection(newSocket, socketId, true);
        });

        newSocket.on('offer', async ({ offer, from }) => {
          createPeerConnection(newSocket, from, false);
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          newSocket.emit('answer', { answer, to: from });
        });

        newSocket.on('answer', async ({ answer }) => {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        });

        newSocket.on('ice-candidate', async ({ candidate }) => {
          if (candidate && peerConnectionRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        });

        newSocket.on('receive-message', async (message) => {
          setMessages((prev) => [...prev, message]);
          if (user.role === 'Interviewer') {
            try {
              await fetch(`http://localhost:5000/api/interviews/${roomId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
              });
            } catch (e) {
              console.error('Failed to save chat', e);
            }
          }
        });
        
        newSocket.on('receive-alert', async (alert) => {
          if (user.role === 'Interviewer') {
            setAlerts((prev) => [...prev, alert]);
            try {
              await fetch(`http://localhost:5000/api/interviews/${roomId}/alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alert)
              });
            } catch (e) {
              console.error('Failed to save alert', e);
            }
          }
        });

        newSocket.on('user-disconnected', () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
        });
      } catch (err) {
        console.error('Error accessing media devices:', err);
        alert('Could not access camera/microphone');
      }
    };

    init();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      newSocket.disconnect();
    };
  }, [roomId, user]);

  const createPeerConnection = (socketInstance, targetSocketId, isInitiator) => {
    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketInstance.emit('ice-candidate', { candidate: event.candidate, to: targetSocketId });
      }
    };

    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer);
        socketInstance.emit('offer', { offer, to: targetSocketId });
      });
    }
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const leaveInterview = () => {
    navigate('/dashboard');
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (newMessage.trim() && socket) {
      const msgData = {
        senderId: user.id,
        senderName: user.name,
        text: newMessage,
        timestamp: new Date().toISOString()
      };
      socket.emit('send-message', { roomId, message: msgData });
      setNewMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Video Area */}
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 bg-gray-800 rounded-2xl relative overflow-hidden flex items-center justify-center border border-gray-700">
            {/* Remote Video (Full Size) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {!remoteVideoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col">
                <VideoOff className="h-16 w-16 mb-4 opacity-50" />
                <p>Waiting for other participant to join...</p>
              </div>
            )}
            
            {/* Local Video (PiP) */}
            <div className="absolute bottom-6 right-6 w-48 aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden shadow-2xl border-2 border-gray-700 z-10 transition-transform hover:scale-105">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
              {user.role === 'Candidate' && (
                <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur">
                  AI Active: {isAiLoaded ? 'Yes' : 'Loading...'}
                </div>
              )}
            </div>
            
            {/* Controls Overlay */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-4">
              <button
                onClick={toggleMute}
                className={`p-4 rounded-full shadow-lg transition ${isMuted ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <button
                onClick={toggleVideo}
                className={`p-4 rounded-full shadow-lg transition ${isVideoOff ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
              >
                {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </button>
              <button
                onClick={leaveInterview}
                className="p-4 rounded-full shadow-lg bg-red-600 hover:bg-red-700 text-white transition"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar (Chat & Alerts) */}
        <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col shadow-xl">
          <div className="p-4 border-b border-gray-700 bg-gray-800/95 backdrop-blur z-10">
            <h2 className="text-xl items-center font-semibold text-white flex justify-between">
              Session Info
              <span className="text-sm font-normal text-gray-400 bg-gray-700 px-3 py-1 rounded-full">
                Room: {roomId}
              </span>
            </h2>
          </div>

          {/* AI Alerts Panel (Only for Interviewer) */}
          {user.role === 'Interviewer' && alerts.length > 0 && (
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <h3 className="text-red-400 font-semibold mb-3 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                AI Alerts ({alerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {alerts.map((alert, idx) => (
                  <div key={idx} className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg flex items-start">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-400">{alert.type}</p>
                      <p className="text-xs text-red-300 mt-1">{alert.description}</p>
                      <span className="text-[10px] text-gray-400 mt-2 block">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                <p>No messages yet. Say hi!</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.senderId === user.id;
                return (
                  <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[11px] text-gray-400 mb-1 ml-1">
                      {isMe ? 'You' : msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] break-words ${
                      isMe 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-gray-700 text-gray-100 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-gray-700 bg-gray-800">
            <form onSubmit={sendMessage} className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-gray-400"
              />
              <button
                type="submit"
                className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition flex items-center justify-center group"
              >
                <Send className="h-5 w-5 transform group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Interview;
