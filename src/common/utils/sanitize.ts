import DOMPurify from "dompurify";
import { marked } from "marked";

export function parseMarkdownSafe(markdown: string): string {
  return DOMPurify.sanitize(marked.parse(markdown, { gfm: true, breaks: true }) as string);
}
