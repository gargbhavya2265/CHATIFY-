
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const MAX_RECORDING_DURATION = 5 * 60;
const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

const getSupportedMimeType = () => {
    if (!window.MediaRecorder) return null;

    const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
    ];

    return (
        supportedTypes.find((type) =>
            MediaRecorder.isTypeSupported(type)
        ) || ""
    );
};

const useVoiceRecorder = () => {
    const [recordingState, setRecordingState] = useState("idle");
    const [duration, setDuration] = useState(0);
    const [audioBlob, setAudioBlob] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startedAtRef = useRef(0);
    const elapsedBeforePauseRef = useRef(0);
    const durationRef = useRef(0);
    const audioUrlRef = useRef(null);
    const stopReasonRef = useRef("preview");
    const mountedRef = useRef(true);

    const releaseMediaStream = useCallback(() => {
        mediaStreamRef.current?.getTracks().forEach((track) => {
            track.stop();
        });

        mediaStreamRef.current = null;
    }, []);

    const clearRecordingTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const revokeAudioUrl = useCallback(() => {
        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
        }

        if (mountedRef.current) {
            setAudioUrl(null);
        }
    }, []);

    const resetRecording = useCallback(() => {
        clearRecordingTimer();
        releaseMediaStream();
        revokeAudioUrl();

        chunksRef.current = [];
        startedAtRef.current = 0;
        elapsedBeforePauseRef.current = 0;
        durationRef.current = 0;
        stopReasonRef.current = "preview";

        if (mountedRef.current) {
            setRecordingState("idle");
            setDuration(0);
            setAudioBlob(null);
        }
    }, [
        clearRecordingTimer,
        releaseMediaStream,
        revokeAudioUrl,
    ]);

    const updateDuration = useCallback(() => {
        const elapsed =
            elapsedBeforePauseRef.current +
            (Date.now() - startedAtRef.current) / 1000;

        const nextDuration = Math.min(
            MAX_RECORDING_DURATION,
            Math.floor(elapsed)
        );

        durationRef.current = nextDuration;

        if (mountedRef.current) {
            setDuration(nextDuration);
        }

        if (elapsed >= MAX_RECORDING_DURATION) {
            stopReasonRef.current = "limit";
            mediaRecorderRef.current?.stop();
            clearRecordingTimer();
        }
    }, [clearRecordingTimer]);

    const startRecording = useCallback(async () => {
        if (recordingState !== "idle") return false;

        if (
            !navigator.mediaDevices?.getUserMedia ||
            !window.MediaRecorder
        ) {
            toast.error(
                "Voice recording is not supported in this browser."
            );
            return false;
        }

        try {
            const stream =
                await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });

            if (!mountedRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return false;
            }

            const mimeType = getSupportedMimeType();

            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            mediaStreamRef.current = stream;
            mediaRecorderRef.current = recorder;
            chunksRef.current = [];
            stopReasonRef.current = "preview";
            elapsedBeforePauseRef.current = 0;
            durationRef.current = 0;

            setAudioBlob(null);
            setDuration(0);
            setRecordingState("recording");

            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onerror = () => {
                toast.error("Recording failed. Please try again.");
                stopReasonRef.current = "error";

                clearRecordingTimer();
                releaseMediaStream();

                if (mountedRef.current) {
                    setRecordingState("idle");
                    setDuration(0);
                }
            };

            recorder.onstop = () => {
                clearRecordingTimer();
                releaseMediaStream();

                const finalDuration = Math.min(
                    MAX_RECORDING_DURATION,
                    Math.max(
                        0,
                        Math.round(durationRef.current)
                    )
                );

                const blob = new Blob(chunksRef.current, {
                    type:
                        recorder.mimeType ||
                        chunksRef.current[0]?.type ||
                        "audio/webm",
                });

                chunksRef.current = [];

                if (
                    stopReasonRef.current === "error" ||
                    stopReasonRef.current === "cancel"
                ) {
                    if (mountedRef.current) {
                        setRecordingState("idle");
                        setDuration(0);
                        setAudioBlob(null);
                    }

                    return;
                }

                if (blob.size > MAX_AUDIO_SIZE) {
                    toast.error("Voice message must be 10 MB or smaller.");

                    if (mountedRef.current) {
                        setRecordingState("idle");
                        setDuration(0);
                        setAudioBlob(null);
                    }

                    return;
                }

                if (blob.size === 0 || finalDuration < 1) {
                    toast.error("Recording is too short.");

                    if (mountedRef.current) {
                        setRecordingState("idle");
                        setDuration(0);
                        setAudioBlob(null);
                    }

                    return;
                }

                const url = URL.createObjectURL(blob);
                audioUrlRef.current = url;

                if (mountedRef.current) {
                    setAudioBlob(blob);
                    setAudioUrl(url);
                    setDuration(finalDuration);
                    setRecordingState("preview");
                }

                if (stopReasonRef.current === "limit") {
                    toast("Maximum recording duration reached.");
                }
            };

            recorder.start(250);

            startedAtRef.current = Date.now();

            timerRef.current = setInterval(
                updateDuration,
                250
            );

            return true;
        } catch (error) {
            console.error("Voice recording error:", error);

            releaseMediaStream();

            if (mountedRef.current) {
                setRecordingState("idle");

                toast.error(
                    error.name === "NotAllowedError"
                        ? "Please allow microphone access."
                        : error.name === "NotFoundError"
                            ? "No microphone was found."
                            : "Unable to start voice recording."
                );
            }

            return false;
        }
    }, [
        recordingState,
        updateDuration,
        clearRecordingTimer,
        releaseMediaStream,
    ]);

    const pauseRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || recorder.state !== "recording") {
            return;
        }

        elapsedBeforePauseRef.current +=
            (Date.now() - startedAtRef.current) / 1000;

        clearRecordingTimer();
        recorder.pause();

        setRecordingState("paused");
    }, [clearRecordingTimer]);

    const resumeRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;

        if (!recorder || recorder.state !== "paused") {
            return;
        }

        startedAtRef.current = Date.now();

        recorder.resume();

        setRecordingState("recording");

        timerRef.current = setInterval(
            updateDuration,
            250
        );
    }, [updateDuration]);

    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;

        if (
            !recorder ||
            !["recording", "paused"].includes(recorder.state)
        ) {
            return;
        }

        if (recorder.state === "recording") {
            elapsedBeforePauseRef.current +=
                (Date.now() - startedAtRef.current) / 1000;
        }

        durationRef.current = Math.min(
            MAX_RECORDING_DURATION,
            Math.floor(elapsedBeforePauseRef.current)
        );

        clearRecordingTimer();
        recorder.stop();

        setRecordingState("processing");
    }, [clearRecordingTimer]);

    const cancelRecording = useCallback(() => {
        stopReasonRef.current = "cancel";

        clearRecordingTimer();

        const recorder = mediaRecorderRef.current;

        if (
            recorder &&
            ["recording", "paused"].includes(recorder.state)
        ) {
            recorder.stop();
        } else {
            resetRecording();
        }
    }, [clearRecordingTimer, resetRecording]);

    const discardRecording = useCallback(() => {
        resetRecording();
    }, [resetRecording]);

    const getAudioFile = useCallback(() => {
        if (!audioBlob) return null;

        const extension = {
            "audio/webm": "webm",
            "audio/ogg": "ogg",
            "audio/mp4": "mp4",
            "audio/mpeg": "mp3",
        }[audioBlob.type.split(";")[0]] || "webm";

        return new File(
            [audioBlob],
            `voice-message.${extension}`,
            {
                type: audioBlob.type,
                lastModified: Date.now(),
            }
        );
    }, [audioBlob]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            clearRecordingTimer();
            releaseMediaStream();

            const recorder = mediaRecorderRef.current;

            if (
                recorder &&
                ["recording", "paused"].includes(recorder.state)
            ) {
                recorder.ondataavailable = null;
                recorder.onstop = null;
                recorder.onerror = null;
                recorder.stop();
            }

            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
        };
    }, [clearRecordingTimer, releaseMediaStream]);

    return {
        recordingState,
        duration,
        audioBlob,
        audioUrl,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
        cancelRecording,
        discardRecording,
        getAudioFile,
    };
};

export default useVoiceRecorder;
