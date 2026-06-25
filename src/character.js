// src/character.js
const { Bodies, Body, Constraint, Composite } = Matter;

export class Character {
    constructor(x, y, config, isPlayer = false) {
        this.config = config || {
            color: '#00f2ff',
            name: 'CHAMPION',
            health: 100,
            speed: 1.0,
            attack: 1.0
        };
        this.color = this.config.color;
        this.isPlayer = isPlayer;
        this.composite = Composite.create();
        this.health = this.config.health;
        this.maxHealth = this.config.health;
        this.energy = 0;
        this.maxEnergy = 100;
        this.stamina = 100;

        // Parts dimensions
        const headRadius = 12;
        const torsoWidth = 20;
        const torsoHeight = 45;
        const limbWidth = 8;
        const limbHeight = 25;

        // Collision groups (prevent self-collision)
        const group = Body.nextGroup(true);

        // Bodies
        this.head = Bodies.circle(x, y - 60, headRadius, {
            collisionFilter: { group },
            friction: 0.3,
            restitution: 0.1,
            label: 'head'
        });

        this.torso = Bodies.rectangle(x, y - 25, torsoWidth, torsoHeight, {
            collisionFilter: { group },
            chamfer: { radius: 5 },
            label: 'torso'
        });

        // Limbs (upper and lower)
        this.armL1 = Bodies.rectangle(x - 15, y - 40, limbWidth, limbHeight, { collisionFilter: { group } });
        this.armL2 = Bodies.rectangle(x - 15, y - 15, limbWidth, limbHeight, { collisionFilter: { group } });
        this.armR1 = Bodies.rectangle(x + 15, y - 40, limbWidth, limbHeight, { collisionFilter: { group } });
        this.armR2 = Bodies.rectangle(x + 15, y - 15, limbWidth, limbHeight, { collisionFilter: { group } });

        this.legL1 = Bodies.rectangle(x - 8, y + 10, limbWidth, limbHeight, { collisionFilter: { group } });
        this.legL2 = Bodies.rectangle(x - 8, y + 35, limbWidth, limbHeight, { collisionFilter: { group } });
        this.legR1 = Bodies.rectangle(x + 8, y + 10, limbWidth, limbHeight, { collisionFilter: { group } });
        this.legR2 = Bodies.rectangle(x + 8, y + 35, limbWidth, limbHeight, { collisionFilter: { group } });

        // Weapon (Sword or Staff)
        const isStaff = this.config.weaponType === 'staff';
        const weaponWidth = isStaff ? 6 : 6;
        const weaponHeight = isStaff ? 80 : 40;

        this.weapon = Bodies.rectangle(x + 30, y - 15, weaponWidth, weaponHeight, {
            collisionFilter: { group },
            chamfer: { radius: 2 },
            label: 'weapon',
            density: isStaff ? 0.005 : 0.01
        });

        const wristR = Constraint.create({
            bodyA: this.armR2, bodyB: this.weapon,
            pointA: { x: 0, y: limbHeight/2 }, pointB: { x: 0, y: isStaff ? 0 : limbHeight/2 },
            stiffness: 0.9, length: 2
        });

        // Constraints (Joints)
        const stiffness = 0.8;
        const neck = Constraint.create({
            bodyA: this.head, bodyB: this.torso,
            pointA: { x: 0, y: headRadius }, pointB: { x: 0, y: -torsoHeight/2 },
            stiffness, length: 2
        });

        // Left Arm
        const shoulderL = Constraint.create({
            bodyA: this.torso, bodyB: this.armL1,
            pointA: { x: -torsoWidth/2, y: -torsoHeight/2 + 5 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });
        const elbowL = Constraint.create({
            bodyA: this.armL1, bodyB: this.armL2,
            pointA: { x: 0, y: limbHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });

        // Right Arm
        const shoulderR = Constraint.create({
            bodyA: this.torso, bodyB: this.armR1,
            pointA: { x: torsoWidth/2, y: -torsoHeight/2 + 5 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });
        const elbowR = Constraint.create({
            bodyA: this.armR1, bodyB: this.armR2,
            pointA: { x: 0, y: limbHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });

        // Left Leg
        const hipL = Constraint.create({
            bodyA: this.torso, bodyB: this.legL1,
            pointA: { x: -5, y: torsoHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });
        const kneeL = Constraint.create({
            bodyA: this.legL1, bodyB: this.legL2,
            pointA: { x: 0, y: limbHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });

        // Right Leg
        const hipR = Constraint.create({
            bodyA: this.torso, bodyB: this.legR1,
            pointA: { x: 5, y: torsoHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });
        const kneeR = Constraint.create({
            bodyA: this.legR1, bodyB: this.legR2,
            pointA: { x: 0, y: limbHeight/2 }, pointB: { x: 0, y: -limbHeight/2 },
            stiffness, length: 2
        });

        Composite.add(this.composite, [
            this.head, this.torso,
            this.armL1, this.armL2, this.armR1, this.armR2,
            this.legL1, this.legL2, this.legR1, this.legR2,
            this.weapon,
            neck, shoulderL, elbowL, shoulderR, elbowR, hipL, kneeL, hipR, kneeR,
            wristR
        ]);

        this.parts = [this.head, this.torso, this.armL1, this.armL2, this.armR1, this.armR2, this.legL1, this.legL2, this.legR1, this.legR2, this.weapon];
        this.parts.forEach(p => p.owner = this);

        this.walkCycle = 0;
        this.isMoving = false;
        this.lookDir = 1;
        this.wasAttacking = false;
    }

    update(input) {
        this.isMoving = false;
        const moveSpeed = 0.005 * (this.config.speed || 1.0);
        const jumpForce = 0.15;

        // Keep upright (Balance)
        const targetAngle = 0;
        const currentAngle = this.torso.angle;
        const angleDiff = targetAngle - currentAngle;
        Body.setAngularVelocity(this.torso, angleDiff * 0.1);

        if (input.left) {
            Body.applyForce(this.torso, this.torso.position, { x: -moveSpeed, y: 0 });
            this.isMoving = true;
            this.lookDir = -1;
        }
        if (input.right) {
            Body.applyForce(this.torso, this.torso.position, { x: moveSpeed, y: 0 });
            this.isMoving = true;
            this.lookDir = 1;
        }
        if (input.up && Math.abs(this.torso.velocity.y) < 0.1) {
            Body.applyForce(this.torso, this.torso.position, { x: 0, y: -jumpForce });
        }

        // Ultimate Ability
        if (input.space && this.energy >= 100) {
            this.energy = 0;
            const dashForce = 0.8;
            Body.applyForce(this.torso, this.torso.position, {
                x: dashForce * this.lookDir,
                y: -dashForce * 0.5
            });
            if (this.owner && this.owner.effects) {
                this.owner.effects.createImpact(this.torso.position.x, this.torso.position.y, true);
                this.owner.effects.shakeCamera(10);
            }
            if (this.owner && this.owner.audio) {
                this.owner.audio.playUltimate();
            }
        }

        // Procedural Walking
        if (this.isMoving) {
            this.walkCycle += 0.2;
            const legOffset = Math.sin(this.walkCycle) * 15;
            Body.setPosition(this.legL2, {
                x: this.legL1.position.x + legOffset,
                y: this.legL2.position.y
            });
            Body.setPosition(this.legR2, {
                x: this.legR1.position.x - legOffset,
                y: this.legR2.position.y
            });
        } else {
            this.walkCycle = 0;
        }

        // Attack logic
        if (input.attack) {
            if (!this.wasAttacking) {
                if (this.owner && this.owner.audio) this.owner.audio.playSwing();
            }
            this.wasAttacking = true;
            const attackForce = 0.05 * (this.config.attack || 1.0);
            Body.applyForce(this.weapon, this.weapon.position, {
                x: attackForce * this.lookDir,
                y: -attackForce
            });
            Body.setAngularVelocity(this.weapon, 0.2 * this.lookDir);
        } else {
            this.wasAttacking = false;
        }

        // Procedural Arm Movement
        const armIdleY = Math.sin(Date.now() * 0.005) * 5;
        if (!input.attack) {
            Body.applyForce(this.armR2, this.armR2.position, { x: 0.001 * this.lookDir, y: 0.0001 * armIdleY });
        }
        Body.applyForce(this.armL2, this.armL2.position, { x: -0.001 * this.lookDir, y: 0.0001 * armIdleY });
    }

    draw(ctx) {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.fillStyle = this.color;

        // Draw connections
        this.composite.constraints.forEach(c => {
            const posA = c.bodyA ? { x: c.bodyA.position.x + c.pointA.x, y: c.bodyA.position.y + c.pointA.y } : c.pointA;
            const posB = c.bodyB ? { x: c.bodyB.position.x + c.pointB.x, y: c.bodyB.position.y + c.pointB.y } : c.pointB;

            ctx.beginPath();
            ctx.moveTo(posA.x, posA.y);
            ctx.lineTo(posB.x, posB.y);
            ctx.stroke();
        });

        // Draw head
        ctx.beginPath();
        ctx.arc(this.head.position.x, this.head.position.y, 12, 0, Math.PI * 2);
        ctx.fill();

        // Draw Energy Glow if full
        if (this.energy >= 100) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
            ctx.beginPath();
            ctx.arc(this.head.position.x, this.head.position.y, 14, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }
}
