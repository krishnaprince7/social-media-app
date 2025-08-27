import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { FiSend, FiArrowUp, FiTrash2, FiImage, FiX, FiMic, FiSquare, FiPlay, FiPause } from "react-icons/fi";

import { io } from "socket.io-client";

const genTempId = () => `tmp_${Math.random().toString(36).slice(2)}_${Date.now()}`;
const getRoomId = (a, b) => [String(a), String(b)].sort((x, y) => (x > y ? 1 : -1)).join("::");

// Time helpers: IST formatting + relative "time ago"
const formatISTDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const formatted = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
  return `${formatted} IST`;
};

const formatTimeAgo = (iso) => {
  if (!iso) return "";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const then = new Date(iso).getTime();
  const now = Date.now();
  let delta = Math.floor((then - now) / 1000);

  const units = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of units) {
    const diff = Math.round(delta / secondsInUnit);
    if (Math.abs(diff) >= 1) {
      return rtf.format(diff, unit);
    }
  }
  return "just now";
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ChatMessages = () => {
  const { senderId = "", receiverId = "" } = useParams();
  const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const API_HOST = useMemo(() => BASE_URL.replace(/\/api\/?$/, ""), [BASE_URL]);

  const [authToken, setAuthToken] = useState(() => localStorage.getItem("access_token"));
  useEffect(() => {
    const i = setInterval(() => {
      const t = localStorage.getItem("access_token");
      if (t !== authToken) setAuthToken(t);
    }, 3000);
    return () => clearInterval(i);
  }, [authToken]);

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: BASE_URL,
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });
    instance.interceptors.request.use((config) => {
      const t = localStorage.getItem("access_token");
      if (t) config.headers.Authorization = `Bearer ${t}`;
      return config;
    });
    return instance;
  }, [BASE_URL]);

  const [receiver, setReceiver] = useState(null);
  const [sender, setSender] = useState(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudio, setPlayingAudio] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);

  // Voice recording refs
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const audioChunksRef = useRef([]);

  const sendingStateRef = useRef(false);
  const [isSending, setIsSending] = useState(false);
  const shouldAutoScrollRef = useRef(true);
  const prevLenRef = useRef(0);

  const roomId = useMemo(() => getRoomId(senderId, receiverId), [senderId, receiverId]);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    const isNew = messages.length > prevLenRef.current;
    prevLenRef.current = messages.length;
    if (isNew && shouldAutoScrollRef.current) scrollToBottom(true);
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, []);

  // Receiver online status
  const [receiverStatus, setReceiverStatus] = useState({
    userId: "",
    username: "",
    isOnline: false,
    lastSeen: null,
  });

  // Ticker to refresh "time ago" rendering
  useEffect(() => {
    const tick = setInterval(() => {
      setReceiverStatus((s) => ({ ...s }));
    }, 60000);
    return () => clearInterval(tick);
  }, []);

  // Fetch status initially and poll every 30s
  useEffect(() => {
    let live = true;

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/status/${receiverId}`);
        if (!live) return;
        const data = res?.data || {};
        setReceiverStatus({
          userId: String(data.userId ?? receiverId),
          username: data.username ?? receiver?.username ?? "",
          isOnline: !!data.isOnline,
          lastSeen: data.lastSeen ?? null,
        });
      } catch (e) {
        // On error, do not crash UI
      }
    };

    if (receiverId) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => {
        live = false;
        clearInterval(interval);
      };
    }
  }, [api, receiverId, receiver?.username]);

  // Initial load
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await api.get(`/${senderId}/${receiverId}`);
        if (!live) return;
        setReceiver(res.data.receiver);
        setMessages((res.data.messages || []).map((m) => ({ ...m, _status: "sent" })));
        requestAnimationFrame(() => {
          scrollToBottom(false);
          shouldAutoScrollRef.current = true;
        });
      } catch (e) {
        console.error("fetch messages error:", e);
      }
    })();
    return () => {
      live = false;
    };
  }, [api, senderId, receiverId, scrollToBottom]);

  // Sender profile
  useEffect(() => {
    try {
      const cached = localStorage.getItem("me");
      if (cached) {
        const me = JSON.parse(cached);
        if (me && me._id === senderId) setSender(me);
      }
    } catch {}
    if (!sender) {
      (async () => {
        try {
          const r = await api.get(`/users/${senderId}`);
          setSender(r.data);
        } catch {
          setSender({ _id: senderId, username: "You" });
        }
      })();
    }
  }, [api, senderId, sender]);

  // Socket connection
  useEffect(() => {
    const s = io(API_HOST, {
      transports: ["websocket"],
      withCredentials: true,
      auth: authToken ? { token: authToken } : undefined,
    });
    socketRef.current = s;

    const onConnect = () => {
      s.emit("joinRoom", { roomId, userId: senderId });
    };

    const onMessage = (msg) => {
      const pairOk =
        (String(msg.sender) === String(senderId) && String(msg.receiver) === String(receiverId)) ||
        (String(msg.sender) === String(receiverId) && String(msg.receiver) === String(senderId));
      if (!pairOk) return;

      setMessages((prev) => {
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m.tempId === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            const prevObjURL = next[idx]?.image;
            const prevAudioURL = next[idx]?.voice;
            next[idx] = { ...next[idx], ...msg, _status: "sent" };

            // Revoke old blob URLs
            if (prevObjURL && prevObjURL.startsWith("blob:") && next[idx].image && !String(next[idx].image).startsWith("blob:")) {
              try { URL.revokeObjectURL(prevObjURL); } catch {}
            }
            if (prevAudioURL && prevAudioURL.startsWith("blob:") && next[idx].voice && !String(next[idx].voice).startsWith("blob:")) {
              try { URL.revokeObjectURL(prevAudioURL); } catch {}
            }
            return next;
          }
        }

        if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
        if (msg.tempId && prev.some((m) => m.tempId === msg.tempId)) return prev;

        return [...prev, { ...msg, _status: "sent" }];
      });
    };

    const onUserStatusChanged = (payload) => {
      if (!payload) return;
      if (String(payload.userId) !== String(receiverId)) return;
      setReceiverStatus((prev) => ({
        userId: String(payload.userId ?? prev.userId),
        username: payload.username ?? prev.username,
        isOnline: !!payload.isOnline,
        lastSeen: payload.lastSeen ?? prev.lastSeen,
      }));
    };

    const onDeleted = (payload) => {
      setMessages((prev) =>
        prev.filter(
          (m) =>
            !(payload?._id && m._id === payload._id) &&
            !(payload?.tempId && m.tempId === payload.tempId)
        )
      );
    };

    s.on("connect", onConnect);
    s.on("message", onMessage);
    s.on("receiveMessage", onMessage);
    s.on("messageDeleted", onDeleted);
    s.on("userStatusChanged", onUserStatusChanged);

    return () => {
      s.off("connect", onConnect);
      s.off("message", onMessage);
      s.off("receiveMessage", onMessage);
      s.off("messageDeleted", onDeleted);
      s.off("userStatusChanged", onUserStatusChanged);
      s.emit("leaveRoom", { roomId, userId: senderId });
      s.disconnect();
    };
  }, [API_HOST, authToken, roomId, senderId, receiverId]);

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordedAudio(audioBlob);
        setAudioPreview(audioUrl);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    clearRecordedAudio();
    setRecordingTime(0);
  };

  const clearRecordedAudio = () => {
    if (audioPreview && audioPreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(audioPreview);
      } catch {}
    }
    setRecordedAudio(null);
    setAudioPreview(null);
  };

  // Audio playback functions
  const playAudio = (audioSrc, messageId) => {
    if (playingAudio === messageId) {
      // Pause current audio
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach(audio => {
        if (!audio.paused) {
          audio.pause();
        }
      });
      setPlayingAudio(null);
      return;
    }

    // Stop any currently playing audio
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    // Create and play new audio
    const audio = new Audio(audioSrc);
    audio.play()
      .then(() => {
        setPlayingAudio(messageId);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
      });

    audio.onended = () => {
      setPlayingAudio(null);
    };

    audio.onerror = () => {
      setPlayingAudio(null);
      console.error('Error loading audio');
    };
  };

  // Image selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return alert("Please select an image file");
    if (file.size > 5 * 1024 * 1024) return alert("Image size should be less than 5MB");

    const objectUrl = URL.createObjectURL(file);
    if (imagePreview && imagePreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch {}
    }
    setSelectedImage(file);
    setImagePreview(objectUrl);
  };

  const clearSelectedImage = () => {
    if (imagePreview && imagePreview.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch {}
    }
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Normalize file src
  const resolveFileSrc = (filePath) => {
    if (!filePath) return "";
    if (/^https?:\/\//i.test(filePath)) return filePath;
    if (filePath.startsWith("blob:")) return filePath;
    const path = filePath.startsWith("/") ? filePath : `/${filePath}`;
    return `${API_HOST}${path}`;
  };

  // Send message
  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text && !selectedImage && !recordedAudio) return;
    if (sendingStateRef.current) return;

    sendingStateRef.current = true;
    setIsSending(true);

    const tempId = genTempId();
    const optimistic = {
      _id: tempId,
      tempId,
      sender: senderId,
      receiver: receiverId,
      text: text || "",
      image: selectedImage ? imagePreview || undefined : undefined,
      voice: recordedAudio ? audioPreview || undefined : undefined,
      _status: "sending",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");

    // For text only, emit immediately via socket
    try {
      if (socketRef.current?.connected && !selectedImage && !recordedAudio) {
        socketRef.current.emit("sendMessage", { roomId, ...optimistic });
      }
    } catch (e) {
      console.warn("socket emit failed:", e);
    }

    // Persist via REST
    try {
      if (selectedImage || recordedAudio) {
        const form = new FormData();
        form.append("sender", senderId);
        form.append("receiver", receiverId);
        form.append("tempId", tempId);
        if (text) form.append("text", text);
        if (selectedImage) form.append("image", selectedImage);
        if (recordedAudio) form.append("voice", recordedAudio);
        
        await api.post("/send-message", form, { 
          headers: { "Content-Type": "multipart/form-data" } 
        });
        
        clearSelectedImage();
        clearRecordedAudio();
      } else {
        await api.post("/send-message", { sender: senderId, receiver: receiverId, text, tempId });
      }
    } catch (err) {
      console.error("send error:", err);
      setMessages((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, _status: "failed" } : m)));
    } finally {
      sendingStateRef.current = false;
      setIsSending(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageIdOrTempId) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg._id === messageIdOrTempId || msg.tempId === messageIdOrTempId
          ? { ...msg, _deleting: true }
          : msg
      )
    );

    setTimeout(() => {
      setMessages((prev) =>
        prev.filter((msg) => !(msg._id === messageIdOrTempId || msg.tempId === messageIdOrTempId))
      );
    }, 300);

    try {
      const target = messages.find((m) => m._id === messageIdOrTempId || m.tempId === messageIdOrTempId);
      if (!target) return;

      if (!target._id) {
        socketRef.current?.emit("unsendTemp", { roomId, tempId: target.tempId });
        return;
      }

      await api.delete(`/messages/${messageIdOrTempId}`);
    } catch (e) {
      console.error("delete error:", e);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageIdOrTempId || msg.tempId === messageIdOrTempId
            ? { ...msg, _deleting: false }
            : msg
        )
      );
    }
  };

  const scrollToBottomManual = () => {
    shouldAutoScrollRef.current = true;
    scrollToBottom(true);
    setShowScrollButton(false);
  };

  const Avatar = ({ user, side = "left", size = 36 }) => {
    const dimension = `${size}px`;
    const initials = user?.username ? user.username.charAt(0).toUpperCase() : "?";
    const src = user?.profilePicture ? resolveFileSrc(user.profilePicture) : null;
    return (
      <div
        className={`rounded-full overflow-hidden border border-gray-700 flex items-center justify-center bg-gray-700 text-white font-bold ${
          side === "left" ? "mr-2" : "ml-2"
        }`}
        style={{ width: dimension, height: dimension, minWidth: dimension }}
      >
        {src ? (
          <img
            src={src}
            alt={user?.username || "User"}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/default-avatar.jpg";
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white relative" style={{ zIndex: 50 }}>
      {receiver && (
        <div className="flex items-center gap-3 p-4 border-b border-gray-800 bg-[#121212]" style={{ zIndex: 40 }}>
          <div className="w-10 h-10 rounded-full overflow-hidden border border-gray-700">
            {receiver.profilePicture ? (
              <img
                src={resolveFileSrc(receiver.profilePicture)}
                alt={receiver.username}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.jpg";
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-white font-bold">
                {receiver.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold">{receiver.username}</h2>
            {receiverStatus.isOnline ? (
              <small className="text-green-500 inline-block">Online</small>
            ) : receiverStatus.lastSeen ? (
              <small className="text-gray-400 inline-block">
                Last seen {formatTimeAgo(receiverStatus.lastSeen)} • {formatISTDateTime(receiverStatus.lastSeen)}
              </small>
            ) : (
              <small className="text-gray-400 inline-block">Status unknown</small>
            )}
          </div>
        </div>
      )}

      {showScrollButton && (
        <button
          onClick={scrollToBottomManual}
          className="fixed right-6 bottom-20 bg-blue-600 p-3 rounded-full hover:bg-blue-700 transition z-50"
          aria-label="Scroll to latest"
        >
          <FiArrowUp className="text-white text-lg" />
        </button>
      )}

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 pb-32"
        style={{ zIndex: 30 }}
        onScroll={handleScroll}
      >
        {messages.map((msg) => {
          const isMine = String(msg.sender) === String(senderId);
          const bubbleColor = isMine
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-800 text-gray-200 rounded-bl-none";

          const imgSrc = msg.image ? resolveFileSrc(msg.image) : "";
          const voiceSrc = msg.voice ? resolveFileSrc(msg.voice) : "";
          const messageId = msg._id || msg.tempId;

          return (
            <div
              key={messageId}
              className={`flex items-end ${isMine ? "justify-end" : "justify-start"} group relative transition-all duration-300 ease-in-out ${
                msg._status === "sending" ? "opacity-70 scale-95" : "opacity-100 scale-100"
              } ${msg._deleting ? "opacity-0 scale-90" : ""}`}
            >
              {!isMine && <Avatar user={receiver} side="left" />}
              <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${bubbleColor} relative`}>
                {!!msg.image && (
                  <div className="mb-2">
                    <img
                      src={imgSrc}
                      alt="Shared content"
                      className="max-w-full rounded-lg"
                      onError={(e) => {
                        e.currentTarget.style.opacity = "0.6";
                      }}
                    />
                  </div>
                )}
                
                {!!msg.voice && (
                  <div className="mb-2 flex items-center gap-2 bg-black/20 rounded-lg p-2">
                    <button
                      onClick={() => playAudio(voiceSrc, messageId)}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
                      aria-label={playingAudio === messageId ? "Pause" : "Play"}
                    >
                      {playingAudio === messageId ? (
                        <FiPause className="text-white text-sm" />
                      ) : (
                        <FiPlay className="text-white text-sm" />
                      )}
                    </button>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-white/20 rounded-full">
                        <div className="h-full bg-white/60 rounded-full" style={{ width: '30%' }} />
                      </div>
                      <span className="text-xs text-white/80">
                        🎵 Voice
                      </span>
                    </div>
                  </div>
                )}
                
                {msg.text && <div>{msg.text}</div>}
                
                {isMine && (
                  <button
                    onClick={() => handleDeleteMessage(msg._id || msg.tempId)}
                    className="absolute -top-2 -right-2 bg-red-600 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    title="Delete message"
                    aria-label="Delete message"
                  >
                    <FiTrash2 className="text-white text-xs" />
                  </button>
                )}
              </div>
              {isMine && <Avatar user={sender} side="right" />}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording UI */}
      {isRecording && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-red-600 text-white flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
            <span>Recording... {formatDuration(recordingTime)}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelRecording}
              className="px-3 py-1 bg-white/20 rounded-md hover:bg-white/30 transition"
            >
              Cancel
            </button>
            <button
              onClick={stopRecording}
              className="px-3 py-1 bg-white/20 rounded-md hover:bg-white/30 transition"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Audio Preview */}
      {audioPreview && !isRecording && (
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-[#1a1a1a] border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => playAudio(audioPreview, 'preview')}
              className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition"
            >
              {playingAudio === 'preview' ? (
                <FiPause className="text-white" />
              ) : (
                <FiPlay className="text-white" />
              )}
            </button>
            <span className="text-sm text-gray-300">Voice message ready to send</span>
          </div>
          <button 
            onClick={clearRecordedAudio} 
            className="p-1 rounded-full bg-gray-700 hover:bg-gray-600" 
            aria-label="Remove recording"
          >
            <FiX className="text-white" />
          </button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="fixed bottom-16 left-0 right-0 p-3 bg-[#1a1a1a] border-t border-gray-800 flex items-center justify-between">
          <div className="flex items-center">
            <img src={imagePreview} alt="Preview" className="w-12 h-12 object-cover rounded-md mr-3" />
            <span className="text-sm text-gray-300">Image ready to send</span>
          </div>
          <button onClick={clearSelectedImage} className="p-1 rounded-full bg-gray-700 hover:bg-gray-600" aria-label="Remove image">
            <FiX className="text-white" />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-gray-800 bg-[#121212] flex items-center gap-2 fixed bottom-0 left-0 right-0" style={{ zIndex: 60 }}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition"
          title="Attach image"
          aria-label="Attach image"
          disabled={isRecording}
        >
          <FiImage className="text-gray-400 text-lg" />
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2 rounded-full transition ${
            isRecording 
              ? "bg-red-600 hover:bg-red-700" 
              : "bg-gray-800 hover:bg-gray-700"
          }`}
          title={isRecording ? "Stop recording" : "Record voice message"}
          aria-label={isRecording ? "Stop recording" : "Record voice message"}
          disabled={isSending}
        >
          {isRecording ? (
            <FiSquare className="text-white text-lg" />
          ) : (
            <FiMic className="text-gray-400 text-lg" />
          )}
        </button>

        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 bg-transparent border border-gray-700 rounded-full px-4 py-2 text-gray-200 outline-none"
          disabled={isRecording}
        />

        <button
          onClick={handleSend}
          className="bg-blue-600 p-3 rounded-full hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-50"
          disabled={isSending || (!newMessage.trim() && !selectedImage && !recordedAudio) || isRecording}
          aria-label="Send"
          title="Send"
        >
          {isSending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiSend className="text-white text-lg" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatMessages;
