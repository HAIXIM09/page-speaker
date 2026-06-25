// src/effects.js
export class EffectsManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.particles = [];
        this.shake = 0;
        this.glows = [];
        this.trails = [];
    }

    addTrail(body, color) {
        this.trails.push({
            body,
            color,
            points: [],
            maxPoints: 10
        });
    }

    createImpact(x, y, isCritical = false) {
        const count = isCritical ? 20 : 10;
        const color = isCritical ? '#ff0000' : '#ffffff';

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
                size: 2 + Math.random() * 3,
                color
            });
        }

        this.glows.push({ x, y, radius: isCritical ? 50 : 30, alpha: 0.8 });
    }

    shakeCamera(amount) {
        this.shake = Math.min(amount, 20);
    }

    update() {
        // Update trails
        this.trails.forEach(t => {
            t.points.unshift({ x: t.body.position.x, y: t.body.position.y });
            if (t.points.length > t.maxPoints) t.points.pop();
        });

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // gravity
            p.life -= p.decay;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Update camera shake
        if (this.shake > 0) {
            this.shake *= 0.9;
            if (this.shake < 0.1) this.shake = 0;
        }

        // Update glows
        for (let i = this.glows.length - 1; i >= 0; i--) {
            this.glows[i].alpha -= 0.05;
            if (this.glows[i].alpha <= 0) this.glows.splice(i, 1);
        }
    }

    preDraw() {
        this.ctx.save();
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * this.shake;
            const dy = (Math.random() - 0.5) * this.shake;
            this.ctx.translate(dx, dy);
        }
    }

    postDraw() {
        // Draw trails
        this.ctx.save();
        this.trails.forEach(t => {
            if (t.points.length < 2) return;
            this.ctx.beginPath();
            this.ctx.strokeStyle = t.color;
            this.ctx.lineWidth = 2;
            this.ctx.moveTo(t.points[0].x, t.points[0].y);
            for (let i = 1; i < t.points.length; i++) {
                this.ctx.globalAlpha = 1 - (i / t.maxPoints);
                this.ctx.lineTo(t.points[i].x, t.points[i].y);
            }
            this.ctx.stroke();
        });
        this.ctx.restore();

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw glows (Dynamic Lighting)
        this.ctx.globalCompositeOperation = 'screen';
        this.glows.forEach(g => {
            const grad = this.ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
            grad.addColorStop(0, `rgba(255, 255, 255, ${g.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalCompositeOperation = 'source-over';
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }
}
