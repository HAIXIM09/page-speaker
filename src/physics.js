// src/physics.js
const { Engine, Render, Runner, World, Bodies, Body, Constraint, Composite, Events } = Matter;

export class PhysicsEngine {
    constructor() {
        this.engine = Engine.create({
            enableSleeping: false,
            gravity: { x: 0, y: 1 }
        });
        this.world = this.engine.world;
        this.runner = Runner.create();
    }

    start() {
        Runner.run(this.runner, this.engine);
    }

    update(delta) {
        Engine.update(this.engine, delta);
    }

    add(body) {
        World.add(this.world, body);
    }

    remove(body) {
        World.remove(this.world, body);
    }
}
