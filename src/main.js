// src/main.js
import { PhysicsEngine } from './physics.js';
import { Character } from './character.js';
import { InputHandler } from './input.js';
import { CombatSystem } from './combat.js';
import { EnemyAI } from './ai.js';
import { EffectsManager } from './effects.js';
import { AudioManager } from './audio.js';

const { Bodies, World, Composite } = Matter;

const CHARACTER_CLASSES = {
    striker: { color: '#00f2ff', name: 'STRIKER', health: 100, speed: 1.0, attack: 1.0, weaponType: 'sword' },
    tank: { color: '#ff7b00', name: 'TANK', health: 150, speed: 0.7, attack: 1.5, weaponType: 'staff' },
    assassin: { color: '#ff00ea', name: 'ASSASSIN', health: 80, speed: 1.4, attack: 1.2, weaponType: 'sword' }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.state = 'MENU';

        this.physics = new PhysicsEngine();
        this.input = new InputHandler();
        this.effects = new EffectsManager(this.canvas, this.ctx);
        this.audio = new AudioManager();
        this.combat = new CombatSystem(this.physics.engine, this.effects);
        this.combat.audio = this.audio;

        this.player = null;
        this.enemy = null;
        this.enemyAI = null;
        this.selectedClass = 'striker';
        this.timer = 99;
        this.lastTime = 0;

        this.initUI();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.loop(0);
    }

    initUI() {
        const btns = ['to-select-btn', 'start-game-btn', 'back-to-menu-from-sel-btn', 'restart-btn', 'back-to-menu-btn', 'settings-btn', 'settings-back-btn'];
        btns.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('mouseenter', () => this.audio.playClick());
            }
        });

        document.getElementById('to-select-btn').onclick = () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('char-selection').classList.remove('hidden');
        };

        document.getElementById('back-to-menu-from-sel-btn').onclick = () => {
            document.getElementById('char-selection').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        };

        document.querySelectorAll('.char-card').forEach(card => {
            card.onclick = () => {
                this.audio.playClick();
                document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedClass = card.dataset.class;
            };
        });

        document.getElementById('start-game-btn').onclick = () => {
            document.getElementById('char-selection').classList.add('hidden');
            this.startGame();
        };

        document.getElementById('restart-btn').onclick = () => this.startGame();
        document.getElementById('back-to-menu-btn').onclick = () => this.showMenu();

        document.getElementById('settings-btn').onclick = () => {
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('settings-panel').classList.remove('hidden');
        };

        document.getElementById('settings-back-btn').onclick = () => {
            document.getElementById('settings-panel').classList.add('hidden');
            document.getElementById('main-menu').classList.remove('hidden');
        };

        const timeInput = document.getElementById('match-time-input');
        timeInput.oninput = (e) => {
            document.getElementById('time-val').textContent = e.target.value + 's';
        };
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startGame() {
        const difficulty = parseFloat(document.getElementById('ai-difficulty').value);
        const matchTime = parseInt(document.getElementById('match-time-input').value);

        // Clear previous world
        World.clear(this.physics.world);

        // Arena Setup
        const ground = Bodies.rectangle(this.canvas.width / 2, this.canvas.height - 20, this.canvas.width, 40, { isStatic: true, label: 'ground' });
        const wallL = Bodies.rectangle(10, this.canvas.height / 2, 20, this.canvas.height, { isStatic: true });
        const wallR = Bodies.rectangle(this.canvas.width - 10, this.canvas.height / 2, 20, this.canvas.height, { isStatic: true });

        // Hazard: Lava Pit in center
        const lava = Bodies.rectangle(this.canvas.width / 2, this.canvas.height - 10, 300, 20, {
            isStatic: true,
            isSensor: true,
            label: 'lava'
        });

        // Hazard: Spikes on platforms
        const plat1 = Bodies.rectangle(300, this.canvas.height - 150, 200, 20, { isStatic: true, label: 'ground' });
        const spikes1 = Bodies.rectangle(300, this.canvas.height - 165, 180, 10, { isStatic: true, isSensor: true, label: 'spikes' });

        const plat2 = Bodies.rectangle(this.canvas.width - 300, this.canvas.height - 150, 200, 20, { isStatic: true, label: 'ground' });
        const spikes2 = Bodies.rectangle(this.canvas.width - 300, this.canvas.height - 165, 180, 10, { isStatic: true, isSensor: true, label: 'spikes' });

        this.physics.add([ground, wallL, wallR, lava, plat1, spikes1, plat2, spikes2]);

        // Players
        const p1Config = CHARACTER_CLASSES[this.selectedClass];
        const p2Class = Object.keys(CHARACTER_CLASSES)[Math.floor(Math.random() * 3)];
        const p2Config = { ...CHARACTER_CLASSES[p2Class], color: '#ff3e3e' };

        this.player = new Character(300, this.canvas.height - 100, p1Config, true);
        this.enemy = new Character(this.canvas.width - 300, this.canvas.height - 100, p2Config);

        this.physics.add(this.player.composite);
        this.physics.add(this.enemy.composite);

        this.player.owner = this;
        this.enemy.owner = this;

        this.enemyAI = new EnemyAI(this.enemy, this.player);
        this.enemyAI.decisionInterval = difficulty * 1000;

        // Add weapon trails
        this.effects.trails = [];
        this.effects.addTrail(this.player.weapon, 'rgba(0, 242, 255, 0.5)');
        this.effects.addTrail(this.enemy.weapon, 'rgba(255, 62, 62, 0.5)');

        this.state = 'PLAYING';
        this.timer = matchTime;

        document.getElementById('main-menu').classList.add('hidden');
        document.getElementById('results-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
    }

    showMenu() {
        this.state = 'MENU';
        document.getElementById('main-menu').classList.remove('hidden');
        document.getElementById('results-screen').classList.add('hidden');
        document.getElementById('hud').classList.add('hidden');
    }

    endGame(winner) {
        this.state = 'RESULTS';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('results-screen').classList.remove('hidden');
        document.getElementById('winner-text').textContent = winner + " WINS";
    }

    update(delta) {
        if (this.state !== 'PLAYING') return;

        this.physics.update(delta);
        this.player.update(this.input.state);
        this.enemyAI.update();
        this.effects.update();

        // Update HUD
        document.getElementById('p1-health').style.width = (this.player.health / this.player.maxHealth * 100) + '%';
        document.getElementById('p2-health').style.width = (this.enemy.health / this.enemy.maxHealth * 100) + '%';
        document.getElementById('p1-energy').style.width = (this.player.energy / this.player.maxEnergy * 100) + '%';
        document.getElementById('p2-energy').style.width = (this.enemy.energy / this.enemy.maxEnergy * 100) + '%';

        this.timer -= delta / 1000;
        document.getElementById('match-timer').textContent = Math.ceil(this.timer);

        if (this.player.health <= 0) this.endGame('AI OVERLORD');
        if (this.enemy.health <= 0) this.endGame('PLAYER 1');
        if (this.timer <= 0) this.endGame('TIME UP');
    }

    draw() {
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Lava
        this.ctx.fillStyle = '#ff4500';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#ff4500';
        this.ctx.fillRect(this.canvas.width / 2 - 150, this.canvas.height - 20, 300, 20);
        this.ctx.shadowBlur = 0;

        // Draw background grid
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.canvas.width; i += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.canvas.height); this.ctx.stroke();
        }
        for (let i = 0; i < this.canvas.height; i += 50) {
            this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(this.canvas.width, i); this.ctx.stroke();
        }

        this.effects.preDraw();

        if (this.state === 'PLAYING') {
            this.player.draw(this.ctx);
            this.enemy.draw(this.ctx);
        }

        this.effects.postDraw();
    }

    loop(time) {
        const delta = time - this.lastTime;
        this.lastTime = time;

        this.update(delta);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}

new Game();
