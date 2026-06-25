// src/ai.js
const { Body } = Matter;

export class EnemyAI {
    constructor(character, target) {
        this.character = character;
        this.target = target;
        this.state = 'IDLE';
        this.lastActionTime = 0;
        this.decisionInterval = 500; // ms

        this.input = {
            left: false,
            right: false,
            up: false,
            attack: false
        };
    }

    update() {
        const now = Date.now();
        if (now - this.lastActionTime > this.decisionInterval) {
            this.decide();
            this.lastActionTime = now;
        }

        this.character.update(this.input);
    }

    decide() {
        const dx = this.target.torso.position.x - this.character.torso.position.x;
        const dy = this.target.torso.position.y - this.character.torso.position.y;
        const distance = Math.abs(dx);

        this.input.left = false;
        this.input.right = false;
        this.input.attack = false;
        this.input.up = false;

        if (distance > 150) {
            this.state = 'APPROACH';
            if (dx > 0) this.input.right = true;
            else this.input.left = true;
        } else if (distance < 50) {
            this.state = 'RETREAT';
            if (dx > 0) this.input.left = true;
            else this.input.right = true;
            this.input.attack = true;
        } else {
            this.state = 'ATTACK';
            this.input.attack = true;
            // Occasional jump
            if (Math.random() > 0.8) this.input.up = true;
        }

        // Difficulty adjustment (random delay/hesitation)
        if (Math.random() > 0.9) {
            this.input.left = false;
            this.input.right = false;
            this.input.attack = false;
        }
    }
}
