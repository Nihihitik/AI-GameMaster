import CurvedLoop from './CurvedLoop';

interface GapTapeProps {
  direction?: 'left' | 'right';
  speed?: number;
  curveAmount?: number;
  /** Текст маркизы между секциями. По умолчанию DEAL CORNER × */
  text?: string;
  /** Наклон полосы в градусах. Дефолт 0 — прямо. */
  tilt?: number;
  /** Дополнительный класс / variant — например `landing-gap-tape--hero` */
  variant?: string;
}

/**
 * Декоративная полоса с outlined DEAL CORNER текстом по кривой.
 * Используется как hero-оверлей или как полоса между секциями (в промежутках).
 */
export default function GapTape({
  direction = 'left',
  speed = 0.5,
  curveAmount = 140,
  text = 'DEAL CORNER × ',
  tilt = 0,
  variant,
}: GapTapeProps) {
  const className = `landing-gap-tape${variant ? ` ${variant}` : ''}`;
  return (
    <div
      className={className}
      aria-hidden="true"
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      <CurvedLoop
        marqueeText={text}
        speed={speed}
        curveAmount={curveAmount}
        direction={direction}
        interactive={false}
        className="curved-loop-text--outline"
      />
    </div>
  );
}
