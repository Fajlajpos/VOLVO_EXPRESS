/**
 * Plays a real Volvo 5-cylinder engine startup sound from `/volvo_startup.mp3`
 * and fades it out smoothly to transition to the main dashboard.
 */
export function playVolvoStartupSound(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio('/volvo_startup.mp3');
      audio.volume = 0.8;

      audio.play().then(() => {
        // Start fading out the sound after 3.8 seconds
        setTimeout(() => {
          let vol = 0.8;
          const fadeInterval = setInterval(() => {
            if (vol > 0.05) {
              vol -= 0.05;
              audio.volume = Math.max(0, vol);
            } else {
              clearInterval(fadeInterval);
              audio.pause();
              audio.currentTime = 0; // reset play head
              resolve();
            }
          }, 75); // ~16 steps * 75ms = 1.2s total fade-out duration
        }, 3800);
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
