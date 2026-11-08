// Scene id → lazy module. Each module default-exports a SceneFactory. Unbuilt stages fall back to the placeholder.
import type { SceneFactory } from './types.ts';
import { STAGES } from '../time/stages.ts';

type Loader = () => Promise<{ default: SceneFactory }>;

const BUILT: Record<string, Loader> = {
  _placeholder: () => import('./_placeholder/index.ts'),
  _lab: () => import('./_lab/index.ts'),
};

const stub = (id: string): Loader => async () => {
  const { makePlaceholder } = await import('./_placeholder/index.ts');
  const st = STAGES.find((s) => s.id === id);
  return { default: () => makePlaceholder({ id, status: st?.status }) };
};

export const SCENES: Record<string, Loader> = Object.fromEntries([
  ...STAGES.map((s) => [s.sceneId, BUILT[s.sceneId] ?? stub(s.sceneId)] as const),
  ...Object.entries(BUILT),
]);

export const SCENE_IDS = STAGES.map((s) => s.sceneId);
