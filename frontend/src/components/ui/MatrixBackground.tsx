import React, { useMemo } from 'react';
import './MatrixBackground.scss';

// Set of characters to use for the matrix (MAFIA KILL + special symbols)
const CHARS = 'MAFIAKILL刀刁ރ';

export default function MatrixBackground() {
  // Generate a fixed number of spans for the grid
  // We need enough to cover a 1920x1080 screen with 40px grid cells (approx 48x27 = 1296)
  const spans = useMemo(() => {
    return Array.from({ length: 1500 }).map((_, i) => {
      const char = CHARS[Math.floor(Math.random() * CHARS.length)];
      return <span key={i}>{char}</span>;
    });
  }, []);

  return (
    <div className="jp-matrix-container">
      <div className="jp-matrix">
        {spans}
      </div>
    </div>
  );
}
