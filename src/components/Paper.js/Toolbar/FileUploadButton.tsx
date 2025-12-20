"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";

export interface UploadedFileData {
  dataUrl: string;
  name: string;
  type: string;
  size: number;
}

interface FileUploadButtonProps {
  onFileSelect: (file: UploadedFileData) => void;
  disabled?: boolean;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10MB for videos

export default function FileUploadButton({ onFileSelect, disabled = false }: Readonly<FileUploadButtonProps>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const ensureMimeType = (file: File): string => {
    if (file.type) return file.type;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      gif: "image/gif",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      svg: "image/svg+xml",
      mp4: "video/mp4",
      webm: "video/webm",
      mp3: "audio/mpeg",
      wav: "audio/wav",
      pdf: "application/pdf",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return extension ? mimeTypes[extension] || "application/octet-stream" : "application/octet-stream";
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      };
      reader.onerror = () => reject(reader.error || new Error("Unknown file reading error"));
      reader.readAsDataURL(file);
    });
  };

  const validateFile = (file: File): string | null => {
    // Check if it's a video
    const isVideo = file.type.startsWith('video/') || file.type.startsWith('audio/');
    
    // Check size according to type
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      return `The video file is too large. Maximum size: 10MB`;
    }
    
    if (!isVideo && file.size > MAX_FILE_SIZE) {
      return `The file is too large. Maximum size: 25MB`;
    }

    return null;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    try {
      // Validate the file
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        setIsProcessing(false);
        return;
      }

      const fileType = ensureMimeType(file);
      const dataUrl = await readFileAsDataUrl(file);

      if (!dataUrl) {
        setError("Unable to read the selected file");
        setIsProcessing(false);
        return;
      }

      onFileSelect({
        dataUrl,
        name: file.name,
        type: fileType,
        size: file.size,
      });
      
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError('Error during file upload');
      console.error('File upload error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing || disabled}
        className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        title={disabled ? "Place the cursor in the document to add a file" : "Add an attachment"}
      >
        <Icon name="document" className="h-5 w-5" />
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
      />

      {error && (
        <div className="fixed left-1/2 top-20 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-4 py-2 rounded shadow-lg">
          {error}
        </div>
      )}
    </>
  );
}

