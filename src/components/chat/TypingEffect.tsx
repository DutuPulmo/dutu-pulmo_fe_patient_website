import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface TypingEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export const TypingEffect: React.FC<TypingEffectProps> = ({
  text,
  speed = 20,
  onComplete,
  className,
}) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
      setDisplayedText('');
  
      const safeText = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
      const chars = Array.from(safeText);
  
      let index = 0;
  
      const timer = setInterval(() => {
        if (index < chars.length) {
          const char = chars[index] ?? '';
          setDisplayedText((prev) => prev + char);
          index++;
        } else {
          clearInterval(timer);
          onComplete?.();
        }
      }, speed);
  
      return () => clearInterval(timer);
    }, [text, speed]);

  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2" {...props} />,
          li: ({node, ...props}) => <li className="mb-1" {...props} />,
          strong: ({node, ...props}) => <strong className="font-semibold text-current" {...props} />,
          em: ({node, ...props}) => <em className="italic" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-500 hover:underline" {...props} />,
        }}
      >
        {displayedText}
      </ReactMarkdown>
    </div>
  );
};