"use client";
import { useState, useEffect, useCallback } from "react";
import UndoRedoButtons from "./UndoRedoButtons";
import FormatButtons from "./FormatButtons";
import ColorPickers from "./ColorPickers";
import HeadingMenu from "./HeadingMenu";
import ListMenu from "./ListMenu";
import AlignmentMenu from "./AlignmentMenu";
import IndentButtons from "./IndentButtons";
import MediaButtons from "./MediaButtons";
import QuoteButtons from "./QuoteButtons";
import DrawingModal from "./DrawingModal";
import ImageEditModal from "./ImageEditModal";
import ToolbarSeparator from "./ToolbarSeparator";
import Icon from "@/components/Icon";

interface WysiwygToolbarProps {
  onFormatChange: (command: string, value?: string) => void;
  showDebug?: boolean;
  onToggleDebug?: () => void;
  onOpenSynthesis?: () => void;
}

export default function WysiwygToolbar({ onFormatChange, showDebug = false, onToggleDebug, onOpenSynthesis }: WysiwygToolbarProps) {
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [showImageEditModal, setShowImageEditModal] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [currentHighlight, setCurrentHighlight] = useState("transparent");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [canEditImage, setCanEditImage] = useState(false);
  const [imageInfo, setImageInfo] = useState<{ src: string; naturalWidth: number; naturalHeight: number; styleWidth: string; styleHeight: string } | null>(null);
  const [hasActiveSelection, setHasActiveSelection] = useState(false);

  // Check current formatting state
  const checkFormatting = useCallback(() => {
    if (typeof document === "undefined") return;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
    
    if (element) {
      setIsBold(document.queryCommandState('bold'));
      setIsItalic(document.queryCommandState('italic'));
      setIsUnderline(document.queryCommandState('underline'));
      
      // Check for strikethrough more thoroughly
      let isStrike = false;
      
      // Check queryCommandState first
      if (document.queryCommandState('strikeThrough')) {
        isStrike = true;
      } else {
        // Check if element or any parent has strikethrough
        let currentElement: HTMLElement | null = element as HTMLElement | null;
        while (currentElement && currentElement !== (document.body as unknown as HTMLElement)) {
          if (currentElement.nodeName === 'S' || 
              currentElement.nodeName === 'DEL' || 
              currentElement.nodeName === 'STRIKE' ||
              (currentElement as HTMLElement).style?.textDecoration?.includes('line-through')) {
            isStrike = true;
            break;
          }
          currentElement = currentElement.parentElement as HTMLElement | null;
        }
      }
      
      setIsStrikethrough(isStrike);

      // Check current text color
      const computedStyle = window.getComputedStyle(element);
      const color = computedStyle.color;
      if (color && color !== 'rgb(0, 0, 0)' && color !== 'rgba(0, 0, 0, 0)') {
        // Convert rgb to hex
        let hexColor = color;
        if (color.startsWith('rgb')) {
          const rgb = color.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0]);
            const g = parseInt(rgb[1]);
            const b = parseInt(rgb[2]);
            hexColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        }
        setCurrentColor(hexColor);
      }

      // Check current highlight color
      const backgroundColor = computedStyle.backgroundColor;
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
        // Convert rgb to hex
        let hexHighlight = backgroundColor;
        if (backgroundColor.startsWith('rgb')) {
          const rgb = backgroundColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const r = parseInt(rgb[0]);
            const g = parseInt(rgb[1]);
            const b = parseInt(rgb[2]);
            hexHighlight = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        }
        setCurrentHighlight(hexHighlight);
      } else {
        setCurrentHighlight("transparent");
      }

      // Check undo/redo availability using custom history
      if (window.canWysiwygUndo && window.canWysiwygRedo) {
        setCanUndo(window.canWysiwygUndo());
        setCanRedo(window.canWysiwygRedo());
      } else {
        // Fallback to native commands
        setCanUndo(document.queryCommandEnabled('undo'));
        setCanRedo(document.queryCommandEnabled('redo'));
      }
    }
  }, []);

  // Listen for selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      checkFormatting();
      if (typeof document !== "undefined") {
        const selection = window.getSelection();
        const editorRoot = document.querySelector('[data-wysiwyg-editor-root="true"]');
        if (!selection || selection.rangeCount === 0 || !editorRoot) {
          setHasActiveSelection(false);
        } else {
          const range = selection.getRangeAt(0);
          const container = range.commonAncestorContainer;
          setHasActiveSelection(editorRoot.contains(container));
        }
      }
      // Detect if an image is selected for editing
      try {
        const selectedImg = document.querySelector('img[data-selected-image="true"]') as HTMLImageElement | null;
        const info = window.getCurrentImageForEditing ? window.getCurrentImageForEditing() : null;
        setCanEditImage(!!selectedImg && !!info);
        if (info) {
          setImageInfo(info);
        } else {
          setImageInfo(null);
        }
      } catch (_e) {
        setCanEditImage(false);
        setImageInfo(null);
      }
    };

    // Listen for input changes to update undo/redo states
    const handleInput = () => {
      setTimeout(() => {
        if ((window as any).canWysiwygUndo && (window as any).canWysiwygRedo) {
          setCanUndo((window as any).canWysiwygUndo());
          setCanRedo((window as any).canWysiwygRedo());
        } else {
          // Fallback to native commands
          setCanUndo(document.queryCommandEnabled('undo'));
          setCanRedo(document.queryCommandEnabled('redo'));
        }
      }, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('input', handleInput);
    handleSelectionChange();
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('input', handleInput);
    };
  }, [checkFormatting]);

  // Expose a global opener so double-click from the editor can open this modal
  useEffect(() => {
    window.openImageEditModal = () => {
      if (canEditImage) setShowImageEditModal(true);
      else setShowImageEditModal(false);
    };
  }, [canEditImage]);

  return (
    <div className="bg-transparent text-foreground p-4 flex flex-wrap items-center gap-1">
      {/* Undo/Redo */}
      <UndoRedoButtons 
        canUndo={canUndo} 
        canRedo={canRedo} 
        onFormatChange={onFormatChange} 
      />

      <ToolbarSeparator />

      {/* Format Buttons */}
      <FormatButtons 
        isBold={isBold}
        isItalic={isItalic}
        isUnderline={isUnderline}
        isStrikethrough={isStrikethrough}
        onFormatChange={onFormatChange}
      />

      {/* Color Pickers */}
      <ColorPickers 
        currentColor={currentColor}
        currentHighlight={currentHighlight}
        onFormatChange={onFormatChange}
      />

      <ToolbarSeparator />

      {/* Heading Menu */}
      <HeadingMenu onFormatChange={onFormatChange} />

      {/* List Menu */}
      <ListMenu onFormatChange={onFormatChange} />

      <ToolbarSeparator />

      {/* Alignment Menu */}
      <AlignmentMenu onFormatChange={onFormatChange} />

      {/* Indent Buttons */}
      <IndentButtons onFormatChange={onFormatChange} />

      <ToolbarSeparator />

      {/* Media Buttons */}
      <MediaButtons 
        onFormatChange={onFormatChange}
        onShowDrawingModal={() => setShowDrawingModal(true)}
        isSelectionActive={hasActiveSelection}
      />

      {/* Quote Buttons */}
      <QuoteButtons onFormatChange={onFormatChange} />

      <ToolbarSeparator />

      {/* AI Synthesis Button */}
      {onOpenSynthesis && (
        <button
          type="button"
          onClick={onOpenSynthesis}
          className="p-2 rounded transition-colors bg-muted hover:bg-muted/80 text-foreground"
          title="AI Summary"
        >
          <Icon name="sparkles" className="h-5 w-5" /> IA
        </button>
      )}

      {/* <ToolbarSeparator /> */}

      {/* Debug Button */}
      
      {/* {onToggleDebug && (
        <button
          type="button"
          onClick={onToggleDebug}
          className={`p-2 rounded transition-colors ${
            showDebug
              ? "bg-primary hover:bg-primary/90 text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-foreground"
          }`}
          title="Afficher/Masquer le debug"
        >
          <Icon name="gear" className="h-5 w-5" />
        </button>
      )} */}

      {/* Modals */}
      <DrawingModal 
        isOpen={showDrawingModal}
        onClose={() => setShowDrawingModal(false)}
        onFormatChange={onFormatChange}
      />

      <ImageEditModal 
        isOpen={showImageEditModal}
        onClose={() => setShowImageEditModal(false)}
        onFormatChange={onFormatChange}
        canEditImage={canEditImage}
        imageInfo={imageInfo}
      />
    </div>
  );
}