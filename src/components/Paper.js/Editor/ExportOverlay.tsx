"use client";

import React, { useState } from "react";
import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  AlignmentType,
  Document as DocxDocument,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  UnderlineType,
  IImageOptions,
} from "docx";
import {
  blobToDataURL,
  downloadBlob,
  forceLightTheme,
  normalizeColor,
  waitForImages,
} from "@/lib/export-utils";
import { copyComputedStyles, normalizeInlineDeclarations } from "@/lib/dom-utils";

const md = new MarkdownIt({ html: true, linkify: true, breaks: true });

const renderMarkdownToHtml = (content: string) => {
  const trimmed = content.trim();
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) return trimmed;
  return md.render(content);
};

const sanitizeHtml = (html: string) => {
  try {
    return DOMPurify.sanitize(html);
  } catch (e) {
    return html;
  }
};

const htmlToPlainText = (html: string) => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  const parts: string[] = [];

  const appendNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim() === "") {
        if (parts.length > 0 && !parts[parts.length - 1].endsWith("\n")) {
          const lastChar = parts[parts.length - 1].slice(-1);
          if (lastChar !== " " && lastChar !== "\n") {
            parts.push(" ");
          }
        }
      } else {
        parts.push(text);
      }
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === "BR") {
        parts.push("\n");
        return;
      }

      const isBlock = BLOCK_TAGS.has(tag);

      if (isBlock && parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (lastPart !== "" && !lastPart.endsWith("\n")) {
          parts.push("\n");
        }
      }

      node.childNodes.forEach((child) => appendNode(child));

      if (isBlock) {
        parts.push("\n");
      }
    }
  };

  tmp.childNodes.forEach((child) => appendNode(child));

  let raw = parts.join("")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ") 
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n");

  const lines = raw.split("\n").map((line) => line.trimEnd());
  
  let result = "";
  let emptyLineCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") {
      emptyLineCount++;
      if (emptyLineCount <= 2) {
        if (result && !result.endsWith("\n\n")) {
          result += "\n";
        }
      }
    } else {
      emptyLineCount = 0;
      if (result && !result.endsWith("\n")) {
        result += "\n";
      }
      result += line;
    }
  }

  return result.trim();
};

const stripMarkdownArtifacts = (text: string) => {
  if (!text) return "";

  let result = text
    .replace(/~~(.*?)~~/g, "$1") 
    .replace(/~~/g, "") 
    .replace(/^[\s\u00a0]*(>\s*)+/gm, "")
    .replace(/[\u00a0\t]+/g, " ") 
    .replace(/[ ]{2,}/g, " ") 
    .replace(/\r\n/g, "\n");

  const lines = result.split("\n");
  const cleanedLines: string[] = [];
  let consecutiveEmpty = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed === "") {
      consecutiveEmpty++;
      if (consecutiveEmpty <= 1) {
        cleanedLines.push("");
      }
    } else {
      consecutiveEmpty = 0;
      cleanedLines.push(trimmed);
    }
  }

  return cleanedLines.join("\n").trim();
};

type DocxImageType = "jpg" | "png" | "gif" | "bmp";
const DOCX_IMAGE_TYPES: DocxImageType[] = ["jpg", "png", "gif", "bmp"];

const isDocxImageType = (value: string): value is DocxImageType =>
  DOCX_IMAGE_TYPES.includes(value as DocxImageType);

type HeadingValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];
type AlignmentValue = (typeof AlignmentType)[keyof typeof AlignmentType];

interface DocxTextStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
  fontSize?: number;
  fontFamily?: string;
}

const pxToHalfPoints = (px?: number) => {
  if (!px || Number.isNaN(px)) return undefined;
  const points = (px * 72) / 96;
  return Math.round(points * 2);
};

const colorCanvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
const colorCtx = colorCanvas ? colorCanvas.getContext("2d") : null;

const cssColorToHex = (value?: string | null) => {
  if (!value || !colorCtx) return null;
  const normalized = normalizeColor(value);
  if (!normalized) return null;
  try {
    colorCtx.fillStyle = "#000";
    colorCtx.fillStyle = normalized;
    const resolved = colorCtx.fillStyle as string;
    if (resolved.startsWith("#")) {
      let hex = resolved.slice(1);
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((ch) => ch + ch)
          .join("");
      }
      return hex.toUpperCase();
    }
    const rgbMatch = resolved.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbMatch) {
      const toHex = (num: string) => Number(num).toString(16).padStart(2, "0");
      return `${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`.toUpperCase();
    }
  } catch (err) {
    return null;
  }
  return null;
};

