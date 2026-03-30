"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecordingState = "idle" | "recording" | "recorded";

const MAX_DURATION = 30;

interface UseAudioRecorderReturn {
	state: RecordingState;
	duration: number;
	audioBlob: Blob | null;
	audioUrl: string | null;
	error: string | null;
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	resetRecording: () => void;
}

function getSupportedMimeType(): string {
	const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
	for (const type of types) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return "";
}

export function useAudioRecorder(): UseAudioRecorderReturn {
	const [state, setState] = useState<RecordingState>("idle");
	const [duration, setDuration] = useState(0);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const durationRef = useRef(0);

	const cleanup = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) {
				track.stop();
			}
			streamRef.current = null;
		}
		mediaRecorderRef.current = null;
		chunksRef.current = [];
	}, []);

	const resetRecording = useCallback(() => {
		cleanup();
		if (audioUrl) URL.revokeObjectURL(audioUrl);
		setAudioBlob(null);
		setAudioUrl(null);
		setDuration(0);
		durationRef.current = 0;
		setError(null);
		setState("idle");
	}, [cleanup, audioUrl]);

	const stopRecording = useCallback(() => {
		if (mediaRecorderRef.current?.state === "recording") {
			mediaRecorderRef.current.stop();
		}
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const startRecording = useCallback(async () => {
		setError(null);

		if (!navigator.mediaDevices?.getUserMedia) {
			setError("mic_not_supported");
			return;
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { sampleRate: { ideal: 48000 }, channelCount: 1 },
			});
			streamRef.current = stream;

			const mimeType = getSupportedMimeType();
			const recorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);

			mediaRecorderRef.current = recorder;
			chunksRef.current = [];

			recorder.ondataavailable = (e) => {
				if (e.data.size > 0) chunksRef.current.push(e.data);
			};

			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType || "audio/webm",
				});
				const url = URL.createObjectURL(blob);
				setAudioBlob(blob);
				setAudioUrl(url);
				setState("recorded");

				if (streamRef.current) {
					for (const track of streamRef.current.getTracks()) {
						track.stop();
					}
					streamRef.current = null;
				}
			};

			recorder.start(250);
			durationRef.current = 0;
			setDuration(0);
			setState("recording");

			timerRef.current = setInterval(() => {
				durationRef.current += 1;
				setDuration(durationRef.current);
				if (durationRef.current >= MAX_DURATION) {
					stopRecording();
				}
			}, 1000);
		} catch (err) {
			cleanup();
			if (err instanceof DOMException) {
				if (err.name === "NotAllowedError") {
					setError("mic_denied");
				} else if (err.name === "NotFoundError") {
					setError("mic_not_found");
				} else {
					setError("mic_error");
				}
			} else {
				setError("mic_error");
			}
		}
	}, [cleanup, stopRecording]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (mediaRecorderRef.current?.state === "recording") {
				mediaRecorderRef.current.stop();
			}
			if (timerRef.current) clearInterval(timerRef.current);
			if (streamRef.current) {
				for (const track of streamRef.current.getTracks()) {
					track.stop();
				}
			}
		};
	}, []);

	return {
		state,
		duration,
		audioBlob,
		audioUrl,
		error,
		startRecording,
		stopRecording,
		resetRecording,
	};
}
