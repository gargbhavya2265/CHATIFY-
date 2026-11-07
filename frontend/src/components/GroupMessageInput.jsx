import { useRef, useState } from "react";
import { Image, Send, X, Smile, Reply } from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import toast from "react-hot-toast";

import { useChatStore } from "../store/useChatStore";
import useKeyboardSound from "../hooks/useKeyboardSound";

function GroupMessageInput() {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  const {
    selectedGroup,
    sendGroupMessage,
    replyingTo,
    setReplyingTo,
  } = useChatStore();

  const { playSendSound } = useKeyboardSound();

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      setImagePreview(reader.result);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleEmojiClick = (emojiData) => {
    const emoji = emojiData.emoji;
    const textarea = textAreaRef.current;

    if (!textarea) {
      setText((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const updatedText =
      text.substring(0, start) + emoji + text.substring(end);

    setText(updatedText);

    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPosition = start + emoji.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
    });
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();

    if ((!text.trim() && !imagePreview) || isSending) return;

    if (text.trim().length > 2000) {
      toast.error("Message cannot exceed 2000 characters");
      return;
    }

    const messageData = {
      text: text.trim(),
      image: imagePreview,
      replyTo: replyingTo?._id || null,
    };

    setIsSending(true);

    try {
      const result = await sendGroupMessage(messageData);

      if (result === false) return;

      playSendSound?.();

      setText("");
      setImagePreview(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
    } catch (error) {
      console.error("Failed to send group message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative shrink-0 w-full border-t border-slate-700/50 bg-slate-800/50 p-4">
      {replyingTo && (
        <div className="flex items-start justify-between bg-slate-700/50 rounded-lg p-3 mb-3 min-w-0 gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <Reply className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />

            <div className="flex-1 min-w-0">
              <p className="text-xs text-cyan-400">
                Replying to
              </p>

              <p className="text-sm text-slate-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {replyingTo.senderId?.fullName || "Group member"}:{" "}
                {replyingTo.image
                  ? replyingTo.text || "Image"
                  : replyingTo.text || "Message"}
              </p>
            </div>

            {replyingTo.image && (
              <img
                src={replyingTo.image}
                alt="Reply preview"
                className="w-10 h-10 rounded-md object-cover shrink-0"
              />
            )}
          </div>

          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="text-slate-400 hover:text-white shrink-0"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 relative w-fit">
          <img
            src={imagePreview}
            alt="Preview"
            className="h-24 w-24 object-cover rounded-lg"
          />

          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="absolute -top-2 -right-2 bg-slate-700 rounded-full p-1"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme="dark"
            height={350}
            width={300}
          />
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="flex items-end gap-2 w-full min-w-0"
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-slate-400 hover:text-cyan-400 shrink-0"
          title="Attach image"
        >
          <Image className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-2 text-slate-400 hover:text-cyan-400 shrink-0"
          title="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        <textarea
          ref={textAreaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSendMessage(event);
            }
          }}
          placeholder={`Message ${selectedGroup?.name || "group"}...`}
          rows={1}
          maxLength={2000}
          className="flex-1 min-w-0 min-h-[48px] max-h-32 resize-y rounded-xl bg-slate-700/50 border border-slate-600/50 px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-cyan-500"
        />

        <button
          type="submit"
          disabled={isSending || (!text.trim() && !imagePreview)}
          className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Send message"
        >
          {isSending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}

export default GroupMessageInput;