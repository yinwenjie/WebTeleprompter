import type { Settings } from '@/core/models/settings';
import { notImplemented } from '@/core/not-implemented';
import type { SettingsRepository } from '@/core/ports/repositories';

export class LocalSettingsRepository implements SettingsRepository {
  load(): Settings {
    return notImplemented('LocalSettingsRepository.load');
  }

  save(_settings: Settings): void {
    notImplemented('LocalSettingsRepository.save');
  }
}
