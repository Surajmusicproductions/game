// audio.js - Handles the game's background music

// Wait until the entire HTML page is loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Find the necessary elements on the page
    const backgroundMusic = document.getElementById('background-music');
    const startButton = document.getElementById('start-button');
    const uiOverlay = document.getElementById('ui-overlay');

    // Make sure all elements were found before adding listeners
    if (backgroundMusic && startButton && uiOverlay) {

        // When the start button is clicked, play the music
        startButton.addEventListener('click', () => {
            // .play() can sometimes be blocked by the browser, so we catch potential errors
            backgroundMusic.play().catch(error => {
                console.error("Audio playback failed:", error);
            });
        });

        // The game's main script shows the 'ui-overlay' div on game over.
        // We can watch for that change to know when to stop the music.
        const observer = new MutationObserver(() => {
            // If the overlay is visible (doesn't have the 'hidden' class), the game is over.
            if (!uiOverlay.classList.contains('hidden')) {
                backgroundMusic.pause();
                backgroundMusic.currentTime = 0; // Rewind the music to the beginning
            }
        });

        // Tell the observer to watch for changes to the 'class' attribute of the overlay
        observer.observe(uiOverlay, { attributes: true });

    } else {
        console.error('Audio script could not find required HTML elements.');
    }
});
