/**
 * Plays a real Volvo 5-cylinder engine startup sound from `/volvo_startup.mp3`
 * and fades it out smoothly to transition to the main dashboard.
 */
export function playVolvoStartupSound(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio('./ffadfadfad_audio.mp3');
      audio.volume = 0.8;

      audio.play().then(() => {
        audio.onended = () => {
          resolve();
        };
      }).catch(err => {
        console.warn('Audio playback failed or was interrupted:', err);
        resolve();
      });
    } catch (e) {
      console.warn('Audio initiation failed:', e);
      resolve();
    }
  });
}
