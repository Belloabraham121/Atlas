import React from 'react';

interface MessageContentProps {
  content: string;
}

export function MessageContent({ content }: MessageContentProps) {
  // Function to parse and render formatted text
  const renderFormattedText = (text: string) => {
    // Split by lines to handle line breaks
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      if (line.trim() === '') {
        return <br key={lineIndex} />;
      }
      
      // Handle different line types
      const elements: React.ReactNode[] = [];
      
      // Check if line starts with bullet point
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        const bulletContent = line.replace(/^[\s]*[•-][\s]*/, '');
        elements.push(
          <div key={lineIndex} className="flex items-start gap-2 ml-4">
            <span className="text-gray-400 mt-1">•</span>
            <span>{renderInlineFormatting(bulletContent)}</span>
          </div>
        );
      }
      // Check if line starts with number (numbered list)
      else if (/^\s*\d+\.\s/.test(line)) {
        const match = line.match(/^(\s*)(\d+\.\s)(.*)$/);
        if (match) {
          const [, indent, number, content] = match;
          elements.push(
            <div key={lineIndex} className="flex items-start gap-2 ml-4">
              <span className="text-gray-400 font-mono text-sm">{number}</span>
              <span>{renderInlineFormatting(content)}</span>
            </div>
          );
        }
      }
      // Check if line is a header (starts with **)
      else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
        const headerText = line.trim().slice(2, -2);
        elements.push(
          <div key={lineIndex} className="font-semibold text-white mb-2 mt-3">
            {headerText}
          </div>
        );
      }
      // Regular line with potential inline formatting
      else {
        elements.push(
          <div key={lineIndex} className="mb-1">
            {renderInlineFormatting(line)}
          </div>
        );
      }
      
      return elements;
    }).flat();
  };
  
  // Function to handle inline formatting like **bold**, links, etc.
  const renderInlineFormatting = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Handle **bold** text
    const boldRegex = /\*\*(.*?)\*\*/g;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const beforeText = text.slice(currentIndex, match.index);
        parts.push(renderLinks(beforeText, parts.length));
      }
      
      // Add bold text
      parts.push(
        <strong key={parts.length} className="font-semibold text-white">
          {match[1]}
        </strong>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      const remainingText = text.slice(currentIndex);
      parts.push(renderLinks(remainingText, parts.length));
    }
    
    return parts.length > 0 ? parts : renderLinks(text, 0);
  };
  
  // Function to handle links
  const renderLinks = (text: string, keyBase: number) => {
    const linkRegex = /🔗\s*\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before the link
      if (match.index > currentIndex) {
        parts.push(text.slice(currentIndex, match.index));
      }
      
      // Add the link
      parts.push(
        <a
          key={`${keyBase}-link-${parts.length}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          🔗 {match[1]}
        </a>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.slice(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };
  
  return (
    <div className="space-y-1">
      {renderFormattedText(content)}
    </div>
  );
}