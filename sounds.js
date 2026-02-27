// Cyber Sound Effects - Using Real Audio Files

class CyberSounds {
    constructor() {
        console.log('Initializing CyberSounds...');
        
        // Load audio files from static folder
        this.bgMusic = new Audio('/static/bg_music.mp3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;
        
        this.accessGranted = new Audio('/static/access_granted.mp3');
        this.accessGranted.volume = 0.7;
        
        this.isPlaying = false;
        this.currentPhase = 'intro'; // intro, camera, success
        
        console.log('Audio sources:');
        console.log('- Background:', this.bgMusic.src);
        console.log('- Access Granted:', this.accessGranted.src);
        
        // Add load event listeners
        this.bgMusic.addEventListener('loadeddata', () => {
            console.log('✓ Background music loaded successfully');
        });
        
        this.bgMusic.addEventListener('error', (e) => {
            console.error('✗ Background music error:', e);
        });
        
        this.accessGranted.addEventListener('loadeddata', () => {
            console.log('✓ Access granted sound loaded successfully');
        });
        
        this.accessGranted.addEventListener('error', (e) => {
            console.error('✗ Access granted sound error:', e);
        });
    }

    // Start continuous ambient background music
    startAmbient() {
        console.log('startAmbient() called');
        if (!this.isPlaying) {
            console.log('Attempting to play background music...');
            this.currentPhase = 'intro';
            const playPromise = this.bgMusic.play();
            
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        console.log('✓ Background music is playing!');
                        this.isPlaying = true;
                    })
                    .catch(error => {
                        console.error('✗ Play failed:', error.name, error.message);
                    });
            }
        }
    }

    // Stop ambient background
    stopAmbient() {
        console.log('Stopping background music');
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
        this.isPlaying = false;
    }

    // Fade out background music (for camera screen)
    fadeOutBackground() {
        console.log('Fading out background music for camera');
        this.currentPhase = 'camera';
        if (this.isPlaying) {
            const fadeInterval = setInterval(() => {
                if (this.bgMusic.volume > 0.05) {
                    this.bgMusic.volume -= 0.05;
                } else {
                    this.bgMusic.pause();
                    this.isPlaying = false;
                    clearInterval(fadeInterval);
                    console.log('Background music stopped');
                }
            }, 100);
        }
    }

    // Simple beep (keep for UI feedback)
    beep(frequency = 1200, duration = 0.06) {
        // Minimal beep
    }

    // Scanning sound
    scanningSound() {
        console.log('Scanning sound');
    }

    // Processing sound
    processingSound() {
        console.log('Processing sound');
    }

    // Access granted - play success sound and stop background
    successSound() {
        console.log('Playing access granted sound...');
        this.currentPhase = 'success';
        
        // Stop background music first
        this.stopAmbient();
        
        // Play success sound
        this.accessGranted.currentTime = 0;
        const playPromise = this.accessGranted.play();
        
        if (playPromise !== undefined) {
            playPromise
                .then(() => console.log('✓ Access granted sound playing!'))
                .catch(e => console.error('✗ Access granted play failed:', e));
        }
    }

    // Error sound
    errorSound() {
        console.log('Error sound');
    }

    // Typing sound
    typeSound() {
        // Minimal
    }

    // Click sound
    clickSound() {
        // Minimal
    }

    // System startup - start background music
    startupSound() {
        console.log('Startup sound - starting ambient');
        setTimeout(() => {
            this.startAmbient();
        }, 100);
    }
}

// Create global sound instance
console.log('Creating CyberSounds instance...');
const cyberSounds = new CyberSounds();

// Try to enable audio on any user interaction
let audioStarted = false;
const startAudio = () => {
    if (!audioStarted) {
        console.log('User interaction detected - attempting to start audio');
        cyberSounds.startAmbient();
        audioStarted = true;
    }
};

document.addEventListener('click', startAudio);
document.addEventListener('keydown', startAudio);
document.addEventListener('touchstart', startAudio);
