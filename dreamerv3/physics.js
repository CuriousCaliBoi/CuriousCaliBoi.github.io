// CartPole's standard equations, with an additional zero-force option for the playground.
export function advance(state, direction, dt = 0.02) {
  const [x, velocity, angle, spin] = state;
  const c = Math.cos(angle), s = Math.sin(angle);
  const force = 10 * Math.sign(direction);
  const temp = (force + 0.05 * spin * spin * s) / 1.1;
  const acceleration = (9.8 * s - c * temp) / (0.5 * (4 / 3 - 0.1 * c * c / 1.1));
  const cartAcceleration = temp - 0.05 * acceleration * c / 1.1;
  return [x + dt * velocity, velocity + dt * cartAcceleration, angle + dt * spin, spin + dt * acceleration];
}
export function failed(state) { return Math.abs(state[0]) > 2.4 || Math.abs(state[2]) > 12 * Math.PI / 180; }
