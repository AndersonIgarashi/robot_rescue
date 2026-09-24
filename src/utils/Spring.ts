/** Damped spring (semi-implicit Euler) for punchy squash/stretch and scale pops. */
export class Spring {
  value = 0;
  velocity = 0;

  constructor(
    public stiffness = 180,
    public damping = 12,
  ) {}

  impulse(velocity: number): void {
    this.velocity += velocity;
  }

  update(dt: number, target = 0): number {
    const force = -this.stiffness * (this.value - target) - this.damping * this.velocity;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  reset(): void {
    this.value = 0;
    this.velocity = 0;
  }
}
