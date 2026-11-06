declare module "d3-force-3d" {
  interface PositionForce<N> {
    (alpha: number): void;
    strength(s: number | ((n: N) => number)): PositionForce<N>;
  }
  export function forceX<N>(x: number | ((n: N) => number)): PositionForce<N>;
  export function forceY<N>(y: number | ((n: N) => number)): PositionForce<N>;
}
