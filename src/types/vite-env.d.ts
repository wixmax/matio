/**
 * Vite environment typing for project-specific flags.
 * `vite/client` already declares ImportMetaEnv; interfaces merge.
 */
interface ImportMetaEnv {
  readonly VITE_FORCE_TOUCH_CONTROLS?: string;
}
