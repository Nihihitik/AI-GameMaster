import React from 'react';
import './Loader.scss';

interface LoaderProps {
  size?: number;
}

export default function Loader({ size = 40 }: LoaderProps) {
  return (
    <div className="loading" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <polyline
          id="back"
          points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"
        />
        <polyline
          id="front"
          points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"
        />
      </svg>
    </div>
  );
}
