import { ControlBar } from './overlays/ControlBar';
import { StatusAnnouncer } from './overlays/StatusAnnouncer';
import { Stage } from './Stage';

/** 提词模式的页面。控件在舞台之外，所以不受镜像影响。规格见 docs/dev/modules/ui-prompter.md */
export function PrompterView() {
  return (
    <>
      <Stage />
      <ControlBar />
      <StatusAnnouncer />
    </>
  );
}
