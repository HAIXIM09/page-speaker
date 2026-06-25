// src/input.js
export class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            space: false,
            attack: false
        };

        this.init();
    }

    init() {
        window.addEventListener('keydown', (e) => this.handleKey(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKey(e.code, false));

        // Touch support
        window.addEventListener('touchstart', (e) => this.handleTouch(e, true), { passive: false });
        window.addEventListener('touchend', (e) => this.handleTouch(e, false), { passive: false });

        // Mouse support (click to attack)
        window.addEventListener('mousedown', () => this.keys.attack = true);
        window.addEventListener('mouseup', () => this.keys.attack = false);
    }

    handleKey(code, isPressed) {
        switch (code) {
            case 'ArrowLeft':
            case 'KeyA':
                this.keys.left = isPressed;
                break;
            case 'ArrowRight':
            case 'KeyD':
                this.keys.right = isPressed;
                break;
            case 'ArrowUp':
            case 'KeyW':
                this.keys.up = isPressed;
                break;
            case 'ArrowDown':
            case 'KeyS':
                this.keys.down = isPressed;
                break;
            case 'Space':
                this.keys.space = isPressed;
                this.keys.attack = isPressed;
                break;
        }
    }

    handleTouch(e, isPressed) {
        // Simple touch logic: left half moves left, right half moves right, top half jumps
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            const width = window.innerWidth;
            const height = window.innerHeight;

            if (x < width / 3) this.keys.left = isPressed;
            else if (x > (width / 3) * 2) this.keys.right = isPressed;
            else this.keys.attack = isPressed;

            if (y < height / 3) this.keys.up = isPressed;
        } else if (!isPressed) {
            this.keys.left = false;
            this.keys.right = false;
            this.keys.up = false;
            this.keys.attack = false;
        }
    }

    get state() {
        return { ...this.keys };
    }
}
