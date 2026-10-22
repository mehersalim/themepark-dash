import { InjectionToken } from '@angular/core';
import { DEMO_MODE } from './config';

/** True in the demo build. A token (rather than the constant) so tests can switch it on. */
export const IS_DEMO = new InjectionToken<boolean>('IS_DEMO', { providedIn: 'root', factory: () => DEMO_MODE });
