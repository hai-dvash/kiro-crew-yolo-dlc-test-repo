// T10 [F2] — post-processing pipeline (R2.2).
// EffectComposer: tonemap (in renderer) + bloom + SSAO, each togglable per tier.
import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SSAOEffect,
  BlendFunction,
} from 'postprocessing';
import { QualityTier } from './../config';

export interface PostPipeline {
  composer: EffectComposer;
  setBloom(on: boolean): void;
  setSSAO(on: boolean): void;
  applyTier(tier: QualityTier): void;
  render(): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): PostPipeline {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new BloomEffect({ intensity: 0.9, luminanceThreshold: 0.6, mipmapBlur: true });
  const ssao = new SSAOEffect(camera, undefined as unknown as THREE.Texture, {
    blendFunction: BlendFunction.MULTIPLY,
    samples: 16,
    radius: 0.1,
    intensity: 1.2,
  });

  bloom.blendMode.opacity.value = 1;
  ssao.blendMode.opacity.value = 1;

  // Single EffectPass hosts both; we toggle via blend opacity so no teardown is needed.
  const effectPass = new EffectPass(camera, ssao, bloom);
  composer.addPass(effectPass);

  const setBloom = (on: boolean) => (bloom.blendMode.opacity.value = on ? 1 : 0);
  const setSSAO = (on: boolean) => (ssao.blendMode.opacity.value = on ? 1 : 0);

  function applyTier(tier: QualityTier): void {
    switch (tier) {
      case QualityTier.High:
        setBloom(true);
        setSSAO(true);
        break;
      case QualityTier.Mid:
        setBloom(true);
        setSSAO(false); // NFR4: drop SSAO to hold >=50fps
        break;
      case QualityTier.Low:
        setBloom(false);
        setSSAO(false);
        break;
    }
  }

  return {
    composer,
    setBloom,
    setSSAO,
    applyTier,
    render: () => composer.render(),
    resize: (w, h) => composer.setSize(w, h),
    dispose: () => composer.dispose(),
  };
}