const headingMap: Record<string, HeadingValue> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

const alignmentMap: Record<string, AlignmentValue> = {
  left: AlignmentType.LEFT,
  right: AlignmentType.RIGHT,
  center: AlignmentType.CENTER,
  justify: AlignmentType.JUSTIFIED,
};

const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "header", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code", "ul", "ol", "li", "table", "hr",
]);

const deriveTextStyle = (element: HTMLElement, base: DocxTextStyle): DocxTextStyle => {
  const next: DocxTextStyle = { ...base };
  const tag = element.tagName.toLowerCase();
  if (tag === "strong" || tag === "b") next.bold = true;
  if (tag === "em" || tag === "i") next.italics = true;
  if (tag === "u") next.underline = true;
  if (tag === "s" || tag === "del" || tag === "strike") next.strike = true;
  if (tag === "code" || tag === "pre") next.fontFamily = "Consolas";
  if (tag === "mark") {
    const bg = cssColorToHex(element.style.backgroundColor || "#fff59d");
    if (bg) next.highlight = bg;
  }
  if (tag === "a") {
    next.underline = true;
    next.color = cssColorToHex(element.style.color || "#1d4ed8") || next.color;
  }

  const style = element.style;
  if (style) {
    const weight = style.fontWeight;
    if (weight && (weight === "bold" || weight === "bolder" || parseInt(weight, 10) >= 600)) next.bold = true;
    const fontStyle = style.fontStyle;
    if (fontStyle && fontStyle !== "normal") next.italics = true;
    const decoration = style.textDecoration || (style as any).textDecorationLine;
    if (decoration) {
      if (decoration.includes("underline")) next.underline = true;
      if (decoration.includes("line-through")) next.strike = true;
    }
    const colorHex = cssColorToHex(style.color);
    if (colorHex) next.color = colorHex;
    const bgHex = cssColorToHex(style.backgroundColor);
    if (bgHex && !/^(?:000000|00000000)$/.test(bgHex)) next.highlight = bgHex;
    const fontSizePx = parseFloat(style.fontSize || "");
    const size = pxToHalfPoints(fontSizePx);
    if (size) next.fontSize = size;
    if (style.fontFamily) {
      next.fontFamily = style.fontFamily.split(",")[0].replace(/['"]/g, "").trim();
    }
  }

  return next;
};

type ParagraphChild = TextRun | ImageRun;

const createTextRunsFromString = (text: string, style: DocxTextStyle): ParagraphChild[] => {
  if (!text) return [];
  const normalized = text.replace(/\u00a0/g, "\u00A0");
  const segments = normalized.split(/\n/);
  const runs: ParagraphChild[] = [];
  segments.forEach((segment, index) => {
    if (segment) {
      const runOptions: any = { text: segment };
      if (style.bold) runOptions.bold = true;
      if (style.italics) runOptions.italics = true;
      if (style.underline) runOptions.underline = { type: UnderlineType.SINGLE };
      if (style.strike) runOptions.strike = true;
      if (style.color) runOptions.color = style.color;
      if (style.fontSize) runOptions.size = style.fontSize;
      if (style.fontFamily) runOptions.font = style.fontFamily;
      if (style.highlight) {
        runOptions.shading = {
          type: ShadingType.CLEAR,
          color: "auto",
          fill: style.highlight,
        };
      }
      runs.push(new TextRun(runOptions));
    }
    if (index < segments.length - 1) {
      runs.push(new TextRun({ break: 1 }));
    }
  });
  return runs;
};

const resolveAbsoluteUrl = (src: string) => {
  try {
    return new URL(src, window.location.href).href;
  } catch (err) {
    return src;
  }
};

const captureImageFromLiveDom = async (src: string) => {
  try {
    const target = resolveAbsoluteUrl(src);
    const images = Array.from(document.querySelectorAll("img")) as HTMLImageElement[];
    const match = images.find((image) => resolveAbsoluteUrl(image.currentSrc || image.src) === target);
    if (!match) return null;
    if (!match.complete || match.naturalWidth === 0) {
      await new Promise<void>((resolve) => {
        const done = () => {
          match.removeEventListener("load", done);
          match.removeEventListener("error", done);
          resolve();
        };
        match.addEventListener("load", done);
        match.addEventListener("error", done);
      });
    }
    const width = match.naturalWidth || match.width || 1;
    const height = match.naturalHeight || match.height || 1;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(match, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } catch (err) {
    return null;
  }
};

const sourceToDataUrl = async (src: string) => {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const response = await fetch(src);
    if (response.ok) {
      const blob = await response.blob();
      return await blobToDataURL(blob);
    }
  } catch (err) {
    // ignore 
  }
  return await captureImageFromLiveDom(src);
};

const dataUrlToUint8Array = (dataUrl: string | null) => {
  if (!dataUrl) return null;
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const base64 = parts[1];
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const dataUrlToDocxImageType = (dataUrl: string | null): DocxImageType => {
  if (!dataUrl) return "png";
  const match = dataUrl.match(/^data:image\/([\w.+-]+)/i);
  if (!match) return "png";
  const subtype = match[1].toLowerCase();
  if (subtype === "jpeg") return "jpg";
  return isDocxImageType(subtype) ? subtype : "png";
};

const createImageRun = async (img: HTMLImageElement): Promise<ImageRun | null> => {
  const src = img.getAttribute("src") || img.src || "";
  if (!src) return null;
  const dataUrl = await sourceToDataUrl(src);
  if (!dataUrl) return null;
  const bytes = dataUrlToUint8Array(dataUrl);
  if (!bytes) return null;
  const type = dataUrlToDocxImageType(dataUrl);
  const maxWidth = 600;
  const width = img.naturalWidth || img.width || maxWidth;
  const height = img.naturalHeight || img.height || maxWidth;
  const scale = width > maxWidth ? maxWidth / width : 1;
  const imageOptions: IImageOptions = {
    type,
    data: bytes,
    transformation: {
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    },
  };

  return new ImageRun(imageOptions);
};

const buildRunsFromChildren = async (element: HTMLElement, baseStyle: DocxTextStyle): Promise<ParagraphChild[]> => {
  const runs: ParagraphChild[] = [];
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || "";
      if (text.trim()) {
        runs.push(...createTextRunsFromString(text, baseStyle));
      }
      continue;
    }

    if (!(child instanceof HTMLElement)) continue;

    if (child.tagName === "BR") {
      runs.push(new TextRun({ break: 1 }));
      continue;
    }

    if (child.tagName === "IMG") {
      const imageRun = await createImageRun(child as HTMLImageElement);
      if (imageRun) runs.push(imageRun);
      continue;
    }

    if (BLOCK_TAGS.has(child.tagName.toLowerCase()) && child.tagName.toLowerCase() !== "hr") {
      const nextStyle = deriveTextStyle(child, baseStyle);
      runs.push(...(await buildRunsFromChildren(child, nextStyle)));
      continue;
    }

    const nextStyle = deriveTextStyle(child, baseStyle);
    runs.push(...(await buildRunsFromChildren(child, nextStyle)));
  }
  return runs;
};

const createParagraphFromElement = async (
  element: HTMLElement,
  options?: { heading?: HeadingValue; indent?: { left?: number; right?: number; hanging?: number } }
) => {
  const baseStyle = deriveTextStyle(element, {});
  const runs = await buildRunsFromChildren(element, baseStyle);
  if (!runs.length) return null;
  const paragraphOptions: any = {
    children: runs,
  };

  if (options?.heading) paragraphOptions.heading = options.heading;
  if (options?.indent) paragraphOptions.indent = options.indent;

  const alignKey = (element.style.textAlign || "").toLowerCase();
  if (alignKey && alignmentMap[alignKey]) {
    paragraphOptions.alignment = alignmentMap[alignKey];
  }

  const borderLeft = element.style.borderLeft || window.getComputedStyle(element).borderLeft;
  const hasBorderLeft = borderLeft && borderLeft !== "none" && borderLeft !== "";
  
  const marginLeft = parseInt(element.style.marginLeft || window.getComputedStyle(element).marginLeft || "0", 10);
  const paddingLeft = parseInt(element.style.paddingLeft || window.getComputedStyle(element).paddingLeft || "0", 10);

  if (element.tagName === "BLOCKQUOTE") {
    paragraphOptions.indent = paragraphOptions.indent || { left: 720, right: 720 };
    paragraphOptions.spacing = { before: 120, after: 120 };
    paragraphOptions.border = {
      left: { size: 6, color: "CCCCCC" },
    };
  } else if (hasBorderLeft) {
    const borderMatch = borderLeft.match(/(\d+)px.*#([a-f0-9]{6}|[a-f0-9]{3})/i);
    if (borderMatch) {
      const borderSize = Math.max(1, Math.round(parseInt(borderMatch[1], 10) / 2));
      const borderColor = borderMatch[2].padEnd(6, "0").substring(0, 6);
      paragraphOptions.border = {
        left: { size: borderSize, color: borderColor },
      };
    }
  }

  if (marginLeft > 0 || paddingLeft > 0) {
    const leftIndent = Math.round((marginLeft + paddingLeft) / 15);
    paragraphOptions.indent = paragraphOptions.indent || {};
    if (!paragraphOptions.indent.left) {
      paragraphOptions.indent.left = leftIndent;
    }
  }

  return new Paragraph(paragraphOptions);
};

const processListElement = async (listEl: HTMLElement, depth = 0): Promise<Paragraph[]> => {
  const paragraphs: Paragraph[] = [];
  const isOrdered = listEl.tagName === "OL";
  const start = parseInt(listEl.getAttribute("start") || "1", 10) || 1;
  let index = 0;
  const items = Array.from(listEl.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "LI"
  );

  for (const item of items) {
    const markerText = isOrdered ? `${start + index}. ` : "• ";
    index += 1;

    const inlineWrapper = item.cloneNode(true) as HTMLElement;
    inlineWrapper.querySelectorAll("ul,ol").forEach((nested) => nested.remove());

    const baseStyle = deriveTextStyle(item, {});
    const runs = await buildRunsFromChildren(inlineWrapper, baseStyle);
    const bulletRun = new TextRun({ text: markerText });
    const children = [bulletRun, ...(runs.length ? runs : [new TextRun(" ")])];

    const paragraph = new Paragraph({
      children,
      indent: { left: 720 + depth * 360, hanging: 360 },
    });
    paragraphs.push(paragraph);

    const nestedLists = Array.from(item.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && (child.tagName === "UL" || child.tagName === "OL")
    );
    for (const nested of nestedLists) {
      paragraphs.push(...(await processListElement(nested, depth + 1)));
    }
  }

  return paragraphs;
};

const convertNodeToParagraphs = async (node: Node): Promise<Paragraph[]> => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || "").trim();
    if (!text) return [];
    return [
      new Paragraph({
        children: createTextRunsFromString(text, {}),
      }),
    ];
  }

  if (!(node instanceof HTMLElement)) return [];

  const tag = node.tagName.toLowerCase();
  if (tag === "ul" || tag === "ol") {
    return await processListElement(node);
  }

  if (tag === "img") {
    const imgRun = await createImageRun(node as HTMLImageElement);
    if (!imgRun) return [];
    return [new Paragraph({ children: [imgRun] })];
  }

  if (tag === "hr") {
    return [
      new Paragraph({
        children: [new TextRun("")],
        border: {
          bottom: {
            color: "000000",
            space: 1,
            style: "single",
            size: 12,
          },
        },
      }),
    ];
  }

  const heading = headingMap[node.tagName];
  if (heading) {
    const paragraph = await createParagraphFromElement(node, { heading });
    return paragraph ? [paragraph] : [];
  }

  if (tag === "blockquote") {
    const paragraph = await createParagraphFromElement(node, { indent: { left: 720, right: 720 } });
    return paragraph ? [paragraph] : [];
  }

  if (tag === "div") {
    const hasMarginLeft = node.style.marginLeft || node.style.paddingLeft;
    const marginLeftVal = parseInt(node.style.marginLeft || "0", 10);
    const paddingLeftVal = parseInt(node.style.paddingLeft || "0", 10);

    if (hasMarginLeft && (marginLeftVal > 0 || paddingLeftVal > 0)) {
      const hasBlockChild = Array.from(node.childNodes).some(
        (child) => child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName.toLowerCase())
      );
      
      if (!hasBlockChild) {
        const leftIndent = Math.round((marginLeftVal + paddingLeftVal) / 15);
        const paragraph = await createParagraphFromElement(node, { indent: { left: leftIndent } });
        return paragraph ? [paragraph] : [];
      }
    }
  }

  const hasBlockChild = Array.from(node.childNodes).some(
    (child) => child instanceof HTMLElement && BLOCK_TAGS.has(child.tagName.toLowerCase())
  );

  if (hasBlockChild) {
    const paragraphs: Paragraph[] = [];
    for (const child of Array.from(node.childNodes)) {
      paragraphs.push(...(await convertNodeToParagraphs(child)));
    }
    return paragraphs;
  }

  const paragraph = await createParagraphFromElement(node);
  return paragraph ? [paragraph] : [];
};

