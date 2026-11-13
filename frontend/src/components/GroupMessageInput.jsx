
import { useEffect, useRef, useState } from "react";
import {
  Image,
  Send,
  X,
  Smile,
  Reply,
  Mic,
  Square,
  Trash2,
} from "lucide-react";
import EmojiPicker from "emoji-picker-react";
import toast from "react-hot-toast";

import { useChatStore } from "../store/useChatStore";
import useKeyboardSound from "../hooks/useKeyboardSound";

function GroupMessageInput() {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingStartTimeRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const cancelRecordingRef = useRef(false);

  const {
    selectedGroup,
    sendGroupMessage,
    sendGroupVoiceMessage,
    replyingTo,
    setReplyingTo,
  } = useChatStore();

  const { playSendSound } = useKeyboardSound();

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
    recordingStartTimeRef.current = null;
    audioChunksRef.current = [];

    setIsRecording(false);
    setRecordingDuration(0);
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (isRecording || isSending) return;

    if (text.trim() || imagePreview) {
      toast.error("Send or clear your message before recording");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        toast.error("Voice recording is not supported in this browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];

      const selectedMimeType = supportedMimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
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
        cancelRecordingRef.current = true;
        toast.error("Recording failed");
        recorder.stop();
      };

      recorder.onstop = async () => {
        const duration = Math.min(
          300,
          Math.round(
            (Date.now() - recordingStartTimeRef.current) / 1000
          )
        );

        const mimeType = recorder.mimeType || "audio/webm";

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        });

        const shouldCancel = cancelRecordingRef.current;

        cleanupRecording();

        if (shouldCancel) return;

        if (duration < 1 || audioBlob.size === 0) {
          toast.error("Voice message is too short");
          return;
        }

        if (audioBlob.size > 10 * 1024 * 1024) {
          toast.error("Voice message must be less than 10MB");
          return;
        }

        setIsSending(true);

        try {
          const result = await sendGroupVoiceMessage(
            audioBlob,
            duration
          );

          if (result === false) return;

          playSendSound?.();
          setReplyingTo(null);
        } catch (error) {
          console.error("Failed to send group voice message:", error);
          toast.error("Failed to send voice message");
        } finally {
          setIsSending(false);
        }
      };

      recorder.start(250);

      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordingStartTimeRef.current) / 1000
        );

        setRecordingDuration(Math.min(elapsed, 300));

        if (elapsed >= 300) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Microphone error:", error);

      cleanupRecording();

      if (error.name === "NotAllowedError") {
        toast.error("Please allow microphone access");
      } else if (error.name === "NotFoundError") {
        toast.error("No microphone found");
      } else {
        toast.error("Unable to start voice recording");
      }
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else {
      cleanupRecording();
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

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
                {replyingTo.audio
                  ? "🎤 Voice message"
                  : replyingTo.image
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

      {showEmojiPicker && !isRecording && (
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
        {isRecording ? (
          <>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-3 rounded-xl text-red-400 hover:bg-red-500/10 shrink-0"
              title="Cancel recording"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-xl bg-slate-700/50 border border-red-500/40 px-4 py-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />

              <span className="text-sm text-red-400 font-medium">
                Recording
              </span>

              <span className="ml-auto text-sm text-slate-200 tabular-nums">
                {formatRecordingTime(recordingDuration)}
              </span>
            </div>

            <button
              type="button"
              onClick={stopRecording}
              className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 shrink-0"
              title="Stop and send voice message"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>
          </>
        ) : (
          <>
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
              disabled={isSending}
              className="p-2 text-slate-400 hover:text-cyan-400 shrink-0 disabled:opacity-50"
              title="Attach image"
            >
              <Image className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              disabled={isSending}
              className="p-2 text-slate-400 hover:text-cyan-400 shrink-0 disabled:opacity-50"
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

            {text.trim() || imagePreview ? (
              <button
                type="submit"
                disabled={isSending}
                className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Send message"
              >
                {isSending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isSending}
                className="p-3 rounded-xl bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50 shrink-0"
                title="Record voice message"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </form>
    </div>
  );
}

export default GroupMessageInput;
