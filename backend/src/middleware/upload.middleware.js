
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";

const ALLOWED_AUDIO_TYPES = [
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/aac",
    "audio/3gpp",
];

const ALLOWED_AUDIO_EXTENSIONS = {
    webm: ["audio/webm"],
    ogg: ["audio/ogg"],
    mp4: ["audio/mp4"],
    mp3: ["audio/mpeg"],
    wav: ["audio/wav"],
    aac: ["audio/aac"],
    "3gp": ["audio/3gpp"],
};

const uploadAudio = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        const mimeType = file.mimetype
            .split(";")[0]
            .trim()
            .toLowerCase();

        if (!ALLOWED_AUDIO_TYPES.includes(mimeType)) {
            return cb(new Error("Unsupported audio format."));
        }

        cb(null, true);
    },
});

const singleAudioUpload = uploadAudio.single("audio");

export const uploadVoiceMessage = (req, res, next) => {
    singleAudioUpload(req, res, async (error) => {
        if (error) {
            if (error.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    message: "Audio file must be 10 MB or smaller.",
                });
            }

            return res.status(400).json({
                message: error.message || "Invalid audio upload.",
            });
        }

        if (!req.file) {
            return next();
        }

        try {
            const detectedType = await fileTypeFromBuffer(req.file.buffer);

            if (!detectedType) {
                return res.status(415).json({
                    message: "Unable to identify audio file format.",
                });
            }

            const allowedMimeTypes =
                ALLOWED_AUDIO_EXTENSIONS[detectedType.ext];

            const declaredMimeType = req.file.mimetype
                .split(";")[0]
                .trim()
                .toLowerCase();

            if (
                !allowedMimeTypes ||
                !allowedMimeTypes.includes(declaredMimeType)
            ) {
                return res.status(415).json({
                    message: "Audio file signature does not match its format.",
                });
            }

            next();
        } catch (validationError) {
            console.error(
                "Audio signature validation failed:",
                validationError.message
            );

            return res.status(400).json({
                message: "Failed to validate audio file.",
            });
        }
    });
};