const buildDocxParagraphsFromClone = async (root: HTMLElement) => {
  const paragraphs: Paragraph[] = [];
  
  for (const child of Array.from(root.childNodes)) {
    const childParagraphs = await convertNodeToParagraphs(child);
    paragraphs.push(...childParagraphs);
  }
  
  if (!paragraphs.length && root.textContent && root.textContent.trim().length > 0) {

    const paragraph = await createParagraphFromElement(root);
    if (paragraph) {
      paragraphs.push(paragraph);
    }
  }
  
  if (!paragraphs.length) {
    paragraphs.push(new Paragraph({ children: [new TextRun(" ")] }));
  }
  
  return paragraphs;
};

const normalizeStyleTags = (root: HTMLElement) => {
  const styleNodes = Array.from(root.querySelectorAll("style"));
  styleNodes.forEach((styleNode) => {
    const cssText = styleNode.textContent;
    if (!cssText) return;
    if (!/lab\(|lch\(/i.test(cssText)) return;
    const normalized = normalizeColor(cssText);
    if (normalized && normalized !== cssText) {
      styleNode.textContent = normalized;
    }
  });
};

const ensureStrikethroughVisible = (root: HTMLElement) => {
  const elements = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
  elements.forEach((el) => {
    const decoration = el.style.textDecoration || "";
    const hasLineThrough = decoration.includes("line-through");
    
    if (!hasLineThrough) return;
    if (el.dataset.strikethroughProcessed === "true") return;
    
    const hasUnderline = decoration.includes("underline");
    
    let textColor = el.style.color;
    if (!textColor || textColor === "" || textColor === "currentColor") {
      textColor = window.getComputedStyle(el).color || "currentColor";
    }
    
    if (hasUnderline) {
      el.style.textDecoration = "underline";
      el.style.textDecorationLine = "underline";
      el.style.textDecorationColor = textColor;
      el.style.textDecorationThickness = "1px";
      el.style.textUnderlineOffset = "2px";
    } else {
      el.style.textDecoration = "none";
    }
    
    const fontSize = parseFloat(window.getComputedStyle(el).fontSize) || 16;
    const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || fontSize * 1.5;
    
    const strikethroughOffset = fontSize * 1.4;
    
    el.style.backgroundImage = `linear-gradient(to right, ${textColor}, ${textColor})`;
    el.style.backgroundPosition = `center ${strikethroughOffset}px`;
    el.style.backgroundSize = "100% 1px";
    el.style.backgroundRepeat = "no-repeat";
    el.style.padding = "0.1em 0";
    el.style.display = "inline-block";
    el.style.lineHeight = `${lineHeight}px`;
    
    el.dataset.strikethroughProcessed = "true";
  });
};

const normalizeTextDecorations = (root: HTMLElement) => {
  const elements = [root, ...Array.from(root.querySelectorAll("*"))] as HTMLElement[];
  elements.forEach((el) => {
    const decoration = el.style.textDecoration;
    if (!decoration) return;
    
    if (el.dataset.strikethroughProcessed === "true") return;
    
    const hasUnderline = decoration.includes("underline");
    const hasLineThrough = decoration.includes("line-through");
    
    if (hasUnderline && hasLineThrough) {
      el.style.textDecoration = "underline line-through";
      el.style.textDecorationLine = "underline line-through";
    }
  });
};

const normalizeListStructure = (root: HTMLElement) => {
  const lists = Array.from(root.querySelectorAll("ul, ol"));
  lists.forEach((list) => {
    const isOrdered = list.tagName === "OL";
    let counter = isOrdered ? parseInt(list.getAttribute("start") || "1", 10) || 1 : 1;
    Array.from(list.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (child.tagName !== "LI") return;
      if (child.dataset.exportListNormalized === "true") return;

      const marker = child.ownerDocument.createElement("span");
      marker.textContent = isOrdered ? `${counter}.` : "\u2022";
      marker.style.display = "inline-block";
      marker.style.minWidth = isOrdered ? "2rem" : "1.5rem";
      marker.style.paddingRight = "0.5rem";
      marker.style.textAlign = isOrdered ? "right" : "center";
      marker.style.lineHeight = "inherit";
      marker.style.verticalAlign = "baseline";
      marker.style.flex = "0 0 auto";

      counter += 1;

      const contentWrapper = child.ownerDocument.createElement("span");
      contentWrapper.style.display = "inline";
      contentWrapper.style.lineHeight = "inherit";
      contentWrapper.style.verticalAlign = "baseline";
      contentWrapper.style.flex = "1 1 auto";

      while (child.firstChild) {
        contentWrapper.appendChild(child.firstChild);
      }

      child.style.display = "flex";
      child.style.alignItems = "baseline";
      child.style.listStyleType = "none";
      child.style.listStylePosition = "outside";
      child.style.paddingLeft = "0";
      child.style.marginLeft = "0";
      child.style.gap = "0";
      child.dataset.exportListNormalized = "true";

      child.appendChild(marker);
      child.appendChild(contentWrapper);
    });
  });
};

const shiftHighlightsDown = (root: HTMLElement, offsetPx: number) => {
  const highlightCandidates = Array.from(root.querySelectorAll<HTMLElement>('mark, [style*="background"], [style*="background-color"]'));
  highlightCandidates.forEach((el) => {
    if (el.dataset.exportHighlightShifted === "true") return;

    const inlineStyle = el.getAttribute("style") || "";
    let colorMatch = inlineStyle.match(/background(?:-color)?:\s*([^;]+)/i);
    let bgColor = colorMatch ? normalizeColor(colorMatch[1]) : null;

    if ((!bgColor || /transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(bgColor)) && typeof window !== "undefined" && el.ownerDocument === document) {
      try {
        const computed = window.getComputedStyle(el);
        if (computed.backgroundColor && !/rgba\(0,\s*0,\s*0,\s*0\)/i.test(computed.backgroundColor)) {
          bgColor = normalizeColor(computed.backgroundColor);
        }
      } catch (err) {
        // ignore
      }
    }

    if (!bgColor || /transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(bgColor)) return;

    el.style.backgroundColor = bgColor;
    el.style.paddingLeft = "2px";
    el.style.paddingRight = "2px";
    el.style.paddingTop = "0px";
    el.style.paddingBottom = "6px";
    el.dataset.exportHighlightShifted = "true";
  });
};

async function exportAsPDF(html: string, filename: string) {
  const liveEditor = document.querySelector('[data-wysiwyg-editor-root="true"]') as HTMLElement | null;

  const fallbackRoot = () => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.style.whiteSpace = "normal";
    return tmp;
  };

  const sourceElement = liveEditor instanceof HTMLElement ? liveEditor : fallbackRoot();
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.setAttribute("data-export-clone", "true");

  if (liveEditor) {
    const restoreTheme = forceLightTheme();
    try {
      copyComputedStyles(liveEditor, clone);
    } finally {
      restoreTheme();
    }
  }

  normalizeInlineDeclarations(clone);
  normalizeTextDecorations(clone);
  ensureStrikethroughVisible(clone);
  normalizeStyleTags(clone);
  normalizeListStructure(clone);
  shiftHighlightsDown(clone, 15);
  await waitForImages(clone);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = `${Math.max(900, sourceElement.clientWidth || 0) + 64}px`;
  iframe.style.height = `${Math.max(1200, sourceElement.clientHeight || 0) + 64}px`;
  iframe.style.visibility = "hidden";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const ensureIframeDoc = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) throw new Error("Could not initialize export iframe");
    return doc;
  };

  const iframeDoc = ensureIframeDoc();
  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.5; }
  [data-export-clone] > * { margin-bottom: 0; }
  [data-export-clone] > * + * { margin-top: 0; }
  [data-export-clone] p { margin: 0; }
  [data-export-clone] div[style*="margin-left"],
  [data-export-clone] div[style*="padding-left"] { margin: 0; }
  [data-export-clone] blockquote { margin: 0; }
  [data-export-clone] img { max-width: 100%; height: auto; }
  [data-export-clone] ul,
  [data-export-clone] ol { margin: 0; padding-left: 1.5rem; list-style-position: outside; }
  [data-export-clone] li { margin: 0; display: list-item; list-style-position: outside; line-height: inherit; }
  [data-export-clone] li::marker { font-size: 1em; }
  [data-export-clone] span[style*="background"],
  [data-export-clone] mark { display: inline; vertical-align: baseline; line-height: inherit; padding: 0; margin: 0; }
  
  [data-export-clone] s,
  [data-export-clone] del,
  [data-export-clone] strike { 
    position: relative;
    display: inline-block;
    line-height: inherit;
    text-decoration: none !important; 
  }
  [data-export-clone] s::before,
  [data-export-clone] del::before,
  [data-export-clone] strike::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background-color: currentColor;
    transform: translateY(-50%);
    display: none; 
  }
  
  [data-export-clone] u {
    text-decoration: underline !important;
    text-decoration-thickness: 1px !important;
    text-decoration-color: currentColor !important;
    text-underline-offset: 2px !important;
    text-decoration-skip-ink: none !important;
  }
  
  [data-export-clone] u s,
  [data-export-clone] u strike,
  [data-export-clone] u del,
  [data-export-clone] *[style*="underline"][style*="line-through"] {
    position: relative;
    display: inline-block;
    line-height: inherit;
    text-decoration: underline !important;
    text-decoration-thickness: 1px !important;
    text-decoration-color: currentColor !important;
    text-underline-offset: 2px !important;
    text-decoration-skip-ink: none !important;
  }
  [data-export-clone] u s::before,
  [data-export-clone] u strike::before,
  [data-export-clone] u del::before,
  [data-export-clone] *[style*="underline"][style*="line-through"]::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background-color: currentColor;
    transform: translateY(-50%);
    display: none;
  }
  
  [data-export-clone] *[style*="underline"] {
    text-decoration: underline !important;
    text-decoration-thickness: 1px !important;
    text-decoration-color: currentColor !important;
    text-underline-offset: 2px !important;
    text-decoration-skip-ink: none !important;
  }
  
  [data-export-clone] strong,
  [data-export-clone] b { font-weight: bold; }
  [data-export-clone] em,
  [data-export-clone] i { font-style: italic; }

  [data-export-clone] blockquote {
    margin: 2rem 0 0.5rem 0 !important;
    padding: 0 0 0 1rem !important;
    border-left: 3px solid #ccc;
  }
  [data-export-clone] blockquote > :not(blockquote) {
    margin-top: 0 !important;
    padding-top: 0 !important;
    transform: translateY(-4px) !important;
  }
    
  [data-export-clone] blockquote blockquote > :not(blockquote) {
    margin-top: 0 !important;
    padding-top: 0 !important;
    transform: translateY(-4px) !important;
  }

  [data-export-clone] blockquote img,
  [data-export-clone] blockquote > img,
  [data-export-clone] blockquote figure,
  [data-export-clone] blockquote blockquote img {
    transform: translateY(-2px) !important;
    vertical-align: middle !important;
    display: inline-block !important;
    max-width: 100% !important;
    height: auto !important;
  }
