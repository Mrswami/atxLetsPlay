import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import './RiveAvatar.css';

/**
 * RiveAvatar: A visionary, animated avatar component for ATX Let's Play.
 * 
 * @param {string} src - Path to the .riv file
 * @param {string} stateMachine - Name of the Rive state machine
 * @param {string} size - CSS size class (small, medium, large)
 */
export default function RiveAvatar({ 
  src = 'https://cdn.rive.app/animations/vehicles.riv', // Placeholder visionary asset
  stateMachine = 'bumpy', 
  size = 'large' 
}) {
  const { RiveComponent, rive } = useRive({
    src,
    stateMachines: stateMachine,
    layout: new Layout({
      fit: Fit.Cover,
      alignment: Alignment.Center,
    }),
    autoplay: true,
  });

  return (
    <div className={`rive-avatar-container rive-avatar--${size}`}>
      <div className="rive-avatar-glow"></div>
      <div className="rive-avatar-canvas-wrapper">
        <RiveComponent />
      </div>
    </div>
  );
}
