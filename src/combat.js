// src/combat.js
const { Events, Vector } = Matter;

export class CombatSystem {
    constructor(engine, effects) {
        this.engine = engine;
        this.effects = effects;
        this.damageThreshold = 5;
        this.setup();
    }

    setup() {
        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                this.handleCollision(pair.bodyA, pair.bodyB);
                this.handleHazards(pair.bodyA, pair.bodyB);
            });
        });

        Events.on(this.engine, 'collisionActive', (event) => {
            event.pairs.forEach((pair) => {
                this.handleHazards(pair.bodyA, pair.bodyB, true);
            });
        });
    }

    handleHazards(bodyA, bodyB, isActive = false) {
        const check = (a, b) => {
            if (a.label === 'lava' && b.owner) {
                this.applyDamage(b.owner, isActive ? 0.5 : 5);
                this.effects.createImpact(b.position.x, b.position.y, true);
            }
            if (a.label === 'spikes' && b.owner && !isActive) {
                this.applyDamage(b.owner, 15);
                this.effects.createImpact(b.position.x, b.position.y, true);
                this.effects.shakeCamera(5);
            }
        };
        check(bodyA, bodyB);
        check(bodyB, bodyA);
    }

    handleCollision(bodyA, bodyB) {
        if (!bodyA.owner || !bodyB.owner) return;
        if (bodyA.owner === bodyB.owner) return;

        const charA = bodyA.owner;
        const charB = bodyB.owner;

        // Calculate impact velocity
        const relativeVelocity = Vector.magnitude(Vector.sub(bodyA.velocity, bodyB.velocity));

        if (relativeVelocity > this.damageThreshold) {
            const damage = Math.floor((relativeVelocity - this.damageThreshold) * 1.5);
            if (damage <= 0) return;

            // Define "vulnerable" parts
            const isVulnerable = (body) => body.label === 'head' || body.label === 'torso';

            let victim = null;
            let isHeadHit = false;

            if (isVulnerable(bodyA) && !isVulnerable(bodyB)) {
                victim = charA;
                isHeadHit = bodyA.label === 'head';
            } else if (isVulnerable(bodyB) && !isVulnerable(bodyA)) {
                victim = charB;
                isHeadHit = bodyB.label === 'head';
            } else if (isVulnerable(bodyA) && isVulnerable(bodyB)) {
                this.applyDamage(charA, damage, charB);
                this.applyDamage(charB, damage, charA);
                return;
            }

            if (victim) {
                const finalDamage = isHeadHit ? damage * 2 : damage;
                this.applyDamage(victim, finalDamage, victim === charA ? charB : charA);
                this.effects.createImpact(bodyA.position.x, bodyA.position.y, isHeadHit);
                this.effects.shakeCamera(damage / 2);
            }
        }
    }

    applyDamage(character, amount, attacker) {
        character.health -= amount;
        if (character.health < 0) character.health = 0;

        // Build energy on hit
        if (attacker) {
            attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + amount * 0.5);
        }
    }
}