</style></head><body></body></html>`);
  iframeDoc.close();

  const wrapper = iframeDoc.createElement("div");
  wrapper.style.width = "100%";
  wrapper.style.minHeight = "100%";
  wrapper.style.backgroundColor = "#ffffff";
  iframeDoc.body.appendChild(wrapper);

  try {
    const adoptedClone = iframeDoc.importNode(clone, true) as HTMLElement;
    wrapper.appendChild(adoptedClone);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const rootRect = adoptedClone.getBoundingClientRect();
    const domImagePositions = Array.from(adoptedClone.querySelectorAll("img")).map((img) => {
      const rect = img.getBoundingClientRect();
      return {
        top: rect.top - rootRect.top,
        bottom: rect.bottom - rootRect.top,
        height: rect.height,
      };
    });

    const canvas = await html2canvas(adoptedClone, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: iframeDoc.documentElement.scrollWidth,
      windowHeight: iframeDoc.documentElement.scrollHeight,
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const ratio = pageWidth / canvas.width;
    const sliceHeightPx = pageHeight / ratio;

    const scaleFactor = canvas.width / Math.max(1, rootRect.width || adoptedClone.clientWidth || 1);
    const imagePositions = domImagePositions.map((pos) => ({
      top: pos.top * scaleFactor,
      bottom: pos.bottom * scaleFactor,
      height: pos.height * scaleFactor,
    }));

    let currentY = 0;
    let pageIndex = 0;

    while (currentY < canvas.height) {
      const remaining = canvas.height - currentY;
      let sliceHeight = Math.min(sliceHeightPx, remaining);
      const sliceEnd = currentY + sliceHeight;

      for (const imgPos of imagePositions) {
        if (imgPos.top >= currentY && imgPos.top < sliceEnd && imgPos.bottom > sliceEnd) {
          if (imgPos.height <= sliceHeightPx) {
            sliceHeight = Math.max(0, imgPos.top - currentY);
            break;
          }
        }
      }

      if (sliceHeight < 20) {
        sliceHeight = Math.min(sliceHeightPx, remaining);
      }

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const pageCtx = pageCanvas.getContext("2d");
      if (pageCtx) {
        pageCtx.drawImage(
          canvas,
          0,
          currentY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight
        );
        const imgData = pageCanvas.toDataURL("image/png", 0.98);
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, 0, pageWidth, sliceHeight * ratio);
      }

      currentY += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    iframe.remove();
  }
}

async function exportAsDocx(html: string, filename: string) {
  const liveEditor = document.querySelector('[data-wysiwyg-editor-root="true"]') as HTMLElement | null;

  const fallbackRoot = () => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    tmp.style.whiteSpace = "normal";
    return tmp;
  };

  const sourceElement = liveEditor instanceof HTMLElement ? liveEditor : fallbackRoot();
  const clone = sourceElement.cloneNode(true) as HTMLElement;
  clone.setAttribute("data-export-clone", "true");

  if (liveEditor) {
    const restoreTheme = forceLightTheme();
    try {
      copyComputedStyles(liveEditor, clone);
    } finally {
      restoreTheme();
    }
  }

  normalizeInlineDeclarations(clone);
  await waitForImages(clone);

  const paragraphs = await buildDocxParagraphsFromClone(clone);

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${filename}.docx`);
}

