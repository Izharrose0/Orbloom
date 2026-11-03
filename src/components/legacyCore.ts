import { orbVertexShader, orbFragmentShader } from '../shaders/legacyOrbShader';
import { U } from '../systems/organism';

/** Material props for the pre-2.0 look (dev comparison only). */
export const legacyCoreMaterialProps = {
  uniforms: U,
  vertexShader: orbVertexShader,
  fragmentShader: orbFragmentShader,
};
