import { atom } from "jotai";

export interface AttachedImage {
	id: string;
	dataUrl: string;
	name: string;
	size: number;
}

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES = 4;
export const ACCEPTED_IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
];

export const attachedImagesAtom = atom<AttachedImage[]>([]);
