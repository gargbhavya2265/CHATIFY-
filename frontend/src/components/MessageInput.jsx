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
} from "lucide-react";

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const activeReceiverIdRef = useRef(null);
  const cursorPositionRef = useRef(0);

  const {
    sendMessage,
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

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const isReplyFromMe =
    replyingTo?.senderId?.toString() === authUser?._id?.toString();

  const replySenderName = isReplyFromMe
    ? "You"
    : selectedUser?.fullName || selectedUser?.username || "Contact";

  const replyText = replyingTo?.text || (
    replyingTo?.image ? "Photo" : "Message"
  );

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
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

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
          type="submit"
          disabled={!text.trim() && !imagePreview}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