async function exportAsTxt(html: string, filename: string) {
  const raw = htmlToPlainText(html);
  const text = stripMarkdownArtifacts(raw);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadBlob(blob, `${filename}.txt`);
}

interface ExportOverlayProps {
  open: boolean;
  onClose?: () => void;
  markdown: string;
  getRichHtml?: () => string;
}

export default function ExportOverlay({
  open,
  onClose,
  markdown,
  getRichHtml,
}: Readonly<ExportOverlayProps>) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const generateFilename = () => {
    const now = new Date();
    const date = now.toISOString().split("T")[0];
    return `note-${date}`;
  };

  const handleExport = async (format: "pdf" | "docx" | "txt") => {
    setIsExporting(true);
    setError(null);
    const filename = generateFilename();
    try {
      const content = getRichHtml ? getRichHtml() : markdown;
      const rawHtml = renderMarkdownToHtml(content);
      const sanitized = sanitizeHtml(rawHtml);

      if (format === "pdf") await exportAsPDF(sanitized, filename);
      else if (format === "docx") await exportAsDocx(sanitized, filename);
      else await exportAsTxt(sanitized, filename);

      onClose?.();
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={() => onClose?.()} />
      <div className="relative bg-card border border-border rounded-lg shadow-lg p-4 w-[320px]">
        <h3 className="text-lg font-semibold mb-2">Export note</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose a format to export your note (fully client-side).
        </p>

        <div className="space-y-3">
          <div className="flex flex-col">
            <button
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-500 text-white rounded disabled:opacity-60 flex items-center justify-between"
              disabled={isExporting}
              onClick={() => handleExport("pdf")}
            >
              <span>Export as PDF</span>
              <span className="text-sm opacity-90">📄</span>
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Generates a PDF client-side — HTML capture → canvas → PDF.
            </p>
          </div>

          <div className="flex flex-col">
            <button
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-60 flex items-center justify-between"
              disabled={isExporting}
              onClick={() => handleExport("docx")}
            >
              <span>Export as Word (.docx)</span>
              <span className="text-sm opacity-90">📝</span>
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Converts structure (headings, lists, code blocks) to .docx. Simple styles preserved.
            </p>
          </div>

          <div className="flex flex-col">
            <button
              className="w-full px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-60 flex items-center justify-between"
              disabled={isExporting}
              onClick={() => handleExport("txt")}
            >
              <span>Export as text (.txt)</span>
              <span className="text-sm opacity-90">📋</span>
            </button>
            <p className="mt-1 text-xs text-muted-foreground">
              Downloads raw text (cleaned Markdown/HTML), without formatting.
            </p>
          </div>

          {error && <p className="text-sm text-destructive mt-1">Error: {error}</p>}

          <div className="flex justify-end mt-2">
            <button className="px-3 py-1 text-sm" onClick={() => onClose?.()} disabled={isExporting}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}