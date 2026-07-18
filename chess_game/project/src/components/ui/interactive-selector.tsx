import React, { useState, useEffect } from 'react';

// Adapted from the "interactive selector" placard component for this
// Vite + React + Tailwind project: converted to TypeScript, made generic
// (options passed as props, controlled activeIndex), replaced Next.js
// styled-jsx with a plain <style> tag, and swapped remote photos for
// gradients + a decorative glyph so it works offline.

export interface SelectorOption {
  title: string;
  description: string;
  gradient: string;   // CSS background-image value
  glyph?: string;     // large decorative character (e.g. a chess piece)
  icon: React.ReactNode;
}

interface InteractiveSelectorProps {
  options: SelectorOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  height?: number;
}

const InteractiveSelector: React.FC<InteractiveSelectorProps> = ({
  options, activeIndex, onSelect, height = 320,
}) => {
  const [animatedOptions, setAnimatedOptions] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    options.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setAnimatedOptions(prev => [...prev, i]);
      }, 90 * i));
    });
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, [options.length]);

  return (
    <div className="relative w-full font-sans text-white">
      <div
        className="options flex w-full items-stretch overflow-hidden relative rounded-xl"
        style={{ height }}
      >
        {options.map((option, index) => {
          const active = activeIndex === index;
          return (
            <div
              key={option.title}
              className="option relative flex flex-col justify-end overflow-hidden transition-all duration-700 ease-in-out"
              style={{
                backgroundImage: option.gradient,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backfaceVisibility: 'hidden',
                opacity: animatedOptions.includes(index) ? 1 : 0,
                transform: animatedOptions.includes(index) ? 'translateX(0)' : 'translateX(-60px)',
                minWidth: '52px',
                margin: 0,
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: active ? '#fff' : '#292929',
                cursor: 'pointer',
                backgroundColor: '#18181b',
                boxShadow: active
                  ? '0 20px 60px rgba(0,0,0,0.50)'
                  : '0 10px 30px rgba(0,0,0,0.30)',
                flex: active ? '7 1 0%' : '1 1 0%',
                zIndex: active ? 10 : 1,
                willChange: 'flex-grow, box-shadow',
              }}
              onClick={() => onSelect(index)}
            >
              {/* Decorative glyph */}
              {option.glyph && (
                <span
                  className="absolute pointer-events-none select-none transition-all duration-700"
                  style={{
                    fontSize: 150,
                    lineHeight: 1,
                    right: active ? 16 : -30,
                    top: 10,
                    opacity: active ? 0.22 : 0.10,
                    color: '#fff',
                  }}
                >
                  {option.glyph}
                </span>
              )}

              {/* Shadow effect */}
              <div
                className="absolute left-0 right-0 pointer-events-none transition-all duration-700 ease-in-out"
                style={{
                  bottom: active ? '0' : '-40px',
                  height: '120px',
                  boxShadow: active
                    ? 'inset 0 -120px 120px -120px #000, inset 0 -120px 120px -80px #000'
                    : 'inset 0 -120px 0px -120px #000, inset 0 -120px 0px -80px #000',
                }}
              />

              {/* Label with icon and info */}
              <div className="absolute left-0 right-0 bottom-4 flex items-center justify-start h-12 z-[2] pointer-events-none px-3 gap-3 w-full">
                <div className="min-w-[40px] max-w-[40px] h-[40px] flex items-center justify-center rounded-full bg-[rgba(32,32,32,0.85)] backdrop-blur-[10px] shadow-[0_1px_4px_rgba(0,0,0,0.18)] border-2 border-[#444] shrink-0 transition-all duration-200">
                  {option.icon}
                </div>
                <div className="text-white whitespace-pre relative">
                  <div
                    className="font-bold text-base transition-all duration-700 ease-in-out"
                    style={{
                      opacity: active ? 1 : 0,
                      transform: active ? 'translateX(0)' : 'translateX(25px)',
                    }}
                  >
                    {option.title}
                  </div>
                  <div
                    className="text-sm text-gray-300 transition-all duration-700 ease-in-out"
                    style={{
                      opacity: active ? 1 : 0,
                      transform: active ? 'translateX(0)' : 'translateX(25px)',
                    }}
                  >
                    {option.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideFadeIn {
          0% { opacity: 0; transform: translateX(-60px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default InteractiveSelector;
