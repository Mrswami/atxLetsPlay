import './Loading.css';

export default function Loading() {
  return (
    <div className="loading-container">
      <video
        className="loading-video"
        src="/assets/loadingScreen.mp4"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="loading-overlay">
        <p className="loading-text">LOADING...</p>
      </div>
    </div>
  );
}
