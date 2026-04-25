import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import './CelestialOracleRive.css';

/**
 * CelestialOracleRive: A Rive-powered version of the Oracles.
 * These are designed to be "Personified Murals" that exist in the 3D void.
 */
export default function CelestialOracleRive({ 
  src = 'https://cdn.rive.app/animations/vehicles.riv', // Placeholder
  stateMachine = 'bumpy',
  name = 'Urban Oracle'
}) {
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachine,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    autoplay: true,
  });

  return (
    <div className="oracle-rive-wrapper">
      <div className="oracle-rive-glow" />
      <div className="oracle-rive-content">
        <RiveComponent />
      </div>
      <div className="oracle-rive-label">
        <div className="oracle-label-line" />
        <span className="oracle-label-text">{name}</span>
      </div>
    </div>
  );
}
