
import { useEffect, useRef, useState } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import EmojiPicker from "emoji-picker-react";
import {
  ImageIcon,
  SendIcon,
  XIcon,
  CornerUpLeftIcon,
  SmileIcon,
  MicIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();

  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeReceiverIdRef = useRef(null);
  const cursorPositionRef = useRef(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const cancelRecordingRef = useRef(false);

  const {
    sendMessage,
    sendVoiceMessage,
    isSoundEnabled,
    selectedUser,
    replyingTo,
    setReplyingTo,
  } = useChatStore();

  const authUser = useAuthStore((state) => state.authUser);
  const socket = useAuthStore((state) => state.socket);

  const stopTyping = (receiverId = activeReceiverIdRef.current) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (receiverId && socket?.connected) {
      socket.emit("stopTyping", { receiverId });
    }

    activeReceiverIdRef.current = null;
  };

  const cleanupRecording = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      mediaStreamRef.current = null;
    }

    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    recordingStartTimeRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      const receiverId = activeReceiverIdRef.current;

      if (receiverId && socket?.connected) {
        socket.emit("stopTyping", { receiverId });
      }

      activeReceiverIdRef.current = null;
    };
  }, [selectedUser?._id, socket]);

  // Clean up microphone when the component unmounts.
  useEffect(() => {
    return () => {
      cancelRecordingRef.current = true;

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;
        recorder.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!text.trim() && !imagePreview) return;

    stopTyping();

    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendMessage({
      text: text.trim(),
      image: imagePreview,
    });

    setText("");
    setImagePreview(null);
    setShowEmojiPicker(false);
    cursorPositionRef.current = 0;

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    cursorPositionRef.current = e.target.selectionStart;

    if (isSoundEnabled) playRandomKeyStrokeSound();

    if (!selectedUser || !socket?.connected) return;

    const receiverId = selectedUser._id;

    if (!value.trim()) {
      stopTyping(receiverId);
      return;
    }

    if (activeReceiverIdRef.current !== receiverId) {
      if (activeReceiverIdRef.current) {
        stopTyping();
      }

      activeReceiverIdRef.current = receiverId;

      socket.emit("typing", { receiverId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(receiverId);
    }, 1000);
  };

  const handleEmojiClick = (emojiData) => {
    const input = textInputRef.current;

    if (!input) return;

    const start = input.selectionStart ?? cursorPositionRef.current;
    const end = input.selectionEnd ?? start;

    const newText =
      text.substring(0, start) +
      emojiData.emoji +
      text.substring(end);

    setText(newText);
    setShowEmojiPicker(false);

    const newCursorPosition = start + emojiData.emoji.length;
    cursorPositionRef.current = newCursorPosition;

    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newCursorPosition, newCursorPosition);
    });

    if (selectedUser && socket?.connected) {
      const receiverId = selectedUser._id;

      if (activeReceiverIdRef.current !== receiverId) {
        activeReceiverIdRef.current = receiverId;
        socket.emit("typing", { receiverId });
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(receiverId);
      }, 1000);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const startRecording = async () => {
    if (!selectedUser) {
      toast.error("Please select a chat first");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error("Voice recording is not supported by this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];

      const mimeType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        toast.error("Recording failed. Please try again.");
        cancelRecordingRef.current = true;

        if (recorder.state !== "inactive") {
          recorder.stop();
        }
      };

      recorder.onstop = async () => {
        const duration = Math.min(
          300,
          Math.max(
            0,
            Math.round(
              (Date.now() - recordingStartTimeRef.current) / 1000
            )
          )
        );

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        const shouldSend = !cancelRecordingRef.current;

        cleanupRecording();
        setIsRecording(false);
        setRecordingDuration(0);

        if (!shouldSend) return;

        if (!audioBlob.size) {
          toast.error("No audio recorded");
          return;
        }

        if (audioBlob.size > 10 * 1024 * 1024) {
          toast.error("Voice message exceeds the 10 MB limit");
          return;
        }

        if (duration < 1) {
          toast.error("Voice message is too short");
          return;
        }

        stopTyping();

        await sendVoiceMessage(audioBlob, duration);
      };

      recorder.start(250);

      setIsRecording(true);
      setRecordingDuration(0);
      setShowEmojiPicker(false);
      stopTyping();

      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordingStartTimeRef.current) / 1000
        );

        setRecordingDuration(elapsed);

        if (elapsed >= 300) {
          toast("Maximum recording duration reached");
          recorder.stop();
        }
      }, 250);
    } catch (error) {
      cleanupRecording();
      setIsRecording(false);

      if (error.name === "NotAllowedError") {
        toast.error("Please allow microphone access to record voice");
      } else if (error.name === "NotFoundError") {
        toast.error("No microphone found on your device");
      } else {
        toast.error("Unable to start voice recording");
      }
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      cleanupRecording();
      setIsRecording(false);
      setRecordingDuration(0);
    }
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const isReplyFromMe =
    replyingTo?.senderId?.toString() === authUser?._id?.toString();

  const replySenderName = isReplyFromMe
    ? "You"
    : selectedUser?.fullName || selectedUser?.username || "Contact";

  const replyText =
    replyingTo?.text ||
    (replyingTo?.image
      ? "Photo"
      : replyingTo?.audio
        ? "Voice message"
        : "Message");

  return (
    <div className="p-4 border-t border-slate-700/50">
      {replyingTo && (
        <div className="max-w-3xl mx-auto mb-3">
          <div className="flex items-center gap-3 bg-slate-800/70 border-l-4 border-cyan-500 rounded-lg p-3">
            <CornerUpLeftIcon className="w-5 h-5 text-cyan-400 shrink-0" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-cyan-400">
                Replying to {replySenderName}
              </p>

              <p className="text-sm text-slate-300 truncate">
                {replyText}
              </p>

              {replyingTo.image && (
                <img
                  src={replyingTo.image}
                  alt="Original message"
                  className="w-10 h-10 object-cover rounded mt-1"
                />
              )}
            </div>

            <button
              type="button"
              onClick={cancelReply}
              className="text-slate-400 hover:text-white p-1"
              aria-label="Cancel reply"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />

            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex gap-2 sm:gap-4"
      >
        <div className="relative flex-1 min-w-0">
          {showEmojiPicker && (
            <div
              ref={emojiPickerRef}
              className="absolute bottom-full left-0 mb-3 z-50 shadow-2xl"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="dark"
                width={300}
                height={350}
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}

          {isRecording ? (
            <div className="w-full flex items-center gap-3 bg-slate-800/70 border border-red-500/40 rounded-lg py-2 px-4">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>

              <span className="text-red-400 text-sm font-medium">
                Recording
              </span>

              <span className="text-white font-mono text-sm tabular-nums">
                {formatRecordingTime(recordingDuration)}
              </span>

              <span className="text-slate-500 text-xs ml-auto">
                Max 05:00
              </span>
            </div>
          ) : (
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={handleTextChange}
              onClick={(e) => {
                cursorPositionRef.current = e.target.selectionStart;
              }}
              onKeyUp={(e) => {
                cursorPositionRef.current = e.target.selectionStart;
              }}
              onSelect={(e) => {
                cursorPositionRef.current = e.target.selectionStart;
              }}
              placeholder="Type a message..."
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4 text-white placeholder:text-slate-400"
            />
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
          disabled={isRecording}
        />

        {!isRecording && (
          <>
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`bg-slate-800/50 rounded-lg px-3 transition-colors ${
                showEmojiPicker
                  ? "text-cyan-400"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              aria-label="Open emoji picker"
            >
              <SmileIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-3 transition-colors ${
                imagePreview ? "text-cyan-500" : ""
              }`}
              aria-label="Attach image"
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={startRecording}
              disabled={!!text.trim() || !!imagePreview}
              className="bg-slate-800/50 text-slate-400 hover:text-red-400 rounded-lg px-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Record voice message"
              title="Record voice message"
            >
              <MicIcon className="w-5 h-5" />
            </button>

            <button
              type="submit"
              disabled={!text.trim() && !imagePreview}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <SendIcon className="w-5 h-5" />
            </button>
          </>
        )}

        {isRecording && (
          <>
            <button
              type="button"
              onClick={cancelRecording}
              className="bg-slate-800 text-red-400 hover:bg-red-500/10 rounded-lg px-3 transition-colors"
              aria-label="Cancel recording"
              title="Cancel recording"
            >
              <Trash2Icon className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={stopRecording}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 hover:from-cyan-600 hover:to-cyan-700 transition-all"
              aria-label="Stop and send voice message"
              title="Stop and send"
            >
              <SquareIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default MessageInput;
